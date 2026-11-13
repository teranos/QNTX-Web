// What agents said to an agent, collected, drawn over the chat with that agent.
// stories/37-root-authors-what-agents-say-to-an-agent.feature is what it does.
// "i dont want a separate screen, a separate ui to have to go to"
// What is collected and when it goes is the node's (the collected signum); this draws it and says what a person does with it.

import { overlayFrom, pressFrom, declareScroller, preventDrag, sizeText, AX, type OverlayHandle } from '@teranos/elements';
import { apiJson } from './client';
import { log, SEG } from './logger.ts';

/** One thing an agent said to another, as the node holds it (protocol.CollectedSaid). */
export interface CollectedSaid {
    from: string;
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

/** What the batch says at rest: how many wait, and when they are sent. */
export function batchSaid(waits: Collected, now: Date = new Date()): string {
    const n = waits.waiting.length;
    return `${n} ${n === 1 ? 'waits' : 'wait'} · ${momentSaid(new Date(waits.due), now)}`;
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

// 「[Opus 5.5] What waits that is drawn now, by the agent it waits for, and what is to be opened as soon as it is drawn.」
const drawnFor = new Map<string, OverlayHandle>();
// 「[Fable 5.2] By the agent it waits for, the time what is to be opened is due: asked for one batch, another is not opened in its place.」
const wantedOpen = new Map<string, string>();
const dueDrawn = new Map<string, string>();

/**
 * 「[Fable 5.2] Opens what waits for the agent whose DID this is and is due at due: now when」
 * 「[Fable 5.2] it is drawn at rest, and when it is drawn otherwise. ROOT came in from a」
 * 「[Fable 5.2] notification about it (phone.ts), and what they came for is in front. Gone」
 * 「[Fable 5.2] before it was drawn, nothing is opened for it.」
 */
export function openWhenShown(did: string, due: string): void {
    const drawn = drawnFor.get(did);
    if (drawn && dueDrawn.get(did) === due) drawn.element.click();
    else wantedOpen.set(did, due);
}

/**
 * What waits for the agent whose DID this is, drawn over the chat it is talked
 * to in: nothing while nothing waits. above is what it first rests above, the
 * chat's field. sent is told when it was released, so the chat follows the
 * turn it starts. What it gives back stops asking.
 */
export function watchCollected(chat: HTMLElement, did: string, above: HTMLElement | null, sent: () => void, node: Collection = theCollection, every: number = LOOK_MS): () => void {
    let overlay: OverlayHandle | null = null;
    let waits: Collected | null = null;
    let stopped = false;
    // What each thing said is drawn as, by its id: its field, what the node held when the node last
    // wrote the field, and the edits of it being kept, one after another.
    interface Row { row: HTMLElement; says: HTMLTextAreaElement; who: HTMLElement; failed: HTMLElement; held: string; keeping: Promise<void> }
    const rows = new Map<string, Row>();
    // Each answer of the node's in the order it was asked for, and the latest drawn: one asked before it is not drawn over it.
    let asked = 0;
    let drawnAt = 0;
    // Whether a batch was drawn, and whether its going was the person's own cancel.
    let had = false;
    let canceledHere = false;

    const header = part('div', 'collected-header');
    header.style.display = 'flex';
    header.style.flexWrap = 'wrap';
    header.style.gap = '8px';
    header.style.alignItems = 'flex-start';
    header.style.paddingBottom = '8px';
    const when = part('div', 'collected-when');
    when.style.paddingBottom = '8px';
    const list = part('div', 'collected-said');
    list.style.flex = '1';
    list.style.minHeight = '0';
    list.style.overflowY = 'auto';
    const whole = part('div', 'collected');
    whole.style.display = 'flex';
    whole.style.flexDirection = 'column';
    whole.style.height = '100%';
    whole.append(header, when, list);
    // What is typed and pressed here is not a drag of the element.
    preventDrag(whole);

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
            overlay?.away();
            if (overlay && drawnFor.get(did) === overlay) drawnFor.delete(did);
            overlay = null;
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
        if (!overlay) {
            const over = chat.closest<HTMLElement>('[data-element-id]');
            // The chat is not in its element yet: asked again at the next look.
            if (!over) return;
            const held = over.getBoundingClientRect();
            const field = above?.getBoundingClientRect();
            const bottom = field && field.height > 0 ? Math.max(8, Math.round(held.bottom - field.top) + 8) : 8;
            overlay = overlayFrom({
                id: `collected:${did}`,
                title: batchSaid(mine),
                color: '#000',
                renderContent: () => whole,
            }, { over, className: 'collected-batch', at: { bottom } });
            drawnFor.set(did, overlay);
        }
        dueDrawn.set(did, mine.due);
        // 「[Fable 5.2] Asked for before it was drawn: opened once it rests, which is a press on it. What was asked」
        // 「[Fable 5.2] for was due at one time, and what is drawn now for another time is not what was asked for.」
        const wanted = wantedOpen.get(did);
        if (wanted !== undefined) {
            wantedOpen.delete(did);
            if (wanted === mine.due) {
                const mineNow = overlay;
                setTimeout(() => { if (drawnFor.get(did) === mineNow && mineNow.element.dataset.form === 'overlay') mineNow.element.click(); }, 0);
            }
        }
        overlay.says(batchSaid(mine));
        const held = mine.held_until ? `, held by you until ${momentSaid(new Date(mine.held_until))}` : '';
        when.textContent = `For ${mine.to}. Sent ${momentSaid(new Date(mine.due))}${held}.`;

        const seen = new Set<string>();
        for (const one of mine.waiting) {
            seen.add(one.id);
            let drawn = rows.get(one.id);
            if (!drawn) {
                const row = part('div', 'collected-one');
                row.dataset.said = one.id;
                row.style.paddingBottom = '12px';
                const who = part('div', 'collected-who');
                const says = part('textarea', 'collected-says');
                says.rows = 3;
                says.style.width = '100%';
                says.style.boxSizing = 'border-box';
                says.setAttribute('aria-label', `What ${one.from} said`);
                says.value = one.says;
                // What the person wrote is the node's once they leave the field.
                says.addEventListener('change', () => { keep(one.id).catch(() => { /* said beside the field */ }); });
                const failed = part('div', 'collected-failed');
                failed.setAttribute('role', 'alert');
                failed.hidden = true;
                const to = mine.to;
                const remove = pressFrom({
                    id: `collected-remove-${one.id}`,
                    title: 'Remove',
                    again: 'never sent',
                    irrevocable: true,
                    // Removed by the person: if it was the last, the batch went by their hand and no turn started.
                    does: async () => {
                        canceledHere = true;
                        try { await ask(() => node.cancel(to, one.id)); } finally { if (had) canceledHere = false; }
                    },
                });
                row.append(who, says, failed, remove.element);
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
        id: 'collected-now',
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
        id: 'collected-later',
        title: 'Later',
        does: async () => { const to = waits?.to; if (to) await ask(() => node.later(to)); },
    });
    const cancel = pressFrom({
        id: 'collected-cancel',
        title: 'Cancel',
        again: 'never sent',
        irrevocable: true,
        does: async () => {
            const to = waits?.to;
            if (!to) return;
            // What is canceled is what the person saw, each by its id: what came in since waits on.
            canceledHere = true;
            try {
                for (const id of Array.from(rows.keys())) await ask(() => node.cancel(to, id));
            } finally {
                // Something came in meanwhile and still waits: when it goes, it was not this cancel.
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
    const until = (): Date => new Date((waits ? new Date(waits.due).getTime() : Date.now()) + hours * 3_600_000);
    const sayLonger = () => {
        hold.setAttribute('aria-valuenow', String(hours));
        longer.hidden = hours === 0;
        confirmHeld.hidden = hours === 0 || from !== null;
        if (hours > 0) longer.textContent = `${longerSaid(hours)} longer: sent ${momentSaid(until())}`;
    };
    const confirm = pressFrom({
        id: 'collected-hold-confirm',
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

    header.append(now.element, later.element, hold, cancel.element, longer, confirmHeld);

    const look = () => { ask(() => node.list()).catch((err: unknown) => fails('list', err)); };
    look();
    const looking = setInterval(look, every);
    declareScroller(list);

    return () => {
        stopped = true;
        clearInterval(looking);
        overlay?.away();
        if (overlay && drawnFor.get(did) === overlay) drawnFor.delete(did);
        overlay = null;
        dueDrawn.delete(did);
    };
}
