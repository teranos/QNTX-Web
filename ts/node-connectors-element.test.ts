/**
 * Node Connectors, as stories/27-root-registers-the-node-with-anthropic.feature walks it.
 *
 * Personas:
 * - Tim: Happy path — the Anthropic row, its light, and the steps it opens into
 */

import { describe, test, expect } from 'bun:test';
import { renderNodeConnectors, type NodeIdentity } from './node-connectors-element';

const NODE: NodeIdentity = {
    name: 'q',
    issuer: 'https://api.q.sbvh.nl',
    did: 'did:key:z6Mkh24w5VtGRLhZ3HWCKMyDQuY4VtvmmxWp8HC2toKgNLed',
    namespaces: ['pond', 'Clean'],
};

function drawn(): HTMLElement {
    const held = document.createElement('div');
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
});
