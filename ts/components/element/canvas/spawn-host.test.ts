/**
 * The host's side of the spawn menu.
 *
 * "on mobile, can't get into spawn menu"
 *
 * The menu, the carrying and the morph are @teranos/elements'. What the host
 * says is which element types a press offers, and what becomes of a choice:
 * its id, its persistence and its place under the canvas's pan and zoom.
 *
 * Personas:
 * - Tim: Happy path — what is offered, and what is placed
 * - Spike: Edge cases — a type that is gone
 * - Jenny: Complex scenarios — right-click to placed, through the package
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { configureElements, resetSpawn, type SpawnEntry } from '@teranos/elements';
import { spawnHost, spawnElement } from './spawn-host';
import { registerElementType, getElementTypeBySymbol } from '../element-registry';
import { uiState } from '../../../state/ui';

// Not in happy-dom: the road a carried element takes into place.
(globalThis.window as any).Element.prototype.animate = function () {
    return { addEventListener() {}, removeEventListener() {}, cancel() {} } as any;
};
globalThis.requestAnimationFrame = (_cb: FrameRequestCallback) => 0;
globalThis.cancelAnimationFrame = () => {};

const PUBLISHED = '◇'; // ◇

/** A canvas as buildCanvasWorkspace makes one: data-canvas-id, a content layer, its items. */
function workspace(canvasId = 'canvas-workspace'): { canvas: HTMLElement; layer: HTMLElement; items: any[] } {
    const canvas = document.createElement('div');
    canvas.className = 'canvas-workspace';
    canvas.dataset.canvasId = canvasId;
    canvas.getBoundingClientRect = () => ({
        left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => '',
    }) as DOMRect;
    const layer = document.createElement('div');
    layer.className = 'canvas-content-layer';
    canvas.appendChild(layer);
    const items: any[] = [];
    (canvas as any).__elements = items;
    document.body.appendChild(canvas);
    return { canvas, layer, items };
}

/** A renderer as the real ones are: it takes up the carried element when it is given one. */
function adopting(item: { cursorElement?: HTMLElement; id: string }): HTMLElement {
    const el = item.cursorElement ?? document.createElement('div');
    el.setAttribute('data-element-id', item.id);
    return el;
}

beforeEach(() => {
    document.body.innerHTML = '';
    registerElementType({
        symbol: PUBLISHED,
        className: 'canvas-published-element element-example',
        title: 'EXAMPLE',
        label: 'example',
        publishedName: 'example',
        render: adopting,
    });
});

afterEach(() => {
    resetSpawn();
    document.body.innerHTML = '';
});

describe('Spawn host - Tim (Happy Path)', () => {
    test('Tim is offered the built-in types, and one that was published, not built in', () => {
        const { canvas } = workspace();
        const offered = spawnHost.entries({ target: canvas, canvas }).map(e => e.symbol);
        expect(offered).toContain(PUBLISHED);
        expect(offered.length).toBeGreaterThan(1);
    });

    test('each entry says what it is in plain text, from the registry', () => {
        const { canvas } = workspace();
        const entries = spawnHost.entries({ target: canvas, canvas });
        for (const entry of entries) {
            expect(entry.title.length).toBeGreaterThan(0);
            expect(entry.id).toBe(entry.symbol);
        }
        const ax = entries.find(e => e.title === 'AX Query');
        expect(ax?.description).toBe('Query the attestation graph');
    });

    test('placing renders into the carried element, puts it on the canvas, persists it, and returns it', async () => {
        const { canvas, layer, items } = workspace();
        const carried = document.createElement('div');
        const symbol = document.createElement('span');
        const entry: SpawnEntry = { id: PUBLISHED, symbol: PUBLISHED, title: 'EXAMPLE' };

        const placed = await spawnHost.place({
            entry, canvas, at: { clientX: 300, clientY: 200 }, carried, symbol,
        });

        expect(placed).toBe(carried);
        expect(carried.parentElement).toBe(layer);
        expect(items).toHaveLength(1);
        expect(items[0].cursorElement).toBe(carried);
        expect(items[0].symbolElement).toBe(symbol);
        const saved = uiState.getCanvasElements('').find(e => e.id === carried.getAttribute('data-element-id'));
        expect(saved).toBeDefined();
        expect(saved!.symbol).toBe(PUBLISHED);
        expect(saved!.x).toBe(300);
        expect(saved!.y).toBe(200);
    });
});

describe('Spawn host - Spike (Edge Cases)', () => {
    test('an entry whose type has gone is an error, not an empty element', async () => {
        const { canvas } = workspace();
        const entry: SpawnEntry = { id: 'no-such-symbol', symbol: 'no-such-symbol', title: 'GONE' };
        await expect(spawnHost.place({
            entry, canvas, at: { clientX: 0, clientY: 0 }, carried: document.createElement('div'), symbol: null,
        })).rejects.toThrow(/no-such-symbol/);
    });

    test('a placed type is the registry\'s, found by the symbol the entry carries', () => {
        expect(getElementTypeBySymbol(PUBLISHED)?.label).toBe('example');
    });
});

describe('Spawn host - Jenny (Complex Scenarios)', () => {
    test('right-click, choose, press: the element stands on the canvas, once, and is saved', async () => {
        const { canvas, layer } = workspace();
        configureElements({ spawn: spawnHost });
        const MouseEv = (window as any).MouseEvent;

        canvas.dispatchEvent(new MouseEv('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 90 }));
        const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
            .find(i => i.textContent?.includes(PUBLISHED))!;
        expect(item).toBeDefined();

        item.dispatchEvent(new MouseEv('mousedown', { bubbles: true, cancelable: true, button: 0 }));
        canvas.dispatchEvent(new MouseEv('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: 400, clientY: 250 }));
        for (let i = 0; i < 10; i++) await Promise.resolve();

        const placed = layer.querySelectorAll('[data-element-id]');
        expect(placed).toHaveLength(1);
        expect(placed[0]).toBe(item);
        const saved = uiState.getCanvasElements('').find(e => e.id === placed[0].getAttribute('data-element-id'));
        expect(saved?.x).toBe(400);
        expect(saved?.y).toBe(250);
    });

    test('a spawn by command, from the search bar, still has no cursor and is put straight down', async () => {
        const { layer, items } = workspace();
        const entry = getElementTypeBySymbol(PUBLISHED)!;
        const placed = await spawnElement(10, 20, layer, items, 'canvas-workspace', entry);
        expect(placed.el.parentElement).toBe(layer);
        expect(placed.el.getAttribute('data-element-id')).toBe(placed.id);
    });
});
