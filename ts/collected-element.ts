// What agents said to an agent, collected, a pill in the field of the chat with that agent.
// stories/37-root-authors-what-agents-say-to-an-agent.feature is what it does.
// "i dont want a separate screen, a separate ui to have to go to"
// "About it taking over everything for no good reason?" "THE OLD PATTERN IS BAD" "I want you to use the pills for it instead":
// @teranos/elements' outbox (examples/outbox.ts) is the pattern: at rest it says how many wait and when they go; pressed, it is
// across its row, the field and the keyboard where they were, what is done with them said once, on one line.
// What is collected and when it goes is the node's (the collected signum); this draws it and says what a person does with it.

import { pillFrom, PILL_RESTED, pressFrom, declareScroller, preventDrag, sizeText, AX, type PillHandle } from '@teranos/elements';
import { apiJson } from './client';
import { log, SEG } from './logger.ts';
import { sacredEntry, type SacredError } from './components/sacred';

/** One thing an agent said to another, as the node holds it (protocol.CollectedSaid). */
export interface CollectedSaid {
    from: string;
    /** Who said it, by DID: what a chat's outbox finds its agent's words by (outbox-element.ts). */
    from_did?: string;
    says: string;
    at: string;
    task: string;
    id: string;
    edited: boolean;
}

/** What waits for one agent (protocol.Collected). */
export interface Collected {
    to: string;
    did: string;
    model: string;
    waits: string;
    due: string;
    held_until: string;
    delivered: string;
    waiting: CollectedSaid[];
    /** Since when delivering it has failed, RFC3339; absent or empty when it has not. */
    failing_since?: string;
    /** How many times in a row the node tried to deliver it and could not. */
    tries?: number;
    /** Why the last try failed, as the node was told. */
    failure?: string;
}

/** The node's collection, as this asks it. */
export interface Collection {
    list(): Promise<Collected[]>;
    edit(to: string, id: string, says: string): Promise<Collected[]>;
    later(to: string): Promise<Collected[]>;
    hold(to: string, until: Date): Promise<Collected[]>;
    release(to: string, ids: string[]): Promise<Collected[]>;
    cancel(to: string, id?: string): Promise<Collected[]>;
}

const said = (path: string, sent: Record<string, string>): Promise<Collected[]> =>
    apiJson<{ collected: Collected[] }>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sent),
    }).then(answer => answer.collected ?? []);

/** The collected signum, at its paths. */
export const theCollection: Collection = {
    list: () => apiJson<{ collected: Collected[] }>('/api/collected').then(answer => answer.collected ?? []),
    edit: (to, id, says) => said('/api/collected/edit', { to, id, says }),
    later: to => said('/api/collected/later', { to }),
    hold: (to, until) => said('/api/collected/hold', { to, until: until.toISOString() }),
    release: (to, ids) => said('/api/collected/release', { to, ids: ids.join(',') }),
    cancel: (to, id) => said('/api/collected/cancel', id ? { to, id } : { to }),
};

// How often what waits is asked again.
const LOOK_MS = 5000;
// How far a finger drags for one hour more, in px.
const PX_PER_HOUR = 10;
// The longest a drag holds it: two weeks.
const MOST_HOURS = 336;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const two = (n: number): string => String(n).padStart(2, '0');

/** A moment as a person reads it: the time, with the day when it is not today. */
export function momentSaid(at: Date, now: Date = new Date()): string {
    const time = `${two(at.getHours())}:${two(at.getMinutes())}`;
    const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
    if (sameDay) return time;
    const within = Math.abs(at.getTime() - now.getTime()) < 6 * 86_400_000;
    return within ? `${DAYS[at.getDay()]} ${time}` : `${at.getDate()}/${at.getMonth() + 1} ${time}`;
}

/**
 * When what waits is sent. What holds only what wakes nobody is due at no
 * time, and the node says so with no time: it goes with what wakes next.
 */
export function sentSaid(due: string, now: Date = new Date()): string {
    return due ? momentSaid(new Date(due), now) : 'with what wakes next';
}

/** What the batch says at rest: how many wait, and when they are sent, or that they were not. */
export function batchSaid(waits: Collected, now: Date = new Date()): string {
    const n = waits.waiting.length;
    const how = waits.failing_since ? `not delivered, ${waits.tries ?? 0} tries` : sentSaid(waits.due, now);
    return `${n} ${n === 1 ? 'waits' : 'wait'} · ${how}`;
}

