import { afterEach, describe, expect, test } from 'bun:test';
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

    describe('in the app', () => {
        // The app's side as the page reaches it: invoke and the channel's callbacks, through __TAURI_INTERNALS__.
        const calls: { cmd: string; args: Record<string, unknown> }[] = [];
        const callbacks = new Map<number, (message: unknown) => void>();
        let opened = 0;
        const app = window as unknown as Record<string, unknown>;
        const inApp = () => {
            calls.length = 0;
            callbacks.clear();
            opened = 0;
            app.__TAURI__ = {};
            app.__TAURI_INTERNALS__ = {
                transformCallback: (callback: (message: unknown) => void) => { const id = callbacks.size + 1; callbacks.set(id, callback); return id; },
                invoke: (cmd: string, args: Record<string, unknown>) => {
                    calls.push({ cmd, args });
                    if (cmd === 'plugin:chat|open') return Promise.resolve({ owner: `owner-${++opened}` });
                    return Promise.resolve(null);
                },
            };
        };
        afterEach(() => { delete app.__TAURI__; delete app.__TAURI_INTERNALS__; });

        test('shows and closes as the owner its open handed back', async () => {
            inApp();
            const chat = await openNativeChat('the Node Agent', { say: () => {}, stop: () => {}, closed: () => {} });
            chat!.show([], true);
            chat!.close();
            expect(calls.map(call => [call.cmd, call.args.owner])).toEqual([
                ['plugin:chat|open', undefined],
                ['plugin:chat|show', 'owner-1'],
                ['plugin:chat|close', 'owner-1'],
            ]);
        });

        test('is taken by the element that opens it last: the one before is told it closed, and shows nothing more', async () => {
            inApp();
            let firstClosed = 0;
            const first = await openNativeChat('first', { say: () => {}, stop: () => {}, closed: () => { firstClosed++; } });
            const second = await openNativeChat('second', { say: () => {}, stop: () => {}, closed: () => {} });
            expect(firstClosed).toBe(1);
            calls.length = 0;
            first!.show([], false);
            first!.close();
            second!.show([], false);
            expect(calls.map(call => [call.cmd, call.args.owner])).toEqual([['plugin:chat|show', 'owner-2']]);
        });
    });
});
