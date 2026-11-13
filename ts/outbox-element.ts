// What a chat's agent said to other agents and is collected for them, drawn over that chat: one batch per agent addressed.
// "similar to how we see what's waiting to wake up this chat with an overlaid element (inbox), I would like to have the same thing for known outbox message collection per addressed session"
// What is collected and when it goes is the node's (the collected signum); collected-element.ts draws what waits for this chat's agent, this what it said.

import { overlayFrom, pressFrom, declareScroller, preventDrag, type OverlayHandle } from '@teranos/elements';
import { theCollection, momentSaid, type Collection, type Collected, type CollectedSaid } from './collected-element';
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
    return out.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}

/** What a batch going out says at rest: to whom, how many, and when they are sent. */
export function outgoingSaid(going: Outgoing, now: Date = new Date()): string {
    return `→ ${going.to} · ${going.mine.length} · ${momentSaid(new Date(going.due), now)}`;
}

function part<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    el.className = className;
    return el;
}

const wordsOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

// How often what goes out is asked again, and how far above the chat's field each batch rests over the one below it, in px.
const LOOK_MS = 5000;
const STACK_PX = 56;

/**
 * What the agent whose DID this is said and is collected for others, drawn over
 * the chat it is talked to in: one batch per agent addressed, resting above the
 * inbox (collected-element.ts). What it gives back stops asking.
 */
export function watchOutbox(chat: HTMLElement, did: string, above: HTMLElement | null, node: Collection = theCollection, every: number = LOOK_MS): () => void {
    let stopped = false;
    let asked = 0;
    let drawnAt = 0;
    interface Batch { overlay: OverlayHandle; when: HTMLElement; list: HTMLElement; rows: Map<string, { row: HTMLElement; says: HTMLTextAreaElement; who: HTMLElement; held: string }>; going: Outgoing }
    const batches = new Map<string, Batch>();
    const fails = (what: string, err: unknown) => log.error(SEG.ELEMENT, `[Outbox] ${what}: ${wordsOf(err)}`);

    const ask = async (answer: () => Promise<Collected[]>): Promise<void> => {
        const mine = ++asked;
        const all = await answer();
        if (mine < drawnAt) return;
        drawnAt = mine;
        draw(all);
    };

    /** One batch going out, drawn the first time it is seen. */
    const open = (going: Outgoing, place: number): Batch | null => {
        const over = chat.closest<HTMLElement>('[data-element-id]');
        if (!over) return null;
        const held = over.getBoundingClientRect();
        const field = above?.getBoundingClientRect();
        const base = field && field.height > 0 ? Math.max(8, Math.round(held.bottom - field.top) + 8) : 8;
        const when = part('div', 'outbox-when');
        when.style.paddingBottom = '8px';
        const list = part('div', 'outbox-said');
        list.style.flex = '1';
        list.style.minHeight = '0';
        list.style.overflowY = 'auto';
        const header = part('div', 'outbox-header');
        header.style.display = 'flex';
        header.style.flexWrap = 'wrap';
        header.style.gap = '8px';
        header.style.paddingBottom = '8px';
        const whole = part('div', 'outbox');
        whole.style.display = 'flex';
        whole.style.flexDirection = 'column';
        whole.style.height = '100%';
        whole.append(header, when, list);
        preventDrag(whole);
        declareScroller(list);
        const to = going.to;
        const batch: Batch = {
            overlay: overlayFrom({ id: `outbox:${did}:${going.did}`, title: outgoingSaid(going), color: '#000', renderContent: () => whole },
                { over, className: 'outbox-batch', at: { bottom: base + STACK_PX * (place + 1) } }),
            when, list, rows: new Map(), going,
        };
        // What goes is what the person saw: the batch's own, what others said in it included, as the inbox sends it.
        const now = pressFrom({ id: `outbox-now-${going.did}`, title: 'Send now', again: 'it is sent', does: () => ask(() => node.release(to, [])) });
        const later = pressFrom({ id: `outbox-later-${going.did}`, title: 'Later', does: () => ask(() => node.later(to)) });
        // What is canceled is what this chat's agent said, each by its id: what others said waits on.
        const cancel = pressFrom({
            id: `outbox-cancel-${going.did}`, title: 'Cancel', again: 'never sent', irrevocable: true,
            does: async () => { for (const id of Array.from(batch.rows.keys())) await ask(() => node.cancel(to, id)); },
        });
        header.append(now.element, later.element, cancel.element);
        return batch;
    };

    const draw = (all: Collected[]) => {
        if (stopped) return;
        const going = outboxOf(all, did);
        const seen = new Set<string>();
        going.forEach((one, place) => {
            seen.add(one.did);
            let batch = batches.get(one.did) ?? null;
            if (!batch) {
                batch = open(one, place);
                if (!batch) return;
                batches.set(one.did, batch);
            }
            batch.going = one;
            batch.overlay.says(outgoingSaid(one));
            const others = one.others > 0 ? ` With ${one.others} from others.` : '';
            const held = one.held_until ? `, held until ${momentSaid(new Date(one.held_until))}` : '';
            batch.when.textContent = `To ${one.to}. Sent ${momentSaid(new Date(one.due))}${held}.${others}`;
            const ids = new Set<string>();
            for (const said of one.mine) {
                ids.add(said.id);
                let drawn = batch.rows.get(said.id);
                if (!drawn) {
                    const row = part('div', 'outbox-one');
                    row.style.paddingBottom = '12px';
                    const who = part('div', 'outbox-at');
                    const says = part('textarea', 'outbox-says');
                    says.rows = 3;
                    says.style.width = '100%';
                    says.style.boxSizing = 'border-box';
                    says.setAttribute('aria-label', `What was said to ${one.to}`);
                    says.value = said.says;
                    const to = one.to;
                    const id = said.id;
                    // What the person wrote is the node's once they leave the field.
                    says.addEventListener('change', () => {
                        const wrote = says.value;
                        ask(() => node.edit(to, id, wrote)).then(() => { const kept = batch?.rows.get(id); if (kept) kept.held = wrote; })
                            .catch((err: unknown) => fails('edit', err));
                    });
                    row.append(who, says);
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
        for (const [to, batch] of batches) {
            if (!seen.has(to)) { batch.overlay.away(); batches.delete(to); }
        }
    };

    const look = () => { ask(() => node.list()).catch((err: unknown) => fails('list', err)); };
    look();
    const looking = setInterval(look, every);

    return () => {
        stopped = true;
        clearInterval(looking);
        for (const batch of batches.values()) batch.overlay.away();
        batches.clear();
    };
}
