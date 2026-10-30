// Connectors (⧉): one row per platform, each opening into its own stories (stories/9-user-sets-up-a-connection.feature).

// "THE USER SETUP'S UP CONNECTIONS"
// "ROOT WANTS AN MCP OVER THE ENTIRE SERVER, SET VIA EITHER I OR AM"
// "AND I SHOULD NOT NEED TO OPEN UP THE TOKEN ELEMENT SEPARATELY TO CREATE THE TOKEN"
// "AS A USER I EXPECT TO SEE THE CONNECTORS ELEMENT"

import type { Element } from '@teranos/elements';
import { AtField, fieldFrom, pressFrom, tray } from '@teranos/elements';
import { apiJson } from './client/http';
import { log, SEG } from './logger';
import { ANTHROPIC, GITHUB, OBSIDIAN, OPENAI, OPENROUTER, markOf, type BrandMark } from './brand-marks';
import { copyable } from './copyable';
import { lightFrom } from './light';
import { createGitHubElement } from './github-element';
import { createObsidianElement } from './obsidian-element';
import { person } from './self-person';
import { openElement as openStanding } from './sidebar.ts';
import { openAgentElement, ELEMENT_ID as AGENT_CHAT_ID } from './agents-element.ts';
import { CONNECTOR } from './sym';
import { createToken, OAUTH, type CreateTokenResponse } from './token-mint-element';
import type { NamespaceKeys } from './generated/proto/plugin/grpc/protocol/sigil';

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

/** The server MCP URL of the namespace stood in. */
function mcpOf(at: ConnectorsAt): string {
    return `${at.node}/${encodeURIComponent(at.standing)}`;
}

export function note(text: string): HTMLElement {
    const said = document.createElement('div');
    said.className = 'element-note';
    said.textContent = text;
    return said;
}

/** A line saying where to go, its address a link out. */
export function goTo(words: string, href: string): HTMLElement {
    const line = note(words);
    const out = document.createElement('a');
    out.href = href;
    out.target = '_blank';
    out.rel = 'noopener noreferrer';
    out.textContent = href;
    out.style.wordBreak = 'break-all';
    out.style.color = 'var(--accent-on-dark)';
    line.append(' ', out);
    return line;
}

/** One named value, copied by a click. */
export function valueRow(name: string, value: HTMLElement): HTMLElement {
    const row = document.createElement('div');
    row.className = 'element-row';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = name;
    value.classList.add('element-value');
    value.style.wordBreak = 'break-all';
    row.append(label, value);
    return row;
}

export function copied(text: string): HTMLElement {
    const shown = document.createElement('span');
    shown.textContent = text;
    return copyable(shown);
}

// "secret is hidden by default"
// "click -> clipboard -> 'Copied!'"
/** A secret shown hidden: a click copies it, and says so. */
function hiddenSecret(secret: string): HTMLElement {
    const hidden = '••••••••••••';
    const shown = document.createElement('span');
    shown.dataset.secret = '';
    shown.textContent = hidden;
    shown.style.cursor = 'pointer';
    shown.addEventListener('click', () => {
        void navigator.clipboard.writeText(secret).then(
            () => { shown.textContent = 'Copied!'; },
            (err: unknown) => { log.warn(SEG.UI, '[connectors] the secret was not copied:', err); shown.textContent = 'not copied'; },
        );
        setTimeout(() => { shown.textContent = hidden; }, 1000);
    });
    return shown;
}

/** What an app is set up with, said where the connection was made. The secret is never shown again. */
function setUpWith(minted: CreateTokenResponse, url?: string, also: [string, string][] = []): HTMLElement {
    const said = document.createElement('div');
    said.className = 'element-section';
    if (url) said.appendChild(valueRow('Server URL', copied(url)));
    said.appendChild(valueRow('Client ID', copied(minted.did ?? '')));
    said.appendChild(valueRow('Client Secret', hiddenSecret(minted.token)));
    for (const [name, value] of also) said.appendChild(valueRow(name, copied(value)));
    said.appendChild(note('The secret is here once.'));
    return said;
}

// "you can connect multiple chatgpt accounts"

/** A connection's name, computed: the app, where it reaches, and when it was made, so a second is its own. */
function nameOf(app: string, namespace: string): string {
    return `${app} ${namespace} ${new Date().toISOString().slice(0, 23).replace('T', ' ')}`;
}

/** stories/20-user-adds-qntx-mcp-to-claude.feature: Claude's callback is set automatically. */
function claudeStory(panel: HTMLElement, at: ConnectorsAt): void {
    const result = document.createElement('div');
    const press = pressFrom({
        id: 'connect-claude',
        title: 'Connect Claude',
        again: `connects Claude to ${at.standing}`,
        creates: true,
        does: async () => {
            const minted = await createToken(nameOf('Claude', at.standing), OAUTH, [at.standing], CLAUDE_CALLBACK);
            result.replaceChildren(
                setUpWith(minted),
                goTo('Add them, with the server MCP URL, at', 'https://claude.ai/new?modal=add-custom-connector#customize/connectors/yours'),
            );
        },
    });
    panel.append(note(`The callback is set automatically to ${CLAUDE_CALLBACK}.`), press.element, result);
}

