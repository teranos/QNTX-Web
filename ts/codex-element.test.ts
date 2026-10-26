import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { codexAt, drawCodex, namespaceCodexTarget, type CodexAgent, type CodexAm, type CodexSaid } from './codex-element';
import type { TranscriptRead } from './components/element/transcript-element';
import { CodexAgents, codexDocument } from '../mock/codex';

const am: CodexAm = {
    did: 'did:key:codex', model: 'test-codex', sandbox: 'read-only', gateway: 'test',
    session: 'signed-session', answering: false, codex: '/bin/codex', codex_version: '0.163.0', not_ready: '',
};
const said: CodexSaid = {
    answer: 'Hello back', session: am.session, model: am.model, codex_version: am.codex_version,
    input_tokens: '19', output_tokens: '3', took_ms: 100, unwritten: '',
};
const transcript: TranscriptRead = {
    session: am.session, subjects: ['qntx/root-agent'], started: '2026-10-25T12:00:00Z',
    ended: '', folded: 0, model: am.model, effort: '',
    turns: [{ at: '2026-10-25T12:00:00Z', speaker: 'assistant', text: 'Hello back', of: 'signed-row-1' }],
};
function agent(overrides: Partial<CodexAgent> = {}): CodexAgent {
    return { am: async () => am, say: async () => said, read: async () => transcript, ...overrides };
}
const stops: Array<() => void> = [];
afterEach(() => { for (const stop of stops.splice(0)) stop(); document.body.replaceChildren(); });
async function settled() { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)); }
function draw(node: CodexAgent, every = 2000) {
    const body = document.createElement('div');
    document.body.append(body);
    stops.push(drawCodex(body, [{ label: 'Node Agent', path: '/api/agent' }], () => node, every));
    return body;
}
function send(body: HTMLElement, text = 'Hello') {
    body.querySelector<HTMLTextAreaElement>('.codex-says')!.value = text;
    body.querySelector<HTMLButtonElement>('.codex-send')!.click();
}

describe('Codex — Tim', () => {
    test('opens the recorded session with model and sandbox, without a login or Claude controls', async () => {
        const body = draw(agent());
        await settled();
        expect(body.querySelector('.codex-who')!.textContent).toContain('test-codex · read-only · Codex 0.163.0');
        expect(body.textContent).not.toContain('did:key');
        expect(body.querySelector('[data-of="signed-row-1"]')!.textContent).toContain('Hello back');
        expect(body.querySelector('.claude-mode, .agent-begin, input[type=file]')).toBeNull();
    });

    test('sends once, follows the transcript, and preserves new words typed during a turn', async () => {
        let finish!: (answer: CodexSaid) => void;
        let sent = 0;
        const body = draw(agent({ say: () => { sent++; return new Promise(resolve => { finish = resolve; }); } }));
        await settled();
        send(body);
        await settled();
        send(body, 'next thought');
        expect(sent).toBe(1);
        expect(body.querySelector('.codex-send')!.getAttribute('aria-disabled')).toBe('true');
        finish(said);
        await settled();
        expect(body.querySelector<HTMLTextAreaElement>('.codex-says')!.value).toBe('next thought');
        expect(body.querySelector('.codex-send')!.getAttribute('aria-disabled')).toBe('false');
    });

    test('wire calls use the Codex envelope and encoded namespace, never Claude permissions or login', async () => {
        const calls: Array<{ url: string; body: unknown }> = [];
        const fetch = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
            calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
            return Response.json(String(input).includes('/session') ? { transcript } : { codex: init?.method === 'POST' ? said : am });
        });
        try {
            const client = codexAt('/api/agents/a%2Fb');
            expect(await client.am()).toEqual(am);
            expect(await client.say('Hello')).toEqual(said);
            expect(await client.read()).toEqual(transcript);
            expect(calls.map(c => new URL(c.url, 'http://localhost').pathname + new URL(c.url, 'http://localhost').search)).toEqual([
                '/api/agents/a%2Fb?harness=codex', '/api/agents/a%2Fb/say', '/api/agents/a%2Fb/session?harness=codex',
            ]);
            expect(calls[1]!.body).toEqual({ harness: 'codex', says: 'Hello' });
        } finally { fetch.mockRestore(); }
    });
});

