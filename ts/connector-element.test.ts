// Connectors (⧉) — what a USER connects, each with its maker's mark, each its own story (stories 9, 11-14, 5).
// Tim: the list, and each story through. Spike: standing nowhere, and a key never said back.

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { nodeMCPOf, renderConnectors, rootsClient } from './connector-element';

const NODE = 'https://api.q.sbvh.nl/mcp';

const originalFetch = globalThis.fetch;
let asked: { url: string; body: Record<string, unknown> }[] = [];

beforeEach(() => {
    document.body.innerHTML = '';
    asked = [];
    globalThis.fetch = mock((url: any, init: any) => {
        asked.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : {} });
        return Promise.resolve(new Response(JSON.stringify({
            id: 'AT_1', label: 'x', token: 'qntx_secret', did: 'did:key:zclient', created_at: '',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }) as unknown as typeof fetch;
});
afterEach(() => { globalThis.fetch = originalFetch; });

/** The second press creates: the first arms it. */
async function pressTwice(held: HTMLElement, id: string): Promise<void> {
    const before = asked.length;
    const press = held.querySelector(`[data-press="${id}"]`) as HTMLElement;
    press.click();
    press.click();
    for (let i = 0; i < 50 && asked.length === before; i++) await new Promise((r) => setTimeout(r, 1));
    await new Promise((r) => setTimeout(r, 5));
}

function drawn(standing: string, opened: string[] = []): HTMLElement {
    const held = document.createElement('div');
    document.body.appendChild(held);
    renderConnectors(held, { node: NODE, standing, open: (id) => opened.push(id) });
    return held;
}

function choose(held: HTMLElement, brand: string): void {
    (held.querySelector(`[data-connect="${brand}"]`) as HTMLElement).click();
}

// "ROOT WANTS AN MCP OVER THE ENTIRE SERVER, SET VIA EITHER I OR AM"
describe('Tim: ROOT connects an app to the node', () => {
    test("ROOT's client names no namespace, and the node's server URL is said with its id and secret", async () => {
        const held = rootsClient(NODE);
        document.body.appendChild(held);
        (held.querySelector('[data-field="roots-client-label"] input') as HTMLInputElement).value = 'chatgpt';
        (held.querySelector('[data-field="roots-client-return"] input') as HTMLInputElement).value = 'https://chatgpt.com/connector/oauth/abc';
        await pressTwice(held, 'roots-client');

        expect(asked[0]!.body).toMatchObject({ label: 'chatgpt', level: 'OAUTH', root: true, namespaces: [] });
        expect(held.textContent).toContain(NODE);
        expect(held.textContent).toContain('qntx_secret');
    });
});

// "AS A USER I EXPECT TO SEE THE CONNECTORS ELEMENT"
describe('Tim: USER sees what can be connected', () => {
    test('each with its own mark and color, and no namespace to pick', () => {
        const held = drawn('Clean');
        for (const brand of ['ChatGPT', 'Claude', 'Obsidian', 'OpenRouter', 'GitHub']) {
            const tile = held.querySelector(`[data-connect="${brand}"]`);
            expect(tile, brand).not.toBeNull();
            expect(tile!.querySelector('svg path')?.getAttribute('d')).toBeTruthy();
        }
        expect(held.querySelector<HTMLElement>('[data-connect="Claude"] [data-brand]')?.dataset.hex).toBe('D97757');
        expect(held.querySelector('select')).toBeNull();
    });
});

describe('Tim: each leads to its own story', () => {
    test('Claude: nothing to type, connected in the namespace stood in (story 12)', async () => {
        const held = drawn('Clean');
        choose(held, 'Claude');
        expect(held.querySelector('input')).toBeNull();
        await pressTwice(held, 'connect-claude');

        const minted = asked.find((a) => a.url.endsWith('/auth/tokens'))!;
        expect(minted.body).toMatchObject({ level: 'OAUTH', namespaces: ['Clean'], return_address: 'https://claude.ai/api/mcp/auth_callback' });
        expect(String(minted.body.label)).toStartWith('Claude');
        expect(held.textContent).toContain('https://api.q.sbvh.nl/mcp/Clean');
        expect(held.textContent).toContain('did:key:zclient');
        expect(held.textContent).toContain('qntx_secret');
    });

    test('ChatGPT: only the callback ChatGPT made is given (story 11)', async () => {
        const held = drawn('Clean');
        choose(held, 'ChatGPT');
        const inputs = held.querySelectorAll('input');
        expect(inputs).toHaveLength(1);
        inputs[0]!.value = 'https://chatgpt.com/connector/oauth/abc';
        await pressTwice(held, 'connect-chatgpt');

        const minted = asked.find((a) => a.url.endsWith('/auth/tokens'))!;
        expect(minted.body).toMatchObject({ level: 'OAUTH', namespaces: ['Clean'], return_address: 'https://chatgpt.com/connector/oauth/abc' });
        expect(held.textContent).toContain('client_secret_post');
        expect(held.textContent).toContain('qntx_secret');
    });

    // "you can connect multiple chatgpt accounts"
    test('ChatGPT twice is two connections, each its own name', async () => {
        const first = drawn('Clean');
        choose(first, 'ChatGPT');
        first.querySelector('input')!.value = 'https://chatgpt.com/connector/oauth/one';
        await pressTwice(first, 'connect-chatgpt');
        const second = drawn('Clean');
        choose(second, 'ChatGPT');
        second.querySelector('input')!.value = 'https://chatgpt.com/connector/oauth/two';
        await pressTwice(second, 'connect-chatgpt');

        const labels = asked.filter((a) => a.url.endsWith('/auth/tokens')).map((a) => a.body.label);
        expect(labels).toHaveLength(2);
        expect(labels[0]).not.toBe(labels[1]);
    });

    test('OpenRouter: the key is kept by the namespace stood in (story 14)', async () => {
        const held = drawn('Clean');
        choose(held, 'OpenRouter');
        const key = held.querySelector('input') as HTMLInputElement;
        expect(key.type).toBe('password');
        key.value = 'sk-or-secret';
        await pressTwice(held, 'connect-openrouter');

        const set = asked.find((a) => a.url.endsWith('/api/keys/Clean'))!;
        expect(set.body).toEqual({ name: 'openrouter', value: 'sk-or-secret' });
        expect(held.textContent).not.toContain('sk-or-secret');
    });

    test('Obsidian and GitHub open their own elements (stories 13 and 5)', () => {
        const opened: string[] = [];
        const held = drawn('Clean', opened);
        choose(held, 'Obsidian');
        choose(held, 'GitHub');
        expect(opened).toEqual(['obsidian-element', 'github-element']);
    });
});

describe('Spike: what is not said', () => {
    test('standing in no namespace, nothing is connected', () => {
        const held = drawn('');
        choose(held, 'Claude');
        expect(held.textContent).toContain('no namespace');
        expect(held.querySelector('[data-press="connect-claude"]')).toBeNull();
    });

    test('a card naming no MCP server names none', () => {
        expect(nodeMCPOf({})).toBeUndefined();
        expect(nodeMCPOf({ capabilities: { extensions: [{ params: {} }] } })).toBeUndefined();
    });

    test('nothing in it is underlined: no URL here is a link out', () => {
        expect(drawn('Clean').querySelector('a')).toBeNull();
    });
});
