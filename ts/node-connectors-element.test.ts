/**
 * Node Connectors, as stories/27-root-registers-the-node-with-anthropic.feature walks it.
 *
 * Personas:
 * - Tim: Happy path — the Anthropic row, its light, and the steps it opens into
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { renderNodeConnectors, type NodeIdentity } from './node-connectors-element';

const originalFetch = globalThis.fetch;
let asked: { url: string; method: string; body: Record<string, string> }[] = [];

/** What the node answers of itself at Anthropic, as anthropic am answers it. */
let atAnthropic: Record<string, unknown> = {};

beforeEach(() => {
    asked = [];
    atAnthropic = { issuer: 'https://api.q.sbvh.nl', subject: 'did:key:z6Mkh24w5VtGRLhZ3HWCKMyDQuY4VtvmmxWp8HC2toKgNLed', asked: false, accepted: false, why: '' };
    globalThis.fetch = mock((url: any, init: any) => {
        const method = init?.method ?? 'GET';
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        asked.push({ url: String(url), method, body });
        if (method === 'POST') {
            // Anthropic accepts the node at fdrl_node alone.
            const accepted = body.federation_rule_id === 'fdrl_node';
            atAnthropic = { ...atAnthropic, ...body, asked: true, accepted, why: accepted ? '' : 'Authentication failed' };
        }
        return Promise.resolve(new Response(JSON.stringify(atAnthropic), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }) as unknown as typeof fetch;
});
afterEach(() => { globalThis.fetch = originalFetch; });

async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 1));
}

/** The three ids given, and the press pressed twice: the first arms it. */
async function give(held: HTMLElement, rule: string): Promise<void> {
    const ids: Record<string, string> = { 'anthropic-organization-id': '00000000-0000-0000-0000-000000000000', 'anthropic-rule-id': rule, 'anthropic-service-account-id': 'svac_node' };
    for (const [id, value] of Object.entries(ids)) (held.querySelector(`[data-field="${id}"] input`) as HTMLInputElement).value = value;
    const press = held.querySelector('[data-press="give-anthropic-rule"]') as HTMLElement;
    press.click();
    press.click();
    for (let i = 0; i < 50 && !asked.some((a) => a.method === 'POST'); i++) await new Promise((r) => setTimeout(r, 1));
    await settle();
}


const NODE: NodeIdentity = {
    name: 'q',
    issuer: 'https://api.q.sbvh.nl',
    did: 'did:key:z6Mkh24w5VtGRLhZ3HWCKMyDQuY4VtvmmxWp8HC2toKgNLed',
    namespaces: ['pond', 'Clean'],
};

function drawn(): HTMLElement {
    const held = document.createElement('div');
    document.body.appendChild(held);
    renderNodeConnectors(held, NODE);
    return held;
}

function opened(): HTMLElement {
    const held = drawn();
    (held.querySelector('[data-connect="Anthropic"]') as HTMLElement).click();
    return held;
}

const copyables = (held: HTMLElement) => Array.from(held.querySelectorAll('[data-copyable]')).map((c) => c.textContent);

describe('Tim: ROOT registers the node at Anthropic (stories/27)', () => {
    test("the Anthropic row's light is not on", () => {
        const light = drawn().querySelector('[data-light="anthropic-oidc"]') as HTMLElement;
        expect(light.dataset.on).toBe('false');
    });

    test("it shows whether each namespace's OIDC is set up", () => {
        const held = drawn();
        for (const each of NODE.namespaces) {
            expect((held.querySelector(`[data-light="oidc-${each}"]`) as HTMLElement).dataset.on, each).toBe('false');
        }
    });

    test("pressing the Anthropic row shows the node's issuer, copyable, and the link to the Console", () => {
        const held = opened();
        expect(copyables(held)).toContain(NODE.issuer);
        expect(held.querySelector('a[href="https://platform.claude.com/settings/workload-identity-federation"]')).not.toBeNull();
    });

    test('it shows the Console at each step, with what to press marked', () => {
        const shots = Array.from(opened().querySelectorAll<HTMLImageElement>('img[data-shot]')).map((i) => i.dataset.shot);
        expect(shots).toEqual([
            'anthropic-workload-identity.png',
            'anthropic-register-issuer.png',
            'anthropic-service-accounts.png',
            'anthropic-create-service-account.png',
            'anthropic-rules-next-to-issuers.png',
            'anthropic-rules.png',
            'anthropic-create-rule.png',
            'anthropic-create-rule-target.png',
            'anthropic-organization.png',
        ]);
    });

    test("the node's name and DID are given copyable, for the forms that ask for them", () => {
        const given = copyables(opened());
        expect(given.filter((c) => c === NODE.name)).toHaveLength(3);
        expect(given).toContain(NODE.did);
    });

    test('it links the service accounts and the organization pages', () => {
        const held = opened();
        expect(held.querySelector('a[href="https://platform.claude.com/settings/service-accounts"]')).not.toBeNull();
        expect(held.querySelector('a[href="https://platform.claude.com/settings/organization"]')).not.toBeNull();
    });

    test('the organization id, the rule id and the service account id are given to the node, and Anthropic accepting lights it green', async () => {
        const held = opened();
        await give(held, 'fdrl_node');
        const posted = asked.find((a) => a.method === 'POST')!;
        expect(posted.url).toEndWith('/api/anthropic');
        expect(posted.body).toEqual({ organization_id: '00000000-0000-0000-0000-000000000000', federation_rule_id: 'fdrl_node', service_account_id: 'svac_node' });
        const light = held.querySelector('[data-light="anthropic-oidc"]') as HTMLElement;
        expect(light.dataset.accepted).toBe('true');
        expect(light.style.backgroundColor).not.toBe('');
    });

    test('a rule Anthropic does not accept the node at lights it red, with what Anthropic said', async () => {
        const held = opened();
        await give(held, 'fdrl_other');
        const light = held.querySelector('[data-light="anthropic-oidc"]') as HTMLElement;
        expect(light.dataset.on).toBe('true');
        expect(light.dataset.accepted).toBe('false');
        expect(held.textContent).toContain('Authentication failed');
    });

    test('the light the node says is there on opening', async () => {
        atAnthropic = { ...atAnthropic, asked: true, accepted: true };
        const held = drawn();
        await settle();
        expect((held.querySelector('[data-light="anthropic-oidc"]') as HTMLElement).dataset.accepted).toBe('true');
    });
});