/**
 * "The failure is also quiet by construction."
 *
 * What the node could not deliver, as the one failure it is: why, and how many
 * times since when. Null while it has not failed. One failure keeps one id for
 * as long as it keeps failing, so it is drawn once and moved, not drawn again.
 */
export function failureOf(waits: Collected): SacredError | null {
    if (!waits.failing_since) return null;
    return {
        id: `collected-failing-${waits.did}-${waits.failing_since}`,
        severity: 'error',
        context: { surface: 'collected', region: waits.to },
        title: `not delivered to ${waits.to}`,
        why: waits.failure ?? '',
        trace: [`tried ${waits.tries ?? 0} times since ${waits.failing_since}`],
        at: waits.failing_since,
    };
}

/** The moment it is held until, hours longer than it is due: from when it is due, and from now where it is due at no time. */
export function heldUntil(due: string, hours: number, now: number = Date.now()): Date {
    return new Date((due ? new Date(due).getTime() : now) + hours * 3_600_000);
}

/** The hours it is held longer after a drag of dy px from what it was: up is more, down is less, never under none. */
export function hoursAfter(was: number, dy: number): number {
    return Math.max(0, Math.min(MOST_HOURS, was + Math.round(-dy / PX_PER_HOUR)));
}

/** How much longer, as a person reads it. */
export function longerSaid(hours: number): string {
    const days = Math.floor(hours / 24);
    return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
}

function part<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    el.className = className;
    return el;
}

const wordsOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));


/** Pins each style on node. */
export function pin(node: HTMLElement, styles: Record<string, string>): void {
    for (const [name, value] of Object.entries(styles)) node.style.setProperty(name, value);
}

/**
 * The pill gone: let go, and out of sight once it is at rest. "Nothing left, it rests and is gone"
 * (@teranos/elements examples/outbox.ts).
 */
export function away(pill: PillHandle): void {
    pill.rest();
    if (pill.element.dataset.form === 'pill' && pill.element.dataset.pillMoving === undefined) pill.element.hidden = true;
}

/** A pill that is shown only while something waits in it: rested with nothing left, it is out of sight. */
export function waitingPill(id: string, title: string, whole: HTMLElement): { pill: PillHandle; waits: () => boolean; said: (waits: boolean) => void } {
    let waiting = false;
    const pill = pillFrom({ id, title, renderContent: () => whole });
    pill.element.hidden = true;
    pill.element.addEventListener(PILL_RESTED, () => { pill.element.hidden = !waiting; });
    return {
        pill,
        waits: () => waiting,
        said: (waits: boolean) => {
            waiting = waits;
            if (waits) pill.element.hidden = false;
            else away(pill);
        },
    };
}

/**
 * A row of what waits: who said it and when, pressed to choose it, and what was said, written over by the person.
 * "A row pressed is chosen; Cancel takes what is chosen, or, nothing chosen, all of it" (@teranos/elements examples/outbox.ts).
 */
export function waitingRow(kind: string, said: string): { row: HTMLElement; who: HTMLButtonElement; says: HTMLTextAreaElement } {
    const row = part('div', `${kind}-one`);
    pin(row, { display: 'flex', 'flex-direction': 'column', gap: '4px' });
    const who = part('button', `${kind}-who`);
    who.type = 'button';
    who.setAttribute('aria-pressed', 'false');
    who.addEventListener('click', () => who.setAttribute('aria-pressed', String(who.getAttribute('aria-pressed') !== 'true')));
    const says = part('textarea', `${kind}-says`);
    says.rows = 2;
    says.style.width = '100%';
    says.style.boxSizing = 'border-box';
    says.setAttribute('aria-label', said);
    row.append(who, says);
    return { row, who, says };
}

/** What is done with what waits, said once, on one line. */
export function actionsLine(kind: string): HTMLElement {
    const line = part('div', `${kind}-actions`);
    pin(line, { display: 'flex', 'flex-wrap': 'wrap', gap: '8px', 'align-items': 'flex-start' });
    return line;
}

/** What waits, each saying what it says: a short list, scrolled in itself. */
export function waitingList(kind: string, label: string): HTMLElement {
    const list = part('div', `${kind}-said`);
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', label);
    pin(list, { display: 'flex', 'flex-direction': 'column', gap: '8px', 'max-height': '30vh', 'overflow-y': 'auto' });
    declareScroller(list);
    return list;
}

