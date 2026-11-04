/**
 * A spawned element is the one the menu carried.
 *
 * "on mobile, can't get into spawn menu"
 *
 * @teranos/elements hands `place` the element it carried (the menu's button, then
 * the cursor) and takes back the element that was placed, which must be that one:
 * an element is one DOM element for its whole life. Any registered type whose
 * renderer makes a root of its own instead is an error there, said, and the
 * carried one is removed.
 *
 * Personas:
 * - Tim: Happy path — every type the menu offers renders into what it is handed
 * - Spike: Edge cases — rendered with nothing carried (a restore, the search bar), each makes its own
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { getAllElementTypes } from '../element-registry';

// Not in happy-dom.
(globalThis.window as any).Element.prototype.animate = function () {
    return { addEventListener() {}, removeEventListener() {}, cancel() {}, finished: Promise.resolve() } as any;
};
globalThis.requestAnimationFrame = (_cb: FrameRequestCallback) => 0;
globalThis.cancelAnimationFrame = () => {};

const types = getAllElementTypes().filter(t => t.spawnMenuOrder !== undefined);

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('A carried element - Tim (Happy Path)', () => {
    test('the menu offers some types to carry', () => {
        expect(types.length).toBeGreaterThan(0);
    });

    for (const type of types) {
        test(`${type.label} renders into the element it is handed, and returns it`, async () => {
            const carried = document.createElement('div');
            document.body.appendChild(carried);

            const rendered = await type.render({
                id: `${type.label.toLowerCase()}-carried`,
                title: type.title,
                symbol: type.symbol,
                x: 10,
                y: 20,
                cursorElement: carried,
                renderContent: () => document.createElement('div'),
            } as any);

            expect(rendered).toBe(carried);
        });
    }
});

describe('A carried element - Spike (Edge Cases)', () => {
    // A note and a prompt wear no symbol of their own, so what the cursor carried is not theirs to keep.
    for (const label of ['Note', 'Prompt']) {
        test(`${label} keeps nothing of the cursor it was carried as`, async () => {
            const type = types.find(t => t.label === label)!;
            const carried = document.createElement('div');
            const cursorSymbol = document.createElement('span');
            cursorSymbol.className = 'cursor-symbol';
            cursorSymbol.textContent = type.symbol;
            carried.appendChild(cursorSymbol);
            document.body.appendChild(carried);

            const rendered = await type.render({
                id: `${label.toLowerCase()}-carried`,
                title: type.title,
                symbol: type.symbol,
                x: 10,
                y: 20,
                cursorElement: carried,
                symbolElement: cursorSymbol,
                renderContent: () => document.createElement('div'),
            } as any);

            expect(rendered).toBe(carried);
            expect(rendered.querySelector('.cursor-symbol')).toBeNull();
        });
    }

    for (const type of types) {
        test(`${type.label}, handed nothing, makes an element of its own`, async () => {
            const rendered = await type.render({
                id: `${type.label.toLowerCase()}-fresh`,
                title: type.title,
                symbol: type.symbol,
                x: 10,
                y: 20,
                renderContent: () => document.createElement('div'),
            } as any);

            expect(rendered).toBeInstanceOf(HTMLElement);
        });
    }
});
