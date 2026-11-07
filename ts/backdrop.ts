// The backdrop: the ground under everything, a visual that is always there.
// Published elements offer grounds (a module exports backdrop); the viewer
// chooses one of them, or none, from their picture; any element can take the
// ground over and give it back. What a ground reads every frame, `live`, the
// page keeps fed from the node's statusline, so the ground is the node.

// "the visual backdrop needs to always be there regardless of being in a Room or not, but not as glitchy, and other elements can replace the backdrop kind of idea."
// "i want backdrop glovbal"
// "i want element to be able to override global backdrop"
// "i want reactive"
// "i want things to be alive"
// "and i want the visual to respond to the server statusline"
// "and i want to feel on a visceral level how the node is doing and what"
// "Goal set: global backdrop, element backdrop overwrite, via /g/, default global backdrop can be boring is ok. option to choose between backdrops by clicking on profile pic."

import { apiFetch } from './client/http';
import { getStorageItem, setStorageItem } from './indexeddb-storage.ts';
import { log, SEG } from './logger.ts';

const LAYER = 'backdrop';
// The viewer's choice, kept in this browser: a ground's name, or NONE.
const CHOICE_KEY = 'backdrop-chosen';
/** The plain ground: the page's own colour and nothing on it. */
export const NONE = 'none';
// How often the ground hears from the node.
const PULSE_MS = 2000;

/** What a ground reads every frame: the node as the page last heard it. */
export interface Live {
    /** The node's answer: how long its last answer took, how long it has been silent, how many of its items are unwell. */
    store: { answer: number; silent: number; held: number; ran: number };
    /** Movement: a level that falls away after each answer, an onset when the statusline changed. */
    audio: { level: number; onset: number; low: number; mid: number; high: number; hz: number };
    now: () => number;
}

/** A module's ground: it fills the layer, and what it returns gives the ground up. */
export type BackdropFn = (layer: HTMLElement, held: { live: Live }) => () => void;

interface StatusItem { name: string; note?: string; symbol: string }

// ── The pulse: the node's statusline, read into live ────────────────

let peakAt = 0;
let peak = 0;
let onsetAt = 0;
let unwell = 0;
let items = 0;

const falling = (at: number, from: number, over: number): number => Math.max(0, from * (1 - (Date.now() - at) / over));

export const live: Live = {
    store: { answer: 0, silent: 0, held: 0, ran: 0 },
    audio: {
        get level() { return falling(peakAt, peak, 1800); },
        get onset() { return falling(onsetAt, 1, 500); },
        get low() { return items ? unwell / items : 0; },
        get mid() { return falling(peakAt, peak, 1800); },
        get high() { return falling(onsetAt, 1, 500); },
        hz: 0,
    },
    now: () => Date.now(),
};

let lastSeen = '';
let silentSince = 0;

/** One beat: the node's statusline, as the brow reads it, into live. */
async function beat(): Promise<void> {
    const asked = performance.now();
    try {
        const response = await apiFetch('/am/statusline?format=json');
        if (!response.ok) throw new Error(`/am/statusline answered ${response.status}`);
        const body = await response.json() as { items?: StatusItem[] };
        const found = body.items ?? [];
        live.store.answer = (performance.now() - asked) / 1000;
        live.store.silent = 0;
        silentSince = 0;
        items = found.length;
        unwell = found.filter(it => it.symbol !== '+' && it.symbol !== '●').length;
        live.store.held = unwell;
        const seen = found.map(it => `${it.name}:${it.symbol}:${it.note ?? ''}`).join('|');
        if (seen !== lastSeen) { onsetAt = Date.now(); lastSeen = seen; }
        peak = 0.35 + Math.min(0.65, live.store.answer);
        peakAt = Date.now();
    } catch (err) {
        if (!silentSince) silentSince = Date.now();
        live.store.silent = (Date.now() - silentSince) / 1000;
        log.debug(SEG.UI, `[Backdrop] the node did not answer: ${err instanceof Error ? err.message : String(err)}`);
    }
}

let pulse: ReturnType<typeof setInterval> | null = null;
function startPulse(): void {
    if (pulse) return;
    void beat();
    pulse = setInterval(() => { if (!document.hidden) void beat(); }, PULSE_MS);
}
function stopPulse(): void {
    if (pulse) { clearInterval(pulse); pulse = null; }
}

// ── The grounds offered, the one chosen, and who holds the layer ────

/** The layer itself, or null before the page has one. */
export function backdropLayer(): HTMLElement | null {
    return document.getElementById(LAYER);
}

const offers = new Map<string, BackdropFn>();
// The ground showing, and how to give it up.
let showing: { name: string; stop: () => void } | null = null;
// An element holding the layer over the ground, by name.
let heldBy = '';
const listeners = new Set<() => void>();

function changed(): void {
    for (const listen of listeners) listen();
}

/** Called whenever the grounds offered, the one chosen or who holds the layer change. */
export function onBackdropChange(listen: () => void): () => void {
    listeners.add(listen);
    return () => { listeners.delete(listen); };
}

/** The viewer's choice: a ground's name, or NONE; the first offered when nothing was chosen. */
export function chosenBackdrop(): string {
    const kept = getStorageItem(CHOICE_KEY);
    if (kept === NONE) return NONE;
    if (kept && offers.has(kept)) return kept;
    return offers.keys().next().value ?? NONE;
}

/** Every ground offered, by name. */
export function offeredBackdrops(): string[] {
    return Array.from(offers.keys());
}

function hideShowing(): void {
    if (!showing) return;
    showing.stop();
    showing = null;
    stopPulse();
    const layer = backdropLayer();
    if (layer) { layer.replaceChildren(); delete layer.dataset.ground; }
}

function showChosen(): void {
    const layer = backdropLayer();
    if (!layer || heldBy) return;
    const name = chosenBackdrop();
    if (showing?.name === name) return;
    hideShowing();
    const fn = offers.get(name);
    if (!fn) { changed(); return; }
    layer.replaceChildren();
    showing = { name, stop: fn(layer, { live }) };
    layer.dataset.ground = name;
    startPulse();
    log.info(SEG.UI, `[Backdrop] the ground is ${name}`);
    changed();
}

/** A published element offers a ground. It shows when it is the one chosen, or the first when none was. */
export function offerBackdrop(name: string, fn: BackdropFn): void {
    offers.set(name, fn);
    showChosen();
}

/** The viewer chooses a ground by name, or NONE. Kept in this browser. */
export function chooseBackdrop(name: string): void {
    setStorageItem(CHOICE_KEY, name);
    if (showing && showing.name !== name) hideShowing();
    showChosen();
    changed();
}

/**
 * An element takes the ground over with node. What it gets back gives the
 * ground up: the chosen ground returns.
 */
export function takeBackdrop(node: HTMLElement, by = node.dataset.elementId ?? node.className ?? 'something'): () => void {
    const layer = backdropLayer();
    if (!layer) return () => {};
    hideShowing();
    layer.replaceChildren(node);
    layer.dataset.heldBy = by;
    heldBy = by;
    changed();
    return () => {
        if (layer.firstChild !== node) return;
        layer.replaceChildren();
        delete layer.dataset.heldBy;
        heldBy = '';
        showChosen();
        changed();
    };
}

/** Who holds the ground now: an element's name, the ground showing, or NONE. */
export function backdropHeldBy(): string {
    return heldBy || showing?.name || NONE;
}