// What waits that is drawn now, by the agent it waits for, and what is to be opened as soon as it is drawn.
const drawnFor = new Map<string, PillHandle>();
// By the agent it waits for, the time what is to be opened is due: asked for one batch, another is not opened in its place.
const wantedOpen = new Map<string, string>();
const dueDrawn = new Map<string, string>();

/**
 * Opens what waits for the agent whose DID this is and is due at due: now when
 * it is drawn at rest, and when it is drawn otherwise. ROOT came in from a
 * notification about it (phone.ts), and what they came for is in front. Gone
 * before it was drawn, nothing is opened for it.
 */
export function openWhenShown(did: string, due: string): void {
    const drawn = drawnFor.get(did);
    if (drawn && dueDrawn.get(did) === due && !drawn.element.hidden) drawn.element.click();
    else wantedOpen.set(did, due);
}

// Each chat's pill, numbered: an element, with an id of its own for its whole life.
let pills = 0;

/** What waits for a chat's agent, as a pill in its field: what watch gives back stops asking. */
export interface CollectedPill {
    element: HTMLElement;
    /** Asks what waits for the agent whose DID this is, and draws it, until what it gives back is called. */
    watch(did: string): () => void;
}

/**
 * What waits for a chat's agent: a pill in the chat's field (declareSay's waiting), out of sight while nothing
 * waits. sent is told when it was released, so the chat follows the turn it starts.
 */
