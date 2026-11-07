// The mock, as an element: who you are on the mock node, who else you can be,
// the way out, and the shake. The mock (mock/server.ts) says who and who else;
// the page draws it, in the tokens, as it draws everything.

// "or like floating and transparent and actually an element"
// "what constitutes to the styling choice of this piece of ui, why isnt it taken seriously"
// "also it blocks the rest, i cant move it out of the way"

import { pressFrom, tray } from '@teranos/elements';
import { SHAKE_EVENT } from './shake.ts';

export const ELEMENT_ID = 'mock-element';
const AS_PATH = '/__mock__/as/';

/** What the mock put on the page: who you are, and every level you can be. */
export interface Mock { as: string; levels?: string[] }

export function theMock(): Mock | null {
    const held = (window as { __MOCK__?: Mock }).__MOCK__;
    return held && typeof held.as === 'string' ? held : null;
}

function part<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    el.className = className;
    return el;
}

/** The mock's window drawn into body: a line of who you are, and the presses. */
export function drawMock(body: HTMLElement, mock: Mock, go: (path: string) => void = path => { location.href = path; }): void {
    const who = part('div', 'mock-who');
    who.textContent = `MOCK, no node · you are ${mock.as}`;
    const presses = part('div', 'mock-presses');
    for (const level of mock.levels ?? []) {
        if (level === mock.as) continue;
        presses.append(pressFrom({ id: `mock-as-${level}`, title: `be ${level}`, does: () => { go(`${AS_PATH}${level}`); } }).element);
    }
    presses.append(pressFrom({ id: 'mock-sign-out', title: 'sign out', does: () => { go(`${AS_PATH}nobody`); } }).element);
    // > think ROOT SHAKE
    // The element's shake is the phone's: the page hears one event either way (ts/shake.ts).
    if (mock.as === 'ROOT') presses.append(pressFrom({ id: 'mock-shake', title: 'shake', does: () => { window.dispatchEvent(new Event(SHAKE_EVENT)); } }).element);
    body.replaceChildren(who, presses);
}

/** Rests the mock in the tray as a small window, open, at the end. Nothing happens without a mock on the page. */
export function restMock(mock: Mock | null = theMock()): void {
    if (!mock || tray.has(ELEMENT_ID)) return;
    tray.add({
        id: ELEMENT_ID,
        title: 'MOCK',
        symbol: '◌',
        opensAs: 'window',
        opensAt: 'end',
        renderContent: () => {
            const body = part('div', 'content-area mock-body');
            drawMock(body, mock);
            return body;
        },
    });
    tray.open(ELEMENT_ID);
}
