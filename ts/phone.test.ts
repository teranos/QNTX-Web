// 「[Fable 5.2] What the app opens on while ROOT is in it: what is about to be said to the Node Agent.」

import { describe, test, expect } from 'bun:test';
import { aboutToBeSaid, rootsPhone, type Phone, type SignedIn } from './phone';
import type { Collected } from './collected-element';

const MIN = 60_000;
const NODE = 'did:key:z6Mknode';

const waits = (did: string, dueIn: number, n = 1): Collected => ({
    to: did, did, model: '', waits: '6h0m0s', due: new Date(Date.now() + dueIn).toISOString(), held_until: '', delivered: '',
    waiting: Array.from({ length: n }, (_, i) => ({ from: 'Alder', says: `thing ${i}`, at: '', task: '', id: `s-${i}`, edited: false })),
});

// Everything already settled has happened.
async function settled(): Promise<void> {
    for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

/** A phone standing in for the node and the page, keeping what was done with it. */
function aPhone(over: Partial<Phone> = {}) {
    const opened: string[] = [];
    const state = { who: { identity: 'root', level: 'ROOT' } as SignedIn, waiting: [] as Collected[], visible: true };
    const phone: Phone = {
        who: () => Promise.resolve(state.who),
        waits: () => Promise.resolve(state.waiting),
        nodeAgent: () => Promise.resolve(NODE),
        open: (did, due) => { opened.push(`${did} ${due}`); },
        visible: () => state.visible,
        ...over,
    };
    return { phone, opened, state };
}

const front = () => document.dispatchEvent(new Event('visibilitychange'));

describe('what the phone opens on', () => {
    test('what is sent within fifteen minutes, soonest first', () => {
        const all = [waits('late', 3 * 60 * MIN), waits('second', 12 * MIN), waits('first', 4 * MIN)];
        expect(aboutToBeSaid(all).map(one => one.did)).toEqual(['first', 'second']);
    });

    test('nothing that is hours away, already past, or holds nothing', () => {
        expect(aboutToBeSaid([waits('later', 16 * MIN), waits('past', -MIN), waits('empty', 5 * MIN, 0)])).toEqual([]);
    });

    test('what waits for the Node Agent, and not what waits for another agent that is due sooner', async () => {
        const { phone, opened, state } = aPhone();
        const mine = waits(NODE, 10 * MIN);
        state.waiting = [waits('did:key:z6Mkalder', 2 * MIN), mine];
        const stop = rootsPhone(phone, 1_000_000);
        await settled();
        expect(opened).toEqual([`${NODE} ${mine.due}`]);
        stop();
    });

    test('each time it is due once, and a later batch when it comes', async () => {
        const { phone, opened, state } = aPhone();
        const first = waits(NODE, 10 * MIN);
        state.waiting = [first];
        const stop = rootsPhone(phone, 1_000_000);
        await settled();
        front();
        await settled();
        expect(opened).toEqual([`${NODE} ${first.due}`]);
        // Held on by the person: another time, and it is opened on again before that one.
        const held = { ...first, due: new Date(Date.now() + 14 * MIN).toISOString() };
        state.waiting = [held];
        front();
        await settled();
        expect(opened).toEqual([`${NODE} ${first.due}`, `${NODE} ${held.due}`]);
        stop();
    });

    test('a batch that comes within the fifteen minutes while the app stays in front', async () => {
        const { phone, opened, state } = aPhone();
        const stop = rootsPhone(phone, 5);
        await settled();
        expect(opened).toEqual([]);
        const mine = waits(NODE, 10 * MIN);
        state.waiting = [mine];
        await new Promise(resolve => setTimeout(resolve, 30));
        await settled();
        expect(opened).toEqual([`${NODE} ${mine.due}`]);
        stop();
    });

    test('nothing while the app is behind, nor when it went behind while the node answered', async () => {
        const answers: Array<() => void> = [];
        const { phone, opened, state } = aPhone();
        const mine = waits(NODE, 10 * MIN);
        const slow = aPhone({ waits: () => new Promise<Collected[]>(resolve => { answers.push(() => resolve([mine])); }) });
        state.visible = false;
        state.waiting = [mine];
        const stop = rootsPhone(phone, 1_000_000);
        await settled();
        expect(opened).toEqual([]);
        stop();

        const stopSlow = rootsPhone(slow.phone, 1_000_000);
        await settled();
        slow.state.visible = false;
        for (const answer of answers) answer();
        await settled();
        expect(slow.opened).toEqual([]);
        stopSlow();
    });
});

describe('who it opens for', () => {
    test('ROOT, and nobody else', async () => {
        const user = aPhone();
        user.state.who = { identity: 'spike', level: 'USER' };
        user.state.waiting = [waits(NODE, 10 * MIN)];
        const stop = rootsPhone(user.phone, 1_000_000);
        await settled();
        expect(user.opened).toEqual([]);
        stop();
    });

    test('one who signs in later, on the same page', async () => {
        const { phone, opened, state } = aPhone();
        const mine = waits(NODE, 10 * MIN);
        state.who = {};
        state.waiting = [mine];
        const stop = rootsPhone(phone, 1_000_000);
        await settled();
        expect(opened).toEqual([]);
        state.who = { identity: 'root', level: 'ROOT' };
        front();
        await settled();
        expect(opened).toEqual([`${NODE} ${mine.due}`]);
        stop();
    });
});