/** stories/11-user-connects-openai.feature: ChatGPT makes a callback per connector, the one thing the node cannot know. */
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
            result.replaceChildren(setUpWith(minted, undefined, [['Token endpoint auth method', 'client_secret_post']]));
        },
    });
    panel.append(goTo('Go to', 'https://chatgpt.com/plugins'), note('There: Add, then Add custom MCP server.'), callback.element, press.element, result);
}

/** The light of a key: green when its platform accepts it, red with what the platform said when not. */
function lightOf(provider: string, title: string): { element: HTMLElement; show: (kept: NamespaceKeys) => void } {
    const light = lightFrom(provider);
    light.element.hidden = true;
    const show = (kept: NamespaceKeys) => {
        const key = kept.keys.find((k) => k.name === provider);
        if (!key) { light.element.hidden = true; return; }
        light.element.hidden = false;
        light.show(key.accepted ? 'on' : 'refused', key.accepted ? `${title} accepts this key.` : key.why);
    };
    return { element: light.element, show };
}

/** stories/21-user-sets-the-anthropic-key.feature and stories/14-user-sets-an-openrouter-key.feature: a platform's key, kept sealed by the namespace stood in under the platform's name (ADR-051). */
function keyStory(provider: string, title: string, placeholder: string, keysAt: string) {
    return (panel: HTMLElement, at: ConnectorsAt): void => {
        const at_ = `/api/keys/${encodeURIComponent(at.standing)}`;
        const light = lightOf(provider, title);
        const key = fieldFrom({ id: `${provider}-key`, label: `${title} API key`, placeholder });
        (key.input as HTMLInputElement).type = 'password';
        const press = pressFrom({
            id: `connect-${provider}`,
            title: 'Keep the key',
            again: `keeps the ${title} key in ${at.standing}`,
            creates: true,
            does: async () => {
                const value = key.input.value;
                if (!value.trim()) throw new AtField(key.input, 'no key');
                const kept = await apiJson<NamespaceKeys>(at_, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: provider, value }),
                });
                key.input.value = '';
                light.show(kept);
            },
        });
        panel.append(goTo('Make a key at', keysAt), key.element, press.element, light.element);
        // The light of a key kept before is there on opening.
        apiJson<NamespaceKeys>(at_).then(light.show).catch((err: unknown) => {
            log.warn(SEG.SELF, `[connectors] the keys of ${at.standing} were not read: ${err instanceof Error ? err.message : String(err)}`);
        });
    };
}

/** One part of a platform: its own story drawn under it, or an element of its own. */
interface Part {
    name: string;
    draw?: (panel: HTMLElement, at: ConnectorsAt) => void;
    opens?: string;
}

/** One platform: its maker's mark, and what pressing it leads to. */
interface Platform {
    brand: BrandMark;
    name: string;
    parts?: Part[];
    draw?: (panel: HTMLElement, at: ConnectorsAt) => void;
    opens?: string;
}

const PLATFORMS: Platform[] = [
    { brand: OBSIDIAN, name: 'Obsidian', opens: 'obsidian-element' },
    { brand: OPENROUTER, name: 'OpenRouter', draw: keyStory('openrouter', 'OpenRouter', 'sk-or-…', 'https://openrouter.ai/settings/keys') },
    // "ITS LIKE THREE THINGS"
    {
        brand: ANTHROPIC, name: 'Anthropic', parts: [
            { name: 'add QNTX MCP to Claude', draw: claudeStory },
            { name: 'Claude Code', opens: 'agent-element' },
        ],
    },
    {
        brand: OPENAI, name: 'OpenAI', parts: [
            { name: 'ChatGPT', draw: chatgptStory },
            { name: 'OpenAI API key', draw: keyStory('openai', 'OpenAI', 'sk-…', 'https://platform.openai.com/api-keys') },
        ],
    },
    { brand: GITHUB, name: 'GitHub', opens: 'github-element' },
];

/** Something pressed that is not a button: a row is as wide as its element, which a button inside one is not. */
export function pressable(element: HTMLElement, does: () => void): HTMLElement {
    element.setAttribute('role', 'button');
    element.tabIndex = 0;
    element.style.cursor = 'pointer';
    element.addEventListener('click', does);
    element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); does(); }
    });
    return element;
}

function headOf(platform: Platform): HTMLElement {
    const head = document.createElement('div');
    head.dataset.connect = platform.name;
    head.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px';
    const name = document.createElement('span');
    name.textContent = platform.name;
    head.append(markOf(platform.brand), name);
    return head;
}

