// Connector Element (⧉) — a connection set up in one place, its server URL, id and secret said where it was made.

// "THE USER SETUP'S UP CONNECTIONS"
// "ROOT WANTS AN MCP OVER THE ENTIRE SERVER, SET VIA EITHER I OR AM"
// "AND I SHOULD NOT NEED TO OPEN UP THE TOKEN ELEMENT SEPARATELY TO CREATE THE TOKEN"

import type { Element } from '@teranos/elements';
import { AtField, fieldFrom, pressFrom } from '@teranos/elements';
import { apiJson } from './client/http';
import { log, SEG } from './logger';
import { ordered, type Namespace } from './namespaces-view';
import { CONNECTOR } from './sym';
import { createToken, OAUTH, type CreateTokenResponse } from './token-mint-element';

export const needs = ['/am/node', '/api/namespaces', '/auth/tokens'] as const;

const ELEMENT_ID = 'connector-element';

/** What of am node's card says where the node's MCP server answers. */
export interface CardMCP {
    capabilities?: { extensions?: { params?: { mcp?: { url?: string } } }[] };
}

/** Where the node says its MCP server is: the mcp extension of its card. */
export function nodeMCPOf(card: CardMCP): string | undefined {
    return (card.capabilities?.extensions ?? []).map((e) => e.params?.mcp?.url).find((url) => !!url);
}

/** What an app is set up with, said where the connection was made. The secret is never shown again. */
function setUpWith(url: string, minted: CreateTokenResponse): HTMLElement {
    const said = document.createElement('div');
    said.className = 'element-section';
    for (const [name, value] of [['Server URL', url], ['Client ID', minted.did ?? ''], ['Client Secret', minted.token]] as const) {
        const row = document.createElement('div');
        row.className = 'element-row';
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = name;
        const shown = document.createElement('span');
        shown.className = 'element-value';
        shown.style.userSelect = 'all';
        shown.style.wordBreak = 'break-all';
        shown.textContent = value;
        row.append(label, shown);
        said.appendChild(row);
    }
    const once = document.createElement('div');
    once.className = 'element-note';
    once.textContent = 'The secret is shown here once.';
    said.appendChild(once);
    return said;
}

/** The namespaces to pick from, none picked until somebody picks one. */
function namespacePick(namespaces: string[]): HTMLSelectElement {
    const select = document.createElement('select');
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'pick a namespace';
    select.appendChild(none);
    for (const name of namespaces) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    }
    return select;
}

/** Exported for tests: a connection for a namespace, set up here (story 9). */
export function renderConnector(container: HTMLElement, node: string, namespaces: string[]): void {
    container.className = 'element-content';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';

    const namespace = namespacePick(namespaces);
    const label = fieldFrom({ id: 'connector-label', label: 'Connection', placeholder: 'what this connection is for' });
    // Where the client's codes go: the callback URL the app shows (ADR-025).
    const returnAddress = fieldFrom({ id: 'connector-return', label: 'Return address', placeholder: 'the callback URL the app shows' });
    const result = document.createElement('div');

    const press = pressFrom({
        id: 'connector',
        title: 'Connector',
        again: 'sets up the connection',
        creates: true,
        does: async () => {
            const picked = namespace.value;
            if (!picked) throw new Error('no namespace picked');
            const named = label.input.value.trim();
            if (!named) throw new AtField(label.input, 'no label');
            const returning = returnAddress.input.value.trim();
            if (!returning) throw new AtField(returnAddress.input, 'no return address');
            // A connector acts in the namespace it was minted in, and answers at that server alone (ADR-038).
            const minted = await createToken(named, OAUTH, [picked], returning);
            label.input.value = '';
            result.replaceChildren(setUpWith(`${node}/${encodeURIComponent(picked)}`, minted));
        },
    });

    container.append(namespace, label.element, returnAddress.element, press.element, result);
}

/** ROOT's client for the node's MCP server, set up on am (story 10, ADR-038). */
export function rootsClient(node: string): HTMLElement {
    const held = document.createElement('div');
    held.className = 'element-section';
    const label = fieldFrom({ id: 'roots-client-label', label: "ROOT's client", placeholder: 'what this client is for' });
    const returnAddress = fieldFrom({ id: 'roots-client-return', label: 'Return address', placeholder: 'the callback URL the app shows' });
    const result = document.createElement('div');
    const press = pressFrom({
        id: 'roots-client',
        title: "ROOT's client",
        again: "sets up ROOT's client for the node's MCP server",
        creates: true,
        does: async () => {
            const named = label.input.value.trim();
            if (!named) throw new AtField(label.input, 'no label');
            const returning = returnAddress.input.value.trim();
            if (!returning) throw new AtField(returnAddress.input, 'no return address');
            const minted = await createToken(named, OAUTH, [], returning, true);
            label.input.value = '';
            result.replaceChildren(setUpWith(node, minted));
        },
    });
    held.append(label.element, returnAddress.element, press.element, result);
    return held;
}

/** What the element draws once the node said where its server is and which namespaces there are. */
async function drawInto(content: HTMLElement): Promise<void> {
    try {
        const [card, listed] = await Promise.all([
            apiJson<{ card: CardMCP }>('/am/node'),
            apiJson<{ namespaces: Namespace[] }>('/api/namespaces'),
        ]);
        const node = nodeMCPOf(card.card ?? {});
        if (!node) throw new Error('the node card names no MCP server');
        renderConnector(content, node, ordered(listed.namespaces ?? []).map((ns) => ns.name));
    } catch (err) {
        const said = err instanceof Error ? err.message : String(err);
        log.warn(SEG.SELF, `[connector] ${said}`);
        const why = document.createElement('div');
        why.className = 'status-unwell';
        why.textContent = said;
        content.appendChild(why);
    }
}

export function createConnectorElement(): Element {
    return {
        id: ELEMENT_ID,
        title: 'Connector',
        symbol: CONNECTOR,
        renderContent: () => {
            const content = document.createElement('div');
            void drawInto(content);
            return content;
        },
    };
}
