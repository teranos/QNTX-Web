/**
 * Records the node holds under a dropped symbol are not loaded, and the node deletes them.
 *
 * The browser drops them when a canvas is drawn. The sync merges the node's state in after the
 * draw, so the node's state is cleaned as it is loaded.
 *
 * Personas:
 * - Tim: Happy path — one the node alone holds never reaches the merge, and is deleted on the node
 * - Spike: Edge cases — other elements, and a minimized one, are handled exactly
 * - Jenny: Complex scenarios — a nonempty local canvas merged with a node that holds them
 */

import { describe, test, expect, spyOn, afterEach } from 'bun:test';
import { dropDroppedRecords, mergeCanvasState } from './canvas';
import { canvasSyncQueue } from './canvas-sync';

const MARK = '\u303D';

const el = (id: string, symbol: string) => ({ id, symbol, x: 0, y: 0, canvas_id: '' }) as any;
const state = (elements: any[], minimizedWindows: string[] = []) => ({ elements, compositions: [], minimizedWindows });

let added: ReturnType<typeof spyOn> | undefined;
afterEach(() => added?.mockRestore());
const deletions = () => (added!.mock.calls as any[][]).map(c => c[0]).filter(c => c.op === 'element_delete').map(c => c.id);

describe('The node holds a record under a dropped symbol - Tim (Happy Path)', () => {
    test('it is left out of what is loaded, and the node is told to delete it', () => {
        added = spyOn(canvasSyncQueue, 'add').mockImplementation(() => {});

        const clean = dropDroppedRecords(state([el('dropped-1', MARK)]));

        expect(clean.elements).toEqual([]);
        expect(deletions()).toEqual(['dropped-1']);
    });
});

describe('The node holds a record under a dropped symbol - Spike (Edge Cases)', () => {
    test('other elements are kept, in their order, and none is deleted', () => {
        added = spyOn(canvasSyncQueue, 'add').mockImplementation(() => {});
        const a = el('a', 'note'), b = el('b', 'prompt');

        const clean = dropDroppedRecords(state([a, b]));

        expect(clean.elements).toEqual([a, b]);
        expect(deletions()).toEqual([]);
    });

    test('a minimized marker is left out of the minimized windows too', () => {
        added = spyOn(canvasSyncQueue, 'add').mockImplementation(() => {});

        const clean = dropDroppedRecords(state([el('dropped-1', MARK), el('a', 'note')], ['dropped-1', 'a']));

        expect(clean.minimizedWindows).toEqual(['a']);
        expect(clean.elements.map(e => e.id)).toEqual(['a']);
    });
});

describe('The node holds a record under a dropped symbol - Jenny (Complex Scenarios)', () => {
    test('a canvas the browser holds, merged with a node that holds markers, gains none', () => {
        added = spyOn(canvasSyncQueue, 'add').mockImplementation(() => {});
        const local = state([el('a', 'note')]);
        const fromNode = state([el('a', 'note'), el('dropped-1', MARK), el('dropped-2', MARK), el('b', 'prompt')], ['dropped-2']);

        const merged = mergeCanvasState(local, dropDroppedRecords(fromNode));

        expect(merged.elements.map(e => e.id)).toEqual(['a', 'b']);
        expect(merged.minimizedWindows).toEqual([]);
        expect(deletions()).toEqual(['dropped-1', 'dropped-2']);
    });
});
