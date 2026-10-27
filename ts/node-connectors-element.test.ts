// Node Connectors, as stories/27-root-registers-the-node-with-anthropic.feature walks it.
// Tim: the wizard's steps one at a time, the snippet pasted whole, Done once Anthropic accepts the node.
// Spike: part of what the node needs, a refused rule, Done pressed too soon, what the Console puts around an ID.

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { idsIn, renderNodeConnectors, wizardName, type NodeIdentity } from './node-connectors-element';

const originalFetch = globalThis.fetch;
let asked: { url: string; method: string; body: Record<string, string> }[] = [];

/** What the node answers of itself at Anthropic, as anthropic am answers it. */
let atAnthropic: Record<string, unknown> = {};

/** The Connect workload wizard's snippet, as its copy button gives it. */
const SNIPPET = `curl -sS https://api.anthropic.com/v1/oauth/token \\
  --data @- <<JSON
{
  "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
  "assertion": "$JWT",
  "federation_rule_id": "fdrl_01Kp4mjUuvKYj3yGjMwYfi81",
  "organization_id": "377885f2-bf73-4758-9338-dcfe26b37568",
  "service_account_id": "svac_01KNepFSKtHDxy3GuBdRbcEB",
  "workspace_id": "wrkspc_01YbvLt3KhHVJZ3hK6kA7bGA"
}
JSON`;

const NODE: NodeIdentity = {
    name: 'QNTX',
    issuer: 'https://api.q.sbvh.nl',
    did: 'did:key:z6Mkh24w5VtGRLhZ3HWCKMyDQuY4VtvmmxWp8HC2toKgNLed',
    namespaces: ['pond', 'Clean'],
};

beforeEach(() => {
    document.body.innerHTML = '';
    asked = [];
    atAnthropic = { issuer: NODE.issuer, subject: NODE.did, asked: false, accepted: false, why: '' };
    globalThis.fetch = mock((url: any, init: any) => {
        const method = init?.method ?? 'GET';
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        asked.push({ url: String(url), method, body });
        if (method === 'POST' && String(url).endsWith('/api/anthropic/order')) {
            atAnthropic = { ...atAnthropic, first: body.first, then: body.then === 'true' };
        } else if (method === 'POST') {
            // Anthropic accepts the node at any rule but fdrl_refused.
            const ids = idsIn(body.given);
            const accepted = ids.federation_rule_id !== 'fdrl_refused';
            atAnthropic = { ...atAnthropic, ...ids, asked: true, accepted, why: accepted ? '' : 'oauth token request failed (status 401): Authentication failed' };
        }
        return Promise.resolve(new Response(JSON.stringify(atAnthropic), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }) as unknown as typeof fetch;
});
afterEach(() => { globalThis.fetch = originalFetch; });

async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 1));
}

async function drawn(): Promise<HTMLElement> {
    const held = document.createElement('div');
    document.body.appendChild(held);
    renderNodeConnectors(held, NODE);
    await settle();
    return held;
}

async function press(held: HTMLElement, id: string): Promise<void> {
    (held.querySelector(`[data-press="${id}"]`) as HTMLButtonElement).click();
    await settle();
}

/** On to the wizard's Test step, through the four before it. */
async function atTest(): Promise<HTMLElement> {
    const held = await drawn();
    for (let i = 0; i < 4; i++) await press(held, 'anthropic-setup-continue');
    return held;
}

async function paste(held: HTMLElement, given: string): Promise<void> {
    const box = held.querySelector('[data-paste="snippet"]') as HTMLTextAreaElement;
    box.value = given;
    box.dispatchEvent(new Event('input'));
    await settle();
}

const panel = (held: HTMLElement) => held.querySelector('[data-flow-panel]') as HTMLElement;
const copyables = (held: HTMLElement) => Array.from(panel(held).querySelectorAll('[data-copyable]')).map((c) => c.textContent);
const light = (held: HTMLElement) => held.querySelector('[data-light="anthropic-oidc"]') as HTMLElement;

