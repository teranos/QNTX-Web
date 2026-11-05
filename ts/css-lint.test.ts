// The token rules in .stylelintrc.json, pinned: a literal colour, radius or
// z-index is a violation wherever it hides (function, shorthand, corner
// longhand); a token reference never is.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import stylelint from 'stylelint';

const config = JSON.parse(readFileSync(join(import.meta.dir, '..', '.stylelintrc.json'), 'utf8'));

async function violations(code: string): Promise<number> {
    const { results } = await stylelint.lint({ code, config, codeFilename: 'probe.css' });
    return results[0].warnings.length;
}

describe('css token rules', () => {
    const literal = [
        '.x{color:#123456}',
        '.x{color:rgb(1,2,3)}',
        '.x{border:1px solid #fff}',
        '.x{border-top-left-radius:9px}',
        '.x{z-index:10}',
        '.x{text-shadow:0 0 3px #f00}',
        '.x{background-image:linear-gradient(#000,#fff)}',
        '.x{text-overflow:ellipsis}',
    ];
    for (const css of literal) test(`flags ${css}`, async () => expect(await violations(css)).toBeGreaterThan(0));

    const tokens = [
        '.x{color:var(--text-primary)}',
        '.x{border:1px solid var(--border)}',
        '.x{border:none}',
        '.x{border-radius:var(--border-radius)}',
        '.x{z-index:var(--z-toast)}',
        '.x{color:transparent}',
        '.x{background-image:url(a.png)}',
    ];
    for (const css of tokens) test(`allows ${css}`, async () => expect(await violations(css)).toBe(0));
});
