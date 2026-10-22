// The mock answers reach the way a node does: from a Tablet of Reach.
// mock/tablet-of-reach is a copy of QNTX's own server/reach/tablet-of-reach.

export type Level = 'ROOT' | 'USER' | 'PUBLIC_REGISTRATION';

export const LEVELS: readonly Level[] = ['ROOT', 'USER', 'PUBLIC_REGISTRATION'];

interface Line {
    path: string;
    levels: string[];
}

const REACH_IS = 'REACH is ';
const OF = ' of ';

function words(text: string): string[] {
    return text.split(' ').filter(word => word !== '' && word !== '\t');
}

function unquoted(word: string): string {
    const start = word.startsWith("'") ? 1 : 0;
    const end = word.endsWith("'") ? word.length - 1 : word.length;
    return word.slice(start, end);
}

/** Every reach line, one entry per quoted path. A signum (no leading slash) is a sigil's line, not a route's, and is skipped. */
export function parseTablet(text: string): Line[] {
    const lines: Line[] = [];
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line.startsWith(REACH_IS)) continue;
        const of = line.lastIndexOf(OF);
        if (of < 0) continue;
        const levels = words(line.slice(of + OF.length));
        for (const word of words(line.slice(REACH_IS.length, of))) {
            const path = unquoted(word);
            if (!path.startsWith('/')) continue;
            lines.push({ path, levels });
        }
    }
    return lines;
}

/** Whether a tablet path names this request path: exact, by `{segment}` pattern, or as a `/` prefix. */
function names(tabletPath: string, path: string): boolean {
    if (tabletPath === path) return true;
    if (tabletPath.includes('{')) {
        const want = tabletPath.split('/');
        const have = path.split('/');
        if (want.length !== have.length) return false;
        return want.every((seg, i) => seg.startsWith('{') || seg === have[i]);
    }
    // '/' is the page itself, not a prefix of everything: undefined is no access.
    if (tabletPath === '/') return false;
    return tabletPath.endsWith('/') && path.startsWith(tabletPath);
}

export class Tablet {
    constructor(private readonly lines: Line[]) {}

    static from(text: string): Tablet {
        return new Tablet(parseTablet(text));
    }

    // The tablet:
    // > A longer path wins over the prefix above
    line(path: string): Line | undefined {
        let best: Line | undefined;
        for (const line of this.lines) {
            if (!names(line.path, path)) continue;
            if (!best || line.path.length > best.path.length) best = line;
        }
        return best;
    }

    // ROOT reaches everything. The tablet:
    // > Not defined is no access.
    reaches(level: Level, path: string): boolean {
        if (level === 'ROOT') return true;
        const line = this.line(path);
        if (!line) return false;
        return line.levels.includes('ANYONE') || line.levels.includes(level);
    }

    /** `GET /i/reaches?paths=`: of the paths asked, the ones reached. */
    reached(level: Level, paths: string[]): string[] {
        return paths.filter(path => this.reaches(level, path));
    }
}
