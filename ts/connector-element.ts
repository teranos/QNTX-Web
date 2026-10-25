// Connectors (⧉) — what a USER connects, each with its maker's mark, each leading to its own story.

// "THE USER SETUP'S UP CONNECTIONS"
// "ROOT WANTS AN MCP OVER THE ENTIRE SERVER, SET VIA EITHER I OR AM"
// "AND I SHOULD NOT NEED TO OPEN UP THE TOKEN ELEMENT SEPARATELY TO CREATE THE TOKEN"
// "AS A USER I EXPECT TO SEE THE CONNECTORS ELEMENT"

import type { Element } from '@teranos/elements';
import { AtField, fieldFrom, pressFrom, tray } from '@teranos/elements';
import { apiJson } from './client/http';
import { log, SEG } from './logger';
import { ANTHROPIC, CLAUDE, GITHUB, OBSIDIAN, OPENAI, OPENROUTER, markOf, type BrandMark } from './brand-marks';
import { createGitHubElement } from './github-element';
import { createObsidianElement } from './obsidian-element';
import { person } from './self-person';
import { CONNECTOR } from './sym';
import { createToken, OAUTH, type CreateTokenResponse } from './token-mint-element';

export const needs = ['/am/node', '/auth/tokens'] as const;

const ELEMENT_ID = 'connector-element';

// Claude sends every connector's code here; q's claude.ai clients name it.
const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

/** What of am node's card says where the node's MCP server answers. */
export interface CardMCP {
    capabilities?: { extensions?: { params?: { mcp?: { url?: string } } }[] };
}

/** Where the node says its MCP server is: the mcp extension of its card. */
export function nodeMCPOf(card: CardMCP): string | undefined {
    return (card.capabilities?.extensions ?? []).map((e) => e.params?.mcp?.url).find((url) => !!url);
}

/** Where Connectors stands: the node's MCP server, the namespace stood in, and how an element is opened. */
export interface ConnectorsAt {
    node: string;
    standing: string;
    open: (elementId: string) => void;
}