describe('Tim: ROOT connects the node at Anthropic with the Connect workload wizard (stories/27)', () => {
    test("the light is not on, each namespace's OIDC is shown, and the steps are the wizard's", async () => {
        const held = await drawn();
        expect(light(held).dataset.state).toBe('off');
        for (const each of NODE.namespaces) expect(held.querySelector(`[data-light="oidc-${each}"]`)).not.toBeNull();
        const steps = Array.from(held.querySelectorAll('[data-flow-step]')).map((s) => s.textContent);
        expect(steps).toEqual([
            '1Connect workloadOpen the wizard',
            '2IssuerSelect or register the provider',
            '3Federation ruleMatch conditions and workspaces',
            '4TargetPick a service account',
            '5TestVerify end-to-end',
        ]);
    });

    test('the first step links the Workload identity page, with Connect workload marked', async () => {
        const held = await drawn();
        expect(panel(held).querySelector('a[href="https://platform.claude.com/settings/workload-identity-federation"]')).not.toBeNull();
        expect(panel(held).textContent).toContain('Press Connect workload, then Custom OIDC.');
        expect(panel(held).querySelector<HTMLImageElement>('img[data-shot]')!.dataset.shot).toBe('anthropic-connect-workload.png');
    });

    test('each step gives what that screen of the wizard asks for, copyable', async () => {
        const held = await drawn();
        await press(held, 'anthropic-setup-continue');
        expect(copyables(held)).toEqual([NODE.issuer]);
        await press(held, 'anthropic-setup-continue');
        expect(copyables(held)).toEqual([wizardName(NODE.name), NODE.did]);
        await press(held, 'anthropic-setup-continue');
        expect(copyables(held)).toEqual([wizardName(NODE.name)]);
    });

    test("the wizard's snippet pasted whole: each ID found, the node asked without a press, Anthropic's answer under the field, and Done ends it", async () => {
        const held = await atTest();
        await paste(held, SNIPPET);
        expect(panel(held).querySelectorAll('[data-found] [data-given]')).toHaveLength(4);
        const posted = asked.find((a) => a.method === 'POST')!;
        expect(posted.url).toEndWith('/api/anthropic');
        expect(posted.body).toEqual({ given: SNIPPET });
        expect(light(held).dataset.state).toBe('on');
        expect(panel(held).querySelector('[data-outcome]')!.textContent).toBe('Anthropic accepts the node.');
        await press(held, 'anthropic-setup-done');
        expect(held.querySelector('[data-flow]')).toBeNull();
        expect(held.querySelectorAll('[data-set-up] [data-given]')).toHaveLength(4);
        expect(held.querySelector('[data-press="anthropic-set-up-again"]')).not.toBeNull();
    });

    test('a node Anthropic already accepts opens on what was set up, and setting it up again is the flow', async () => {
        atAnthropic = { ...atAnthropic, asked: true, accepted: true, federation_rule_id: 'fdrl_x', organization_id: '377885f2-bf73-4758-9338-dcfe26b37568', service_account_id: 'svac_x', workspace_id: 'wrkspc_x' };
        const held = await drawn();
        expect(held.querySelector('[data-flow]')).toBeNull();
        expect(light(held).dataset.state).toBe('on');
        await press(held, 'anthropic-set-up-again');
        expect(held.querySelector('[data-flow]')).not.toBeNull();
    });
});

