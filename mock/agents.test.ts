import { describe, expect, test } from 'bun:test';
import { Agent } from './agents';

// A page listening to a turn while it is printed is handed each event whole,
// as one that reads the turn after it was printed is.
describe('Spike: the mock turn, listened to as it is printed', () => {
    test('what it writes reaches a listener with what was written', async () => {
        const agent = new Agent('the Node Agent', 'did:key:mock-node-agent');
        const said = agent.say('What would you tell people at a claude code community meetup?', '', '', '');
        const heard: Array<{ tool: string; input?: string }> = [];
        agent.live('')!.listen(0, (event) => { if (event) heard.push({ tool: event.tool, input: event.input }); });
        await said;
        const wrote = heard.find((event) => event.tool === 'Write');
        expect(wrote?.input).toContain('MOCK line 40 of 40, written by the mock');
    }, 30_000);
});
