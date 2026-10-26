// Connectors (⧉): one row per platform, each opening into its own stories (stories/9, 11, 12, 20, 21, 14, 13, 5).
// Tim: the rows, each platform through. Spike: standing nowhere, a key never said back, a key its platform refuses.

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { MEANS } from '@teranos/elements';
import { createConnectorElement, nodeMCPOf, renderConnectors, rootsClient } from './connector-element';

const NODE = 'https://api.q.sbvh.nl/mcp';

const originalFetch = globalThis.fetch;
let asked: { url: string; method: string; body: Record<string, unknown> }[] = [];

/** What the node holds of Clean's keys, as keys list answers it. */
let keys: { name: string; set_by: string; at: string; asked: boolean; accepted: boolean; why: string }[] = [];

function answer(body: unknown): Promise<Response> {
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

beforeEach(() => {
    document.body.innerHTML = '';
    asked = [];
    keys = [];
    globalThis.fetch = mock((url: any, init: any) => {
        const method = init?.method ?? 'GET';
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        asked.push({ url: String(url), method, body });
        if (String(url).endsWith('/api/keys/Clean')) {
            if (method === 'POST') {
                // The platform issued only sk-ant-issued.
                const accepted = body.value === 'sk-ant-issued';
                keys = [{ name: body.name, set_by: 'me', at: '', asked: true, accepted, why: accepted ? '' : 'anthropic answered 401' }];
            }
            return answer({ namespace: 'Clean', keys });
        }
        return answer({ id: 'AT_1', label: 'x', token: 'qntx_secret', did: 'did:key:zclient', created_at: '' });
    }) as unknown as typeof fetch;
});
afterEach(() => { globalThis.fetch = originalFetch; });

/** Lets what was asked of the node be answered. */
async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 1));
}

/** The second press creates: the first arms it. */
async function pressTwice(held: HTMLElement, id: string): Promise<void> {
    const before = asked.length;
    const press = held.querySelector(`[data-press="${id}"]`) as HTMLElement;
    press.click();
    press.click();
    for (let i = 0; i < 50 && asked.length === before; i++) await new Promise((r) => setTimeout(r, 1));
    await settle();
}

function drawn(standing: string, opened: string[] = []): HTMLElement {
    const held = document.createElement('div');
    document.body.appendChild(held);
    renderConnectors(held, { node: NODE, standing, open: (id) => opened.push(id) });
    return held;
}

function row(held: HTMLElement, platform: string): HTMLElement {
    return held.querySelector(`[data-platform="${platform}"]`) as HTMLElement;
}

function choose(held: HTMLElement, platform: string): HTMLElement {
    (row(held, platform).querySelector('[data-connect]') as HTMLElement).click();
    return row(held, platform);
}

function part(inRow: HTMLElement, name: string): HTMLElement {
    (inRow.querySelector(`[data-part="${name}"]`) as HTMLElement).click();
    return inRow;
}

// "ROOT WANTS AN MCP OVER THE ENTIRE SERVER, SET VIA EITHER I OR AM ELEMENT"
describe('Tim: ROOT connects an app to the node', () => {
    test("ROOT's client names no namespace, and the node's server URL is said with its id and secret", async () => {
        const held = rootsClient(NODE);
        document.body.appendChild(held);
        expect(held.tagName).toBe('DETAILS');
        (held.querySelector('[data-field="roots-client-label"] input') as HTMLInputElement).value = 'chatgpt';
        (held.querySelector('[data-field="roots-client-return"] input') as HTMLInputElement).value = 'https://chatgpt.com/connector/oauth/abc';
        await pressTwice(held, 'roots-client');

        expect(asked[0]!.body).toMatchObject({ label: 'chatgpt', level: 'OAUTH', root: true, namespaces: [] });
        expect(held.textContent).toContain(NODE);
        await expectSecretHiddenAndCopied(held);
    });
});

