// 「[Opus 5.5] What goes out, and what it says at rest: the parts of outbox-element.ts with no page in them.」

import { describe, test, expect } from 'bun:test';
import { outboxOf, outgoingSaid } from './outbox-element';
import type { Collected } from './collected-element';

const at = (h: number, min: number) => new Date(2026, 10, 13, h, min);
const now = at(13, 30);

const waitsFor = (to: string, did: string, due: Date, from: [string, string][]): Collected => ({
    to, did, model: 'claude-fable-5-2', waits: '6h0m0s', due: due.toISOString(), held_until: '', delivered: '',
    waiting: from.map(([name, fromDid], i) => ({ from: name, from_did: fromDid, says: `thing ${i}`, at: now.toISOString(), task: '', id: `${to}-${i}`, edited: false })),
});

describe('what goes out from a chat', () => {
    test('only what its agent said, by DID, per agent addressed, soonest first', () => {
        const all = [
            waitsFor('Alder', 'did:key:alder', at(21, 1), [['Lamplighter', 'did:key:lamp'], ['Hazel', 'did:key:hazel'], ['Lamplighter', 'did:key:lamp']]),
            waitsFor('Rowan', 'did:key:rowan', at(16, 0), [['Lamplighter', 'did:key:lamp']]),
            waitsFor('Lamplighter', 'did:key:lamp', at(15, 0), [['Alder', 'did:key:alder']]),
        ];
        const out = outboxOf(all, 'did:key:lamp');
        expect(out.map(o => o.to)).toEqual(['Rowan', 'Alder']);
        expect(out[1].mine.map(s => s.id)).toEqual(['Alder-0', 'Alder-2']);
        expect(out[1].others).toBe(1);
    });

    test('what was collected before it said who by DID is no one\'s outbox', () => {
        const old = waitsFor('Alder', 'did:key:alder', at(21, 1), [['Lamplighter', '']]);
        expect(outboxOf([old], 'did:key:lamp')).toEqual([]);
    });

    test('at rest it says to whom, how many, and when', () => {
        const [going] = outboxOf([waitsFor('Alder', 'did:key:alder', at(21, 1), [['Lamplighter', 'did:key:lamp']])], 'did:key:lamp');
        expect(outgoingSaid(going, now)).toBe('→ Alder · 1 · 21:01');
    });
});
