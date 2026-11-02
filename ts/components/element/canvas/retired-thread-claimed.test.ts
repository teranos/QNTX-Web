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

import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { renderElement, buildCanvasWorkspace } from './canvas-workspace-builder';
import { getAllElementTypes, registerElementType, unregisterElementType, getElementTypeBySymbol, getElementTypeBySavedSymbol } from '../element-registry';
import { uiState } from '../../../state/ui';

const MARK = '〽'; // 〽

// The registry is the process's, shared by every test file that runs after this one: what is
// registered here is taken out again.
afterAll(() => {
    unregisterElementType(MARK);
});

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

describe('Taking a type out of the registry - Tim (Happy Path)', () => {
    test('a type registered at runtime can be taken out, and the symbol is free again', () => {
        const SYMBOL = 'zz-unregister-me';
        registerElementType({
            symbol: SYMBOL,
            className: 'canvas-published-element element-unregister-me',
            title: 'GONE SOON',
            label: 'gonesoon',
            publishedName: 'gonesoon',
            render: () => document.createElement('div'),
        });
        expect(getElementTypeBySymbol(SYMBOL)).toBeDefined();

        expect(unregisterElementType(SYMBOL)).toBe(true);

        expect(getElementTypeBySymbol(SYMBOL)).toBeUndefined();
        expect(getElementTypeBySavedSymbol(SYMBOL)).toBeUndefined();
    });
});

describe('Taking a type out of the registry - Spike (Edge Cases)', () => {
    test('a built-in is refused, and stays', () => {
        const ax = getAllElementTypes().find(t => t.label === 'AX')!;
        expect(unregisterElementType(ax.symbol)).toBe(false);
        expect(getElementTypeBySymbol(ax.symbol)).toBe(ax);
    });

    test('a symbol nothing holds is nothing to take out', () => {
        expect(unregisterElementType('zz-never-registered')).toBe(false);
    });
});
