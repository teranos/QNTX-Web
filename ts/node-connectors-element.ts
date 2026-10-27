// Node Connectors: the node's own connections, ROOT's (stories/27-root-registers-the-node-with-anthropic.feature).
// "ROOT's connectors; are called the Node Connectors, namespace connectors are called Namespace Connetors bt displayed as Connectors to the user."
// "you may open Node Connectors from am if you are root"

import type { Element } from '@teranos/elements';
import { fieldFrom, flowFrom, pressFrom, tray, type FlowHandle, type FlowStep } from '@teranos/elements';
import { apiJson } from './client/http';
import { log, SEG } from './logger';
import { ANTHROPIC, markOf } from './brand-marks';
import { copied, goTo, note, valueRow } from './connector-element';
import { copyable } from './copyable';
import { lightFrom, type Light } from './light';
import { CONNECTOR } from './sym';
import type { NodeAnthropic } from './generated/proto/plugin/grpc/protocol/sigil';

export const ELEMENT_ID = 'node-connectors-element';

const CONSOLE_FEDERATION = 'https://platform.claude.com/settings/workload-identity-federation';

/** What the node says of itself that ROOT gives Anthropic. */
export interface NodeIdentity {
    name: string;
    issuer: string;
    did: string;
    namespaces: string[];
}

/** An id of Anthropic's, by the name the node keeps it under. */
type Kind = 'organization_id' | 'federation_rule_id' | 'service_account_id' | 'workspace_id';

/** What the node needs from the wizard's snippet, in the order the snippet says them. */
const NEEDED: Kind[] = ['federation_rule_id', 'organization_id', 'service_account_id', 'workspace_id'];

const CALLED: Record<Kind, string> = {
    organization_id: "The organization's ID",
    federation_rule_id: "The rule's ID",
    service_account_id: "The service account's ID",
    workspace_id: "The workspace's ID",
};

/** Whether word is a UUID, as Anthropic shows an organization's id. */
function isUUID(word: string): boolean {
    if (word.length !== 36) return false;
    for (let at = 0; at < word.length; at++) {
        const c = word[at]!;
        if (at === 8 || at === 13 || at === 18 || at === 23) { if (c !== '-') return false; continue; }
        if (!'0123456789abcdefABCDEF'.includes(c)) return false;
    }
    return true;
}

/** The id a word is, by its prefix or for the organization by being a UUID, as the node places it (server/node_anthropic.go). */
export function kindOf(word: string): Kind | undefined {
    if (word.startsWith('fdrl_') && word.length > 5) return 'federation_rule_id';
    if (word.startsWith('svac_') && word.length > 5) return 'service_account_id';
    if (word.startsWith('wrkspc_') && word.length > 7) return 'workspace_id';
    if (isUUID(word)) return 'organization_id';
    return undefined;
}

/** Every id of Anthropic's in what was pasted: the wizard's whole snippet, or one id with whatever the Console put around it. */
export function idsIn(pasted: string): Partial<Record<Kind, string>> {
    const found: Partial<Record<Kind, string>> = {};
    let word = '';
    const close = () => { const kind = kindOf(word); if (kind) found[kind] = word; word = ''; };
    for (const c of pasted) {
        if (' \t\n\r"\'`,:;{}'.includes(c)) close(); else word += c;
    }
    close();
    return found;
}

/** The node's name as the wizard takes a name: lowercase letters, numbers and hyphens. */
export function wizardName(name: string): string {
    let out = '';
    for (const c of name.toLowerCase()) out += 'abcdefghijklmnopqrstuvwxyz0123456789-'.includes(c) ? c : '-';
    return out;
}

/** A Console screenshot, with what to press marked. Relative, so it is found under whatever path the page is served from. */
function shot(file: string, says: string): HTMLElement {
    const image = document.createElement('img');
    image.setAttribute('src', `img/connectors/${file}`);
    image.alt = says;
    image.dataset.shot = file;
    image.style.cssText = 'max-width:100%;border:1px solid var(--border-on-dark);border-radius:var(--border-radius)';
    return image;
}