/** A platform's row: the row is the container of what it opens. */
function rowOf(platform: Platform, at: () => ConnectorsAt | undefined): HTMLElement {
    const row = document.createElement('div');
    row.dataset.platform = platform.name;
    row.style.cssText = 'display:flex;flex-direction:column;border:1px solid var(--border-on-dark);border-radius:var(--border-radius);background:var(--bg-dark-light);color:var(--text-on-dark)';
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:0 8px 8px';
    body.hidden = true;
    const draw = (here: ConnectorsAt) => {
        if (platform.opens) { here.open(platform.opens); return; }
        body.hidden = !body.hidden;
        if (body.hidden) return;
        body.replaceChildren();
        // A connection is made in the namespace stood in, and none is picked here.
        if (!here.standing) {
            body.appendChild(note('You stand in no namespace: stand in one, and connect there.'));
            return;
        }
        if (platform.draw) { platform.draw(body, here); return; }
        const opened = document.createElement('div');
        opened.style.cssText = 'display:flex;flex-direction:column;gap:8px';
        for (const each of platform.parts ?? []) {
            const item = document.createElement('div');
            item.dataset.part = each.name;
            item.textContent = each.name;
            item.style.cssText = 'padding:4px 8px;border:1px solid var(--border-on-dark);border-radius:var(--border-radius)';
            body.appendChild(pressable(item, () => {
                if (each.opens) { here.open(each.opens); return; }
                opened.replaceChildren();
                each.draw?.(opened, here);
            }));
        }
        body.appendChild(opened);
    };
    row.append(pressable(headOf(platform), () => {
        const here = at();
        if (here) draw(here);
    }), body);
    return row;
}

/** Exported for tests: the server MCP URL, then one row per platform (stories/9). */
export function renderConnectors(container: HTMLElement, at: ConnectorsAt | Promise<ConnectorsAt>): void {
    container.className = 'element-content';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '6px';

    let here: ConnectorsAt | undefined;
    const url = document.createElement('span');
    url.dataset.mcpUrl = '';
    url.textContent = '…';
    const known = (now: ConnectorsAt) => {
        here = now;
        url.textContent = now.standing ? mcpOf(now) : 'You stand in no namespace.';
        if (now.standing) copyable(url);
    };
    if (at instanceof Promise) at.then(known).catch(() => {});
    else known(at);

    container.appendChild(valueRow('Server MCP URL', url));
    for (const platform of PLATFORMS) container.appendChild(rowOf(platform, () => here));
}

/** ROOT's client for the node's MCP server, set up on am (stories/10, ADR-038): folded until ROOT opens it. */
/** ROOT's client for the node's MCP server as an element of its own, which am holds as a button, as it holds A2A. */
export function rootsClientElement(node: string): Element {
    return { id: 'roots-client-element', title: "ROOT's client for the node's MCP server", renderContent: () => rootsClient(node) };
}

export function rootsClient(node: string): HTMLElement {
    const held = document.createElement('div');
    held.className = 'element-content';
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
            result.replaceChildren(setUpWith(minted, node));
        },
    });
    held.append(label.element, returnAddress.element, press.element, result);
    return held;
}

const OPENED: Record<string, () => Element> = {
    'obsidian-element': createObsidianElement,
    'github-element': createGitHubElement,
};

/** An element a connection is: one of the tray's, added the first time, or one resting in the sidebar. */
function openElement(id: string): void {
    // Claude Code is the agent of the namespace stood in, whose chat opens from the Agents level too.
    if (id === AGENT_CHAT_ID) { openAgentElement(); return; }
    const create = OPENED[id];
    if (!create) { openStanding(id); return; }
    if (!tray.has(id)) tray.add(create());
    tray.open(id);
}

/** Where Connectors stands, once the node said where its server is and where the viewer stands. */
async function whereAt(): Promise<ConnectorsAt> {
    const [card, who] = await Promise.all([apiJson<{ card: CardMCP }>('/am/node'), person()]);
    const node = nodeMCPOf(card.card ?? {});
    if (!node) throw new Error('the node card names no MCP server');
    return { node, standing: who.standing, open: openElement };
}

export function createConnectorElement(): Element {
    return {
        id: ELEMENT_ID,
        title: 'Connectors',
        symbol: CONNECTOR,
        // Its rows are drawn at once, so the window is measured whole; what the node says fills them in.
        renderContent: () => {
            const content = document.createElement('div');
            const at = whereAt();
            at.catch((err: unknown) => {
                const said = err instanceof Error ? err.message : String(err);
                log.warn(SEG.SELF, `[connectors] ${said}`);
                const why = document.createElement('div');
                why.className = 'status-unwell';
                why.textContent = said;
                content.prepend(why);
            });
            renderConnectors(content, at);
            return content;
        },
    };
}
