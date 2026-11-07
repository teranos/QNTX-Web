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
/** Where the choice is kept: this browser's storage, or what a test hands resetBackdrop. */
interface Keep { get(key: string): string | null; set(key: string, value: string): void }
const browserKeep: Keep = { get: getStorageItem, set: setStorageItem };
let keep: Keep = browserKeep;
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

/**
 * An agent as a ground draws it: its name, the harness it runs in, the model
 * it is, and two numbers every ground agrees on — how strong the model is
 * (size) and how much effort it runs at (speed), each 0..1.
 */
// "and the room itself is the fish is the agent is the model is a different species per model."
// "stronger model is stronger bigger fish"
// "effort translated to speed"
export interface Fish { name: string; harness: string; model: string; effort: string; strength: number; speed: number }

/** A room holding the ground: its name, and the agents in it, each a fish. */
export interface RoomHeld { name: string; agents: Fish[] }

// How strong a model is, by its name: the page's one reading of it, so pond and piranha agree.
const STRENGTH: Array<[string, number]> = [
    ['fable', 1], ['opus', 0.9], ['sonnet', 0.6], ['haiku', 0.3],
    ['pro', 0.8], ['flash', 0.4],
    ['nano', 0.2], ['mini', 0.4], ['gpt', 0.8], ['codex', 0.8],
];
// How fast it runs, by the effort it was given.
const SPEED: Record<string, number> = { low: 0.4, medium: 0.6, high: 0.8, xhigh: 0.9, max: 1 };

/** The fish an agent is: strength from its model's name, speed from its effort; 0.5 and 0.6 when unknown. */
export function fishOf(agent: { name: string; harness: string; model?: string; effort?: string }): Fish {
    const model = (agent.model ?? '').toLowerCase();
    const strength = STRENGTH.find(([word]) => model.includes(word))?.[1] ?? 0.5;
    const speed = SPEED[(agent.effort ?? '').toLowerCase()] ?? 0.6;
    return { name: agent.name, harness: agent.harness, model: agent.model ?? '', effort: agent.effort ?? '', strength, speed };
}

/** What a ground is given: the node as live, and the room holding it, when one does. */
export interface Held { live: Live; room?: RoomHeld }

/** A module's ground: it fills the layer, and what it returns gives the ground up. */
export type BackdropFn = (layer: HTMLElement, held: Held) => () => void;

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
    const kept = keep.get(CHOICE_KEY);
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
    keep.set(CHOICE_KEY, name);
    if (holding) { redrawHeld(); return; }
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

/**
 * An element holds the ground: the chosen ground is drawn again for it, given
 * what it holds (a room, its agents). What comes back gives the ground up, and
 * the chosen ground returns as it was. With the ground plain, nothing is held.
 */
export function holdBackdrop(by: string, holds: Omit<Held, 'live'>): () => void {
    const layer = backdropLayer();
    if (!layer) return () => {};
    hideShowing();
    if (holding) { holding.stop(); holding = null; }
    const node = document.createElement('div');
    node.className = 'backdrop-held-by';
    const drawn = drawHeld(layer, node, by, holds);
    if (!drawn) { layer.replaceChildren(); return () => {}; }
    return () => {
        if (!holding || holding.node !== node) return;
        holding.stop();
        holding = null;
        stopPulse();
        layer.replaceChildren();
        delete layer.dataset.heldBy;
        delete layer.dataset.holds;
        heldBy = '';
        showChosen();
        changed();
    };
}

// The element holding the ground now: who, what it holds, the node it draws in, and how to stop the ground drawn for it.
let holding: { by: string; holds: Omit<Held, 'live'>; node: HTMLElement; stop: () => void } | null = null;

/** The chosen ground drawn in node for the element holding it; false when the ground is plain. */
function drawHeld(layer: HTMLElement, node: HTMLElement, by: string, holds: Omit<Held, 'live'>): boolean {
    const name = chosenBackdrop();
    const fn = offers.get(name);
    if (!fn) return false;
    node.replaceChildren();
    layer.replaceChildren(node);
    holding = { by, holds, node, stop: fn(node, { live, ...holds }) };
    startPulse();
    layer.dataset.heldBy = by;
    layer.dataset.holds = name;
    heldBy = by;
    log.info(SEG.UI, `[Backdrop] ${by} holds the ground, ${name}`);
    changed();
    return true;
}

/** The viewer chose while an element holds the ground: the hold is drawn again with the ground chosen now. */
function redrawHeld(): void {
    const layer = backdropLayer();
    if (!layer || !holding) return;
    const { by, holds, node } = holding;
    holding.stop();
    holding = null;
    if (!drawHeld(layer, node, by, holds)) {
        layer.replaceChildren();
        delete layer.dataset.heldBy;
        delete layer.dataset.holds;
        heldBy = '';
        changed();
    }
}

/** Who holds the ground now: an element's name, the ground showing, or NONE. */
export function backdropHeldBy(): string {
    return heldBy || showing?.name || NONE;
}

/** For tests: forget every ground offered, showing or held, so the next test starts from nothing; keep the choice where the test says. */
export function resetBackdrop(keepIn: Keep = browserKeep): void {
    hideShowing();
    offers.clear();
    heldBy = '';
    listeners.clear();
    lastSeen = '';
    silentSince = 0;
    keep = keepIn;
}
