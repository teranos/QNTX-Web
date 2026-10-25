// Connector Element — a connection set up in one place, its URL, id and secret said where it was made.
// Tim: USER sets up a connection (story 9); ROOT connects an app to the node (story 10).
// Spike: what is not said.

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { nodeMCPOf, renderConnector, rootsClient } from './connector-element';

const NODE = 'https://api.q.sbvh.nl/mcp';

const originalFetch = globalThis.fetch;
let sent: Record<string, unknown> | undefined;

beforeEach(() => {
    document.body.innerHTML = '';
    sent = undefined;
    globalThis.fetch = mock((url: any, init: any) => {
        if (String(url).endsWith('/auth/tokens')) sent = JSON.parse(String(init?.body));
        return Promise.resolve(new Response(JSON.stringify({
            id: 'AT_1', label: 'chatgpt', token: 'qntx_secret', did: 'did:key:zclient', created_at: '',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }) as unknown as typeof fetch;
});
afterEach(() => { globalThis.fetch = originalFetch; });

/** The second press creates: the first arms it. */
async function pressTwice(held: HTMLElement): Promise<void> {
    const press = held.querySelector('[data-press]') as HTMLElement;
    press.click();
    press.click();
    for (let i = 0; i < 50 && !held.textContent?.includes('qntx_secret'); i++) await new Promise((r) => setTimeout(r, 1));
}

function fill(held: HTMLElement, field: string, value: string): void {
    const input = held.querySelector(`[data-field="${field}"] input`) as HTMLInputElement;
    input.value = value;
}

// "THE USER SETUP'S UP CONNECTIONS"
describe('Tim: USER sets up a connection', () => {
    test('the server URL, the client id and the secret are said where the connection was made', async () => {
        const held = document.createElement('div');
        document.body.appendChild(held);
        renderConnector(held, NODE, ['Clean', 'default']);
        (held.querySelector('select') as HTMLSelectElement).value = 'Clean';
        fill(held, 'connector-label', 'chatgpt');
        fill(held, 'connector-return', 'https://chatgpt.com/connector/oauth/abc');
        await pressTwice(held);

        expect(sent).toMatchObject({ label: 'chatgpt', level: 'OAUTH', namespaces: ['Clean'], return_address: 'https://chatgpt.com/connector/oauth/abc' });
        expect(sent!.root).toBeUndefined();
        expect(held.textContent).toContain('https://api.q.sbvh.nl/mcp/Clean');
        expect(held.textContent).toContain('did:key:zclient');
        expect(held.textContent).toContain('qntx_secret');
    });
});

// "ROOT WANTS AN MCP OVER THE ENTIRE SERVER, SET VIA EITHER I OR AM"
describe('Tim: ROOT connects an app to the node', () => {
    test("ROOT's client names no namespace, and the node's server URL is said with its id and secret", async () => {
        const held = rootsClient(NODE);
        document.body.appendChild(held);
        fill(held, 'roots-client-label', 'chatgpt');
        fill(held, 'roots-client-return', 'https://chatgpt.com/connector/oauth/abc');
        await pressTwice(held);

        expect(sent).toMatchObject({ label: 'chatgpt', level: 'OAUTH', root: true, return_address: 'https://chatgpt.com/connector/oauth/abc' });
        expect(sent!.namespaces).toEqual([]);
        expect(held.textContent).toContain(NODE);
        expect(held.textContent).toContain('did:key:zclient');
        expect(held.textContent).toContain('qntx_secret');
    });
});

describe('Spike: what is not said', () => {
    test('a card naming no MCP server names none', () => {
        expect(nodeMCPOf({})).toBeUndefined();
        expect(nodeMCPOf({ capabilities: { extensions: [{ params: {} }] } })).toBeUndefined();
    });

    test('the URL is read off the card the node gives (am node)', () => {
        const card = { capabilities: { extensions: [{ params: {} }, { params: { mcp: { url: NODE, protocolVersion: '2026-07-28' } } }] } };
        expect(nodeMCPOf(card)).toBe(NODE);
    });

    test('no namespace picked, nothing is minted', async () => {
        const held = document.createElement('div');
        document.body.appendChild(held);
        renderConnector(held, NODE, ['Clean']);
        fill(held, 'connector-label', 'chatgpt');
        fill(held, 'connector-return', 'https://chatgpt.com/connector/oauth/abc');
        await pressTwice(held);
        expect(sent).toBeUndefined();
    });

    test('nothing in it is underlined: no URL here is a link out', () => {
        const held = document.createElement('div');
        renderConnector(held, NODE, ['Clean']);
        expect(held.querySelector('a')).toBeNull();
    });
});
