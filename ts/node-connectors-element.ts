// Node Connectors: the node's own connections, ROOT's (stories/27-root-registers-the-node-with-anthropic.feature).
// "ROOT's connectors; are called the Node Connectors, namespace connectors are called Namespace Connetors bt displayed as Connectors to the user."
// "you may open Node Connectors from am if you are root"

import type { Element } from '@teranos/elements';
import { tray } from '@teranos/elements';
import { apiJson } from './client/http';
import { log, SEG } from './logger';
import { ANTHROPIC, markOf } from './brand-marks';
import { copied, goTo, note, pressable, valueRow } from './connector-element';
import { CONNECTOR } from './sym';

export const ELEMENT_ID = 'node-connectors-element';

const CONSOLE_FEDERATION = 'https://platform.claude.com/settings/workload-identity-federation';
const CONSOLE_SERVICE_ACCOUNTS = 'https://platform.claude.com/settings/service-accounts';
const CONSOLE_ORGANIZATION = 'https://platform.claude.com/settings/organization';

/** What the node says of itself that ROOT gives Anthropic. */
export interface NodeIdentity {
    name: string;
    issuer: string;
    did: string;
    namespaces: string[];
}

/** A light that is not on: nothing is set up for it yet. */
function lightOff(of: string): HTMLElement {
    const light = document.createElement('span');
    light.dataset.light = of;
    light.dataset.on = 'false';
    light.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:50%;flex:0 0 auto;border:1px solid var(--border-on-dark)';
    return light;
}

/** A Console screenshot, with what to press marked. */
function shot(file: string, says: string): HTMLElement {
    const image = document.createElement('img');
    // Relative, so it is found under whatever path the page is served from.
    image.setAttribute('src', `img/connectors/${file}`);
    image.alt = says;
    image.dataset.shot = file;
    image.style.cssText = 'max-width:100%;border:1px solid var(--border-on-dark);border-radius:var(--border-radius)';
    return image;
}

/** What to give each field of a Console form. */
function fields(rows: [string, string | HTMLElement][]): HTMLElement {
    const held = document.createElement('div');
    for (const [name, give] of rows) {
        held.appendChild(valueRow(name, typeof give === 'string' ? Object.assign(document.createElement('span'), { textContent: give }) : give));
    }
    return held;
}

/** Each step of registering the node at Anthropic, as story 27 walks it. */
function anthropicSteps(panel: HTMLElement, node: NodeIdentity): void {
    panel.append(
        valueRow("The node's issuer", copied(node.issuer)),
        goTo('Go to', CONSOLE_FEDERATION),
        shot('anthropic-workload-identity.png', 'Register issuer, marked'),
        note('Press Register issuer, and give:'),
        shot('anthropic-register-issuer.png', 'The Register issuer form'),
        fields([
            ['Name', copied(node.name)],
            ['Issuer URL (iss claim)', copied(node.issuer)],
            ['JWKS source', 'OIDC discovery'],
            ['Discovery base URL', 'blank'],
            ['CA certificate', 'blank'],
            ['Enforce single-use tokens', 'on'],
            ['Maximum token lifetime', '1'],
        ]),
        note('Press Register.'),
        goTo('Go to', CONSOLE_SERVICE_ACCOUNTS),
        note('Create a service account with the developer role, in the workspace that pays.'),
        shot('anthropic-service-accounts.png', 'Create service account, marked'),
        shot('anthropic-create-service-account.png', 'The Create service account form'),
        fields([
            ['Name', copied(node.name)],
            ['Description', 'blank'],
            ['Organization role', 'Developer'],
            ['Workspaces', 'Default'],
        ]),
        note('Press Create service account.'),
        goTo('Go to', CONSOLE_FEDERATION),
        note('Rules, next to Issuers.'),
        shot('anthropic-rules-next-to-issuers.png', 'Rules, marked'),
        shot('anthropic-rules.png', 'New rule, marked'),
        note('Press New rule, and give:'),
        shot('anthropic-create-rule.png', 'The Create federation rule form'),
        shot('anthropic-create-rule-target.png', 'Its target and authorization'),
        fields([
            ['Rule name', copied(node.name)],
            ['Description', 'blank'],
            ['Issuer', "the node's issuer"],
            ['Match configuration', 'Pattern match'],
            ['Subject pattern', copied(node.did)],
            ['Additional claim conditions', 'none'],
            ['Expected audience', 'blank'],
            ['Service account', "the node's service account"],
            ['Enable in all workspaces', 'off'],
            ['Workspaces', 'Default'],
            ['OAuth scope', 'workspace:developer'],
            ['Token lifetime', '10 minutes (default)'],
        ]),
        note('Press Create rule.'),
        goTo('The organization id is at', CONSOLE_ORGANIZATION),
        shot('anthropic-organization.png', 'Where the organization id is'),
    );
}

/** The Anthropic row: its light, each namespace's OIDC, and the steps it opens into. */
function anthropicRow(node: NodeIdentity): HTMLElement {
    const row = document.createElement('div');
    row.dataset.platform = 'Anthropic';
    row.style.cssText = 'display:flex;flex-direction:column;border:1px solid var(--border-on-dark);border-radius:var(--border-radius);background:var(--bg-dark-light);color:var(--text-on-dark)';
    const head = document.createElement('div');
    head.dataset.connect = 'Anthropic';
    head.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px';
    const name = document.createElement('span');
    name.textContent = 'Anthropic';
    name.style.flex = '1';
    head.append(markOf(ANTHROPIC), name, lightOff('anthropic-oidc'));
    // Whether each namespace's OIDC is set up: none is yet, so no light is on.
    const namespaces = document.createElement('div');
    namespaces.dataset.namespacesOidc = '';
    namespaces.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:0 8px 6px';
    for (const each of node.namespaces) {
        const line = document.createElement('div');
        line.dataset.namespace = each;
        line.style.cssText = 'display:flex;align-items:center;gap:8px';
        line.append(lightOff(`oidc-${each}`), Object.assign(document.createElement('span'), { textContent: each }));
        namespaces.appendChild(line);
    }
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:0 8px 8px';
    body.hidden = true;
    row.append(pressable(head, () => {
        body.hidden = !body.hidden;
        if (body.hidden || body.childElementCount > 0) return;
        anthropicSteps(body, node);
    }), namespaces, body);
    return row;
}

/** Exported for tests: the node's connectors, drawn from what the node says of itself. */
export function renderNodeConnectors(container: HTMLElement, node: NodeIdentity): void {
    container.style.cssText = 'display:flex;flex-direction:column;gap:8px';
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
        renderContent: () => {
            const content = document.createElement('div');
            nodeIdentity().then((node) => renderNodeConnectors(content, node)).catch((err: unknown) => {
                const said = err instanceof Error ? err.message : String(err);
                log.warn(SEG.SELF, `[node connectors] ${said}`);
                const why = document.createElement('div');
                why.className = 'status-unwell';
                why.textContent = said;
                content.appendChild(why);
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
