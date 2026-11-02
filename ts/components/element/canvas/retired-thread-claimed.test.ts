/**
 * Dropping a retired thread marker is not dropping what a type registered under its symbol.
 *
 * "The whole thread line thing can entirely go, in ui and api"
 *
 * The thread is not a registered type any more, so a plugin or a published element may
 * register under 〽. A canvas that holds an element of that type must still draw it:
 * only a saved 〽 that nothing is registered for is the thread's end marker.
 *
 * Personas:
 * - Spike: Edge cases — a type claims 〽; a marker is minimized; neither is lost or kept wrongly
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { renderElement, buildCanvasWorkspace } from './canvas-workspace-builder';
import { registerElementType } from '../element-registry';
import { uiState } from '../../../state/ui';

const MARK = '〽'; // 〽

beforeEach(() => {
    document.body.innerHTML = '';
    uiState.setCanvasElements([]);
    uiState.setMinimizedWindows([]);
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

    // Last: a type registered stays registered for the rest of this file.
    test('one a type has claimed is that type\'s element, drawn and kept', async () => {
        registerElementType({
            symbol: MARK,
            className: 'canvas-published-element element-claimed',
            title: 'CLAIMED',
            label: 'claimed',
            publishedName: 'claimed',
            render: (item) => {
                const el = document.createElement('div');
                el.setAttribute('data-element-id', item.id);
                return el;
            },
        });
        uiState.addCanvasElement({ id: 'claimed-1', symbol: MARK, x: 1, y: 2, canvas_id: '' });

        const drawn = await renderElement({ id: 'claimed-1', symbol: MARK, title: 'CLAIMED', x: 1, y: 2 } as any);

        expect(drawn.getAttribute('data-element-id')).toBe('claimed-1');
        expect(uiState.getCanvasElement('claimed-1')).toBeDefined();
    });
});
