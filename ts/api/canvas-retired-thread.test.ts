/**
 * The thread (〽) is gone, and the node's copy of what it saved goes too.
 *
 * "Make sure thread is not a thing anymore"
 *
 * The browser drops a saved end marker when a canvas is drawn. The node can
 * still hold one the browser does not, and the sync merges it in after the
 * draw, so the merge cannot be where it arrives: the node's state is cleaned
 * as it is loaded, and the node told to delete the record.
 *
 * Personas:
 * - Tim: Happy path — a node-only end marker never reaches the merge, and is deleted on the node
 * - Spike: Edge cases — other elements, and a minimized marker, are handled exactly
 * - Jenny: Complex scenarios — a nonempty local canvas merged with a node that holds markers
 */

import { describe, test, expect, spyOn, afterEach } from 'bun:test';
import { dropRetiredThreads, mergeCanvasState } from './canvas';
import { canvasSyncQueue } from './canvas-sync';

const END_MARKER = '〽';

const el = (id: string, symbol: string) => ({ id, symbol, x: 0, y: 0, canvas_id: '' }) as any;
const state = (elements: any[], minimizedWindows: string[] = []) => ({ elements, compositions: [], minimizedWindows });

let added: ReturnType<typeof spyOn> | undefined;
afterEach(() => added?.mockRestore());
const deletions = () => (added!.mock.calls as any[][]).map(c => c[0]).filter(c => c.op === 'element_delete').map(c => c.id);

describe('The node holds a thread end marker - Tim (Happy Path)', () => {
    test('it is left out of what is loaded, and the node is told to delete it', () => {
        added = spyOn(canvasSyncQueue, 'add').mockImplementation(() => {});

        const clean = dropRetiredThreads(state([el('thread-1', END_MARKER)]));

        expect(clean.elements).toEqual([]);
        expect(deletions()).toEqual(['thread-1']);
    });
});

describe('The node holds a thread end marker - Spike (Edge Cases)', () => {
    test('other elements are kept, in their order, and none is deleted', () => {
        added = spyOn(canvasSyncQueue, 'add').mockImplementation(() => {});
        const a = el('a', 'note'), b = el('b', 'prompt');

        const clean = dropRetiredThreads(state([a, b]));

        expect(clean.elements).toEqual([a, b]);
        expect(deletions()).toEqual([]);
    });

    test('a minimized marker is left out of the minimized windows too', () => {
        added = spyOn(canvasSyncQueue, 'add').mockImplementation(() => {});

        const clean = dropRetiredThreads(state([el('thread-1', END_MARKER), el('a', 'note')], ['thread-1', 'a']));

        expect(clean.minimizedWindows).toEqual(['a']);
        expect(clean.elements.map(e => e.id)).toEqual(['a']);
    });
});

describe('The node holds a thread end marker - Jenny (Complex Scenarios)', () => {
    test('a canvas the browser holds, merged with a node that holds markers, gains none', () => {
        added = spyOn(canvasSyncQueue, 'add').mockImplementation(() => {});
        const local = state([el('a', 'note')]);
        const fromNode = state([el('a', 'note'), el('thread-1', END_MARKER), el('thread-2', END_MARKER), el('b', 'prompt')], ['thread-2']);

        const merged = mergeCanvasState(local, dropRetiredThreads(fromNode));

        expect(merged.elements.map(e => e.id)).toEqual(['a', 'b']);
        expect(merged.minimizedWindows).toEqual([]);
        expect(deletions()).toEqual(['thread-1', 'thread-2']);
    });
});
