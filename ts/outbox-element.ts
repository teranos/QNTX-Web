// What a chat's agent said to other agents and is collected for them, a pill in that chat's field: one batch per agent addressed.
// "similar to how we see what's waiting to wake up this chat with an overlaid element (inbox), I would like to have the same thing for known outbox message collection per addressed session"
// "THE OLD PATTERN IS BAD" "I want you to use the pills for it instead": @teranos/elements' outbox (examples/outbox.ts) is the pattern.
// What is collected and when it goes is the node's (the collected signum); collected-element.ts draws what waits for this chat's agent, this what it said.

import { pressFrom, preventDrag } from '@teranos/elements';
import { theCollection, momentSaid, sentSaid, pin, waitingPill, waitingRow, actionsLine, waitingList, away, type Collection, type Collected, type CollectedSaid } from './collected-element';
import { log, SEG } from './logger.ts';

/** What one agent addressed waits on that this chat's agent said, and what others said with it. */
export interface Outgoing {
    to: string;
    did: string;
    due: string;
    held_until: string;
    mine: CollectedSaid[];
    others: number;
}

/** What the agent whose DID this is said that waits, by the agent it waits for, soonest first. */
export function outboxOf(all: Collected[], did: string): Outgoing[] {
    const out: Outgoing[] = [];
    for (const waits of all) {
        const mine = waits.waiting.filter(said => said.from_did === did);
        if (mine.length === 0) continue;
        out.push({ to: waits.to, did: waits.did, due: waits.due, held_until: waits.held_until, mine, others: waits.waiting.length - mine.length });
    }
    // 「[Fable 5.2, Opus 5.5] What goes with what wakes next has no time: it stands after everything that has one.」
    const at = (due: string) => (due ? new Date(due).getTime() : Number.POSITIVE_INFINITY);
    return out.sort((a, b) => at(a.due) - at(b.due));
}

/** What a batch going out says at rest: to whom, how many, and when they are sent. */
export function outgoingSaid(going: Outgoing, now: Date = new Date()): string {
    return `→ ${going.to} · ${going.mine.length} · ${sentSaid(going.due, now)}`;
}

/**
 * What the outbox says at rest: the batch that goes soonest, and, more agents addressed, how many more.
 * "Many chosen: two said, more the first and how many more" (@teranos/elements content/choices.ts).
 */
export function outboxSaid(going: Outgoing[], now: Date = new Date()): string {
    if (going.length === 0) return '';
    const first = outgoingSaid(going[0]!, now);
    return going.length > 1 ? `${first} +${going.length - 1}` : first;
}

function part<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    el.className = className;
    return el;
}

const wordsOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Moves what holds node, the focus and the caret staying where they were in it: moved, a field loses the focus. */
function moveKeeping(node: HTMLElement, move: () => void): void {
    const active = node.ownerDocument.activeElement as HTMLTextAreaElement | null;
    const inside = active !== null && node.contains(active);
    const caret = inside && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd, active.selectionDirection] as const : null;
    move();
    if (!inside || node.ownerDocument.activeElement === active) return;
    active.focus({ preventScroll: true });
    if (caret) active.setSelectionRange(caret[0], caret[1], caret[2] ?? undefined);
}

// How often what goes out is asked again.
const LOOK_MS = 5000;

// Each chat's outbox, numbered: an element, with an id of its own for its whole life.
let outboxes = 0;

/** What a chat's agent said that waits, as a pill in its field: what watch gives back stops asking. */
export interface OutboxPill {
    element: HTMLElement;
    watch(did: string): () => void;
}

/**
 * What the agent whose DID it is told said and is collected for others: one pill in the chat's field, out of
 * sight while nothing waits. Pressed, each agent addressed has its batch: when it goes, what is done with it,
 * and what was said.
 */