describe('Tim: USER sees one row per platform (stories/9)', () => {
    test('Obsidian, OpenRouter, Anthropic, OpenAI and GitHub, each with its own mark', () => {
        const held = drawn('Clean');
        for (const platform of ['Obsidian', 'OpenRouter', 'Anthropic', 'OpenAI', 'GitHub']) {
            expect(row(held, platform), platform).not.toBeNull();
            expect(row(held, platform).querySelector('svg path')?.getAttribute('d'), platform).toBeTruthy();
        }
        expect(held.querySelectorAll('[data-platform]')).toHaveLength(5);
        expect(held.querySelector('select')).toBeNull();
    });

    test('the server MCP URL of the namespace stood in is there on opening, and a click copies it', () => {
        const url = drawn('Clean').querySelector('[data-mcp-url]') as HTMLElement;
        expect(url.textContent).toBe(`${NODE}/Clean`);
        expect(url.hasAttribute('data-copyable')).toBe(true);
    });

    test('Connectors draws its rows before the node answers, so it opens measured whole', () => {
        globalThis.fetch = mock(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
        const content = createConnectorElement().renderContent!();
        expect(content.querySelectorAll('[data-platform]')).toHaveLength(5);
    });

    test('a platform opens inside its own row', () => {
        const held = drawn('Clean');
        const anthropic = choose(held, 'Anthropic');
        expect(anthropic.querySelector('[data-part="add QNTX MCP to Claude"]')).not.toBeNull();
        expect(row(held, 'OpenAI').querySelector('[data-part]')).toBeNull();
    });
});

describe('Tim: Anthropic leads to three stories (stories/12)', () => {
    test('add QNTX MCP to Claude, Claude Code, and the Anthropic API key', () => {
        const anthropic = choose(drawn('Clean'), 'Anthropic');
        for (const name of ['add QNTX MCP to Claude', 'Claude Code', 'Anthropic API key']) {
            expect(anthropic.querySelector(`[data-part="${name}"]`), name).not.toBeNull();
        }
    });

    test('add QNTX MCP to Claude: connected in the namespace stood in, id and secret copied by a click (stories/20)', async () => {
        const held = drawn('Clean');
        part(choose(held, 'Anthropic'), 'add QNTX MCP to Claude');
        await pressTwice(held, 'connect-claude');

        const minted = asked.find((a) => a.url.endsWith('/auth/tokens'))!;
        expect(minted.body).toMatchObject({ level: 'OAUTH', namespaces: ['Clean'], return_address: 'https://claude.ai/api/mcp/auth_callback' });
        const copied = Array.from(held.querySelectorAll('[data-copyable]')).map((c) => c.textContent);
        expect(copied).toContain('did:key:zclient');
        await expectSecretHiddenAndCopied(held);
        expect(held.querySelector<HTMLAnchorElement>('a[href="https://claude.ai/new?modal=add-custom-connector#customize/connectors/yours"]')).not.toBeNull();
    });

    test('Claude Code opens the agent of the namespace stood in', () => {
        const opened: string[] = [];
        part(choose(drawn('Clean', opened), 'Anthropic'), 'Claude Code');
        expect(opened).toEqual(['agent-element']);
    });
});

describe('Tim: USER sets the Anthropic key (stories/21)', () => {
    test("I am sent to the platform's keys, and the key is kept by the namespace stood in, never said back", async () => {
        const held = drawn('Clean');
        part(choose(held, 'Anthropic'), 'Anthropic API key');
        const out = held.querySelector<HTMLAnchorElement>('a[href="https://platform.claude.com/settings/keys"]');
        expect(out?.target).toBe('_blank');
        const key = row(held, 'Anthropic').querySelector('input') as HTMLInputElement;
        expect(key.type).toBe('password');
        key.value = 'sk-ant-issued';
        await pressTwice(held, 'connect-anthropic');

        const set = asked.find((a) => a.url.endsWith('/api/keys/Clean') && a.method === 'POST')!;
        expect(set.body).toEqual({ name: 'anthropic', value: 'sk-ant-issued' });
        expect(held.textContent).not.toContain('sk-ant-issued');
    });

    test('a key Anthropic issued lights green at once', async () => {
        const held = drawn('Clean');
        part(choose(held, 'Anthropic'), 'Anthropic API key');
        (row(held, 'Anthropic').querySelector('input') as HTMLInputElement).value = 'sk-ant-issued';
        await pressTwice(held, 'connect-anthropic');

        const light = held.querySelector('[data-light="anthropic"]') as HTMLElement;
        expect(light.dataset.accepted).toBe('true');
        expect(light.style.backgroundColor).toBe(hex(MEANS.yes));
    });

    test('a key Anthropic did not issue is kept, with a red light and what Anthropic said', async () => {
        const held = drawn('Clean');
        part(choose(held, 'Anthropic'), 'Anthropic API key');
        (row(held, 'Anthropic').querySelector('input') as HTMLInputElement).value = 'sk-ant-mistyped';
        await pressTwice(held, 'connect-anthropic');

        const light = held.querySelector('[data-light="anthropic"]') as HTMLElement;
        expect(light.dataset.accepted).toBe('false');
        expect(light.style.backgroundColor).toBe(hex(MEANS.no));
        expect(row(held, 'Anthropic').textContent).toContain('anthropic answered 401');
    });

    test('the light of a key kept before is there on opening', async () => {
        keys = [{ name: 'anthropic', set_by: 'me', at: '', asked: true, accepted: true, why: '' }];
        const held = drawn('Clean');
        part(choose(held, 'Anthropic'), 'Anthropic API key');
        await settle();
        expect((held.querySelector('[data-light="anthropic"]') as HTMLElement).dataset.accepted).toBe('true');
    });
});

// "secret is hidden by default"
// "click -> clipboard -> 'Copied!'"
async function expectSecretHiddenAndCopied(held: HTMLElement): Promise<void> {
    const secret = held.querySelector('[data-secret]') as HTMLElement;
    expect(secret.textContent).not.toContain('qntx_secret');
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: (text: string) => { written.push(text); return Promise.resolve(); } },
        configurable: true,
    });
    secret.click();
    await settle();
    expect(written).toEqual(['qntx_secret']);
    expect(secret.textContent).toBe('Copied!');
}

