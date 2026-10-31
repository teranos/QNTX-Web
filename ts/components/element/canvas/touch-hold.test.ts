/**
 * A finger held still on the canvas opens what a right-click opens.
 *
 * "on mobile, can't get into spawn menu"
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { onTouchHold } from './touch-hold';

const HOLD = 20;
// The DOM's own Event: one made by the runtime's has no target when dispatched.
const DomEvent: typeof Event = (window as any).Event;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Finger { identifier: number; clientX: number; clientY: number }

function touch(target: EventTarget, type: string, touches: Finger[], changed: Finger[] = touches): Event {
    const e = new DomEvent(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'touches', { value: touches });
    Object.defineProperty(e, 'changedTouches', { value: changed });
    target.dispatchEvent(e);
    return e;
}

describe('touch hold on the canvas', () => {
    let canvas: HTMLElement;
    let fired: { x: number; y: number; target: HTMLElement }[];

    beforeEach(() => {
        document.body.innerHTML = '';
        canvas = document.createElement('div');
        document.body.appendChild(canvas);
        fired = [];
        onTouchHold(canvas, (x, y, target) => fired.push({ x, y, target }), { holdMs: HOLD });
    });

    // Every finger lifts, so no hold outlives its test.
    afterEach(async () => {
        touch(canvas, 'touchend', [], [{ identifier: 1, clientX: 0, clientY: 0 }]);
        await wait(5);
    });

    test('a finger held still fires where it rests', async () => {
        const f = { identifier: 1, clientX: 100, clientY: 200 };
        touch(canvas, 'touchstart', [f]);
        await wait(HOLD * 2);
        expect(fired).toHaveLength(1);
        expect(fired[0].x).toBe(100);
        expect(fired[0].y).toBe(200);
        expect(fired[0].target).toBe(canvas);
    });

    test('a tap lets go before the hold', async () => {
        const f = { identifier: 1, clientX: 100, clientY: 200 };
        touch(canvas, 'touchstart', [f]);
        touch(canvas, 'touchend', [], [f]);
        await wait(HOLD * 2);
        expect(fired).toHaveLength(0);
    });

    test('a finger that moves is panning', async () => {
        touch(canvas, 'touchstart', [{ identifier: 1, clientX: 100, clientY: 200 }]);
        touch(canvas, 'touchmove', [{ identifier: 1, clientX: 140, clientY: 200 }]);
        await wait(HOLD * 2);
        expect(fired).toHaveLength(0);
    });

    test('a tremble within the slop still holds', async () => {
        touch(canvas, 'touchstart', [{ identifier: 1, clientX: 100, clientY: 200 }]);
        touch(canvas, 'touchmove', [{ identifier: 1, clientX: 103, clientY: 202 }]);
        await wait(HOLD * 2);
        expect(fired).toHaveLength(1);
    });

    test('two fingers are pinching', async () => {
        touch(canvas, 'touchstart', [{ identifier: 1, clientX: 100, clientY: 200 }]);
        touch(canvas, 'touchstart', [
            { identifier: 1, clientX: 100, clientY: 200 },
            { identifier: 2, clientX: 200, clientY: 300 },
        ]);
        await wait(HOLD * 2);
        expect(fired).toHaveLength(0);
    });

    test('a hold in a field is the field\'s', async () => {
        const field = document.createElement('textarea');
        canvas.appendChild(field);
        touch(field, 'touchstart', [{ identifier: 1, clientX: 100, clientY: 200 }]);
        await wait(HOLD * 2);
        expect(fired).toHaveLength(0);
    });

    test('lifting the held finger sends no mouse events after it', async () => {
        const f = { identifier: 1, clientX: 100, clientY: 200 };
        touch(canvas, 'touchstart', [f]);
        await wait(HOLD * 2);
        const end = touch(canvas, 'touchend', [], [f]);
        expect(end.defaultPrevented).toBe(true);
    });

    test('a contextmenu the platform sends for the same press does not reach the page', async () => {
        let reached = 0;
        document.addEventListener('contextmenu', () => { reached++; });
        const f = { identifier: 1, clientX: 100, clientY: 200 };
        touch(canvas, 'touchstart', [f]);
        await wait(HOLD * 2);
        canvas.dispatchEvent(new DomEvent('contextmenu', { bubbles: true, cancelable: true }));
        expect(reached).toBe(0);
        touch(canvas, 'touchend', [], [f]);
        await wait(5);
        canvas.dispatchEvent(new DomEvent('contextmenu', { bubbles: true, cancelable: true }));
        expect(reached).toBe(1);
    });

    test('a lift off something taken out of the canvas is still heard', async () => {
        const symbol = document.createElement('span');
        canvas.appendChild(symbol);
        const f = { identifier: 1, clientX: 100, clientY: 200 };
        touch(symbol, 'touchstart', [f]);
        await wait(HOLD * 2);
        document.body.appendChild(symbol);
        const end = touch(symbol, 'touchend', [], [f]);
        expect(end.defaultPrevented).toBe(true);
    });

    test('a contextmenu that comes first is the one that counts', async () => {
        touch(canvas, 'touchstart', [{ identifier: 1, clientX: 100, clientY: 200 }]);
        canvas.dispatchEvent(new DomEvent('contextmenu', { bubbles: true, cancelable: true }));
        await wait(HOLD * 2);
        expect(fired).toHaveLength(0);
    });
});
