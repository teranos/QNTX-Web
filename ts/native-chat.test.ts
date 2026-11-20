import { describe, expect, test } from 'bun:test';
import { openNativeChat, saidOf } from './native-chat';

describe('the native chat', () => {
    test('is shown what the person and the agent said, theirs and its, in order', () => {
        const said = saidOf([
            { at: '2026-11-20T10:00:00Z', speaker: 'session', text: 'resumed', of: '' },
            { at: '2026-11-20T10:00:01Z', speaker: 'human', text: 'hello', of: '' },
            { at: '2026-11-20T10:00:02Z', speaker: 'tool', text: 'ls', of: '' },
            { at: '2026-11-20T10:00:03Z', speaker: 'assistant', text: 'hi', of: '' },
            { at: '2026-11-20T10:00:04Z', speaker: 'error', text: 'it failed', of: 'say' },
        ]);
        expect(said.map(one => [one.text, one.mine])).toEqual([['hello', true], ['hi', false], ['it failed', false]]);
        expect(said[0]!.at).toBe(Date.parse('2026-11-20T10:00:01Z'));
        expect(new Set(said.map(one => one.id)).size).toBe(3);
    });

    test('is not there outside the app, and the page keeps its own chat', async () => {
        const chat = await openNativeChat('the Node Agent', { say: () => {}, stop: () => {}, closed: () => {} });
        expect(chat).toBeNull();
    });
});
