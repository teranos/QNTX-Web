// Contrast is enforced like the ellipsis ban: the suite fails.
//   1. every declared text/surface pairing in contrast-pairs.json,
//   2. every rule that sets both a colour and an opaque background.
// What fails today is frozen in contrast-baseline.json; nothing new may join it.
// `bun run contrast` prints the full list. Fixing one is a colour decision, not a lint fix.

import { describe, expect, test } from 'bun:test';
import { parseColour, ratio } from './contrast';
import { collect, readBaseline } from './contrast-run';

describe('contrast maths', () => {
    const c = (v: string) => parseColour(v)!.rgb;
    test('black on white is 21', () => expect(ratio(c('#000'), c('#fff'))).toBeCloseTo(21, 5));
    test('identical colours are 1', () => expect(ratio(c('#2e2f2e'), c('#2e2f2e'))).toBeCloseTo(1, 5));
    test('order does not matter', () => expect(ratio(c('#333433'), c('#fcffff'))).toBeCloseTo(ratio(c('#fcffff'), c('#333433')), 9));
    test('#767676 on white is the 4.54 AA threshold', () => expect(ratio(c('#767676'), c('#fff'))).toBeCloseTo(4.54, 2));
});

describe('contrast', () => {
    const run = collect();
    const base = readBaseline();

    test('the manifest names only tokens that exist', () => {
        expect(run.skipped.filter(s => s.skipped === 'undefined token').map(s => s.key)).toEqual([]);
    });

    test('no declared pairing falls below the minimum unless baselined', () => {
        const fresh = run.failingPairs.filter(p => !base.pairs.includes(p.key)).map(p => `${p.ratio.toFixed(2)}  ${p.key}`);
        expect(fresh).toEqual([]);
    });

    test('no rule falls below the minimum unless baselined', () => {
        const fresh = run.failingRules.filter(h => !base.rules.includes(h.key)).map(h => `${h.ratio.toFixed(2)}  ${h.key}`);
        expect(fresh).toEqual([]);
    });
});
