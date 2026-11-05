// Reads the repo's stylesheets, manifest and baseline, and says what fails.
// Shared by ts/contrast.test.ts (the gate) and contrast-report.ts (the report).
// Node/Bun only: not imported by the app.

import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { declaredPairs, parseTokens, ruleHits, type Manifest, type PairResult, type RuleHit } from './contrast';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const baselineFile = join(root, 'contrast-baseline.json');

export type Baseline = { pairs: string[]; rules: string[] };

function* cssFiles(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) yield* cssFiles(path);
        else if (name.endsWith('.css')) yield path;
    }
}

export function collect() {
    const tokensCss = readFileSync(join(root, 'css/tokens.css'), 'utf8');
    const tokens = parseTokens(tokensCss);
    const manifest = JSON.parse(readFileSync(join(root, 'contrast-pairs.json'), 'utf8')) as Manifest;
    const pairs = declaredPairs(manifest, tokens);
    // An element's interior chooses its own colours: only the shell is measured here.
    const { interiors } = JSON.parse(readFileSync(join(root, 'css-interiors.json'), 'utf8')) as { interiors: string[] };
    const hits: RuleHit[] = [];
    for (const file of cssFiles(join(root, 'css'))) {
        if (file.endsWith('tokens.css') || interiors.includes(relative(root, file))) continue;
        hits.push(...ruleHits(relative(root, file), readFileSync(file, 'utf8'), tokens));
    }
    const failingPairs = pairs.filter((p): p is Extract<PairResult, { ratio: number }> => 'ratio' in p && p.ratio < manifest.min);
    const failingRules = hits.filter(h => h.ratio < manifest.min);
    const skipped = pairs.filter((p): p is Extract<PairResult, { skipped: string }> => 'skipped' in p);
    return { manifest, pairs, hits, failingPairs, failingRules, skipped };
}

export function readBaseline(): Baseline {
    try { return JSON.parse(readFileSync(baselineFile, 'utf8')); } catch { return { pairs: [], rules: [] }; }
}
