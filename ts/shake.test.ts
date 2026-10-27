// ROOT SHAKE picks the element in front; say carries the element and the picture.

import { describe, expect, test } from 'bun:test';
import { elementOfSymbol, elementOnScreen, SHAKE_ID } from './shake';
import { sayBody } from './claude-element';

function placed(id: string, form: string, z: string, symbol = ''): HTMLElement {
    const el = document.createElement('div');
    el.dataset.elementId = id;
    el.dataset.form = form;
    if (symbol) el.dataset.symbol = symbol;
    if (z) el.style.zIndex = z;
    return el;
}

describe('the element on screen', () => {
    test('a resting dot is not on screen', () => {
        const root = document.createElement('div');
        root.append(placed('a', 'dot', ''));
        expect(elementOnScreen(root)).toBeNull();
    });

    test('the window in front wins over the one behind', () => {
        const root = document.createElement('div');
        root.append(placed('behind', 'window', '10003'), placed('front', 'window', '10007', '✦'), placed('placed', 'canvasPlaced', '3'));
        expect(elementOnScreen(root)).toEqual({ id: 'front', symbol: '✦' });
    });

    test('level, the last in the page wins', () => {
        const root = document.createElement('div');
        root.append(placed('first', 'canvasPlaced', ''), placed('last', 'canvasPlaced', ''));
        expect(elementOnScreen(root)?.id).toBe('last');
    });

    test('a placed element lies on the canvas, so it wins over the workspace behind it', () => {
        const root = document.createElement('div');
        const workspace = placed('canvas-workspace', 'workspace', '1000');
        const note = placed('mock-note', '', '');
        note.classList.add('canvas-element');
        const ax = placed('mock-ax', '', '');
        ax.classList.add('canvas-element', 'canvas-element-selected');
        root.append(workspace, note, ax);
        expect(elementOnScreen(root)?.id).toBe('mock-ax');
        ax.classList.remove('canvas-element-selected');
        expect(elementOnScreen(root)?.id).toBe('mock-ax');
        note.style.zIndex = '5';
        expect(elementOnScreen(root)?.id).toBe('mock-note');
    });

    test('a window lies over the canvas and everything placed on it', () => {
        const root = document.createElement('div');
        const note = placed('mock-note', '', '99');
        note.classList.add('canvas-element');
        root.append(placed('canvas-workspace', 'workspace', '1000'), note, placed('i-element', 'window', '10002'));
        expect(elementOnScreen(root)?.id).toBe('i-element');
    });

    test('the shake chat itself is never what is shaken about', () => {
        const root = document.createElement('div');
        root.append(placed('note', 'canvasPlaced', '2'), placed(SHAKE_ID, 'panel', '10003'));
        expect(elementOnScreen(root)?.id).toBe('note');
    });
});

// > right click symbol -> ROOT SHAKE
describe('a right-clicked symbol', () => {
    test("is its element's, whichever element is in front", () => {
        const el = placed('behind', 'window', '10003', '⊔');
        const symbol = document.createElement('span');
        symbol.className = 'symbol';
        const glyph = document.createElement('span');
        symbol.append(glyph);
        el.append(symbol);
        expect(elementOfSymbol(glyph)).toEqual({ id: 'behind', symbol: '⊔' });
    });

    test('anywhere else on the element is no shake', () => {
        const el = placed('a', 'window', '1');
        const title = document.createElement('span');
        el.append(title);
        expect(elementOfSymbol(title)).toBeNull();
    });

    test('the shake chat itself is never what is shaken about', () => {
        const el = placed(SHAKE_ID, 'panel', '1');
        const symbol = document.createElement('span');
        symbol.className = 'symbol';
        el.append(symbol);
        expect(elementOfSymbol(symbol)).toBeNull();
    });
});

describe('what say carries', () => {
    test('words alone', () => {
        expect(JSON.parse(sayBody('hi', '', undefined))).toEqual({ harness: 'claude', says: 'hi' });
    });

    test('the mode and the picture', () => {
        expect(JSON.parse(sayBody('look', 'plan', { file_id: 'f1' })))
            .toEqual({ harness: 'claude', says: 'look', permission_mode: 'plan', file_id: 'f1' });
    });
});
