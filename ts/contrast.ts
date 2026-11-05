// Contrast, computed from the stylesheets themselves. Pure functions over
// strings (no fs, no DOM), so the test, the report script and the design-system
// viewer can all use them. WCAG 2.x relative luminance; 4.5 is AA for small text,
// and every size QNTX has (10-14px) is small text.

export type RGB = [number, number, number];
export type Colour = { rgb: RGB; alpha: number };

/** Every `--name: value;` in the given css, first declaration wins, comments dropped. */
export function parseTokens(css: string): Record<string, string> {
    const tokens: Record<string, string> = {};
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of clean.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+?)\s*;/gm)) {
        if (!(m[1] in tokens)) tokens[m[1]] = m[2].trim();
    }
    return tokens;
}

/** Follow var(--x[, fallback]) chains to a literal. null when it never gets there. */
export function resolve(value: string | undefined, tokens: Record<string, string>, depth = 0): string | null {
    if (!value) return null;
    const v = value.trim();
    const m = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]*))?\)$/);
    if (!m) return v;
    if (depth > 8) return null;
    if (m[1] in tokens) return resolve(tokens[m[1]], tokens, depth + 1);
    return m[2] ? resolve(m[2], tokens, depth + 1) : null;
}

export function parseColour(value: string): Colour | null {
    const v = value.trim().toLowerCase();
    const hex = v.match(/^#([0-9a-f]{3,8})$/);
    if (hex) {
        let h = hex[1];
        if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
        if (h.length !== 6 && h.length !== 8) return null;
        const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
        return { rgb: [n(0), n(2), n(4)], alpha: h.length === 8 ? n(6) : 1 };
    }
    const fn = v.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)$/);
    if (fn) {
        const a = fn[4] === undefined ? 1 : fn[4].endsWith('%') ? parseFloat(fn[4]) / 100 : parseFloat(fn[4]);
        return { rgb: [+fn[1] / 255, +fn[2] / 255, +fn[3] / 255], alpha: a };
    }
    if (v === 'white') return { rgb: [1, 1, 1], alpha: 1 };
    if (v === 'black') return { rgb: [0, 0, 0], alpha: 1 };
    return null;
}

function luminance([r, g, b]: RGB): number {
    const f = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function ratio(a: RGB, b: RGB): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** Opaque colour of a token, or null when it is translucent, a gradient, or unresolvable. */
export function opaque(name: string, tokens: Record<string, string>): RGB | null {
    const c = parseColour(resolve(`var(${name})`, tokens) ?? '');
    return c && c.alpha === 1 ? c.rgb : null;
}

export type Manifest = {
    min: number;
    themes: Record<string, { surfaces: string[]; text: string[] }>;
    pairs: { text: string; surface: string }[];
};

export type PairResult = { key: string; text: string; surface: string; ratio: number } | { key: string; skipped: string };

/** Every declared text/surface pairing: each theme's text roles on each of its surfaces, plus the explicit pairs. */
export function declaredPairs(manifest: Manifest, tokens: Record<string, string>): PairResult[] {
    const all: [string, string][] = [];
    for (const t of Object.values(manifest.themes)) for (const s of t.surfaces) for (const x of t.text) all.push([x, s]);
    for (const p of manifest.pairs) all.push([p.text, p.surface]);
    const seen = new Set<string>();
    const out: PairResult[] = [];
    for (const [text, surface] of all) {
        const key = `${text} on ${surface}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const a = opaque(text, tokens);
        const b = opaque(surface, tokens);
        if (!a || !b) { out.push({ key, skipped: !(text in tokens) || !(surface in tokens) ? 'undefined token' : 'not an opaque colour' }); continue; }
        out.push({ key, text, surface, ratio: ratio(a, b) });
    }
    return out;
}

export type RuleHit = { key: string; file: string; selector: string; color: string; background: string; ratio: number };

/** Rules that set both a colour and an opaque background, each resolvable to hex. A rule that inherits one of them is not seen here. */
export function ruleHits(file: string, css: string, tokens: Record<string, string>): RuleHit[] {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const out: RuleHit[] = [];
    for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = m[1].trim().replace(/\s+/g, ' ');
        const color = m[2].match(/(?<![-\w])color\s*:\s*([^;]+?)\s*(?:!important)?\s*(?:;|$)/);
        const bg = m[2].match(/(?<![-\w])background(?:-color)?\s*:\s*([^;]+?)\s*(?:!important)?\s*(?:;|$)/);
        if (!color || !bg) continue;
        const fg = parseColour(resolve(color[1], tokens) ?? '');
        const bk = parseColour(resolve(bg[1], tokens) ?? '');
        if (!fg || !bk || fg.alpha !== 1 || bk.alpha !== 1) continue;
        out.push({ key: `${file} | ${selector} | color:${color[1]} on ${bg[1]}`, file, selector, color: color[1], background: bg[1], ratio: ratio(fg.rgb, bk.rgb) });
    }
    return out;
}
