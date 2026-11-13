// The chat a person opens on the Node Agent is the one that stops it and shows what waits for it.
// The stop and the collection were once the Node Agent's in a chat the page never drew.

import { describe, test, expect } from 'bun:test';
import { agentIn } from './agents-element';

describe('the Node Agent as the Agents element draws it', () => {
    test('in Claude Code it is stopped by the node, and what agents say to it is collected', () => {
        const node = agentIn('/api/agent', 'claude');
        expect(typeof node.stop).toBe('function');
        expect(node.collected).toBeDefined();
    });

    test('in another harness, and any other agent, has neither', () => {
        for (const other of [agentIn('/api/agent', 'codex'), agentIn('/api/agents/pond', 'claude'), agentIn('/api/elements/story-1-x', 'claude')]) {
            expect(other.stop).toBeUndefined();
            expect(other.collected).toBeUndefined();
        }
    });
});
