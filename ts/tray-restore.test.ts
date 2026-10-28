/**
 * A window resting in the tray rests there again after a restart.
 *
 * "tray persistence between Mobile App restarts"
 */

import { describe, test, expect } from 'bun:test';
import { tray } from '@teranos/elements';
import { restorerOf, restoreToTray } from './tray-restore';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('tray restore', () => {
    test('an agent session\'s Transcript and a User are kinds it rebuilds', () => {
        expect(restorerOf('transcript-2ed899af-e95e-53f2-bf39-e58440f09df4')).not.toBeNull();
        expect(restorerOf('user-element-u-1')).not.toBeNull();
    });

    test('an id no kind names is not rebuilt here, so a placed result goes on to the canvas', () => {
        expect(restorerOf('result-3f1c')).toBeNull();
        expect(restorerOf('canvas-workspace')).toBeNull();
        expect(restoreToTray('result-3f1c')).toBe(false);
    });

    test('a prefix alone names nothing', () => {
        expect(restorerOf('transcript-')).toBeNull();
        expect(restorerOf('user-element-')).toBeNull();
    });

    test('a Transcript rests in the tray again from its id, unopened', async () => {
        tray.init();
        const id = 'transcript-restored-session';
        expect(tray.has(id)).toBe(false);
        expect(restoreToTray(id)).toBe(true);
        await wait(50);
        expect(tray.has(id)).toBe(true);
        expect(document.querySelectorAll(`[data-element-id="${id}"]`).length).toBe(1);
        // Asked again, it is one element still.
        restoreToTray(id);
        await wait(20);
        expect(document.querySelectorAll(`[data-element-id="${id}"]`).length).toBe(1);
        tray.remove(id);
    });
});
