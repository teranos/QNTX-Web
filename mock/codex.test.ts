import { describe, expect, test } from 'bun:test';
import { CodexAgents } from './codex';
import { codexAsAm, codexAsSaid, type CodexAm, type CodexSaid } from '../ts/agents-element';

const at = (path: string, init?: RequestInit) => new Request(`http://mock${path}`, init);
const say = (path: string, says: string, harness = 'codex') => at(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ says, harness }),
});

describe('Tim: the mock answers in Codex where the chat asks for it', () => {
    test('the Node Agent says who it is in Codex, as the chat reads it', async () => {
        const agents = new CodexAgents();
        const answer = await agents.answer(at('/api/agent?harness=codex'));
        const am = (await answer!.json()) as { codex: { did: string; sandbox: string; answering: boolean } };
        expect(am.codex.did).toContain('codex');
        expect(am.codex.sandbox).toBe('read-only');
        expect(am.codex.answering).toBe(false);
    });

    test('a turn said in Codex is answered in Codex and read back in its session', async () => {
        const agents = new CodexAgents();
        const said = (await (await agents.answer(say('/api/agents/pond/say', 'what holds the pond?')))!.json()) as { codex: { answer: string; session: string } };
        expect(said.codex.answer.length).toBeGreaterThan(0);
        const read = (await (await agents.answer(at('/api/agents/pond/session?harness=codex')))!.json()) as { transcript: { session: string; turns: { text: string }[] } };
        expect(read.transcript.session).toBe(said.codex.session);
        expect(read.transcript.turns.map(t => t.text)).toContain('what holds the pond?');
    }, 30_000);

    test('the chat reads the mock without a word of its own', async () => {
        const agents = new CodexAgents();
        const am = (await (await agents.answer(at('/api/elements/stories-element?harness=codex')))!.json()) as { codex: CodexAm };
        expect(codexAsAm(am.codex).auth_method).toBe('mock');
        const said = (await (await agents.answer(say('/api/elements/stories-element/say', 'hello')))!.json()) as { codex: CodexSaid };
        expect(codexAsSaid(said.codex).answer.length).toBeGreaterThan(0);
    }, 30_000);
});

describe('Spike: what is not Codex is not the Codex mock\'s', () => {
    test('a request in another harness, or none, is handed on', async () => {
        const agents = new CodexAgents();
        expect(await agents.answer(at('/api/agent?harness=claude'))).toBeNull();
        expect(await agents.answer(at('/api/agent'))).toBeNull();
        expect(await agents.answer(say('/api/agent/say', 'hi', 'pi'))).toBeNull();
        expect(await agents.answer(at('/api/canvas/elements?harness=codex'))).toBeNull();
    });

    test('a turn with nothing said is refused, as the node refuses it', async () => {
        const agents = new CodexAgents();
        const refused = await agents.answer(say('/api/agent/say', '   '));
        expect(refused!.status).toBe(400);
    });
});
