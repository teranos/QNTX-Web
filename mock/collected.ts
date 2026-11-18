// What agents said to an agent, collected, as the mock holds it (QNTX server/collected.go).
// What a person does with it is answered as the node answers it; what agents
// say is put in by the mock itself, since the mock has no agents that speak.

export interface CollectedSaid {
    from: string;
    /** Who said it, by DID: what a chat's outbox finds its agent's words by. */
    from_did?: string;
    says: string;
    at: string;
    task: string;
    id: string;
    edited: boolean;
}

export interface Collected {
    to: string;
    did: string;
    model: string;
    waits: string;
    due: string;
    held_until: string;
    delivered: string;
    waiting: CollectedSaid[];
}

// Six hours, as the node holds an agent on Fable to.
const WAIT_MS = 21_600_000;

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** What waits for the mock's one Node Agent, and what a person did with it. */
export class TheCollected {
    private waiting: CollectedSaid[] = [];
    private heldUntil = 0;
    private delivered = 0;
    private n = 0;
    /** Everything delivered, each as the one thing said: what a story asks after. */
    readonly sent: string[] = [];
    readonly canceled: CollectedSaid[] = [];

    constructor(private called: string, private did: string, private model: string, private say: (says: string) => void) {}

    /** Who it is collected for. */
    get to(): string { return this.called; }

    /** An agent says something to the agent: it waits. */
    said(from: string, says: string, from_did?: string): void {
        this.waiting.push({ from, ...(from_did ? { from_did } : {}), says, at: new Date().toISOString(), task: '', id: `mock-said-${this.called}-${++this.n}`, edited: false });
    }

    /** Nothing waits and nothing was done: as the mock started. */
    forget(): void {
        this.waiting = [];
        this.heldUntil = 0;
        this.delivered = 0;
        this.sent.length = 0;
        this.canceled.length = 0;
    }

    private due(): number {
        if (this.waiting.length === 0) return 0;
        let due = Date.parse(this.waiting[0]!.at) + WAIT_MS;
        if (this.delivered && this.delivered + WAIT_MS > due) due = this.delivered + WAIT_MS;
        if (this.heldUntil > due) due = this.heldUntil;
        return due;
    }

    all(): { collected: Collected[] } {
        if (this.waiting.length === 0 && !this.heldUntil) return { collected: [] };
        const stamp = (ms: number) => (ms ? new Date(ms).toISOString() : '');
        return {
            collected: [{
                to: this.called, did: this.did, model: this.model, waits: '6h0m0s',
                due: stamp(this.due()), held_until: stamp(this.heldUntil), delivered: stamp(this.delivered),
                waiting: this.waiting,
            }],
        };
    }

    private asOneThing(going: CollectedSaid[]): string {
        const changed = going.some(one => one.edited);
        const lines = [`Collected for you: what agents said to you since ${going[0]!.at}, delivered together.${changed ? ' A person changed what is marked so.' : ' No person said any of it.'}`];
        for (const one of going) lines.push('', `${one.from}, ${one.at}${one.edited ? ', changed by a person' : ''}:`, one.says);
        return lines.join('\n');
    }

    /** `/api/collected…`, answered; null for a path that is not its. */
    async answer(method: string, path: string, req: Request): Promise<Response | null> {
        if (path !== '/api/collected' && !path.startsWith('/api/collected/')) return null;
        if (path === '/api/collected' && method === 'GET') return json(this.all());
        if (method !== 'POST') return null;
        return this.done(path, (await req.json()) as Record<string, string>);
    }

    /** What a person did with what waits for this agent, answered. */
    done(path: string, sent: Record<string, string>): Response | null {
        if ((sent.to ?? '').toLowerCase() !== this.called.toLowerCase() || (this.waiting.length === 0 && !this.heldUntil)) {
            return json({ error: `nothing is collected for ${sent.to}` }, 404);
        }
        switch (path) {
            case '/api/collected/hold': {
                const until = Date.parse(sent.until ?? '');
                if (Number.isNaN(until)) return json({ error: `until is a moment, as RFC3339, and this said ${sent.until}` }, 400);
                this.heldUntil = until;
                return json(this.all());
            }
            case '/api/collected/later':
                if (this.waiting.length > 0) this.heldUntil = this.due() + WAIT_MS;
                return json(this.all());
            case '/api/collected/edit': {
                const one = this.waiting.find(it => it.id === sent.id);
                if (!one) return json({ error: `nothing that waits for ${sent.to} is ${sent.id}` }, 404);
                one.says = sent.says ?? '';
                one.edited = true;
                return json(this.all());
            }
            case '/api/collected/cancel': {
                const id = (sent.id ?? '').trim();
                const gone = this.waiting.filter(it => !id || it.id === id);
                if (id && gone.length === 0) return json({ error: `nothing that waits for ${sent.to} is ${id}` }, 404);
                this.canceled.push(...gone);
                this.waiting = this.waiting.filter(it => !gone.includes(it));
                if (this.waiting.length === 0) this.heldUntil = 0;
                return json(this.all());
            }
            case '/api/collected/release': {
                const ids = (sent.ids ?? '').split(',').map(id => id.trim()).filter(Boolean);
                const going = this.waiting.filter(it => ids.length === 0 || ids.includes(it.id));
                if (going.length === 0) return json({ error: `nothing that waits for ${sent.to} is among ${ids.join(', ')}` }, 500);
                const says = (sent.says ?? '').trim() ? sent.says! : this.asOneThing(going);
                this.sent.push(says);
                this.say(says);
                this.waiting = this.waiting.filter(it => !going.includes(it));
                this.delivered = Date.now();
                this.heldUntil = 0;
                return json(this.all());
            }
        }
        return null;
    }
}

/**
 * What waits for each agent the mock collects for, asked as one: the node's own answer lists every agent
 * something waits for, and what is done with it names the agent it is for.
 */
export class Collections {
    constructor(private each: TheCollected[]) {}

    async answer(method: string, path: string, req: Request): Promise<Response | null> {
        if (path !== '/api/collected' && !path.startsWith('/api/collected/')) return null;
        if (path === '/api/collected' && method === 'GET') return json({ collected: this.each.flatMap(one => one.all().collected) });
        if (method !== 'POST') return null;
        const sent = (await req.json()) as Record<string, string>;
        const one = this.each.find(it => it.to.toLowerCase() === (sent.to ?? '').toLowerCase()) ?? this.each[0]!;
        const answered = one.done(path, sent);
        if (!answered || !answered.ok) return answered;
        return json({ collected: this.each.flatMap(it => it.all().collected) });
    }
}