/** What went wrong, as an error: red, readable, and copied by a click. */
export function errorOf(said: string): HTMLElement {
    const shown = document.createElement('div');
    shown.dataset.error = '';
    shown.textContent = said;
    // As every element says an error: the error ground, the error text.
    shown.style.cssText = 'white-space:pre-wrap;word-break:break-word;font-family:var(--font-mono);padding:6px 8px;border-left:3px solid currentColor;background:var(--element-status-error-bg);color:var(--element-status-error-text)';
    return copyable(shown);
}

/** The ids the node keeps, by kind. */
function keptOf(am: NodeAnthropic): Partial<Record<Kind, string>> {
    return {
        organization_id: am.organization_id || undefined,
        federation_rule_id: am.federation_rule_id || undefined,
        service_account_id: am.service_account_id || undefined,
        workspace_id: am.workspace_id || undefined,
    };
}

/** Each id the node needs, ✓ with its value when it is there, named as still needed when not. */
function foundOf(ids: Partial<Record<Kind, string>>): HTMLElement {
    const found = document.createElement('div');
    found.dataset.found = '';
    found.style.cssText = 'display:flex;flex-direction:column;gap:2px';
    for (const kind of NEEDED) {
        const line = document.createElement('div');
        line.dataset.id = kind;
        line.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap';
        const id = ids[kind];
        if (id) {
            line.dataset.given = '';
            line.append(Object.assign(document.createElement('span'), { className: 'status-well', textContent: `✓ ${CALLED[kind]}` }), copied(id));
        } else {
            line.append(Object.assign(document.createElement('span'), { className: 'status-unwell', textContent: `${CALLED[kind]} is still needed` }));
        }
        found.appendChild(line);
    }
    return found;
}

/** The light as the node answered it. */
function lit(light: Light, am: NodeAnthropic): void {
    if (!am.asked) light.show('off', 'Console not set up');
    else light.show(am.accepted ? 'on' : 'refused', am.accepted ? 'Console accepted' : 'Console refused');
}

const STILL_NEEDED = "Paste the wizard's snippet, and Anthropic accepts the node.";

/** The wizard's steps, as Anthropic's Connect workload names them, each with what the node gives there. */
function setUpFlow(node: NodeIdentity, light: Light, done: (am: NodeAnthropic) => void): FlowHandle {
    const name = wizardName(node.name);
    let last: NodeAnthropic | null = null;
    const steps: FlowStep[] = [
        {
            title: 'Connect workload',
            says: 'Open the wizard',
            draw: (panel, resolved) => {
                panel.append(goTo('Go to', CONSOLE_FEDERATION), note('Press Connect workload, then Custom OIDC.'), shot('anthropic-connect-workload.png', 'Connect workload, marked'));
                resolved(null);
            },
        },
        {
            title: 'Issuer',
            says: 'Select or register the provider',
            draw: (panel, resolved) => {
                panel.append(note("Connect a new provider, with the node's issuer as its URL. If the node's issuer is listed under Use a registered issuer, pick it."),
                    valueRow('Issuer URL', copied(node.issuer)), shot('anthropic-wizard-issuer.png', "The wizard's Issuer screen"));
                resolved(null);
            },
        },
        {
            title: 'Federation rule',
            says: 'Match conditions and workspaces',
            draw: (panel, resolved) => {
                panel.append(valueRow('Rule name', copied(name)), valueRow('Subject (sub) claim', copied(node.did)), note('Leave the rest as it is.'),
                    shot('anthropic-wizard-rule.png', "The wizard's Federation rule screen"));
                resolved(null);
            },
        },
        {
            title: 'Target',
            says: 'Pick a service account',
            draw: (panel, resolved) => {
                panel.append(note('Create a new one.'), valueRow('Service account name', copied(name)), note('Leave the rest as it is, and press Apply and continue.'),
                    shot('anthropic-wizard-target.png', "The wizard's Target screen"));
                resolved(null);
            },
        },
        {
            title: 'Test',
            says: 'Verify end-to-end',
            draw: (panel, resolved) => {
                const field = fieldFrom({ id: 'anthropic-snippet', label: "The wizard's snippet", placeholder: "Press the snippet's copy button, and paste it here", lines: 8 });
                field.input.dataset.paste = 'snippet';
                const outcome = document.createElement('div');
                outcome.dataset.outcome = '';
                let found = foundOf(last ? keptOf(last) : {});
                let pasted: Partial<Record<Kind, string>> = {};
                const answered = (am: NodeAnthropic) => {
                    last = am;
                    lit(light, am);
                    const shown = foundOf({ ...keptOf(am), ...pasted });
                    found.replaceWith(shown);
                    found = shown;
                    outcome.replaceChildren();
                    if (am.asked) {
                        outcome.appendChild(am.accepted
                            ? Object.assign(document.createElement('div'), { className: 'status-well', textContent: 'Anthropic accepts the node.' })
                            : errorOf(am.why));
                    }
                    resolved(am.accepted ? null : STILL_NEEDED);
                };
                field.input.addEventListener('input', () => {
                    const given = field.input.value;
                    pasted = idsIn(given);
                    const ids = { ...(last ? keptOf(last) : {}), ...pasted };
                    const shown = foundOf(ids);
                    found.replaceWith(shown);
                    found = shown;
                    outcome.replaceChildren();
                    // Nothing is asked of Anthropic until all the node needs is there.
                    if (NEEDED.some((kind) => !ids[kind])) return;
                    light.show('waiting', 'Asking Anthropic');
                    outcome.appendChild(note('Asking Anthropic…'));
                    apiJson<NodeAnthropic>('/api/anthropic', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ given }),
                    }).then(answered).catch((err: unknown) => {
                        outcome.replaceChildren(errorOf(err instanceof Error ? err.message : String(err)));
                    });
                });
                panel.append(field.element, outcome, found, shot('anthropic-wizard-test.png', "The wizard's snippet, its copy button marked"));
                resolved(last?.accepted ? null : STILL_NEEDED);
            },
        },
    ];
    return flowFrom({ id: 'anthropic-setup', steps, onDone: () => { if (last) done(last); } });
}

