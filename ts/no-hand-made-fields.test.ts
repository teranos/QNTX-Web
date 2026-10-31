// "ban unstyled inputfield"
// A field is @teranos/elements' fieldFrom. These files still make one by hand; the list only shrinks.

import { describe, test, expect } from 'bun:test';
import { Glob } from 'bun';
import { join } from 'node:path';

const STILL_BY_HAND = [
    'ts/ceremony.ts',
    'ts/components/element/ax-element.ts',
    'ts/components/element/element-followup.ts',
    'ts/components/element/prompt-element.ts',
    'ts/door-dev.ts',
    'ts/door.ts',
    'ts/github-element.ts',
    'ts/market-element.ts',
    'ts/obsidian-element.ts',
    'ts/parity-element.ts',
    'ts/system-drawer.ts',
    'ts/token-mint-element.ts',
    'ts/user-element.ts',
    'ts/user-invite-element.ts',
];

const BY_HAND = ['input', 'textarea', 'select'].flatMap((tag) => [`createElement('${tag}')`, `createElement("${tag}")`]);

describe('Spike: a field is made by fieldFrom', () => {
    test('no file makes a field by hand but those still listed, and a file that stops is taken off', async () => {
        const root = join(import.meta.dir, '..');
        const found: string[] = [];
        for await (const path of new Glob('ts/**/*.ts').scan(root)) {
            if (path.endsWith('.test.ts') || path.startsWith('ts/generated/')) continue;
            const text = await Bun.file(join(root, path)).text();
            if (BY_HAND.some((call) => text.includes(call))) found.push(path);
        }
        expect(found.sort()).toEqual(STILL_BY_HAND);
    });
});
