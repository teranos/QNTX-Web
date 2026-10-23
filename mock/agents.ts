// The mock's agents: the Node Agent and the agent of each namespace, each
// with one session, and one more per element it is said to about.

// > each element is an agent as well, we default to claude

// > say being able to carry an image sounds usefull to me

// What is said is answered at once, in the mock's own words, so the page's
// turn, its picture and its element can be seen without a node.

export interface Turn {
    at: string;
    speaker: 'person' | 'agent';
    text: string;
    of: string;
}

export interface Transcript {
    session: string;
    subjects: string[];
    started: string;
    ended: string;
    turns: Turn[];
    folded: number;
    model: string;
    effort: string;
}

export interface Am {
    did: string;
    model: string;
    effort: string;
    permission_mode: string;
    permission_modes: string[];
    allow: string[];
    session: string;
    answering: boolean;
    claude_code: string;
    not_ready: string;
    signed_in: boolean;
    auth_method: string;
}

export interface Said {
    answer: string;
    is_error: boolean;
    subtype: string;
    session: string;
    model: string;
    claude_code: string;
    permission_mode: string;
    denied: string[];
    cost_usd: number;
    took_ms: number;
    unwritten: string;
}

const MODEL = 'claude-fable-5-1';

/** One agent's sessions: its own, and one per element. */
export class Agent {
    private sessions = new Map<string, Transcript>();

    constructor(readonly of: string, readonly did: string, seed?: Transcript) {
        if (seed) this.sessions.set('', seed);
    }

    /** The session key: the element, or the agent's own when none is named. */
    private session(element: string): Transcript {
        let held = this.sessions.get(element);
        if (!held) {
            const now = new Date().toISOString();
            held = {
                session: `mock-${this.of}-${element || 'own'}`,
                subjects: element ? [element] : [this.of],
                started: now,
                ended: now,
                turns: [],
                folded: 0,
                model: MODEL,
                effort: 'high',
            };
            this.sessions.set(element, held);
        }
        return held;
    }

    am(element: string): Am {
        const held = this.sessions.get(element);
        return {
            did: this.did,
            model: MODEL,
            effort: 'high',
            permission_mode: 'default',
            permission_modes: ['default', 'acceptEdits', 'plan'],
            allow: ['Bash(git *)'],
            session: held ? held.session : '',
            answering: false,
            claude_code: 'mock',
            not_ready: '',
            signed_in: true,
            auth_method: 'mock',
        };
    }

    read(element: string): Transcript | undefined {
        return this.sessions.get(element);
    }

    /** What is said, answered: the mock names the element and the picture it was handed, and gives the words back. */
    say(says: string, element: string, fileId: string, mode: string): Said {
        const held = this.session(element);
        const now = new Date().toISOString();
        const saw = fileId ? ` I was handed a picture, file ${fileId}.` : '';
        const about = element ? ` This is ${element}'s own session with me.` : '';
        const answer = `MOCK ${this.of} answers.${about}${saw} You said: ${says}`;
        held.turns.push({ at: now, speaker: 'person', text: says, of: 'person' });
        held.turns.push({ at: now, speaker: 'agent', text: answer, of: 'agent' });
        held.ended = now;
        return {
            answer,
            is_error: false,
            subtype: 'success',
            session: held.session,
            model: MODEL,
            claude_code: 'mock',
            permission_mode: mode || 'default',
            denied: [],
            cost_usd: 0,
            took_ms: 1,
            unwritten: '',
        };
    }
}

/** The files the page sent up, by the id the mock gave each. */
export class Files {
    private held = new Map<string, { bytes: Uint8Array; type: string; name: string }>();
    private n = 0;

    keep(bytes: Uint8Array, type: string, name: string): { id: string; filename: string; content_type: string; size: number } {
        const id = `mock-file-${++this.n}`;
        this.held.set(id, { bytes, type, name });
        return { id, filename: name, content_type: type, size: bytes.byteLength };
    }

    /** The file by `<id>` or `<id>.<ext>`. */
    get(path: string): { bytes: Uint8Array; type: string } | undefined {
        const dot = path.indexOf('.');
        return this.held.get(dot < 0 ? path : path.slice(0, dot));
    }
}