export function outboxFrom(node: Collection = theCollection, every: number = LOOK_MS): OutboxPill {
    let did = '';
    let stopped = true;
    let asked = 0;
    let drawnAt = 0;
    interface Batch { section: HTMLElement; when: HTMLElement; list: HTMLElement; rows: Map<string, { row: HTMLElement; says: HTMLTextAreaElement; who: HTMLButtonElement; held: string }>; going: Outgoing }
    const batches = new Map<string, Batch>();
    const fails = (what: string, err: unknown) => log.error(SEG.ELEMENT, `[Outbox] ${what}: ${wordsOf(err)}`);
    const n = ++outboxes;

    const whole = part('div', 'outbox');
    pin(whole, { display: 'flex', 'flex-direction': 'column', gap: '16px', width: '100%' });
    preventDrag(whole);
    const shown = waitingPill(`outbox-${n}`, '', whole);
    shown.pill.element.title = 'What this agent said that waits to be said';
    shown.pill.element.dataset.outbox = '';

    const ask = async (answer: () => Promise<Collected[]>): Promise<void> => {
        const mine = ++asked;
        const all = await answer();
        if (mine < drawnAt) return;
        drawnAt = mine;
        draw(all);
    };

    /** One batch going out, drawn the first time it is seen. */
    const open = (going: Outgoing): Batch => {
        const when = part('div', 'outbox-when');
        const actions = actionsLine('outbox');
        const list = waitingList('outbox', `What waits for ${going.to}`);
        const section = part('div', 'outbox-batch');
        pin(section, { display: 'flex', 'flex-direction': 'column', gap: '8px' });
        section.append(when, actions, list);
        const batch: Batch = { section, when, list, rows: new Map(), going };
        const to = going.to;
        // What goes is what the person saw: the batch's own, what others said in it included, as the inbox sends it.
        const now = pressFrom({ id: `outbox-now-${n}-${going.did}`, title: 'Send now', again: 'it is sent', does: () => ask(() => node.release(to, [])) });
        const later = pressFrom({ id: `outbox-later-${n}-${going.did}`, title: 'Later', does: () => ask(() => node.later(to)) });
        // What is chosen, or, nothing chosen, all this chat's agent said, each by its id: what others said waits on.
        const cancel = pressFrom({
            id: `outbox-cancel-${n}-${going.did}`, title: 'Cancel', again: 'never sent', irrevocable: true,
            does: async () => {
                const chosen = Array.from(batch.rows).filter(([, drawn]) => drawn.who.getAttribute('aria-pressed') === 'true').map(([id]) => id);
                for (const id of chosen.length ? chosen : Array.from(batch.rows.keys())) await ask(() => node.cancel(to, id));
            },
        });
        actions.append(now.element, later.element, cancel.element);
        return batch;
    };

    const draw = (all: Collected[]) => {
        if (stopped) return;
        const going = outboxOf(all, did);
        // What went is taken away first: put in order after, what stays is moved only past what stays.
        const seen = new Set(going.map(one => one.did));
        for (const [to, batch] of batches) {
            if (!seen.has(to)) { batch.section.remove(); batches.delete(to); }
        }
        going.forEach((one, place) => {
            let batch = batches.get(one.did);
            if (!batch) {
                batch = open(one);
                batches.set(one.did, batch);
            }
            // Soonest first, as at rest. Moved only when it stands elsewhere: a move takes the focus from what is being written.
            const there = whole.children[place] ?? null;
            if (there !== batch.section) moveKeeping(batch.section, () => whole.insertBefore(batch.section, there));
            batch.going = one;
            const others = one.others > 0 ? ` With ${one.others} from others.` : '';
            const held = one.held_until ? `, held until ${momentSaid(new Date(one.held_until))}` : '';
            batch.when.textContent = `To ${one.to}. Sent ${sentSaid(one.due)}${held}.${others}`;
            const ids = new Set<string>();
            for (const said of one.mine) {
                ids.add(said.id);
                let drawn = batch.rows.get(said.id);
                if (!drawn) {
                    const { row, who, says } = waitingRow('outbox', `What was said to ${one.to}`);
                    says.value = said.says;
                    const to = one.to;
                    const id = said.id;
                    const kept = batch;
                    // What the person wrote is the node's once they leave the field.
                    says.addEventListener('change', () => {
                        const wrote = says.value;
                        ask(() => node.edit(to, id, wrote)).then(() => { const now = kept.rows.get(id); if (now) now.held = wrote; })
                            .catch((err: unknown) => fails('edit', err));
                    });
                    batch.list.appendChild(row);
                    drawn = { row, says, who, held: said.says };
                    batch.rows.set(said.id, drawn);
                }
                drawn.who.textContent = `${momentSaid(new Date(said.at))}${said.edited ? ' · changed by you' : ''}`;
                // The node's words go only into a field that still says what the node last put there.
                if (drawn.says.value === drawn.held) drawn.says.value = said.says;
                drawn.held = said.says;
            }
            for (const [id, drawn] of batch.rows) {
                if (!ids.has(id)) { drawn.row.remove(); batch.rows.delete(id); }
            }
        });
        if (going.length) shown.pill.retitle(outboxSaid(going));
        shown.said(going.length > 0);
    };

    return {
        element: shown.pill.element,
        watch(whose: string): () => void {
            did = whose;
            stopped = false;
            const look = () => { ask(() => node.list()).catch((err: unknown) => fails('list', err)); };
            look();
            const looking = setInterval(look, every);
            return () => {
                stopped = true;
                clearInterval(looking);
                away(shown.pill);
                for (const batch of batches.values()) batch.section.remove();
                batches.clear();
            };
        },
    };
}
