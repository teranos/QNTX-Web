// Rooms element: a level of the sidebar, a room a board, an agent pressed is addressed, a send wakes who it names.

import { describe, test, expect } from 'bun:test';
import { addressed, drawRoom, fillRoomsLevel, messageRow, ofSaid, reachSaid, type Room, type RoomAgent, type Rooms } from './rooms-element';

const claude: RoomAgent = { did: 'did:key:n', harness: 'claude', name: 'node-claude' };
const codex: RoomAgent = { did: 'did:key:n', harness: 'codex', name: 'node-codex' };
const nodeRoom: Room = { id: 'node-room', provider: 'switchai-py', name: 'Node Room', description: 'the Node Agents', instructions: '', of: { node: 'did:key:n' } };

async function settled(): Promise<void> {
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

function roomsOf(log: string[]): Rooms {
    return {
        list: () => Promise.resolve([nodeRoom, { ...nodeRoom, id: 'pond', name: 'pond', of: { namespace: 'pond' } }]),
        get: () => Promise.resolve({ room: { ...nodeRoom, connected: 'Telegram group "the node"' }, agents: [claude, codex] }),
        read: () => Promise.resolve({ messages: [{ id: 'm-1', room: 'node-room', sender: 'tg:1', sender_name: 'root', agent: null, body: 'hello room', thread: '', at: '2026-11-07T09:00:00Z' }], joined: [], truncated: false }),
        post: (_room, body) => { log.push(`post ${body}`); return Promise.resolve({ id: 'm-2' }); },
        wake: (_room, agents, says) => { log.push(`wake ${agents.map(a => a.name).join(',')} ${says}`); return Promise.resolve({ id: 'm-3', woken: agents.map(agent => ({ agent, reach: agent.harness === 'codex' ? 'ROOM_REACH_WAITS' : 'ROOM_REACH_ARRIVES' })) }); },
    };
}

describe('Rooms', () => {
    test('Rooms is a level of the sidebar: every room a row, a row opens the room', async () => {
        const level = document.createElement('div');
        const opened: string[] = [];
        fillRoomsLevel(level, roomsOf([]).list(), room => opened.push(room.id));
        await settled();
        expect(Array.from(level.querySelectorAll('.sidebar-level-row')).map(r => r.textContent)).toEqual(['Node Room', 'pond']);
        level.querySelectorAll<HTMLButtonElement>('.sidebar-level-row')[0]!.click();
        expect(opened).toEqual(['node-room']);
    });

    // "here i see what it's connected to and what Agents are in it"
    test('a room says what it is connected to and which agents are in it, and the board holds what was said', async () => {
        const body = document.createElement('div');
        const stop = drawRoom(body, nodeRoom, roomsOf([]), 60_000);
        await settled();
        expect(body.querySelector('.room-connected')?.textContent).toBe('connected to Telegram group "the node"');
        expect(body.querySelector('.room-send')?.textContent).toBe('→');
        expect(Array.from(body.querySelectorAll('.room-agent')).map(a => a.getAttribute('data-agent'))).toEqual(['node-claude', 'node-codex']);
        expect(body.querySelector('.room-board .room-row')?.textContent).toContain('hello room');
        stop();
    });

    // "i press on an Agent / `@agent_name` appears in inputfield and i can type something."
    test('pressing an agent highlights it and puts its name after an @ in the box; pressing it highlighted opens its own element; a send wakes who is named', async () => {
        const log: string[] = [];
        const opened: string[] = [];
        const body = document.createElement('div');
        const stop = drawRoom(body, nodeRoom, roomsOf(log), 60_000, (_room, agent) => opened.push(agent.name));
        await settled();
        const says = body.querySelector<HTMLTextAreaElement>('.room-says')!;
        const press = body.querySelector<HTMLButtonElement>('.room-agent[data-agent="node-claude"]')!;
        press.click();
        expect(says.value).toBe('@node-claude ');
        expect(press.classList.contains('room-agent-on')).toBe(true);
        expect(opened).toEqual([]);
        press.click();
        expect(opened).toEqual(['node-claude']);
        expect(says.value).toBe('@node-claude ');
        body.querySelector<HTMLButtonElement>('.room-agent[data-agent="node-codex"]')!.click();
        expect(press.classList.contains('room-agent-on')).toBe(false);
        expect(body.querySelector('.room-agent-on')?.getAttribute('data-agent')).toBe('node-codex');
        expect(says.value).toBe('@node-claude @node-codex ');
        says.value = '@node-claude ';
        says.value += 'what is up?';
        body.querySelector<HTMLButtonElement>('.room-send')!.click();
        await settled();
        expect(log).toEqual(['wake node-claude @node-claude what is up?']);
        expect(says.value).toBe('');
        expect(body.querySelector('.room-reach-line')?.textContent).toBe('arrives for node-claude');
        stop();
    });

    // "shared message board"
    test('a send naming no agent is posted to the board for everyone', async () => {
        const log: string[] = [];
        const body = document.createElement('div');
        const stop = drawRoom(body, nodeRoom, roomsOf(log), 60_000);
        await settled();
        const says = body.querySelector<HTMLTextAreaElement>('.room-says')!;
        says.value = 'for everyone here';
        body.querySelector<HTMLButtonElement>('.room-send')!.click();
        await settled();
        expect(log).toEqual(['post for everyone here']);
        stop();
    });

    test('who is addressed is each agent of the room named after an @, and no other word', () => {
        expect(addressed('@node-claude @node-codex, look', [claude, codex]).map(a => a.name)).toEqual(['node-claude', 'node-codex']);
        expect(addressed('@nobody is here', [claude, codex])).toEqual([]);
        expect(addressed('mail me at a@b.c', [claude, codex])).toEqual([]);
    });

    test('the agent a room agent is: the Node Room holds the Node Agent, a namespace room its agent, a purpose room none the page knows', async () => {
        const { reachableOf } = await import('./rooms-element');
        expect(reachableOf(nodeRoom, claude)?.at).toBe('/api/agent');
        expect(reachableOf({ ...nodeRoom, of: { namespace: 'pond' } }, claude)?.at).toBe('/api/agents/pond');
        expect(reachableOf({ ...nodeRoom, of: { element: 'db-element' } }, claude)?.at).toBe('/api/elements/db-element');
        expect(reachableOf({ ...nodeRoom, of: { purpose: 'deployment' } }, claude)).toBeUndefined();
    });

    test('a reach and what a room is of are said in words', () => {
        expect(reachSaid({ agent: claude, reach: 'ROOM_REACH_ARRIVES' })).toBe('arrives for node-claude');
        expect(reachSaid({ agent: codex, reach: 'ROOM_REACH_WAITS' })).toBe('waits for node-codex to read the room');
        expect(ofSaid({ namespace: 'pond' })).toBe('the room of pond');
        expect(ofSaid({ purpose: 'deployment' })).toBe('the deployment room');
        const row = messageRow({ id: 'm', room: 'r', sender: 's', sender_name: 'node-claude', agent: claude, body: 'done', thread: '', at: '' });
        expect(row.dataset.agent).toBe('node-claude');
        expect(row.classList.contains('chat-said')).toBe(true);
    });
});