describe('Spike: what was pasted, as people paste it', () => {
    test("the rule's ID alone: found, the other three named as still needed, nothing asked of Anthropic", async () => {
        const held = await atTest();
        await paste(held, '"federation_rule_id": "fdrl_01Kp4mjUuvKYj3yGjMwYfi81",');
        expect(panel(held).querySelectorAll('[data-found] [data-given]')).toHaveLength(1);
        expect(panel(held).querySelector('[data-found]')!.textContent).toContain("The organization's ID is still needed");
        expect(asked.some((a) => a.method === 'POST')).toBe(false);
    });

    test('Done pressed before Anthropic accepts the node says what is still needed, and stays', async () => {
        const held = await atTest();
        await press(held, 'anthropic-setup-done');
        expect(held.querySelector('[data-flow]')).not.toBeNull();
        expect(held.textContent).toContain("Paste the wizard's snippet, and Anthropic accepts the node.");
    });

    test('a rule Anthropic refuses: red, with what Anthropic said, as an error that copies, and Done still held', async () => {
        const held = await atTest();
        await paste(held, SNIPPET.replace('fdrl_01Kp4mjUuvKYj3yGjMwYfi81', 'fdrl_refused'));
        expect(light(held).dataset.state).toBe('refused');
        const said = panel(held).querySelector('[data-outcome] [data-error]') as HTMLElement;
        expect(said.hasAttribute('data-copyable')).toBe(true);
        expect(said.textContent).toContain('Authentication failed');
        await press(held, 'anthropic-setup-done');
        expect(held.querySelector('[data-flow]')).not.toBeNull();
    });

    test('an ID as the Console shows it, label and quotes and all, is the ID', () => {
        expect(idsIn('Organization ID: 377885f2-bf73-4758-9338-dcfe26b37568')).toEqual({ organization_id: '377885f2-bf73-4758-9338-dcfe26b37568' });
        expect(idsIn(' "svac_01KNepFSKtHDxy3GuBdRbcEB" ')).toEqual({ service_account_id: 'svac_01KNepFSKtHDxy3GuBdRbcEB' });
        expect(idsIn('fdrl_')).toEqual({});
    });

    test("the node's name as the wizard takes a name: lowercase letters, numbers and hyphens", () => {
        expect(wizardName('QNTX')).toBe('qntx');
        expect(wizardName('My Node_1')).toBe('my-node-1');
    });
});

const spendRows = (held: HTMLElement) => Array.from(held.querySelectorAll('[data-spend] [data-source]')).map((l) => (l as HTMLElement).dataset.source);
const inUse = (held: HTMLElement) => held.querySelector('[data-spend] [data-in-use="true"]')?.previousElementSibling as HTMLElement | null;

// "the Anthropic Node Connector needs to show two light indicators,"
// "the one that already exists, and the session"
// "and it needs to be clear which one we are using."
// "as a ROOT user, i expect to see balance."
// "we use session first until exhaustion"
// "Optionally declare that iodc Console balance will be utilised when session is exhausted"
// "we use iodc Console balance until exhaustion"
// "Optionally declare that we will use session when API balance is exhausted"
describe('Tim: ROOT orders what its agents spend (stories/29)', () => {
    test('the session and the Console, in the order they are spent, the one in use marked, with what is left of the session', async () => {
        atAnthropic = { ...atAnthropic, asked: true, accepted: true, first: 'session', then: false, in_use: 'session',
            session: [{ window: 'five_hour', used_percentage: 88, resets_at: 0, at: '' }, { window: 'seven_day', used_percentage: 41, resets_at: 0, at: '' }] };
        const held = await drawn();
        expect(spendRows(held)).toEqual(['session', 'console']);
        expect(inUse(held)?.dataset.source).toBe('session');
        expect(held.querySelector('[data-light="anthropic-session"]')!.textContent).toBe('Session 12% left');
        expect(light(held).textContent).toBe('Console accepted');
    });

    test('ticking the second says it follows; swapping makes the Console first', async () => {
        atAnthropic = { ...atAnthropic, asked: true, accepted: true, first: 'session', then: false };
        const held = await drawn();
        await press(held, 'anthropic-then');
        expect(asked.at(-1)!.url).toEndWith('/api/anthropic/order');
        expect(asked.at(-1)!.body).toEqual({ first: 'session', then: 'true' });
        expect(held.querySelector('[data-press="anthropic-then"]')!.textContent).toContain('☑');
        await press(held, 'anthropic-swap');
        expect(asked.at(-1)!.body).toEqual({ first: 'console', then: 'true' });
        expect(spendRows(held)).toEqual(['console', 'session']);
    });

    test('a session with nothing left is red, and the mark moves to what ROOT\'s agents run on', async () => {
        atAnthropic = { ...atAnthropic, asked: true, accepted: true, first: 'session', then: true, in_use: 'console',
            session: [{ window: 'five_hour', used_percentage: 100, resets_at: 0, at: '' }] };
        const held = await drawn();
        expect((held.querySelector('[data-light="anthropic-session"]') as HTMLElement).dataset.state).toBe('refused');
        expect(inUse(held)?.dataset.source).toBe('console');
    });
});