/** The node set up at Anthropic: its ids, and a way to set it up again. */
function setUp(am: NodeAnthropic, again: () => void): HTMLElement {
    const held = document.createElement('div');
    held.dataset.setUp = '';
    held.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    const anew = pressFrom({ id: 'anthropic-set-up-again', title: 'Set up again', does: again });
    held.append(foundOf(keptOf(am)), anew.element);
    return held;
}

const SOURCE_CALLED: Record<string, string> = { session: 'Session', console: 'Console' };

/** What is left of the session: the window with the least left, as ug last read it. */
function sessionLeft(am: NodeAnthropic): number | undefined {
    // An empty list is left off the wire.
    const windows = am.session ?? [];
    if (windows.length === 0) return undefined;
    return Math.min(...windows.map((w) => 100 - w.used_percentage));
}

/**
 * What ROOT's agents spend, in the order they spend it: the first, then the second.
 * The one in use is marked; the second's box says whether it follows, and the two swap.
 */
function spendRows(am: NodeAnthropic, console_: Light, ordered: (first: string, then: boolean) => void): HTMLElement {
    const rows = document.createElement('div');
    rows.dataset.spend = '';
    rows.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    const first = am.first || 'session';
    const order = [first, first === 'session' ? 'console' : 'session'];
    const using = am.in_use || first;

    const session = lightFrom('anthropic-session');
    const left = sessionLeft(am);
    if (left === undefined) session.show('off', 'Session');
    else session.show(left <= 0 ? 'refused' : 'on', `Session ${Math.max(0, Math.round(left))}% left`);
    const lights: Record<string, Light> = { session, console: console_ };

    order.forEach((source, n) => {
        const number = document.createElement('span');
        number.textContent = String(n + 1);
        const marked = document.createElement('span');
        marked.dataset.inUse = source === using ? 'true' : 'false';
        marked.textContent = source === using ? '◀' : '';
        marked.title = source === using ? `ROOT's agents run on the ${SOURCE_CALLED[source]}` : '';
        const lit_ = lights[source]!.element;
        lit_.dataset.source = source;
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap';
        line.append(number, lit_, marked);
        if (n === 1) {
            line.append(
                pressFrom({ id: 'anthropic-then', title: `${am.then ? '☑' : '☐'} then`, does: () => ordered(first, !am.then) }).element,
                pressFrom({ id: 'anthropic-swap', title: '⇅ swap', does: () => ordered(order[1]!, am.then) }).element,
            );
        }
        rows.append(line);
    });
    return rows;
}