describe('Codex — Spike', () => {
    test('unconfigured or unauthorized agents keep the composer held and show the refusal', async () => {
        let sent = false;
        const body = draw(agent({ am: async () => { throw new Error('HTTP 404 no [agent.root.codex]'); }, say: async () => { sent = true; return said; } }));
        await settled();
        send(body);
        await settled();
        expect(sent).toBe(false);
        const error = body.querySelector<any>('sacred-error')!.error;
        expect(JSON.stringify(error)).toContain('no [agent.root.codex]');
        expect(body.querySelector<HTMLTextAreaElement>('.codex-says')!.value).toBe('Hello');
    });

    test('not ready is enforced for Enter as well as Say, and Refresh can recover', async () => {
        let ready = false;
        let sent = 0;
        const body = draw(agent({ am: async () => ({ ...am, not_ready: ready ? '' : 'codex is still being fetched' }), say: async () => { sent++; return said; } }));
        await settled();
        const input = body.querySelector<HTMLTextAreaElement>('.codex-says')!;
        input.value = 'Hello';
        input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(sent).toBe(0);
        expect(body.querySelector('.codex-who')!.textContent).toContain('still being fetched');
        ready = true;
        body.querySelector<HTMLButtonElement>('.codex-refresh')!.click();
        await settled();
        send(body);
        await settled();
        expect(sent).toBe(1);
        expect(input.value).toBe('');
    });

    test('failed turns keep the draft, show the exact failure, and read their recorded transcript', async () => {
        let reads = 0;
        const body = draw(agent({ say: async () => { throw new Error('Codex authentication failed'); }, read: async () => { reads++; return transcript; } }));
        await settled();
        send(body);
        await settled();
        expect(body.textContent).toContain('Codex authentication failed');
        expect(body.querySelector<HTMLTextAreaElement>('.codex-says')!.value).toBe('Hello');
        expect(reads).toBeGreaterThan(1);
    });

    test('an unwritten transcript row remains visible after a successful answer', async () => {
        const body = draw(agent({ say: async () => ({ ...said, unwritten: 'storage full' }) }));
        await settled(); send(body); await settled();
        expect(JSON.stringify(body.querySelector<any>('sacred-error')!.error)).toContain('storage full');
    });

    test('a missing Codex envelope is an error, not a blank answer', async () => {
        const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ claude: said, codex: null }));
        try { await expect(codexAt('/api/agent').am()).rejects.toThrow('no Codex response'); }
        finally { fetch.mockRestore(); }
    });

    test('namespace selection needs both reach and an advertised Codex harness', async () => {
        let permitted = false;
        let supported = false;
        const fetch = spyOn(globalThis, 'fetch').mockImplementation(async input => {
            if (String(input).includes('/i/reaches')) return Response.json({ paths: permitted ? ['/api/agents/{namespace}', '/openapi.json'] : [] });
            return Response.json(supported ? codexDocument : { paths: {} });
        });
        try {
            expect(await namespaceCodexTarget('a/b')).toEqual([]);
            permitted = true;
            expect(await namespaceCodexTarget('a/b')).toEqual([]);
            supported = true;
            expect(await namespaceCodexTarget('a/b')).toEqual([{ label: 'Namespace: a/b', path: '/api/agents/a%2Fb' }]);
        } finally { fetch.mockRestore(); }
    });
});

describe('Codex — Jenny', () => {
    test('switching targets preserves each draft and routes to its own conversation', async () => {
        const body = document.createElement('div');
        const sent: string[] = [];
        stops.push(drawCodex(body, [{ label: 'Node Agent', path: '/api/agent' }, { label: 'Namespace: pond', path: '/api/agents/pond' }], path => agent({ say: async () => { sent.push(path); return said; } })));
        await settled();
        const nodeTalk = body.querySelector<HTMLElement>('.codex-talk')!;
        nodeTalk.querySelector<HTMLTextAreaElement>('textarea')!.value = 'node draft';
        const select = body.querySelector<HTMLSelectElement>('select')!;
        select.value = '/api/agents/pond'; select.dispatchEvent(new window.Event('change'));
        await settled();
        const namespaceTalk = body.querySelector<HTMLElement>('.codex-talk:not([hidden])')!;
        send(namespaceTalk, 'pond question'); await settled();
        expect(sent).toEqual(['/api/agents/pond']);
        select.value = '/api/agent'; select.dispatchEvent(new window.Event('change'));
        expect(body.querySelector('.codex-talk:not([hidden])')).toBe(nodeTalk);
        expect(nodeTalk.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('node draft');
    });

    test('cleanup before the first status response prevents polling and late DOM changes', async () => {
        let finish!: (is: CodexAm) => void;
        let calls = 0;
        const body = document.createElement('div');
        const stop = drawCodex(body, [{ label: 'Node Agent', path: '/api/agent' }], () => agent({ am: () => { calls++; return new Promise(resolve => { finish = resolve; }); } }), 1);
        stop();
        finish({ ...am, answering: true });
        await settled();
        expect(calls).toBe(1);
        expect(body.textContent).not.toContain('test-codex');
    });

    test('an already-running turn is followed until idle', async () => {
        let calls = 0;
        const body = draw(agent({ am: async () => ({ ...am, answering: ++calls < 3 }) }), 1);
        await new Promise(resolve => setTimeout(resolve, 30));
        expect(calls).toBe(3);
        expect(body.querySelector('.codex-status')!.textContent).toBe('');
    });

    test('the mock keeps node and namespace Codex sessions separate', async () => {
        const mock = new CodexAgents();
        const say = (path: string, says: string) => mock.answer(new Request(`http://localhost${path}/say`, { method: 'POST', body: JSON.stringify({ harness: 'codex', says }) }));
        const node = await (await say('/api/agent', 'node words'))!.json();
        const ns = await (await say('/api/agents/pond', 'pond words'))!.json();
        expect(node.codex.session).not.toBe(ns.codex.session);
        const read = await (await mock.answer(new Request('http://localhost/api/agent/session?harness=codex')))!.json();
        expect(JSON.stringify(read)).toContain('node words');
        expect(JSON.stringify(read)).not.toContain('pond words');
        expect(await mock.answer(new Request('http://localhost/api/agent?harness=claude'))).toBeNull();
    });
});
