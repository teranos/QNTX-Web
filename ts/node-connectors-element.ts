// Node Connectors: the node's own connections, ROOT's (stories/27-root-registers-the-node-with-anthropic.feature).
// "ROOT's connectors; are called the Node Connectors, namespace connectors are called Namespace Connetors bt displayed as Connectors to the user."
// "you may open Node Connectors from am if you are root"

import type { Element } from '@teranos/elements';
import { MEANS, tray } from '@teranos/elements';
import { apiJson } from './client/http';
import { log, SEG } from './logger';
import { ANTHROPIC, markOf } from './brand-marks';
import { copied, goTo, note, valueRow } from './connector-element';
import { copyable } from './copyable';
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

/** A light: off before anything is set up, green when it is, red when it is refused. */
function lightOf(of: string): HTMLElement {
    const light = document.createElement('span');
    light.dataset.light = of;
    light.dataset.on = 'false';
    light.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:50%;flex:0 0 auto;border:1px solid var(--border-on-dark)';
    return light;
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
    // Red as the light that says it is refused.
    shown.style.cssText = `white-space:pre-wrap;word-break:break-word;font-family:var(--font-mono);padding:6px 8px;border-left:3px solid currentColor;background:var(--bg-almost-black);color:${MEANS.no}`;
    return copyable(shown);
}

/** A screen of the wizard: what it is called, the screenshot of it, and what to give there. */
function screen(title: string, image: HTMLElement, ...gives: HTMLElement[]): HTMLElement {
    const held = document.createElement('div');
    held.dataset.screen = title;
    held.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    const named = document.createElement('div');
    named.textContent = title;
    named.style.fontWeight = 'bold';
    held.append(named, image, ...gives);
    return held;
}

/** The wizard's screens, each with what the node gives there. */
function wizard(node: NodeIdentity): HTMLElement {
    const held = document.createElement('div');
    held.style.cssText = 'display:flex;flex-direction:column;gap:12px';
    const name = wizardName(node.name);
    held.append(
        goTo('Go to', CONSOLE_FEDERATION),
        note('Press Connect workload, then Custom OIDC.'),
        shot('anthropic-connect-workload.png', 'Connect workload, marked'),
        screen('Issuer', shot('anthropic-wizard-issuer.png', "The wizard's Issuer screen"),
            note("Connect a new provider, with the node's issuer as its URL. If the node's issuer is listed under Use a registered issuer, pick it."),
            valueRow('Issuer URL', copied(node.issuer))),
        screen('Federation rule', shot('anthropic-wizard-rule.png', "The wizard's Federation rule screen"),
            valueRow('Rule name', copied(name)),
            valueRow('Subject (sub) claim', copied(node.did)),
            note('Leave the rest as it is.')),
        screen('Target', shot('anthropic-wizard-target.png', "The wizard's Target screen"),
            note('Create a new one.'),
            valueRow('Service account name', copied(name)),
            note('Leave the rest as it is, and press Apply and continue.')),
        screen('Test', shot('anthropic-wizard-test.png', "The wizard's snippet, its copy button marked"),
            note("Press the snippet's copy button, and paste it below.")),
    );
    return held;
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

/** The Anthropic row: its light, each namespace's OIDC, the wizard, and the box its snippet is pasted into. */
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
    const light = lightOf('anthropic-oidc');
    head.append(markOf(ANTHROPIC), title, light);

    // Whether each namespace's OIDC is set up: none is yet, so no light is on.
    const namespaces = document.createElement('div');
    namespaces.dataset.namespacesOidc = '';
    namespaces.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 12px';
    for (const each of node.namespaces) {
        const line = document.createElement('span');
        line.dataset.namespace = each;
        line.style.cssText = 'display:inline-flex;align-items:center;gap:6px';
        line.append(lightOf(`oidc-${each}`), Object.assign(document.createElement('span'), { textContent: each }));
        namespaces.appendChild(line);
    }

    // The box the wizard's snippet is pasted into, and right under it what was found and what Anthropic said.
    const box = document.createElement('textarea');
    box.dataset.paste = 'snippet';
    box.rows = 4;
    box.placeholder = "Paste the wizard's snippet here";
    box.style.cssText = 'width:100%;font-family:var(--font-mono)';
    const found = document.createElement('div');
    found.dataset.found = '';
    found.style.cssText = 'display:flex;flex-direction:column;gap:2px';
    const outcome = document.createElement('div');
    outcome.dataset.outcome = '';

    // What was pasted, and what the node keeps: an answer arriving after a paste never takes the paste back.
    let pasted: Partial<Record<Kind, string>> = {};
    let kept: Partial<Record<Kind, string>> = {};

    /** Each id the node needs, ✓ with its value when it is there, named as still needed when not. */
    const showFound = (ids: Partial<Record<Kind, string>>) => {
        found.replaceChildren();
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
    };

    /** What the node answered: its light, and right under the box whether Anthropic accepts it. */
    const answered = (am: NodeAnthropic, toPaste = false) => {
        light.dataset.on = String(am.asked);
        light.dataset.accepted = String(am.accepted);
        light.style.backgroundColor = !am.asked ? '' : am.accepted ? MEANS.yes : MEANS.no;
        kept = keptOf(am);
        showFound({ ...kept, ...pasted });
        outcome.replaceChildren();
        if (!am.asked) return;
        outcome.appendChild(am.accepted
            ? Object.assign(document.createElement('div'), { className: 'status-well', textContent: 'Anthropic accepts the node.' })
            : errorOf(am.why));
        // Only an answer to a paste is brought into view: on opening, the first step is what is seen.
        if (toPaste) outcome.scrollIntoView?.({ block: 'nearest' });
    };

    box.addEventListener('input', () => {
        const given = box.value;
        pasted = idsIn(given);
        const ids = { ...kept, ...pasted };
        showFound(ids);
        outcome.replaceChildren();
        // Nothing is asked of Anthropic until all the node needs is there.
        if (NEEDED.some((kind) => !ids[kind])) return;
        outcome.appendChild(note('Asking Anthropic…'));
        outcome.scrollIntoView?.({ block: 'nearest' });
        apiJson<NodeAnthropic>('/api/anthropic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ given }),
        }).then((am) => answered(am, true)).catch((err: unknown) => {
            outcome.replaceChildren(errorOf(err instanceof Error ? err.message : String(err)));
        });
    });

    const steps = wizard(node);
    row.append(head, namespaces, steps, box, outcome, found);
    showFound({});
    // What the node already keeps, and its light, on opening.
    apiJson<NodeAnthropic>('/api/anthropic').then((am) => answered(am)).catch((err: unknown) => {
        log.warn(SEG.SELF, `[node connectors] the node's light at Anthropic was not read: ${err instanceof Error ? err.message : String(err)}`);
        outcome.replaceChildren(errorOf(err instanceof Error ? err.message : String(err)));
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
