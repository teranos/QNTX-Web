// ROOT's phone: what it opens on, who is a phone at all, and the token handed over.

import { describe, test, expect } from 'bun:test';
import { aboutToBeSaid, handOver, type PhoneToken } from './phone';
import type { Collected } from './collected-element';

const now = Date.parse('2026-11-13T14:00:00Z');
const waits = (did: string, dueIn: number, n = 1): Collected => ({
    to: did, did, model: '', waits: '6h0m0s', due: new Date(now + dueIn).toISOString(), held_until: '', delivered: '',
    waiting: Array.from({ length: n }, (_, i) => ({ from: 'Alder', says: `thing ${i}`, at: '', task: '', id: `s-${i}`, edited: false })),
});
const MIN = 60_000;

describe('what the phone opens on', () => {
    test('what is sent within fifteen minutes, soonest first', () => {
        const all = [waits('late', 3 * 60 * MIN), waits('second', 12 * MIN), waits('first', 4 * MIN)];
        expect(aboutToBeSaid(all, now).map(one => one.did)).toEqual(['first', 'second']);
    });

    test('nothing that is hours away, already past, or holds nothing', () => {
        expect(aboutToBeSaid([waits('later', 16 * MIN), waits('past', -MIN), waits('empty', 5 * MIN, 0)], now)).toEqual([]);
    });
});

describe('the token', () => {
    test('what the app answers is what the node is handed', async () => {
        const kept: PhoneToken[] = [];
        const done = await handOver(() => Promise.resolve({ token: 'aa11', platform: 'ios' }), held => { kept.push(held); return Promise.resolve(); });
        expect(done).toBe(true);
        expect(kept).toEqual([{ token: 'aa11', platform: 'ios' }]);
    });

    test('a phone that gives none hands the node nothing, and says why', async () => {
        const kept: PhoneToken[] = [];
        const refused = handOver(() => Promise.reject(new Error('notifications are turned off for QNTX in Settings')), held => { kept.push(held); return Promise.resolve(); });
        await expect(refused).rejects.toThrow('notifications are turned off');
        expect(kept).toEqual([]);
    });
});
