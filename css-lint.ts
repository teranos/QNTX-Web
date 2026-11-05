// Stylelint with a ratchet. `bun run lint:css` fails when any file has MORE
// violations of a rule than css-lint-baseline.json records; fewer is fine and
// is reported. `bun run lint:css --update` rewrites the baseline (only after
// fixing). `--update` refuses to raise any count; `--update --force` is the
// deliberate way to widen the baseline (a new rule, say) and says what grew.
// The baseline is plain JSON: { "css/x.css": { "rule": count } }.
// Stylelint itself failing (bad config/option, parse error, unexpected exit
// status) fails this script; a run that did not really lint never passes.
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { relative } from 'path';

const root = import.meta.dir;
const baselineFile = `${root}/css-lint-baseline.json`;

const run = spawnSync('bunx', ['stylelint', 'css/**/*.css', '--formatter', 'json', '--allow-empty-input'], {
    cwd: root, encoding: 'utf8', maxBuffer: 1 << 28,
});
const raw = (run.stderr || '') + (run.stdout || '');
// stylelint exits 0 (clean) or 2 (lint errors); anything else is a failed run.
if (run.error || (run.status !== 0 && run.status !== 2)) {
    console.error(`stylelint did not run cleanly (status ${run.status}):\n${run.error ?? raw}`);
    process.exit(2);
}
const start = raw.indexOf('[');
if (start < 0) { console.error(`stylelint printed no results:\n${raw}`); process.exit(2); }
const results = JSON.parse(raw.slice(start, raw.lastIndexOf(']') + 1)) as {
    source: string;
    warnings: { rule: string; line: number; text: string }[];
    invalidOptionWarnings: { text: string }[];
    parseErrors: { text: string }[];
}[];

// A rule with an invalid option does not run: that is a broken linter, not a clean file.
const broken = results.flatMap(r => [...r.invalidOptionWarnings, ...r.parseErrors].map(w => `${relative(root, r.source)}: ${w.text}`));
if (broken.length) { console.error(`stylelint reported errors of its own:\n  ${[...new Set(broken)].join('\n  ')}`); process.exit(2); }

type Counts = Record<string, Record<string, number>>;
const now: Counts = {};
const where: Record<string, string[]> = {};
for (const r of results) {
    const file = relative(root, r.source);
    for (const w of r.warnings) {
        (now[file] ??= {})[w.rule] = (now[file][w.rule] ?? 0) + 1;
        (where[`${file}|${w.rule}`] ??= []).push(`${file}:${w.line}  ${w.text}`);
    }
}

const baseOnDisk: Counts = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')) : {};

if (process.argv.includes('--update')) {
    const grew = Object.entries(now).flatMap(([file, rules]) =>
        Object.entries(rules).filter(([rule, n]) => n > (baseOnDisk[file]?.[rule] ?? 0)).map(([rule, n]) => `${file} ${rule}: ${baseOnDisk[file]?.[rule] ?? 0} -> ${n}`));
    if (grew.length && !process.argv.includes('--force')) {
        console.error(`--update would raise the baseline; fix these or pass --force on purpose:\n  ${grew.join('\n  ')}`);
        process.exit(1);
    }
    const sorted = Object.fromEntries(Object.entries(now).sort());
    writeFileSync(baselineFile, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`baseline written: ${Object.values(now).flatMap(Object.values).reduce((a, b) => a + b, 0)} violations in ${Object.keys(now).length} files`);
    process.exit(0);
}

const base = baseOnDisk;
let worse = 0, better = 0;
for (const [file, rules] of Object.entries(now)) {
    for (const [rule, n] of Object.entries(rules)) {
        const allowed = base[file]?.[rule] ?? 0;
        if (n > allowed) {
            worse += n - allowed;
            console.error(`✗ ${file} ${rule}: ${n} (baseline ${allowed})`);
            for (const line of where[`${file}|${rule}`]) console.error(`    ${line}`);
        }
    }
}
for (const [file, rules] of Object.entries(base)) {
    for (const [rule, allowed] of Object.entries(rules)) {
        const n = now[file]?.[rule] ?? 0;
        if (n < allowed) better += allowed - n;
    }
}
if (better) console.log(`${better} fewer than baseline — run \`bun run lint:css --update\` to lock it in.`);
if (worse) { console.error(`${worse} new violation(s).`); process.exit(1); }
console.log('css lint: no new violations.');
