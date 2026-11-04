import { describe, expect, test } from 'bun:test';
import { AgyAgents } from './agy';
import { namespaceAnswer } from '../ts/agents-element';

const at = (path: string, init?: RequestInit) => new Request(`http://mock${path}`, init);
const say = (path: string, says: string) => at(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ says, harness: 'agy' }),
});

// "A Namespace Owner logs in with their own oicd for their namespace access to agy, like how Root does for Node"
describe('the mock answers a namespace\'s agent in agy as the node wraps it', () => {
    test('before its first turn it says where its owner connects it, read through the namespace unwrap', async () => {
        const agents = new AgyAgents();
        const answer = (await (await agents.answer(at('/api/agents/pond?harness=agy')))!.json());
        const am = namespaceAnswer(answer).agy!;
        expect(am.model).toBe('gemini-3.8-flash');
        expect(am.google_connect).toBe('/auth/google/cloud?namespace=pond&thing=agy');
    });

    test('a turn said in agy is answered and read back in its session', async () => {
        const agents = new AgyAgents();
        const said = (await (await agents.answer(say('/api/agents/pond/say', 'what holds the pond?')))!.json()) as { agy: { answer: string; session: string } };
        expect(said.agy.answer.length).toBeGreaterThan(0);
        const read = (await (await agents.answer(at('/api/agents/pond/session?harness=agy')))!.json()) as { transcript: { session: string } };
        expect(read.transcript.session).toBe(said.agy.session);
    }, 30_000);

    test('the Node Agent in agy is answered as before, unwrapped', async () => {
        const agents = new AgyAgents();
        const answer = (await (await agents.answer(at('/api/agent?harness=agy')))!.json()) as { agy: { google_connect?: string } };
        expect(answer.agy).toBeDefined();
        expect(answer.agy.google_connect).toBeUndefined();
    });
});

describe('what is not agy is not the agy mock\'s', () => {
    test('a namespace asked in another harness is handed on', async () => {
        expect(await new AgyAgents().answer(at('/api/agents/pond?harness=claude'))).toBeNull();
    });
});
