import { test, expect } from 'bun:test';
import { changedLine } from './dev-build';

// "log once per build, not once per event"
test('a file seen once is named, a file seen often is named once with its count', () => {
    const seen = new Map([['ts/main.ts', 1], ['ts/user-element.test.ts', 411167]]);
    expect(changedLine(seen)).toBe('ts/main.ts, ts/user-element.test.ts (411167x)');
});

test('nothing seen is an empty line', () => {
    expect(changedLine(new Map())).toBe('');
});
