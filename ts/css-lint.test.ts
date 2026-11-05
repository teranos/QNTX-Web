// The rules in stylelint.config.mjs, pinned. In the shell a literal colour,
// radius or z-index is a violation wherever it hides (function, shorthand,
// corner longhand); a token reference never is. Inside an element
// (css-interiors.json) the element's own colours are its own; the QNTX-wide
// axioms still hold there.
//
// Stylelint runs in a child process, not in this one: `bun test` preloads a
// DOM (jsdom under USE_JSDOM=1), and with Bun 1.3.9 importing stylelint under
// it recurses forever (os.cpus() -> navigator.hardwareConcurrency -> os.cpus()).

import { beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'child_process';
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

// An interior stylesheet: the probe is linted as if it were that file.
const interior = 'css/obsidian-element.css';
const interiorOwn = ['.x{color:#7c3aed}', '.x{border:1px solid rgb(1,2,3)}', '.x{z-index:10}'];
const interiorAxioms = ['.x{text-overflow:ellipsis}', '.x{colr:red}'];

// The config is found as it is for any file: stylelint.config.mjs at the root.
const runner = `
import stylelint from 'stylelint';
const cases = JSON.parse(await Bun.stdin.text());
const out = {};
for (const [file, code] of cases) {
    const r = await stylelint.lint({ code, codeFilename: file });
    out[file + ' ' + code] = r.results[0].warnings.length;
}
console.log(JSON.stringify(out));
`;

let counts: Record<string, number> = {};

beforeAll(() => {
    const shell = (c: string) => ['css/probe.css', c];
    const inside = (c: string) => [interior, c];
    const cases = [...literal.map(shell), ...tokens.map(shell), ...interiorOwn.map(inside), ...interiorAxioms.map(inside)];
    const run = spawnSync(process.execPath, ['-e', runner], { cwd: root, input: JSON.stringify(cases), encoding: 'utf8' });
    if (run.status !== 0) throw new Error(`stylelint probe failed (${run.status}): ${run.stderr || run.stdout}`);
    counts = JSON.parse(run.stdout.trim().split('\n').pop()!);
});

describe('the shell is held to tokens', () => {
    for (const css of literal) test(`flags ${css}`, () => expect(counts[`css/probe.css ${css}`]).toBeGreaterThan(0));
    for (const css of tokens) test(`allows ${css}`, () => expect(counts[`css/probe.css ${css}`]).toBe(0));
});

describe('an element interior is its own thing', () => {
    for (const css of interiorOwn) test(`allows ${css} in ${interior}`, () => expect(counts[`${interior} ${css}`]).toBe(0));
    for (const css of interiorAxioms) test(`still flags ${css} in ${interior}`, () => expect(counts[`${interior} ${css}`]).toBeGreaterThan(0));
});