export function collectedFrom(sent: () => void, node: Collection = theCollection, every: number = LOOK_MS): CollectedPill {
    let waits: Collected | null = null;
    let did = '';
    let stopped = true;
    // What each thing said is drawn as, by its id: its field, what the node held when the node last
    // wrote the field, and the edits of it being kept, one after another.
    interface Row { row: HTMLElement; says: HTMLTextAreaElement; who: HTMLButtonElement; failed: HTMLElement; held: string; keeping: Promise<void> }
    const rows = new Map<string, Row>();
    // Each answer of the node's in the order it was asked for, and the latest drawn: one asked before it is not drawn over it.
    let asked = 0;
    let drawnAt = 0;
    // Whether a batch was drawn, and whether its going was the person's own cancel.
    let had = false;
    let canceledHere = false;

    // "THE UI CONTROLS ARE DISPLAYED IN THE HEADER AREA": what is done with it, said once, on one line, above what waits.
    const actions = actionsLine('collected');
    const when = part('div', 'collected-when');
    const list = waitingList('collected', 'What waits');
    // What the node could not deliver, through the one render a failure has.
    const failed = part('div', 'collected-failed-delivery');
    let failedFor = '';
    const whole = part('div', 'collected');
    pin(whole, { display: 'flex', 'flex-direction': 'column', gap: '8px', width: '100%' });
    whole.append(failed, when, actions, list);
    // What is typed and pressed here is not a drag of the element.
    preventDrag(whole);
    const shown = waitingPill(`collected-${++pills}`, '', whole);
    const pill = shown.pill;
    pill.element.title = 'What waits to be said to this agent';
    pill.element.dataset.collected = '';

    const fails = (what: string, err: unknown) => log.error(SEG.ELEMENT, `[Collected] ${what}: ${wordsOf(err)}`);

    /** One thing asked of the node, drawn when it answers unless something asked later was drawn first. */
    const ask = async (answer: () => Promise<Collected[]>): Promise<void> => {
        const mine = ++asked;
        const all = await answer();
        if (mine < drawnAt) return;
        drawnAt = mine;
        draw(all);
    };

    /** What the node holds now, drawn: the batch at rest, and who said what when it is open. */
    const draw = (all: Collected[]) => {
        if (stopped) return;
        const mine = all.find(one => one.did === did && one.waiting.length > 0) ?? null;
        waits = mine;
        if (!mine) {
            shown.said(false);
            if (drawnFor.get(did) === pill) drawnFor.delete(did);
            wantedOpen.delete(did);
            dueDrawn.delete(did);
            rows.clear();
            list.replaceChildren();
            // It went and the person did not cancel it: the node delivered it, from here or from
            // elsewhere, and the chat follows the turn that started.
            if (had && !canceledHere) sent();
            had = false;
            canceledHere = false;
            return;
        }
        had = true;
        pill.retitle(batchSaid(mine));
        shown.said(true);
        drawnFor.set(did, pill);
        dueDrawn.set(did, mine.due);
        // Asked for before it was drawn: opened once it rests, which is a press on it. What was asked
        // for was due at one time, and what is drawn now for another time is not what was asked for.
        const wanted = wantedOpen.get(did);
        if (wanted !== undefined) {
            wantedOpen.delete(did);
            if (wanted === mine.due) {
                setTimeout(() => { if (drawnFor.get(did) === pill && pill.element.dataset.form === 'pill' && pill.element.isConnected) pill.element.click(); }, 0);
            }
        }
        const held = mine.held_until ? `, held by you until ${momentSaid(new Date(mine.held_until))}` : '';
        when.textContent = `For ${mine.to}. Sent ${sentSaid(mine.due)}${held}.`;
        const failure = failureOf(mine);
        if (!failure) {
            failed.replaceChildren();
            failedFor = '';
        } else if (failure.id !== failedFor) {
            failed.replaceChildren(sacredEntry(failure));
            failedFor = failure.id;
        }

        const seen = new Set<string>();
        for (const one of mine.waiting) {
            seen.add(one.id);
            let drawn = rows.get(one.id);
            if (!drawn) {
                const { row, who, says } = waitingRow('collected', `What ${one.from} said`);
                row.dataset.said = one.id;
                says.value = one.says;
                // What the person wrote is the node's once they leave the field.
                says.addEventListener('change', () => { keep(one.id).catch(() => { /* said beside the field */ }); });
                const failed = part('div', 'collected-failed');
                failed.setAttribute('role', 'alert');
                failed.hidden = true;
                row.append(failed);
                list.appendChild(row);
                drawn = { row, says, who, failed, held: one.says, keeping: Promise.resolve() };
                rows.set(one.id, drawn);
            }
            drawn.who.textContent = `${one.from} · ${momentSaid(new Date(one.at))}${one.edited ? ' · changed by you' : ''}`;
            // What the person wrote and the node does not hold yet is theirs: the node's words go only
            // into a field that still says what the node last put there.
            if (drawn.says.value === drawn.held) drawn.says.value = one.says;
            drawn.held = one.says;
        }
        for (const [id, drawn] of rows) {
            if (!seen.has(id)) { drawn.row.remove(); rows.delete(id); }
        }
    };

    /**
     * What the person wrote for one thing said, kept by the node when it differs from what the node holds.
     * One edit of a thing at a time, each after the one before: what was written last is what is kept last.
     */
    const keep = (id: string): Promise<void> => {
        const drawn = rows.get(id);
        if (!drawn) return Promise.resolve();
        const kept = drawn.keeping.catch(() => { /* the one before said its own */ }).then(async () => {
            const to = waits?.to;
            const wrote = drawn.says.value;
            if (!to || !rows.has(id) || wrote === drawn.held) return;
            try {
                const mine = ++asked;
                const all = await node.edit(to, id, wrote);
                drawn.failed.hidden = true;
                // The node holds what was written, and the field says so unless the person wrote on meanwhile.
                drawn.held = wrote;
                if (mine >= drawnAt) { drawnAt = mine; draw(all); }
            } catch (err) {
                // What they wrote stays in the field, said not to be kept, and is tried again when they leave it or send.
                drawn.failed.textContent = `Not kept by the node: ${wordsOf(err)}`;
                drawn.failed.hidden = false;
                fails('edit', err);
                throw err;
            }
        });
        drawn.keeping = kept;
        return kept;
    };
    /** Everything typed and not yet the node's, kept before anything is done with the batch. */
    const keepAll = async (): Promise<void> => { for (const id of Array.from(rows.keys())) await keep(id); };

    const now = pressFrom({
        id: `collected-now-${pills}`,
        title: 'Send now',
        again: 'it is sent',
        does: async () => {
            if (!waits) return;
            await keepAll();
            // What goes is what the person saw: what was collected since waits on.
            const to = waits.to;
            const saw = Array.from(rows.keys());
            await ask(() => node.release(to, saw));
            // Something still waits, so the batch did not go from the chat: the turn that started is followed all the same.
            if (had) sent();
        },
    });
    const later = pressFrom({
        id: `collected-later-${pills}`,
        title: 'Later',
        does: async () => { const to = waits?.to; if (to) await ask(() => node.later(to)); },
    });
    // What is chosen, or, nothing chosen, all of it: what the person saw, each by its id. What came in since waits on.
    const cancel = pressFrom({
        id: `collected-cancel-${pills}`,
        title: 'Cancel',
        again: 'never sent',
        irrevocable: true,
        does: async () => {
            const to = waits?.to;
            if (!to) return;
            // What is taken is what was chosen when it was pressed.
            const chosen = Array.from(rows).filter(([, drawn]) => drawn.who.getAttribute('aria-pressed') === 'true').map(([id]) => id);
            const taken = chosen.length ? chosen : Array.from(rows.keys());
            canceledHere = true;
            try {
                for (const id of taken) await ask(() => node.cancel(to, id));
            } finally {
                // Something still waits: when it goes, it was not this cancel.
                if (had) canceledHere = false;
            }
        },
    });

    // "DELAY QUICKLY (GET'S COLLECTED WITH THE NEXT BATCH), DELAY LONGER BY KEEPING IT PRESSED AND DRAGGING HOW MUCH(UP/DOWN)RELEASE-CONFIRM."
    // Kept pressed and dragged, it says how much longer; let go, it asks once; confirmed, the node holds it.
    const hold = part('div', 'collected-hold');
    hold.setAttribute('role', 'slider');
    hold.setAttribute('aria-label', 'Hold longer: keep pressed and drag up or down');
    hold.setAttribute('aria-valuemin', '0');
    hold.setAttribute('aria-valuemax', String(MOST_HOURS));
    hold.tabIndex = 0;
    hold.textContent = 'Hold ↕';
    hold.style.touchAction = 'none';
    hold.style.userSelect = 'none';
    hold.style.setProperty('-webkit-user-select', 'none');
    hold.style.cursor = 'ns-resize';
    // It stands among the presses as one of them: their box, their ground, their ink.
    hold.style.display = 'inline-flex';
    hold.style.alignItems = 'center';
    hold.style.justifyContent = 'center';
    hold.style.boxSizing = 'border-box';
    hold.style.width = '128px';
    hold.style.height = '44px';
    hold.style.background = AX.ground;
    hold.style.color = AX.ink;
    hold.style.borderRadius = now.element.style.borderRadius;
    sizeText(hold, 'md');
    const longer = part('div', 'collected-longer');
    longer.style.flexBasis = '100%';
    longer.hidden = true;
    let hours = 0;
    let from: { y: number; hours: number } | null = null;
    const until = (): Date => heldUntil(waits?.due ?? '', hours);
    const sayLonger = () => {
        hold.setAttribute('aria-valuenow', String(hours));
        longer.hidden = hours === 0;
        confirmHeld.hidden = hours === 0 || from !== null;
        if (hours > 0) longer.textContent = `${longerSaid(hours)} longer: sent ${momentSaid(until())}`;
    };
    const confirm = pressFrom({
        id: `collected-hold-confirm-${pills}`,
        title: 'Confirm',
        does: async () => {
            const to = waits?.to;
            if (!to || hours === 0) return;
            const at = until();
            await ask(() => node.hold(to, at));
            hours = 0;
            sayLonger();
        },
    });
    // A press is always drawn: what holds it is what is shown or not.
    const confirmHeld = part('span', 'collected-confirm');
    confirmHeld.appendChild(confirm.element);
    confirmHeld.hidden = true;
    hold.addEventListener('pointerdown', (e: PointerEvent) => {
        from = { y: e.clientY, hours };
        try { hold.setPointerCapture(e.pointerId); } catch { /* a press with no pointer to hold */ }
        e.preventDefault();
        sayLonger();
    });
    hold.addEventListener('pointermove', (e: PointerEvent) => {
        if (!from) return;
        hours = hoursAfter(from.hours, e.clientY - from.y);
        sayLonger();
    });
    const letGo = () => { if (!from) return; from = null; sayLonger(); };
    hold.addEventListener('pointerup', letGo);
    hold.addEventListener('pointercancel', letGo);
    // By keyboard: up and down are an hour.
    hold.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        hours = hoursAfter(hours, e.key === 'ArrowUp' ? -PX_PER_HOUR : PX_PER_HOUR);
        sayLonger();
    });

    actions.append(now.element, later.element, hold, cancel.element, longer, confirmHeld);

    return {
        element: pill.element,
        watch(whose: string): () => void {
            did = whose;
            stopped = false;
            const look = () => { ask(() => node.list()).catch((err: unknown) => fails('list', err)); };
            look();
            const looking = setInterval(look, every);
            return () => {
                stopped = true;
                clearInterval(looking);
                away(pill);
                if (drawnFor.get(did) === pill) drawnFor.delete(did);
                dueDrawn.delete(did);
            };
        },
    };
}