/** What an app is set up with, said where the connection was made. The secret is never shown again. */
function setUpWith(url: string, minted: CreateTokenResponse, also: [string, string][] = []): HTMLElement {
    const said = document.createElement('div');
    said.className = 'element-section';
    const rows: [string, string][] = [['Server URL', url], ['Client ID', minted.did ?? ''], ['Client Secret', minted.token], ...also];
    for (const [name, value] of rows) {
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

// "you can connect multiple chatgpt accounts"

/** A connection's name, computed: the app, where it reaches, and when it was made, so a second is its own. */
function nameOf(app: string, namespace: string): string {
    return `${app} ${namespace} ${new Date().toISOString().slice(0, 23).replace('T', ' ')}`;
}

function note(text: string): HTMLElement {
    const said = document.createElement('div');
    said.className = 'element-note';
    said.textContent = text;
    return said;
}

/** Story 12: Claude's callback is known, so nothing is typed. */
function claudeStory(panel: HTMLElement, at: ConnectorsAt): void {
    const result = document.createElement('div');
    const press = pressFrom({
        id: 'connect-claude',
        title: 'Connect Claude',
        again: `connects Claude to ${at.standing}`,
        creates: true,
        does: async () => {
            const minted = await createToken(nameOf('Claude', at.standing), OAUTH, [at.standing], CLAUDE_CALLBACK);
            result.replaceChildren(setUpWith(`${at.node}/${encodeURIComponent(at.standing)}`, minted));
        },
    });
    panel.append(note(`Claude reaches ${at.standing}.`), press.element, result);
}

/** Story 11: ChatGPT makes a callback per connector, the one thing the node cannot know. */
function chatgptStory(panel: HTMLElement, at: ConnectorsAt): void {
    const callback = fieldFrom({ id: 'chatgpt-callback', label: 'Callback URL', placeholder: 'the callback URL ChatGPT shows' });
    const result = document.createElement('div');
    const press = pressFrom({
        id: 'connect-chatgpt',
        title: 'Connect ChatGPT',
        again: `connects ChatGPT to ${at.standing}`,
        creates: true,
        does: async () => {
            const returning = callback.input.value.trim();
            if (!returning) throw new AtField(callback.input, 'no callback URL');
            const minted = await createToken(nameOf('ChatGPT', at.standing), OAUTH, [at.standing], returning);
            callback.input.value = '';
            result.replaceChildren(setUpWith(`${at.node}/${encodeURIComponent(at.standing)}`, minted,
                [['Token endpoint auth method', 'client_secret_post']]));
        },
    });
    panel.append(note(`ChatGPT reaches ${at.standing}.`), callback.element, press.element, result);
}

/** Story 14: a provider's key, kept sealed by the namespace stood in under the provider's name (ADR-051). */
function keyStory(provider: string, title: string, placeholder: string) {
    return (panel: HTMLElement, at: ConnectorsAt): void => {
        const key = fieldFrom({ id: `${provider}-key`, label: `${title} API key`, placeholder });
        key.input.type = 'password';
        const result = document.createElement('div');
        const press = pressFrom({
            id: `connect-${provider}`,
            title: 'Keep the key',
            again: `keeps the ${title} key in ${at.standing}`,
            creates: true,
            does: async () => {
                const value = key.input.value;
                if (!value.trim()) throw new AtField(key.input, 'no key');
                await apiJson(`/api/keys/${encodeURIComponent(at.standing)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: provider, value }),
                });
                key.input.value = '';
                result.replaceChildren(note(`Kept, sealed, in ${at.standing}. It is never shown again.`));
            },
        });
        panel.append(key.element, press.element, result);
    };
}

/** One thing a USER connects: its maker's mark, and the story it leads to. */
interface Connection {
    brand: BrandMark;
    name: string;
    /** An element of its own, opened as it is. */
    opens?: string;
    story?: (panel: HTMLElement, at: ConnectorsAt) => void;
}

const CONNECTIONS: Connection[] = [
    { brand: OPENAI, name: 'ChatGPT', story: chatgptStory },
    { brand: CLAUDE, name: 'Claude', story: claudeStory },
    { brand: OBSIDIAN, name: 'Obsidian', opens: 'obsidian-element' },
    // The providers the namespace agent in Pi calls, each with its own key (server/agents.go piProviders).
    { brand: OPENROUTER, name: 'OpenRouter', story: keyStory('openrouter', 'OpenRouter', 'sk-or-…') },
    { brand: ANTHROPIC, name: 'Anthropic', story: keyStory('anthropic', 'Anthropic', 'sk-ant-…') },
    { brand: OPENAI, name: 'OpenAI', story: keyStory('openai', 'OpenAI', 'sk-…') },
    { brand: GITHUB, name: 'GitHub', opens: 'github-element' },
];

function tileOf(connection: Connection): HTMLButtonElement {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.dataset.connect = connection.name;
    tile.style.display = 'flex';
    tile.style.alignItems = 'center';
    tile.style.gap = '8px';
    tile.style.padding = '6px 8px';
    tile.style.minWidth = '0';
    tile.style.cursor = 'pointer';
    tile.style.fontFamily = 'var(--font-mono)';
    tile.style.color = 'var(--text-on-dark)';
    tile.style.background = 'var(--bg-dark-light)';
    tile.style.border = '1px solid var(--border-on-dark)';
    tile.style.borderRadius = 'var(--border-radius)';
    const name = document.createElement('span');
    name.textContent = connection.name;
    name.style.overflow = 'hidden';
    name.style.textOverflow = 'ellipsis';
    tile.append(markOf(connection.brand), name);
    return tile;
}

/** Exported for tests: every connection, and the story of the one pressed (story 9). */
export function renderConnectors(container: HTMLElement, at: ConnectorsAt): void {
    container.className = 'element-content';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';

    const tiles = document.createElement('div');
    tiles.style.display = 'grid';
    tiles.style.gridTemplateColumns = 'repeat(auto-fill, minmax(130px, 1fr))';
    tiles.style.gap = '6px';
    const panel = document.createElement('div');
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '8px';

    for (const connection of CONNECTIONS) {
        const tile = tileOf(connection);
        tile.addEventListener('click', () => {
            if (connection.opens) {
                at.open(connection.opens);
                return;
            }
            panel.replaceChildren();
            // A connection is made in the namespace stood in, and none is picked here.
            if (!at.standing) {
                panel.appendChild(note('You stand in no namespace: stand in one, and connect there.'));
                return;
            }
            connection.story?.(panel, at);
        });
        tiles.appendChild(tile);
    }
    container.append(tiles, panel);
}

/** ROOT's client for the node's MCP server, set up on am (story 10, ADR-038): folded until ROOT opens it. */
export function rootsClient(node: string): HTMLElement {
    const held = document.createElement('details');
    held.className = 'element-section';
    const summary = document.createElement('summary');
    summary.textContent = "ROOT's client for the node's MCP server";
    summary.style.cursor = 'pointer';
    held.appendChild(summary);
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

const OPENED: Record<string, () => Element> = {
    'obsidian-element': createObsidianElement,
    'github-element': createGitHubElement,
};

/** An element a connection is, opened in the tray: added the first time, as the token mint is. */
function openElement(id: string): void {
    const create = OPENED[id];
    if (!create) return;
    if (!tray.has(id)) tray.add(create());
    tray.open(id);
}

/** What the element draws once the node said where its server is and where the viewer stands. */
async function drawInto(content: HTMLElement): Promise<void> {
    try {
        const [card, who] = await Promise.all([apiJson<{ card: CardMCP }>('/am/node'), person()]);
        const node = nodeMCPOf(card.card ?? {});
        if (!node) throw new Error('the node card names no MCP server');
        renderConnectors(content, { node, standing: who.standing, open: openElement });
    } catch (err) {
        const said = err instanceof Error ? err.message : String(err);
        log.warn(SEG.SELF, `[connectors] ${said}`);
        const why = document.createElement('div');
        why.className = 'status-unwell';
        why.textContent = said;
        content.appendChild(why);
    }
}

export function createConnectorElement(): Element {
    return {
        id: ELEMENT_ID,
        title: 'Connectors',
        symbol: CONNECTOR,
        renderContent: () => {
            const content = document.createElement('div');
            void drawInto(content);
            return content;
        },
    };
}
