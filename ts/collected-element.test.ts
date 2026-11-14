// What the batch says, and how a drag is read: the parts of collected-element.ts with no page in them.

import { describe, test, expect } from 'bun:test';
import { batchSaid, momentSaid, sentSaid, heldUntil, hoursAfter, longerSaid, type Collected } from './collected-element';

const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min);
const now = at(2026, 11, 13, 13, 30);

const waits = (n: number, due: Date): Collected => ({
    to: 'Lamplighter', did: 'did:key:z6Mklamp', model: 'claude-fable-5-2', waits: '6h0m0s',
    due: due.toISOString(), held_until: '', delivered: '',
    waiting: Array.from({ length: n }, (_, i) => ({ from: 'Alder', says: `thing ${i}`, at: now.toISOString(), task: '', id: `s-${i}`, edited: false })),
});

describe('what the batch says at rest', () => {
    test('how many wait, and when they are sent, on a clock of 24 hours', () => {
        expect(batchSaid(waits(3, at(2026, 11, 13, 19, 5)), now)).toBe('3 wait · 19:05');
        expect(batchSaid(waits(1, at(2026, 11, 13, 14, 0)), now)).toBe('1 waits · 14:00');
    });

    test('what wakes nobody is due at no time, and says what it goes with', () => {
        expect(batchSaid({ ...waits(2, now), due: '' }, now)).toBe('2 wait · with what wakes next');
    });

    test('another day is said with its day', () => {
        expect(momentSaid(at(2026, 11, 14, 9, 0), now)).toBe('Sat 09:00');
        expect(momentSaid(at(2026, 11, 27, 9, 0), now)).toBe('27/11 09:00');
    });
});

describe('a drag on hold', () => {
    test('up is longer, down is less, and never under none', () => {
        expect(hoursAfter(0, -150)).toBe(15);
        expect(hoursAfter(15, 50)).toBe(10);
        expect(hoursAfter(2, 500)).toBe(0);
    });

    test('no drag holds it longer than two weeks', () => {
        expect(hoursAfter(0, -90000)).toBe(336);
    });

    test('how much longer is said in days and hours', () => {
        expect(longerSaid(15)).toBe('15h');
        expect(longerSaid(50)).toBe('2d 2h');
    });
});

describe('what is due at no time', () => {
    test('its Sent line says it goes with what wakes next', () => {
        expect(sentSaid('', now)).toBe('with what wakes next');
        expect(sentSaid(at(2026, 11, 13, 19, 5).toISOString(), now)).toBe('19:05');
    });

    test('held longer, it is held from now; with a time, from that time', () => {
        expect(heldUntil('', 3, now.getTime()).getTime()).toBe(now.getTime() + 3 * 3_600_000);
        const due = at(2026, 11, 13, 19, 0);
        expect(heldUntil(due.toISOString(), 2, now.getTime()).getTime()).toBe(due.getTime() + 2 * 3_600_000);
    });
});
