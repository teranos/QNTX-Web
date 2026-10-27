// Node Connectors, as stories/27-root-registers-the-node-with-anthropic.feature walks it.
// Tim: the wizard's screens, the snippet pasted whole, Anthropic's answer under it.
// Spike: part of what the node needs, a refused rule, what the Console puts around an ID.

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { idsIn, renderNodeConnectors, wizardName, type NodeIdentity } from './node-connectors-element';

const originalFetch = globalThis.fetch;
let asked: { url: string; method: string; body: Record<string, string> }[] = [];

/** What the node answers of itself at Anthropic, as anthropic am answers it. */
let atAnthropic: Record<string, unknown> = {};

/** The Connect workload wizard's snippet, as its copy button gives it. */
const SNIPPET = `# However your platform exposes its OIDC identity token
JWT="$YOUR_PLATFORM_OIDC_TOKEN"

curl -sS https://api.anthropic.com/v1/oauth/token \\
  -H "content-type: application/json" \\
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
        if (method === 'POST') {
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

function drawn(): HTMLElement {
    const held = document.createElement('div');
    document.body.appendChild(held);
    renderNodeConnectors(held, NODE);
    return held;
}

async function paste(held: HTMLElement, given: string): Promise<void> {
    const box = held.querySelector('[data-paste="snippet"]') as HTMLTextAreaElement;
    box.value = given;
    box.dispatchEvent(new Event('input'));
    await settle();
}

const copyables = (held: HTMLElement) => Array.from(held.querySelectorAll('[data-copyable]')).map((c) => c.textContent);
const light = (held: HTMLElement) => held.querySelector('[data-light="anthropic-oidc"]') as HTMLElement;

describe('Tim: ROOT connects the node at Anthropic with the Connect workload wizard (stories/27)', () => {
    test("the Anthropic row's light is not on, and each namespace's OIDC is shown", () => {
        const held = drawn();
        expect(light(held).dataset.on).toBe('false');
        for (const each of NODE.namespaces) expect(held.querySelector(`[data-light="oidc-${each}"]`)).not.toBeNull();
    });

    test('it links the Workload identity page, with Connect workload marked, then each screen of the wizard', () => {
        const held = drawn();
        expect(held.querySelector('a[href="https://platform.claude.com/settings/workload-identity-federation"]')).not.toBeNull();
        expect(held.textContent).toContain('Press Connect workload, then Custom OIDC.');
        const shots = Array.from(held.querySelectorAll<HTMLImageElement>('img[data-shot]')).map((i) => i.dataset.shot);
        expect(shots).toEqual(['anthropic-connect-workload.png', 'anthropic-wizard-issuer.png', 'anthropic-wizard-rule.png', 'anthropic-wizard-target.png', 'anthropic-wizard-test.png']);
    });

    test("it gives what each screen asks for, copyable: the node's issuer, its name as the wizard takes names, its DID", () => {
        const given = copyables(drawn());
        expect(given).toContain(NODE.issuer);
        expect(given).toContain(NODE.did);
        expect(given.filter((c) => c === 'qntx')).toHaveLength(2);
    });

    test("the wizard's snippet pasted whole: each ID found, the node asked without a press, Anthropic's answer right under the box", async () => {
        const held = drawn();
        await paste(held, SNIPPET);
        expect(held.querySelectorAll('[data-found] [data-given]')).toHaveLength(4);
        const posted = asked.find((a) => a.method === 'POST')!;
        expect(posted.url).toEndWith('/api/anthropic');
        expect(posted.body).toEqual({ given: SNIPPET });
        expect(light(held).dataset.accepted).toBe('true');
        expect(held.querySelector('[data-paste="snippet"]')!.nextElementSibling?.textContent).toBe('Anthropic accepts the node.');
    });
});

describe('Spike: what was pasted, as people paste it', () => {
    test("the rule's ID alone: found, the other three named as still needed, nothing asked of Anthropic", async () => {
        const held = drawn();
        await paste(held, '"federation_rule_id": "fdrl_01Kp4mjUuvKYj3yGjMwYfi81",');
        expect(held.querySelectorAll('[data-found] [data-given]')).toHaveLength(1);
        expect(held.querySelector('[data-found]')!.textContent).toContain("The organization's ID is still needed");
        expect(asked.some((a) => a.method === 'POST')).toBe(false);
    });

    test('a rule Anthropic refuses: red, with what Anthropic said, as an error that copies, right under the box', async () => {
        const held = drawn();
        await paste(held, SNIPPET.replace('fdrl_01Kp4mjUuvKYj3yGjMwYfi81', 'fdrl_refused'));
        expect(light(held).dataset.accepted).toBe('false');
        const said = held.querySelector('[data-paste="snippet"]')!.nextElementSibling!.firstElementChild as HTMLElement;
        expect(said.dataset.error).toBe('');
        expect(said.hasAttribute('data-copyable')).toBe(true);
        expect(said.textContent).toContain('Authentication failed');
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
