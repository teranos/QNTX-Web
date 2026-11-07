// 「[Fable 5.1, Opus 5.5] The mock's rooms (ADR-057): the Node Room, with every Node Agent in it and a」
// 「[Fable 5.1, Opus 5.5] Telegram group connected, and the room of pond. Answered as rooms.proto's」
// 「[Fable 5.1, Opus 5.5] calls, each under /api/rooms. An agent woken answers into the room a moment」
// 「[Fable 5.1, Opus 5.5] later, in the mock's own words; one whose wake only waits does not.」

// "「[Opus 5.5] i want all Node Agents to be in the Node Room」"
// "「[Opus 5.5] and i will also connect the Node Room to a Telegram group i have」"

export interface RoomAgent { did: string; harness: string; name: string }
export interface Room { id: string; provider: string; name: string; description: string; instructions: string; of: Record<string, string> }
export interface RoomMessage { id: string; room: string; sender: string; sender_name: string; agent: RoomAgent | null; body: string; thread: string; at: string }
export interface RoomJoined { room: string; member: string; member_name: string; agent: RoomAgent | null; at: string }

const PROVIDER = 'switchai-py';
const NODE_DID = 'did:key:z6MkmockNode';
const MADE_AT = '2026-11-07T09:00:00Z';

// 「[Fable 5.1, Opus 5.5] How long an agent takes to put something back into the room.」
const ANSWER_MS = 1500;

const nodeAgent = (harness: string): RoomAgent => ({ did: 'did:key:mock-node-agent', harness, name: `node-${harness}` });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export class Rooms {
    private rooms: Room[] = [
        { id: 'node-room', provider: PROVIDER, name: 'Node Room', description: 'the Node Agents of this node, in every harness it runs them in', instructions: 'the Agy, Claude, Codex Node Agents are all in the Node Room', of: { node: NODE_DID } },
        { id: 'pond', provider: PROVIDER, name: 'pond', description: 'the room of the pond namespace', instructions: '', of: { namespace: 'pond' } },
    ];
    private agents = new Map<string, RoomAgent[]>([
        ['node-room', [nodeAgent('claude'), nodeAgent('codex'), nodeAgent('agy')]],
        ['pond', [{ did: 'did:key:mock-agent-pond', harness: 'claude', name: 'pond' }]],
    ]);
    private connected = new Map<string, string>([
        ['node-room', 'Telegram group "the node"'],
    ]);
    private messages = new Map<string, RoomMessage[]>([
        ['node-room', [
            { id: 'm-1', room: 'node-room', sender: 'tg:5551', sender_name: 'root', agent: null, body: 'MOCK. This room is the Node Room of the mock node, connected to a Telegram group.', thread: '', at: MADE_AT },
            { id: 'm-2', room: 'node-room', sender: 'node-claude', sender_name: 'node-claude', agent: nodeAgent('claude'), body: 'MOCK node-claude is here, reading the room.', thread: '', at: '2026-11-07T09:00:30Z' },
        ]],
        ['pond', []],
    ]);
    private joined = new Map<string, RoomJoined[]>([
        ['node-room', [
            { room: 'node-room', member: 'node-codex', member_name: 'node-codex', agent: nodeAgent('codex'), at: '2026-11-07T09:00:10Z' },
            { room: 'node-room', member: 'node-agy', member_name: 'node-agy', agent: nodeAgent('agy'), at: '2026-11-07T09:00:20Z' },
        ]],
        ['pond', []],
    ]);
    private n = 2;

    private room(id: string): Room | undefined {
        return this.rooms.find(r => r.id === id);
    }

    private say(room: Room, sender: string, senderName: string, agent: RoomAgent | null, body: string, thread = ''): RoomMessage {
        const message: RoomMessage = { id: `m-${++this.n}`, room: room.id, sender, sender_name: senderName, agent, body, thread, at: new Date().toISOString() };
        this.messages.get(room.id)!.push(message);
        return message;
    }

    /** The rooms paths, or null when the path is not one. */
    async answer(level: string, method: string, path: string, req: Request): Promise<Response | null> {
        if (path === '/api/rooms' && method === 'GET') return json({ list: this.rooms });
        if (!path.startsWith('/api/rooms/')) return null;
        const [id, ...more] = path.slice('/api/rooms/'.length).split('/');
        const room = this.room(decodeURIComponent(id ?? ''));
        if (!room) return json({ error: `${path}: the mock holds no room ${id}` }, 404);
        const rest = more.length ? `/${more.join('/')}` : '';
        if (rest === '' && method === 'GET') return json({ room: { ...room, connected: this.connected.get(room.id) ?? '' }, agents: this.agents.get(room.id) ?? [] });
        if (rest === '/read' && method === 'GET') return json({ messages: this.messages.get(room.id) ?? [], joined: this.joined.get(room.id) ?? [], truncated: false });
        if (rest === '/post' && method === 'POST') {
            const sent = (await req.json()) as { body?: string; thread?: string };
            if (!sent.body) return json({ error: 'body is required' }, 400);
            const said = this.say(room, `mock:${level}`, level.toLowerCase(), null, sent.body, sent.thread);
            console.log(`${level} posted in ${room.name}: ${sent.body}`);
            return json({ id: said.id });
        }
        if (rest === '/wake' && method === 'POST') {
            // 「[Fable 5.1, Opus 5.5] agents arrives as the node's sigil takes it: names, comma-separated.」
            const sent = (await req.json()) as { agents?: string; says?: string; thread?: string };
            if (!sent.says) return json({ error: 'says is required' }, 400);
            const inRoom = this.agents.get(room.id) ?? [];
            const names = new Set((sent.agents ?? '').split(',').map(name => name.trim()).filter(Boolean));
            const named = inRoom.filter(held => names.has(held.name));
            if (named.length === 0) return json({ error: 'agents names nobody in the room' }, 400);
            const said = this.say(room, `mock:${level}`, level.toLowerCase(), null, sent.says, sent.thread);
            // 「[Fable 5.1, Opus 5.5] The mock's codex is told by nothing: its wake stands in the room until it next reads it.」
            const woken = named.map(agent => ({ agent, reach: agent.harness === 'codex' ? 'ROOM_REACH_WAITS' : 'ROOM_REACH_ARRIVES' }));
            for (const each of woken) {
                if (each.reach !== 'ROOM_REACH_ARRIVES') continue;
                setTimeout(() => {
                    this.say(room, each.agent.name, each.agent.name, each.agent, `MOCK ${each.agent.name} answers in ${room.name}: you said "${sent.says}". A mock has nothing to do about it, so it says so, here, where everyone in the room reads it.`, said.id);
                }, ANSWER_MS);
            }
            console.log(`${level} woke ${named.map(a => a.name).join(', ')} in ${room.name}: ${sent.says}`);
            return json({ id: said.id, woken });
        }
        return null;
    }
}
