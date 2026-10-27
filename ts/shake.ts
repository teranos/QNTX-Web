// ROOT SHAKE — the phone shaken, the element on screen talked to.

// > i want to shake my phone and talk to an element

// > and its not the user Feedback form but literally an agent prompt, with the screenshot pasted right there.

// > this mechanism is special, its just for root.

// > ROOT SHAKE should open up that element chat from below,

// The shake is the shell's (QNTX-App feels it natively, no permission asked) or
// the mock strip's; both arrive here as one event. The picture is the shell's
// snapshot of the web view, or, under the mock, a drawn stand-in that says so.

import type { Element } from '@teranos/elements';
import { tray } from '@teranos/elements';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { drawClaude, elementAgent } from './claude-element';
import { log, SEG } from './logger.ts';
import { Shake } from './sym';
import type { Person } from './self-person';

export const SHAKE_ID = 'shake-element';

/** A phone, as the page tells one (sidebar.ts). */
const PHONE = '(max-width: 768px)';

/** The DOM event a shake is, whoever felt it. The mock strip dispatches it; so may a test. */
export const SHAKE_EVENT = 'qntx-shake';

/** What the shell emits when the phone is shaken (QNTX-App, plugin shake). */
const SHELL_EVENT = 'shake';

/** What the page invokes for the shell's picture of itself. */
const SNAPSHOT = 'plugin:shake|snapshot';

// How far in front an element is by the form it is in: a window or panel lies
// over the canvas, a placed element lies on it, the canvas itself is behind all
// of them. A placed element carries no data-form; its class says what it is.
function layer(each: HTMLElement): number {
    const form = each.dataset.form ?? '';
    if (form === 'window' || form === 'panel' || form === 'canvasExpanded') return 3;
    if (form === 'canvasPlaced' || each.classList.contains('canvas-element')) return each.classList.contains('canvas-element-selected') ? 2.5 : 2;
    if (form === 'workspace') return 1;
    return 0;
}

/** The element on screen: the one in front, by its layer, then its z-index, then last in the page when level. */
export function elementOnScreen(root: ParentNode = document): { id: string; symbol: string } | null {
    let found: HTMLElement | null = null;
    let frontLayer = 0;
    let front = Number.NEGATIVE_INFINITY;
    for (const each of root.querySelectorAll<HTMLElement>('[data-element-id]')) {
        if (each.dataset.elementId === SHAKE_ID) continue;
        const at = layer(each);
        if (at === 0) continue;
        const z = parseInt(each.style.zIndex || '0', 10) || 0;
        if (at > frontLayer || (at === frontLayer && z >= front)) {
            frontLayer = at;
            front = z;
            found = each;
        }
    }
    if (!found) return null;
    return { id: found.dataset.elementId ?? '', symbol: found.dataset.symbol ?? '' };
}

interface Snapshot {
    png: string;
    width: number;
    height: number;
}

/** The shell's picture of the page, or the mock's stand-in, or nothing where neither is. */
export async function snapshot(): Promise<Blob | null> {
    if (window.__TAURI__) {
        const shot = await invoke<Snapshot>(SNAPSHOT);
        return (await fetch(shot.png)).blob();
    }
    if ((window as { __MOCK__?: unknown }).__MOCK__) return mockPicture();
    return null;
}

// The mock has no shell to picture the page: a drawn frame that says it is the mock, the size of the viewport.
function mockPicture(): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ink = canvas.getContext('2d');
    if (!ink) return Promise.resolve(null);
    ink.fillStyle = '#151514';
    ink.fillRect(0, 0, canvas.width, canvas.height);
    ink.strokeStyle = '#fde68a';
    ink.lineWidth = 8;
    ink.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    ink.fillStyle = '#fde68a';
    ink.font = '24px monospace';
    ink.fillText('MOCK snapshot', 24, 48);
    ink.fillText(`${canvas.width} × ${canvas.height}, ${new Date().toISOString()}`, 24, 84);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

