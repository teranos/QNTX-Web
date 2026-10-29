// The mock's agents: the Node Agent and the agent of each namespace, each
// with one session, and one more per element it is said to about.

// > each element is an agent as well, we default to claude

// > say being able to carry an image sounds usefull to me

// What is said is answered in the mock's own words, over a few seconds, so the
// page's turn, its picture, its element and its stream can be seen without a node.

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

// One line of the turn's stream as the node tails it (protocol.SessionEvent).
export interface LiveEvent {
    session: string;
    harness: string;
    at: string;
    kind: string;
    text: string;
    tool: string;
    tool_use_id: string;
    input: string;
    raw: string;
    mark: string;
}

// How long each word of the answer takes to land.
const WORD_MS = 120;

/** The turn going: what it printed so far, who listens, and whether it ended. */
class Going {
    readonly events: LiveEvent[] = [];
    private listeners = new Set<(event: LiveEvent | null) => void>();
    ended = false;

    constructor(readonly session: string) {}

    print(kind: string, text: string, tool = ''): void {
        const event: LiveEvent = {
            session: this.session, harness: 'claude', at: new Date().toISOString(), kind, text, tool,
            tool_use_id: tool ? `mock-tool-use-${this.events.length}` : '', input: tool ? '{"command":"echo MOCK uptime"}' : '',
            raw: JSON.stringify({ mock: true, type: kind === 'delta' ? 'stream_event' : kind, text }), mark: String(this.events.length + 1),
        };
        this.events.push(event);
        for (const listen of this.listeners) listen(event);
    }

    end(): void {
        this.ended = true;
        for (const listen of this.listeners) listen(null);
        this.listeners.clear();
    }

    /** Each event from the mark on as it lands, then null at the end; what it gives back stops listening. */
    listen(mark: number, onEvent: (event: LiveEvent | null) => void): () => void {
        for (const event of this.events.slice(mark)) onEvent(event);
        if (this.ended) { onEvent(null); return () => {}; }
        this.listeners.add(onEvent);
        return () => this.listeners.delete(onEvent);
    }
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** One agent's sessions: its own, and one per element. */
export class Agent {
    private sessions = new Map<string, Transcript>();
    // The turn going per session key, while one is.
    private going = new Map<string, Going>();

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
            answering: this.going.has(element),
            claude_code: 'mock',
            not_ready: '',
            signed_in: true,
            auth_method: 'mock',
        };
    }

    read(element: string): Transcript | undefined {
        return this.sessions.get(element);
    }

    /** The turn going in the session, or none between turns. */
    live(element: string): Going | undefined {
        return this.going.get(element);
    }

    /** What is said, answered: the mock names the element and the picture it was handed, and gives the words back. */
    async say(says: string, element: string, fileId: string, mode: string): Promise<Said> {
        const held = this.session(element);
        const saw = fileId ? ` I was handed a picture, file ${fileId}.` : '';
        const about = element ? ` This is ${element}'s own session with me.` : '';
        // Long enough to be read, scrolled and watched while it is said.
        const more = ' I will say a little more, so there is something to watch arrive: a mock has no thoughts of its own, so it counts instead, one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty, and that is the end of what the mock has to say.';
        const answer = `MOCK ${this.of} answers, turn ${held.turns.length / 2 + 1} of our one conversation.${about}${saw} You said: ${says}${more}`;
        // The person's words are written down first, as the node does, and the
        // answer is printed a word at a time: the stream is what tails it.
        held.turns.push({ at: new Date().toISOString(), speaker: 'person', text: says, of: 'person' });
        const going = new Going(held.session);
        this.going.set(element, going);
        going.print('started', MODEL);
        await wait(WORD_MS);
        going.print('tool_use', 'Bash', 'Bash');
        await wait(WORD_MS);
        going.print('tool_result', 'MOCK uptime: up 0 days, this is the mock');
        await wait(WORD_MS);
        going.print('tool_use', 'Write', 'Write');
        going.events[going.events.length - 1]!.input = JSON.stringify({ file_path: `mock/turn-${held.turns.length}.md`, content: Array.from({ length: 40 }, (_, i) => `MOCK line ${i + 1} of 40, written by the mock`).join('\n') });
        let said = '';
        for (const word of answer.split(' ')) {
            await wait(WORD_MS);
            const piece = said ? ` ${word}` : word;
            said += piece;
            going.print('delta', piece);
        }
        going.print('text', answer);
        going.print('ended', answer);
        const now = new Date().toISOString();
        held.turns.push({ at: now, speaker: 'agent', text: answer, of: 'agent' });
        held.ended = now;
        this.going.delete(element);
        going.end();
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
