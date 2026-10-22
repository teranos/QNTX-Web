// > NEVER use `text-overflow: ellipsis`.

// > this can be in the linter, no need to have it in CLAUDE.md

// This is the linter: every stylesheet and module is read, and a declaration
// of the property fails the suite with its file and line.

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const web = join(import.meta.dir, '..');
const roots = ['css', 'ts', 'index.html'].map(name => join(web, name));

function* files(path: string): Generator<string> {
    if (statSync(path).isDirectory()) {
        for (const name of readdirSync(path)) yield* files(join(path, name));
        return;
    }
    if (path.endsWith('.css') || path.endsWith('.html') || (path.endsWith('.ts') && !path.endsWith('.test.ts'))) yield path;
}

/** `file:line` of every declaration of text-overflow: ellipsis, in CSS or in a style attribute. */
export function ellipses(): string[] {
    const found: string[] = [];
    for (const root of roots) {
        for (const file of files(root)) {
            readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                const at = line.indexOf('text-overflow');
                if (at < 0) return;
                if (!line.slice(at).includes('ellipsis')) return;
                found.push(`${relative(web, file)}:${i + 1}`);
            });
        }
    }
    return found;
}

describe('no ellipsis', () => {
    test('all text wraps: nothing declares text-overflow: ellipsis', () => {
        expect(ellipses()).toEqual([]);
    });
});
