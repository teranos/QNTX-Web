/**
 * A record saved under a dropped symbol is not drawn, and is dropped from what the canvas keeps.
 *
 * Nothing is registered under it, which would draw a frame saying so.
 *
 * Personas:
 * - Tim: Happy path — it is dropped, and nothing is drawn for it
 * - Spike: Edge cases — another element's record next to it is left alone
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { renderElement } from './canvas-workspace-builder';
import { uiState } from '../../../state/ui';

const MARK = '\u303D';

beforeEach(() => {
    document.body.innerHTML = '';
    uiState.setCanvasElements([]);
});

describe('A record saved under a dropped symbol - Tim (Happy Path)', () => {
    test('is not drawn, and its record is dropped', async () => {
        uiState.addCanvasElement({ id: 'dropped-1', symbol: MARK, x: 10, y: 20, canvas_id: '' });

        const drawn = await renderElement({ id: 'dropped-1', symbol: MARK, title: 'Dropped', x: 10, y: 20 } as any);

        expect(drawn.hasAttribute('data-element-id')).toBe(false);
        expect(drawn.textContent).toBe('');
        expect(uiState.getCanvasElement('dropped-1')).toBeUndefined();
    });
});

describe('A record saved under a dropped symbol - Spike (Edge Cases)', () => {
    test('another element saved beside it is kept', async () => {
        uiState.addCanvasElement({ id: 'dropped-1', symbol: MARK, x: 10, y: 20, canvas_id: '' });
        uiState.addCanvasElement({ id: 'note-1', symbol: 'stream', content: 'kept', x: 0, y: 0, canvas_id: '' });

        await renderElement({ id: 'dropped-1', symbol: MARK, title: 'Dropped', x: 10, y: 20 } as any);

        expect(uiState.getCanvasElement('note-1')).toBeDefined();
    });
});
