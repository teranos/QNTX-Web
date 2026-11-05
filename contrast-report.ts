// `bun run contrast` prints every failing pairing and rule, lowest first, and
// exits 1 if any is not in contrast-baseline.json.
// `bun run contrast --update` rewrites the baseline; it refuses to ADD an entry
// unless --force is given, so a baseline can shrink freely but only grow on purpose.
import { writeFileSync } from 'fs';
import { baselineFile, collect, readBaseline } from './ts/contrast-run';

const { manifest, pairs, hits, failingPairs, failingRules, skipped } = collect();
const base = readBaseline();
const row = (r: number) => r.toFixed(2).padStart(5);

console.log(`declared pairings: ${pairs.length - skipped.length} measured, ${failingPairs.length} under ${manifest.min}; ${skipped.length} skipped`);
for (const p of [...failingPairs].sort((a, b) => a.ratio - b.ratio)) console.log(`  ${row(p.ratio)}  ${p.key}${base.pairs.includes(p.key) ? '' : '   << NEW'}`);
for (const s of skipped) console.log(`  skip   ${s.key} (${s.skipped})`);
console.log(`\nrules with colour and opaque background: ${hits.length} measured, ${failingRules.length} under ${manifest.min}`);
for (const h of [...failingRules].sort((a, b) => a.ratio - b.ratio)) console.log(`  ${row(h.ratio)}  ${h.file}  ${h.selector}  color:${h.color} on ${h.background}${base.rules.includes(h.key) ? '' : '   << NEW'}`);

const nowPairs = failingPairs.map(p => p.key).sort();
const nowRules = failingRules.map(h => h.key).sort();
const newOnes = [...nowPairs.filter(k => !base.pairs.includes(k)), ...nowRules.filter(k => !base.rules.includes(k))];
const gone = base.pairs.filter(k => !nowPairs.includes(k)).length + base.rules.filter(k => !nowRules.includes(k)).length;

if (process.argv.includes('--update')) {
    if (newOnes.length && !process.argv.includes('--force')) {
        console.error(`\n--update would add ${newOnes.length} failing entr${newOnes.length === 1 ? 'y' : 'ies'}; fix them or pass --force on purpose.`);
        process.exit(1);
    }
    writeFileSync(baselineFile, JSON.stringify({ pairs: nowPairs, rules: nowRules }, null, 2) + '\n');
    console.log(`\nbaseline written: ${nowPairs.length} pairings, ${nowRules.length} rules.`);
    process.exit(0);
}
if (gone) console.log(`\n${gone} baselined entr${gone === 1 ? 'y' : 'ies'} no longer fail: run \`bun run contrast --update\` to lock it in.`);
if (newOnes.length) { console.error(`\n${newOnes.length} new failing entr${newOnes.length === 1 ? 'y' : 'ies'} (marked NEW).`); process.exit(1); }
console.log('\ncontrast: nothing new below the line.');
