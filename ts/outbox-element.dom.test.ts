/**
 * @jest-environment jsdom
 *
 * What a chat's agent said to other agents that waits, one pill in its field (outbox-element.ts).
 *
 * "About it taking over everything for no good reason?" "THE OLD PATTERN IS BAD" "I want you to use the pills for it
 * instead": @teranos/elements' outbox (examples/outbox.ts) is the pattern. At rest it says how many wait and when they
 * go; pressed, it is across its row, the field where it was, what is done with them said once, on one line. A row
 * pressed is chosen; Cancel takes what is chosen, or, nothing chosen, all of it.
 *
 * Personas: Tim (happy path), Spike (edge cases), Jenny (complex scenarios).
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { renderContent, declareSay, type Element } from '@teranos/elements';
import { momentSaid, type Collected, type Collection } from './collected-element';
import { outboxFrom } from './outbox-element';

const USE_JSDOM = process.env.USE_JSDOM === '1';

const DID = 'did:key:node-agent';
// What was said an hour ago, due in five: how they read is momentSaid's.
const DUE = new Date(Date.now() + 5 * 3_600_000).toISOString();
const AT = new Date(Date.now() - 3_600_000).toISOString();
const SOON = new Date(Date.now() + 2 * 3_600_000).toISOString();
const LATER = new Date(Date.now() + 4 * 3_600_000).toISOString();


const said = (from: string, says: string, id: string, from_did = 'did:key:other') => ({ from, from_did, says, at: AT, task: '', id, edited: false });

/** The node's collection, held here: what is done with it is kept to be asked after. */
function collection(start: Collected[]): Collection & { canceled: string[]; released: string[][]; all: Collected[] } {
    const held = {
        all: start,
        canceled: [] as string[],
        released: [] as string[][],
        list: () => Promise.resolve(held.all),
        edit: () => Promise.resolve(held.all),
        later: () => Promise.resolve(held.all),
        hold: () => Promise.resolve(held.all),
        release: (_to: string, ids: string[]) => { held.released.push(ids); held.all = []; return Promise.resolve(held.all); },
        cancel: (to: string, id?: string) => {
            held.canceled.push(id ?? '');
            held.all = held.all.map(one => (one.to === to ? { ...one, waiting: one.waiting.filter(w => w.id !== id) } : one)).filter(one => one.waiting.length);
            return Promise.resolve(held.all);
        },
    };
    return held;
}

const waiting = (): Collected[] => [{
    to: 'Lamplighter', did: DID, model: 'claude-fable-5-2', waits: '6h', due: DUE, held_until: '', delivered: '',
    waiting: [said('Alder', 'pull request one is open', 's1'), said('Hazel', 'the pond is drained', 's2'), said('Alder', 'pull request two is open', 's3')],
}];

let elements = 0;
// What a test put on the page leaves it with the test: the package keeps watching what is on the page.
const placed: HTMLElement[] = [];
afterEach(() => { for (const element of placed.splice(0)) element.remove(); });
/** A chat's field in an element, as a panel holds it, with what waits in its pills. */
function field(pills: HTMLElement[]): HTMLTextAreaElement {
    const element = document.createElement('div');
    placed.push(element);
    const body = document.createElement('div');
    const says = document.createElement('textarea');
    body.appendChild(says);
    document.body.appendChild(element);
    renderContent(element, { id: `chat-${++elements}`, title: 'Node Agent', renderContent: () => body } as unknown as Element, 'test');
    declareSay(says, { end: document.createElement('button'), waiting: pills });
    return says;
}

async function settled(): Promise<void> {
    for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

const local = (iso: string) => momentSaid(new Date(iso));
const press = (root: HTMLElement, title: string) => Array.from(root.querySelectorAll<HTMLElement>('[data-press]')).find(p => p.textContent?.includes(title))!;
/** A press of two stages: pressed, it is armed; pressed again, it does what it says. */
const twice = (root: HTMLElement, title: string) => { const it = press(root, title); it.click(); it.click(); };

describe('What the agent said that waits - the outbox', () => {
    if (!USE_JSDOM) { test.skip('Skipped locally (run with USE_JSDOM=1 to enable)', () => {}); return; }

    const MINE = 'did:key:mine';
    const two = (): Collected[] => [
        { to: 'Hazel', did: 'did:key:hazel', model: '', waits: '', due: LATER, held_until: '', delivered: '', waiting: [said('me', 'later one', 'h1', MINE)] },
        { to: 'Alder', did: 'did:key:alder', model: '', waits: '', due: SOON, held_until: '', delivered: '', waiting: [said('me', 'first one', 'a1', MINE), said('me', 'second one', 'a2', MINE), said('Hazel', 'not mine', 'a3')] },
    ];

    test('Tim: one pill for all it said, saying the soonest and how many more agents wait on it', async () => {
        const outbox = outboxFrom(collection(two()), 60_000);
        field([outbox.element]);
        const stop = outbox.watch(MINE);
        await settled();
        expect(outbox.element.hidden).toBe(false);
        expect(outbox.element.textContent).toBe(`→ Alder · 2 · ${local(SOON)} +1`);
        stop();
    });

    test('Tim: pressed, each agent addressed has its batch, soonest first, what is done with it on one line', async () => {
        const outbox = outboxFrom(collection(two()), 60_000);
        field([outbox.element]);
        const stop = outbox.watch(MINE);
        await settled();
        outbox.element.click();
        await settled();
        const batches = Array.from(outbox.element.querySelectorAll<HTMLElement>('.outbox-batch'));
        expect(batches.map(b => b.querySelector('.outbox-when')!.textContent!.split('.')[0])).toEqual(['To Alder', 'To Hazel']);
        expect(batches[0]!.querySelector('.outbox-when')!.textContent).toContain('With 1 from others.');
        expect(Array.from(batches[0]!.querySelectorAll<HTMLTextAreaElement>('.outbox-says')).map(t => t.value)).toEqual(['first one', 'second one']);
        expect(Array.from(batches[0]!.querySelector('.outbox-actions')!.children).map(c => c.textContent?.trim())).toEqual(['Send now', 'Later', 'Cancel']);
        stop();
    });

    test('Spike: Cancel takes what is chosen of what it said, and what others said waits on', async () => {
        const node = collection(two());
        const outbox = outboxFrom(node, 60_000);
        field([outbox.element]);
        const stop = outbox.watch(MINE);
        await settled();
        outbox.element.click();
        await settled();
        const alder = outbox.element.querySelector<HTMLElement>('.outbox-batch')!;
        alder.querySelectorAll<HTMLButtonElement>('.outbox-who')[1]!.click();
        twice(alder, 'Cancel');
        await settled();
        expect(node.canceled).toEqual(['a2']);
        stop();
    });

    test('Spike: it said nothing that waits: no pill is seen', async () => {
        const outbox = outboxFrom(collection(waiting()), 60_000);
        field([outbox.element]);
        const stop = outbox.watch(MINE);
        await settled();
        expect(outbox.element.hidden).toBe(true);
        stop();
    });
});
