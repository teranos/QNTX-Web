// The token rules in .stylelintrc.json, pinned: a literal colour, radius or
// z-index is a violation wherever it hides (function, shorthand, corner
// longhand); a token reference never is.
//
// Stylelint runs in a child process, not in this one: `bun test` preloads a
// DOM (jsdom under USE_JSDOM=1), and with Bun 1.3.9 importing stylelint under
// it recurses forever (os.cpus() -> navigator.hardwareConcurrency -> os.cpus()).

import { beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dir, '..');

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

const tokens = [
    '.x{color:var(--text-primary)}',
    '.x{border:1px solid var(--border)}',
    '.x{border:none}',
    '.x{border-radius:var(--border-radius)}',
    '.x{z-index:var(--z-toast)}',
    '.x{color:transparent}',
    '.x{background-image:url(a.png)}',
];

const runner = `
import stylelint from 'stylelint';
const { config, cases } = JSON.parse(await Bun.stdin.text());
const out = {};
for (const code of cases) {
    const r = await stylelint.lint({ code, config, codeFilename: 'probe.css' });
    out[code] = r.results[0].warnings.length;
}
console.log(JSON.stringify(out));
`;

let counts: Record<string, number> = {};

beforeAll(() => {
    const config = JSON.parse(readFileSync(join(root, '.stylelintrc.json'), 'utf8'));
    const run = spawnSync(process.execPath, ['-e', runner], {
        cwd: root, input: JSON.stringify({ config, cases: [...literal, ...tokens] }), encoding: 'utf8',
    });
    if (run.status !== 0) throw new Error(`stylelint probe failed (${run.status}): ${run.stderr || run.stdout}`);
    counts = JSON.parse(run.stdout.trim().split('\n').pop()!);
});

describe('css token rules', () => {
    for (const css of literal) test(`flags ${css}`, () => expect(counts[css]).toBeGreaterThan(0));
    for (const css of tokens) test(`allows ${css}`, () => expect(counts[css]).toBe(0));
});
