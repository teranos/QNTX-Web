/**
 * The thread (〽) is gone from the canvas, and what it saved goes with it.
 *
 * "The whole thread line thing can entirely go, in ui and api"
 *
 * A canvas saved before the thread was removed still holds its end markers,
 * records with the symbol 〽. Nothing is registered under it now, which would
 * draw each as a frame saying so, for a feature nobody can use. It is dropped
 * from what the canvas keeps instead, as an empty stream is.
 *
 * Personas:
 * - Tim: Happy path — a saved end marker is dropped, and nothing is drawn for it
 * - Spike: Edge cases — another element's record next to it is left alone
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { renderElement } from './canvas-workspace-builder';
import { uiState } from '../../../state/ui';

const END_MARKER = '〽'; // 〽

beforeEach(() => {
    document.body.innerHTML = '';
    uiState.setCanvasElements([]);
});

describe('A saved thread end marker - Tim (Happy Path)', () => {
    test('is not drawn, and its record is dropped', async () => {
        uiState.addCanvasElement({ id: 'thread-1', symbol: END_MARKER, x: 10, y: 20, canvas_id: '' });

        const drawn = await renderElement({ id: 'thread-1', symbol: END_MARKER, title: 'Thread', x: 10, y: 20 } as any);

        expect(drawn.hasAttribute('data-element-id')).toBe(false);
        expect(drawn.textContent).toBe('');
        expect(uiState.getCanvasElement('thread-1')).toBeUndefined();
    });
});

describe('A saved thread end marker - Spike (Edge Cases)', () => {
    test('another element saved beside it is kept', async () => {
        uiState.addCanvasElement({ id: 'thread-1', symbol: END_MARKER, x: 10, y: 20, canvas_id: '' });
        uiState.addCanvasElement({ id: 'note-1', symbol: 'stream', content: 'kept', x: 0, y: 0, canvas_id: '' });

        await renderElement({ id: 'thread-1', symbol: END_MARKER, title: 'Thread', x: 10, y: 20 } as any);

        expect(uiState.getCanvasElement('note-1')).toBeDefined();
    });
});
