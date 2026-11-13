// 「[Fable 5.2] The chat a person opens on the Node Agent is the one that stops it and shows what waits for it.」
// 「[Fable 5.2] The stop and the collection were once the Node Agent's in a chat the page never drew.」

import { describe, test, expect } from 'bun:test';
import { agentIn } from './agents-element';

describe('the Node Agent as the Agents element draws it', () => {
    test('in Claude Code it is stopped by the node, and what agents say to it is collected', () => {
        const node = agentIn('/api/agent', 'claude');
        expect(typeof node.stop).toBe('function');
        expect(node.collected).toBeDefined();
    });

    test('in another harness what waits for it still shows, and nothing stops it', () => {
        const node = agentIn('/api/agent', 'codex');
        expect(node.collected).toBeDefined();
        expect(node.stop).toBeUndefined();
    });

    test('any other agent has neither', () => {
        for (const other of [agentIn('/api/agents/pond', 'claude'), agentIn('/api/elements/story-1-x', 'claude')]) {
            expect(other.stop).toBeUndefined();
            expect(other.collected).toBeUndefined();
        }
    });
});
