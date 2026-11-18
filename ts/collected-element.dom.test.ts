/**
 * @jest-environment jsdom
 *
 * What waits for a chat's agent, as a pill in its field: what agents said to it (collected-element.ts).
 *
 * "About it taking over everything for no good reason?" "THE OLD PATTERN IS BAD" "I want you to use the pills for it
 * instead": @teranos/elements' outbox (examples/outbox.ts) is the pattern. At rest it says how many wait and when they
 * go; pressed, it is across its row, the field where it was, what is done with them said once, on one line. A row
 * pressed is chosen; Cancel takes what is chosen, or, nothing chosen, all of it.
 *
 * Personas: Tim (happy path), Spike (edge cases), Jenny (complex scenarios).
 */

import { describe, test, expect } from 'bun:test';
import { renderContent, declareSay, type Element } from '@teranos/elements';
import { collectedFrom, openWhenShown, momentSaid, type Collected, type Collection } from './collected-element';

const USE_JSDOM = process.env.USE_JSDOM === '1';

const DID = 'did:key:node-agent';
// What was said an hour ago, due in five: how they read is momentSaid's.
const DUE = new Date(Date.now() + 5 * 3_600_000).toISOString();
const AT = new Date(Date.now() - 3_600_000).toISOString();
const SOON = new Date(Date.now() + 2 * 3_600_000).toISOString();
const LATER = new Date(Date.now() + 4 * 3_600_000).toISOString();

// What a browser measures and jsdom does not: the width of a button's words (@teranos/elements fit.ts).
const range = Object.getPrototypeOf(document.createRange()) as Range;
if (typeof range.getBoundingClientRect !== 'function') {
    range.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) }) as DOMRect;
}

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
/** A chat's field in an element, as a panel holds it, with what waits in its pills. */
function field(pills: HTMLElement[]): HTMLTextAreaElement {
    const element = document.createElement('div');
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

describe('What waits for the agent - Tim', () => {
    if (!USE_JSDOM) { test.skip('Skipped locally (run with USE_JSDOM=1 to enable)', () => {}); return; }

    test('nothing waits: no pill is seen', async () => {
        const inbox = collectedFrom(() => {}, collection([]), 60_000);
        field([inbox.element]);
        const stop = inbox.watch(DID);
        await settled();
        expect(inbox.element.hidden).toBe(true);
        stop();
    });

    // "IF THERE ARE MESSAGES PENDING TO BE SENT, AS A COLLECTED BATCH, I SEE IT"
    test('what waits is a pill above the input field, saying how many wait and when they go', async () => {
        const inbox = collectedFrom(() => {}, collection(waiting()), 60_000);
        field([inbox.element]);
        const stop = inbox.watch(DID);
        await settled();
        expect(inbox.element.hidden).toBe(false);
        expect(inbox.element.dataset.form).toBe('pill');
        expect(inbox.element.parentElement!.dataset.sayPills).toBe('');
        expect(inbox.element.textContent).toBe(`3 wait · ${local(DUE)}`);
        stop();
    });

    test('pressed, it is across its row: when it goes, what is done with it on one line, who said what', async () => {
        const inbox = collectedFrom(() => {}, collection(waiting()), 60_000);
        const says = field([inbox.element]);
        const stop = inbox.watch(DID);
        await settled();
        inbox.element.click();
        await settled();
        expect(inbox.element.dataset.form).toBe('pillOpen');
        // The field where it was.
        expect(says.isConnected).toBe(true);
        const line = inbox.element.querySelector<HTMLElement>('.collected-actions')!;
        expect(Array.from(line.children).map(c => c.textContent?.trim()).filter(Boolean).slice(0, 4)).toEqual(['Send now', 'Later', 'Hold ↕', 'Cancel']);
        expect(inbox.element.querySelector('.collected-when')!.textContent).toContain('For Lamplighter.');
        const rows = Array.from(inbox.element.querySelectorAll<HTMLElement>('.collected-one'));
        expect(rows.map(r => r.querySelector('.collected-who')!.textContent)).toEqual([`Alder · ${local(AT)}`, `Hazel · ${local(AT)}`, `Alder · ${local(AT)}`]);
        expect(rows.map(r => r.querySelector<HTMLTextAreaElement>('.collected-says')!.value)).toEqual(['pull request one is open', 'the pond is drained', 'pull request two is open']);
        // Nothing removes one thing by itself: what is done is said once.
        expect(inbox.element.querySelectorAll('.collected-one [data-press]')).toHaveLength(0);
        stop();
    });
});

describe('What waits for the agent - Spike', () => {
    if (!USE_JSDOM) { test.skip('Skipped locally (run with USE_JSDOM=1 to enable)', () => {}); return; }

    test('a row pressed is chosen, and Cancel takes only what is chosen', async () => {
        const node = collection(waiting());
        const inbox = collectedFrom(() => {}, node, 60_000);
        field([inbox.element]);
        const stop = inbox.watch(DID);
        await settled();
        inbox.element.click();
        await settled();
        const hazel = inbox.element.querySelectorAll<HTMLButtonElement>('.collected-who')[1]!;
        hazel.click();
        expect(hazel.getAttribute('aria-pressed')).toBe('true');
        twice(inbox.element, 'Cancel');
        await settled();
        expect(node.canceled).toEqual(['s2']);
        expect(inbox.element.querySelectorAll('.collected-one')).toHaveLength(2);
        expect(inbox.element.hidden).toBe(false);
        stop();
    });

    test('nothing chosen, Cancel takes all of it, and with nothing left the pill is gone', async () => {
        const node = collection(waiting());
        const inbox = collectedFrom(() => {}, node, 60_000);
        field([inbox.element]);
        const stop = inbox.watch(DID);
        await settled();
        inbox.element.click();
        await settled();
        twice(inbox.element, 'Cancel');
        await settled();
        expect(node.canceled).toEqual(['s1', 's2', 's3']);
        await new Promise(resolve => setTimeout(resolve, 600));
        await settled();
        expect(inbox.element.hidden).toBe(true);
        stop();
    });
});

describe('What waits for the agent - Jenny', () => {
    if (!USE_JSDOM) { test.skip('Skipped locally (run with USE_JSDOM=1 to enable)', () => {}); return; }

    // ROOT came in from a notification about it (phone.ts): what they came for is in front.
    test('asked for from a notification, it opens once it is shown', async () => {
        const inbox = collectedFrom(() => {}, collection(waiting()), 60_000);
        field([inbox.element]);
        openWhenShown(DID, DUE);
        const stop = inbox.watch(DID);
        await settled();
        expect(inbox.element.dataset.form).toBe('pillOpen');
        stop();
    });

    test('sent from the pill, the chat follows the turn it starts', async () => {
        let followed = 0;
        const node = collection(waiting());
        const inbox = collectedFrom(() => { followed++; }, node, 60_000);
        field([inbox.element]);
        const stop = inbox.watch(DID);
        await settled();
        inbox.element.click();
        await settled();
        twice(inbox.element, 'Send now');
        await settled();
        expect(node.released).toEqual([['s1', 's2', 's3']]);
        expect(followed).toBe(1);
        stop();
    });
});