/** The Anthropic row: what ROOT's agents spend, each namespace's OIDC, and the set-up flow or what was set up. */
function anthropicRow(node: NodeIdentity): HTMLElement {
    const row = document.createElement('div');
    row.dataset.platform = 'Anthropic';
    row.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:8px;border:1px solid var(--border-on-dark);border-radius:var(--border-radius);background:var(--bg-dark-light);color:var(--text-on-dark)';
    const head = document.createElement('div');
    head.dataset.connect = 'Anthropic';
    head.style.cssText = 'display:flex;align-items:center;gap:8px';
    const title = document.createElement('span');
    title.textContent = 'Anthropic';
    title.style.flex = '1';
    const light = lightFrom('anthropic-oidc', 'Console not set up');
    head.append(markOf(ANTHROPIC), title);
    const spend = document.createElement('div');

    // Whether each namespace's OIDC is set up: none is yet, so no light is on.
    const namespaces = document.createElement('div');
    namespaces.dataset.namespacesOidc = '';
    namespaces.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 12px';
    for (const each of node.namespaces) namespaces.appendChild(lightFrom(`oidc-${each}`, each).element);

    const body = document.createElement('div');
    row.append(head, spend, namespaces, body);

    // The lights drawn from what the node answered; an order given is answered anew.
    const drawSpend = (am: NodeAnthropic) => {
        lit(light, am);
        spend.replaceChildren(spendRows(am, light, (first, then) => {
            apiJson<NodeAnthropic>('/api/anthropic/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first, then: String(then) }),
            }).then(drawSpend).catch((err: unknown) => {
                spend.appendChild(errorOf(err instanceof Error ? err.message : String(err)));
            });
        }));
    };

    // Seen through to the end, as Anthropic's own wizard is.
    const flow = () => {
        const setting = setUpFlow(node, light, (am) => body.replaceChildren(setUp(am, flow)));
        body.replaceChildren(setting.element);
        if (row.isConnected) setting.captive();
        else requestAnimationFrame(() => { if (row.isConnected) setting.captive(); });
    };
    apiJson<NodeAnthropic>('/api/anthropic').then((am) => {
        drawSpend(am);
        if (am.accepted) body.replaceChildren(setUp(am, flow));
        else flow();
    }).catch((err: unknown) => {
        log.warn(SEG.SELF, `[node connectors] the node's light at Anthropic was not read: ${err instanceof Error ? err.message : String(err)}`);
        body.replaceChildren(errorOf(err instanceof Error ? err.message : String(err)));
    });
    return row;
}

/** Exported for tests: the node's connectors, drawn from what the node says of itself. */
export function renderNodeConnectors(container: HTMLElement, node: NodeIdentity): void {
    container.appendChild(anthropicRow(node));
}

/** What the node says of itself: its name, its issuer, its DID and its namespaces. */
async function nodeIdentity(): Promise<NodeIdentity> {
    const [card, discovery, did, listed] = await Promise.all([
        apiJson<{ card: { name?: string } }>('/am/node'),
        apiJson<{ issuer: string }>('/.well-known/openid-configuration'),
        apiJson<{ id: string }>('/.well-known/did.json'),
        apiJson<{ namespaces: { name: string }[] }>('/api/namespaces'),
    ]);
    const name = card.card?.name;
    if (!name) throw new Error('the node card names no node');
    return { name, issuer: discovery.issuer, did: did.id, namespaces: (listed.namespaces ?? []).map((n) => n.name) };
}

export function createNodeConnectorsElement(): Element {
    return {
        id: ELEMENT_ID,
        title: 'Node Connectors',
        symbol: CONNECTOR,
        // Opened just below the top, beside the sidebar: never past the bottom of the screen.
        defaultX: 260,
        defaultY: 40,
        renderContent: () => {
            // As wide as the wizard's screenshots read, from the moment it is measured: what arrives later does not resize it.
            const content = document.createElement('div');
            content.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:720px';
            nodeIdentity().then((node) => renderNodeConnectors(content, node)).catch((err: unknown) => {
                const said = err instanceof Error ? err.message : String(err);
                log.warn(SEG.SELF, `[node connectors] ${said}`);
                content.appendChild(errorOf(said));
            });
            return content;
        },
    };
}

/** Opens Node Connectors: one of the tray's, added the first time. */
export function openNodeConnectors(): void {
    if (!tray.has(ELEMENT_ID)) tray.add(createNodeConnectorsElement());
    tray.open(ELEMENT_ID);
}
