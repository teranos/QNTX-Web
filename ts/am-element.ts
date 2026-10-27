/**
 * ≡ — what the node is, and what it was told to be.
 *
 * `am` is being: "am is the node, am is the server".
 * The node's build, the backends it was compiled against, the key it signs
 * with and the row its status line draws are all that: what the node is. They
 * sat on ⍟ because ⍟ was the only element there, and a person opening ⍟ to see
 * themselves read the node's build time first.
 *
 * The settings with their sources do not fit in a window, so they are ≡'s
 * panel and are opened from here.
 */

import { apiFetch } from './client';
import { apiJson } from './client/http';
import { AM } from './sym';
import { escapeHtml } from './html-utils';
import { log, SEG } from './logger.ts';
import { formatBuildTime } from './components/tooltip.ts';
import type { StatusItem } from './brow.ts';
import { a2aCardRow } from './a2a-card-element.ts';
import { nodeMCPOf, rootsClientElement, type CardMCP } from './connector-element.ts';
import { createNodeConnectorsElement } from './node-connectors-element.ts';
import { createStoriesElement } from './stories-element.ts';
import { buttonFrom } from '@teranos/elements';
import { person } from './self-person.ts';
import type { VersionMessage, SystemCapabilitiesMessage } from '../types/websocket';

// What the node has said about itself. Null is nothing asked yet, which draws
// no section rather than an empty one.
let amElement: HTMLElement | null = null;
let amVersion: VersionMessage | null = null;
let amCapabilities: SystemCapabilitiesMessage | null = null;
let amNodeDID: string | null = null;
let amStatusRow: StatusItem[] = [];
// ROOT's client for the node's MCP server, held so a redraw keeps what was typed.
// Null for anybody but ROOT.
let amRootsClient: HTMLElement | null = null;
// Where ROOT opens Node Connectors. Null for anybody but ROOT.
let amNodeConnectors: HTMLElement | null = null;

/** The build, pushed on the connect frame. */
export function updateAmVersion(data: VersionMessage): void {
    amVersion = data;
    if (amElement) renderAm();
}

/** The backends, pushed on connect and asked for at /am/syscap. */
export function updateAmCapabilities(data: SystemCapabilitiesMessage): void {
    amCapabilities = data;
    if (amElement) renderAm();
}

