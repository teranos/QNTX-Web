/**
 * Touch hold — a finger held still on the canvas, the phone's right-click.
 *
 * "on mobile, can't get into spawn menu"
 *
 * The spawn menu opens on `contextmenu`, and WebKit on iOS never fires one for
 * a long press. Held still for HOLD_MS, a finger fires what a right-click
 * would, where it rests. A finger that moves is panning; two are pinching;
 * either lets go of the hold. A press in a field is left to the field: a long
 * press there selects text.
 *
 * Where the platform does fire `contextmenu` on a long press (Android), the
 * first of the two to arrive is the one that counts: the hold gives way to a
 * `contextmenu` that came before it, and swallows the one that comes after it,
 * so the menu it opened is not dismissed by it.
 */

export const HOLD_MS = 500;
export const HOLD_SLOP_PX = 10;

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], .cm-editor';

export interface TouchHoldOptions {
    holdMs?: number;
    slopPx?: number;
    signal?: AbortSignal;
}

/** Calls fire with where a finger was held still on container, and what it held. */
export function onTouchHold(
    container: HTMLElement,
    fire: (clientX: number, clientY: number, target: HTMLElement) => void,
    options: TouchHoldOptions = {},
): void {
    const holdMs = options.holdMs ?? HOLD_MS;
    const slop = options.slopPx ?? HOLD_SLOP_PX;
    const signal = options.signal;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let finger: number | null = null;
    let startX = 0;
    let startY = 0;
    let held = false;

    const letGo = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        finger = null;
    };

    // A contextmenu the platform sends for the held press arrives after the
    // menu is open, and would dismiss it: swallowed, until the finger lifts.
    const swallow = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };
    let swallowing = false;
    let expiry: ReturnType<typeof setTimeout> | null = null;
    const stopSwallowing = () => {
        if (expiry !== null) clearTimeout(expiry);
        expiry = null;
        if (!swallowing) return;
        swallowing = false;
        window.removeEventListener('contextmenu', swallow, { capture: true });
        window.removeEventListener('touchend', lifted, { capture: true });
        window.removeEventListener('touchcancel', lifted, { capture: true });
    };

    // Heard on the window, so a finger lifting off something the menu took
    // out of the canvas is still heard.
    function lifted(e: Event): void {
        letGo();
        if (!held) return;
        held = false;
        // No mouse events after a hold: the menu's mousedown would take the
        // lifted finger for a press outside it.
        if (e.cancelable) e.preventDefault();
        // Android sends its contextmenu before the finger lifts; past this
        // point one is a new press, not this one.
        setTimeout(stopSwallowing, 0);
    }

    container.addEventListener('touchstart', (e: TouchEvent) => {
        letGo();
        held = false;
        stopSwallowing();
        if (e.touches.length !== 1) return;
        const target = e.target as HTMLElement | null;
        if (!target || target.closest(EDITABLE)) return;

        const touch = e.touches[0];
        finger = touch.identifier;
        startX = touch.clientX;
        startY = touch.clientY;
        timer = setTimeout(() => {
            timer = null;
            if (finger === null) return;
            held = true;
            swallowing = true;
            window.addEventListener('contextmenu', swallow, { capture: true });
            window.addEventListener('touchend', lifted, { capture: true, passive: false });
            window.addEventListener('touchcancel', lifted, { capture: true, passive: false });
            // Never past a lift the window did not hear.
            expiry = setTimeout(() => { held = false; stopSwallowing(); }, 5000);
            fire(startX, startY, target);
        }, holdMs);
    }, { signal, passive: true });

    container.addEventListener('touchmove', (e: TouchEvent) => {
        if (finger === null) return;
        if (e.touches.length !== 1) { letGo(); return; }
        const touch = Array.from(e.touches).find(t => t.identifier === finger);
        if (!touch) { letGo(); return; }
        if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > slop) letGo();
    }, { signal, passive: true });

    // A lift before the hold is a tap, and lets go of it.
    container.addEventListener('touchend', () => { if (!held) letGo(); }, { signal });
    container.addEventListener('touchcancel', () => { if (!held) letGo(); }, { signal });

    // The platform got there first: the hold gives way.
    container.addEventListener('contextmenu', () => { if (!held) letGo(); }, { signal });
}
