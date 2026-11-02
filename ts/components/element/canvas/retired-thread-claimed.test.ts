/**
 * 〽 is the thread's, and the thread is gone: nothing may claim it.
 *
 * "I don't want threads"
 *
 * A canvas saved before the thread was removed holds end markers, records with the
 * symbol 〽. Plugins and published elements register after the canvas has opened, so
 * "nothing is registered for it yet" cannot say a saved 〽 is a marker. The symbol is
 * reserved instead: refused at registration, said, and every saved 〽 is a marker.
 *
 * Personas:
 * - Tim: Happy path — a type that asks for 〽 is refused, said
 * - Spike: Edge cases — a minimized marker is dropped too; one that a type tried to claim is still a marker
 */

import { describe, test, expect, beforeEach, spyOn } from 'bun:test';
import { renderElement, buildCanvasWorkspace } from './canvas-workspace-builder';
import { registerElementType, getElementTypeBySymbol } from '../element-registry';
import { uiState } from '../../../state/ui';

const MARK = '\u303D'; // 〽

const claimant = () => ({
    symbol: MARK,
    className: 'canvas-published-element element-claimant',
    title: 'CLAIMANT',
    label: 'claimant',
    publishedName: 'claimant',
    render: (item: { id: string }) => {
        const el = document.createElement('div');
        el.setAttribute('data-element-id', item.id);
        return el;
    },
});

beforeEach(() => {
    document.body.innerHTML = '';
    uiState.setCanvasElements([]);
    uiState.setMinimizedWindows([]);
});

describe('The symbol of a thread - Tim (Happy Path)', () => {
    test('a type that asks for it is refused, and it says so', () => {
        const warn = spyOn(console, 'warn').mockImplementation(() => {});
        registerElementType(claimant());

        expect(getElementTypeBySymbol(MARK)).toBeUndefined();
        expect(warn).toHaveBeenCalled();
        expect(String(warn.mock.calls[0]?.[0])).toContain(MARK);
        warn.mockRestore();
    });
});

describe('A retired thread marker - Spike (Edge Cases)', () => {
    test('a minimized one is dropped too, and is no longer waiting in the tray', async () => {
        uiState.addCanvasElement({ id: 'thread-m', symbol: MARK, x: 1, y: 2, canvas_id: '' });
        uiState.setMinimizedWindows(['thread-m']);
        const items: any[] = [{ id: 'thread-m', symbol: MARK, title: 'Thread', x: 1, y: 2 }];

        buildCanvasWorkspace('canvas-workspace', items);
        for (let i = 0; i < 20; i++) await Promise.resolve();

        expect(uiState.getCanvasElement('thread-m')).toBeUndefined();
        expect(uiState.getMinimizedWindows()).not.toContain('thread-m');
    });

    test('one a type tried to claim is still the thread\'s marker: dropped, not drawn', async () => {
        const warn = spyOn(console, 'warn').mockImplementation(() => {});
        registerElementType(claimant());
        warn.mockRestore();
        uiState.addCanvasElement({ id: 'claimed-1', symbol: MARK, x: 1, y: 2, canvas_id: '' });

        const drawn = await renderElement({ id: 'claimed-1', symbol: MARK, title: 'CLAIMANT', x: 1, y: 2 } as any);

        expect(drawn.hasAttribute('data-element-id')).toBe(false);
        expect(uiState.getCanvasElement('claimed-1')).toBeUndefined();
    });
});