interface Shaken {
    id: string;
    symbol: string;
    image: Blob | null;
}

let current: Shaken | null = null;
let body: HTMLElement | null = null;
let settle = () => {};

function part<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    el.className = className;
    return el;
}

// The chat: the element's own agent, the picture already in the composer.

// > AND THAT ELEMENT IS THE AGENT,

// > DAY 3 SHAKE AGAIN, SAME ELEMENT
function draw(into: HTMLElement, shaken: Shaken): void {
    settle();
    const head = part('div', 'shake-head');
    head.textContent = `${shaken.symbol} ${shaken.id}`.trim();
    const talk = part('div', 'shake-talk');
    into.replaceChildren(head, talk);
    settle = drawClaude(talk, elementAgent(shaken.id), undefined, shaken.image ? { image: shaken.image } : {});
    const says = talk.querySelector<HTMLTextAreaElement>('.claude-says');
    if (says) {
        says.placeholder = `Say what is wrong with ${shaken.id}`;
        says.focus();
    }
}

function createShakeElement(): Element {
    return {
        id: SHAKE_ID,
        title: 'ROOT SHAKE',
        symbol: Shake,
        // From below on a phone; on a desktop a window, not the whole screen.
        opensAs: window.matchMedia?.(PHONE).matches ? 'panel' : 'window',
        opensAt: 'end',
        renderContent: () => {
            body = part('div', 'content-area claude claude-brand shake-body');
            if (current) draw(body, current);
            else body.textContent = 'Shake the phone with an element on screen.';
            return body;
        },
    };
}

/** One shake: the element in front, the picture, and the chat from below. */
export async function shaken(): Promise<void> {
    const on = elementOnScreen();
    if (!on) {
        log.info(SEG.ELEMENT, '[Shake] nothing is on screen to talk to');
        return;
    }
    await shake(on);
}

// > right click symbol -> ROOT SHAKE

/** The element whose symbol was right-clicked, or null when the click was on no element's symbol. */
export function elementOfSymbol(target: EventTarget | null): { id: string; symbol: string } | null {
    if (!(target instanceof HTMLElement) || !target.closest('.symbol')) return null;
    // ROOT SHAKE's own symbol too: a right-click names the element, the shake chat as well.
    const element = target.closest<HTMLElement>('[data-element-id]');
    if (!element) return null;
    return { id: element.dataset.elementId ?? '', symbol: element.dataset.symbol ?? '' };
}

/** ROOT SHAKE about the agent named, whatever is on screen: a story's, from the Stories element. */
export function shakeAbout(id: string, symbol: string): Promise<void> {
    return shake({ id, symbol });
}

async function shake(on: { id: string; symbol: string }): Promise<void> {
    let image: Blob | null = null;
    try {
        image = await snapshot();
    } catch (err: unknown) {
        log.warn(SEG.ELEMENT, `[Shake] no picture of the page: ${err instanceof Error ? err.message : String(err)}`);
    }
    current = { id: on.id, symbol: on.symbol, image };
    if (!tray.has(SHAKE_ID)) tray.add(createShakeElement());
    // The panel's content is drawn once and kept across its forms, so every
    // shake draws it again for the element in front, before the panel opens.
    if (body) draw(body, current);
    tray.open(SHAKE_ID);
}

/** ROOT's shake is wired; anyone else's is not felt. Returns whether it was. */
export function rootShake(who: Person | null): boolean {
    if (who?.level !== 'ROOT') return false;
    window.addEventListener(SHAKE_EVENT, () => { void shaken(); });
    document.addEventListener('contextmenu', (event) => {
        const on = elementOfSymbol(event.target);
        if (!on) return;
        event.preventDefault();
        void shake(on);
    });
    if (window.__TAURI__) {
        listen(SHELL_EVENT, () => { void shaken(); }).catch((err: unknown) => {
            log.error(SEG.UI, `[Shake] the shell's shake was not listened to: ${err instanceof Error ? err.message : String(err)}`);
        });
    }
    return true;
}
