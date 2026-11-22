import { test, expect } from 'bun:test';
import { namespacesBelongHere } from './capabilities';

test('parquet has namespaces', () => {
    expect(namespacesBelongHere('parquet')).toBe(true);
});

test('sqlite keeps one universe, so it has no namespaces to show', () => {
    expect(namespacesBelongHere('sqlite')).toBe(false);
});

// Before the node has said, nothing has been ruled out — an empty store must
// not read as parquet.
test('an unanswered store rules nothing out', () => {
    expect(namespacesBelongHere('')).toBe(false);
});