// The node's did:key, served publicly at /.well-known/did.json. It is the
// anchor ADR-010 says everything else references, so ≡ states it rather than
// leaving the node anonymous to its own operator.
async function loadNodeDID(): Promise<void> {
    try {
        const response = await apiFetch('/.well-known/did.json');
        if (!response.ok) {
            log.warn(SEG.SELF, `[am] DID document unavailable: ${response.status} ${response.statusText}`);
            return;
        }
        const doc = await response.json();
        amNodeDID = typeof doc?.id === 'string' ? doc.id : null;
        if (amElement) renderAm();
    } catch (error: unknown) {
        log.warn(SEG.SELF, `[am] DID document fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// The socket pushes the backends on connect, and a caller without one has no
// other way to them. Asking is what makes ≡ drawable before a socket exists.
async function loadSyscap(): Promise<void> {
    if (amCapabilities) return;
    try {
        const response = await apiFetch('/am/syscap');
        if (!response.ok) {
            log.warn(SEG.SELF, `[am] /am/syscap answered ${response.status} ${response.statusText}`);
            return;
        }
        amCapabilities = await response.json() as SystemCapabilitiesMessage;
        if (amElement) renderAm();
    } catch (error: unknown) {
        log.warn(SEG.SELF, `[am] /am/syscap fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// The same row the brow draws, on the element whose subject it is.
async function loadStatusRow(): Promise<void> {
    try {
        const response = await apiFetch('/am/statusline?format=json');
        if (!response.ok) {
            log.warn(SEG.SELF, `[am] /am/statusline answered ${response.status} ${response.statusText}`);
            return;
        }
        const body = await response.json();
        amStatusRow = Array.isArray(body?.items) ? body.items as StatusItem[] : [];
        if (amElement) renderAm();
    } catch (error: unknown) {
        log.warn(SEG.SELF, `[am] /am/statusline fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function row(label: string, value: string): string {
    return `
        <div class="element-row">
            <span class="label">${escapeHtml(label)}</span>
            <span class="element-value">${value}</span>
        </div>
    `;
}

function renderAm(): void {
    if (!amElement) return;

    if (!amVersion && !amCapabilities && !amNodeDID) {
        amElement.innerHTML = '<div class="element-loading">Waiting for the node to say what it is...</div>';
        return;
    }

    const sections: string[] = [];

    if (amStatusRow.length > 0) {
        const items = amStatusRow.map((item) => {
            const state = item.symbol === '+' ? 'status-well' : 'status-unwell';
            const note = item.note ? ` <span class="element-note">${escapeHtml(item.note)}</span>` : '';
            return `<span class="${state}">${escapeHtml(item.symbol)} ${escapeHtml(item.name)}${note}</span>`;
        }).join('');
        sections.push(`
            <div class="element-section">
                <h3 class="element-section-title">Status line</h3>
                <div class="element-status-row">${items}</div>
            </div>
        `);
    }

    if (amVersion) {
        const built = formatBuildTime(amVersion.build_time) || amVersion.build_time || 'unknown';
        const commit = amVersion.commit?.substring(0, 7) || 'unknown';
        sections.push(`
            <div class="element-section">
                <h3 class="element-section-title">QNTX Server</h3>
                ${row('Version:', escapeHtml(amVersion.version || 'unknown'))}
                ${row('Commit:', escapeHtml(commit))}
                ${row('Built:', escapeHtml(built))}
                ${amVersion.go_version ? row('Go:', escapeHtml(amVersion.go_version)) : ''}
            </div>
        `);
    }

    if (amCapabilities) {
        const caps = amCapabilities;
        const parser = caps.parser_optimized
            ? `<span class="status-well">✓ ats WASM ${caps.parser_size ? `(${escapeHtml(caps.parser_size)})` : ''}</span>`
            : '<span class="status-unwell">⚠ Go native parser</span>';
        const storage = caps.storage_optimized
            ? '<span class="status-well">✓ Optimized (Rust)</span>'
            : '<span class="status-unwell">⚠ Fallback (Go)</span>';
        sections.push(`
            <div class="element-section">
                <h3 class="element-section-title">System Capabilities</h3>
                ${row('parser:', `${caps.parser_version ? `v${escapeHtml(caps.parser_version)} ` : ''}${parser}`)}
                ${row('storage:', storage)}
            </div>
        `);
    }

    // The node signs every attestation with this key, so a reader elsewhere
    // verifies against exactly this string.
    if (amNodeDID) {
        sections.push(`
            <div class="element-section">
                <h3 class="element-section-title">Identity</h3>
                ${row('Node DID:', `<span class="element-did">${escapeHtml(amNodeDID)}</span>`)}
            </div>
        `);
    }

    amElement.innerHTML = `
        <div class="element-content">
            ${sections.join('\n')}
        </div>
    `;
    // The A2A card rests here as a button; the same one every redraw.
    amElement.firstElementChild?.appendChild(a2aCardRow());
    // "for root it can be in i of the root or on am"
    if (amRootsClient) amElement.firstElementChild?.appendChild(amRootsClient);
    if (amNodeConnectors) amElement.firstElementChild?.appendChild(amNodeConnectors);
}

// Whether the viewer is ROOT, which ROOT's client is drawn for, and where the
// node's MCP server answers, which the app is set up with.
async function loadRootsClient(): Promise<void> {
    try {
        const who = await person();
        if (who.level !== 'ROOT') return;
        // "you may open Node Connectors from am if you are root"
        // A button, as A2A is: made once, so a redraw of am keeps the one element.
        if (!amNodeConnectors) {
            amNodeConnectors = document.createElement('div');
            amNodeConnectors.className = 'element-section';
            amNodeConnectors.appendChild(buttonFrom(createNodeConnectorsElement(), { className: 'qntx-btn qntx-btn-ghost qntx-btn-small' }));
            // "ROOT or developer oriented Stories Element should exist"
            amNodeConnectors.appendChild(buttonFrom(createStoriesElement(), { className: 'qntx-btn qntx-btn-ghost qntx-btn-small' }));
        }
        const said = await apiJson<{ card: CardMCP }>('/am/node');
        const node = nodeMCPOf(said.card ?? {});
        if (!node) {
            log.warn(SEG.SELF, '[am] the node card names no MCP server');
            return;
        }
        // A button, as A2A is, not a fold: made once, so a redraw of am keeps the one element.
        if (!amRootsClient) {
            amRootsClient = document.createElement('div');
            amRootsClient.className = 'element-section';
            amRootsClient.appendChild(buttonFrom(rootsClientElement(node), { className: 'qntx-btn qntx-btn-ghost qntx-btn-small' }));
        }
        if (amElement) renderAm();
    } catch (error: unknown) {
        log.warn(SEG.SELF, `[am] ROOT's client: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Who this is for: whoever reaches these (audience.ts).
export const needs = ['/.well-known/did.json'] as const;

/** ≡ in the tray: a window, the same form as ⍟. */
export function createAmElement() {
    return {
        id: 'am-element',
        title: 'am',
        symbol: AM,
        renderContent: () => {
            const content = document.createElement('div');
            amElement = content;
            renderAm();
            if (!amNodeDID) void loadNodeDID();
            if (!amCapabilities) void loadSyscap();
            void loadStatusRow();
            if (!amRootsClient) void loadRootsClient();
            return content;
        },
    };
}