/** A colour as the DOM reads it back off a style. */
function hex(color: string): string {
    const probe = document.createElement('span');
    probe.style.backgroundColor = color;
    return probe.style.backgroundColor;
}

describe('Tim: OpenAI, OpenRouter, Obsidian and GitHub', () => {
    test('OpenAI: ChatGPT connects with the callback ChatGPT made (stories/11)', async () => {
        const held = drawn('Clean');
        part(choose(held, 'OpenAI'), 'ChatGPT');
        const callback = row(held, 'OpenAI').querySelector('input') as HTMLInputElement;
        callback.value = 'https://chatgpt.com/connector/oauth/abc';
        await pressTwice(held, 'connect-chatgpt');

        const minted = asked.find((a) => a.url.endsWith('/auth/tokens'))!;
        expect(minted.body).toMatchObject({ level: 'OAUTH', namespaces: ['Clean'], return_address: 'https://chatgpt.com/connector/oauth/abc' });
        expect(held.textContent).toContain('client_secret_post');
        expect(held.querySelector('a[href="https://chatgpt.com/plugins"]')).not.toBeNull();
    });

    // "you can connect multiple chatgpt accounts"
    test('ChatGPT twice is two connections, each its own name', async () => {
        for (const callback of ['https://chatgpt.com/connector/oauth/one', 'https://chatgpt.com/connector/oauth/two']) {
            const held = drawn('Clean');
            part(choose(held, 'OpenAI'), 'ChatGPT');
            (row(held, 'OpenAI').querySelector('input') as HTMLInputElement).value = callback;
            await pressTwice(held, 'connect-chatgpt');
        }
        const labels = asked.filter((a) => a.url.endsWith('/auth/tokens')).map((a) => a.body.label);
        expect(labels).toHaveLength(2);
        expect(labels[0]).not.toBe(labels[1]);
    });

    test('OpenAI and OpenRouter keep their keys by the platform name (stories/14)', async () => {
        const held = drawn('Clean');
        part(choose(held, 'OpenAI'), 'OpenAI API key');
        (row(held, 'OpenAI').querySelector('input') as HTMLInputElement).value = 'sk-openai';
        await pressTwice(held, 'connect-openai');
        choose(held, 'OpenRouter');
        (row(held, 'OpenRouter').querySelector('input') as HTMLInputElement).value = 'sk-or';
        await pressTwice(held, 'connect-openrouter');

        const set = asked.filter((a) => a.method === 'POST' && a.url.endsWith('/api/keys/Clean')).map((a) => a.body);
        expect(set).toEqual([{ name: 'openai', value: 'sk-openai' }, { name: 'openrouter', value: 'sk-or' }]);
    });

    test('Obsidian and GitHub open their own elements (stories/13 and 5)', () => {
        const opened: string[] = [];
        const held = drawn('Clean', opened);
        choose(held, 'Obsidian');
        choose(held, 'GitHub');
        expect(opened).toEqual(['obsidian-element', 'github-element']);
    });
});

describe('Spike: standing nowhere, and a card naming no server', () => {
    test('standing in no namespace, a platform says so and offers nothing to press', () => {
        const anthropic = choose(drawn(''), 'Anthropic');
        expect(anthropic.textContent).toContain('no namespace');
        expect(anthropic.querySelector('[data-part]')).toBeNull();
    });

    test('a card naming no MCP server names none', () => {
        expect(nodeMCPOf({})).toBeUndefined();
        expect(nodeMCPOf({ capabilities: { extensions: [{ params: {} }] } })).toBeUndefined();
    });
});
