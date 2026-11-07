// Rooms Element — the rooms this node's agents are in (ADR-057), each a board
// that people and agents write on. Rooms is a level of the sidebar, as Agents
// is; a room opens from its row.

// ADR-057:
// "shared message board"
// "Say you can wake a specific Agent so it will check the room"

// "rooms will be plugin provided"
// "i want all Node Agents to be in the Node Room"
// "instead of 'say'i want a right arrow > glyph"
// "the prose can be removed, think about mobile usage of this feature"
// "and the send needs to be right side"
// "and clicking once on the agent needs to also highlight it in the ui. clicking on the highlighted Agent will open its own Agent element"
// "round send button"

// Story 200:
// "i open leftside bar"
// "i open Rooms Element"
// "I open a specific Room, like the Node Room"
// "the Node Room Element"
// "here i see what it's connected to and what Agents are in it"
// "i press on an Agent"
// "`@agent_name` appears in inputfield and i can type something."
// "i press send."
// "the message get's to the Agent via the room and the Agent can put something back into the room."

import { declareSay, preventDrag, tray } from '@teranos/elements';
import { restLevelInSidebar, enterLevel, levelRow } from './sidebar.ts';
import { apiJson } from './client';
import { log, SEG } from './logger.ts';
import { Room as RoomSymbol } from './sym';
import { chatRow, chatText, renderAssistant, when, atBottom, jumpToBottom, scrollToBottom } from './chat';
import { errorOf } from './node-connectors-element';
import { openAgentChat, type Reachable } from './agents-element';
import type { ClaudeAm } from './claude-element';

export const LEVEL_ID = 'rooms';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const PHONE = '(max-width: 768px)';
// How often an open room is read again, so what an agent puts back into it arrives.
const FOLLOW_MS = 3000;

// ── rooms.proto, as the page reads it (QNTX plugin/grpc/protocol/rooms.proto) ──

/** RoomAgent: an agent as a room holds it. */
export interface RoomAgent { did: string; harness: string; name: string }
/** RoomOf: what a room is of. */
export interface RoomOf { node?: string; namespace?: string; element?: string; purpose?: string }
/** Room: one room. */
export interface Room { id: string; provider: string; name: string; description: string; instructions: string; of?: RoomOf; connected?: string }
/** RoomMessage: one thing said in a room. agent is unset when nobody the provider holds as a RoomAgent said it. */
export interface RoomMessage { id: string; room: string; sender: string; sender_name: string; agent?: RoomAgent | null; body: string; thread: string; at: string }
/** RoomJoined: someone arriving in a room. */
export interface RoomJoined { room: string; member: string; member_name: string; agent?: RoomAgent | null; at: string }
/** ReadRoomResponse. */
export interface RoomRead { messages: RoomMessage[]; joined: RoomJoined[]; truncated: boolean }
/**
 * GetRoomResponse. What the room is connected to beyond its provider is the
 * room's own `connected` (rooms.proto Room.connected): a Telegram group, say.
 */
export interface RoomDetail { room: Room; agents: RoomAgent[] }
/** RoomWoken: what the provider says of one agent a wake named; reach is ROOM_REACH_ARRIVES, _WAITS or _DECLINED. */
export interface RoomWoken { agent: RoomAgent; reach: string }
/** WakeInRoomResponse. */
export interface Woke { id: string; woken: RoomWoken[] }

/** The node, as this element asks it of rooms. */
export interface Rooms {
    list(): Promise<Room[]>;
    get(room: Room): Promise<RoomDetail>;
    read(room: Room): Promise<RoomRead>;
    post(room: Room, body: string): Promise<{ id: string }>;
    wake(room: Room, agents: RoomAgent[], says: string): Promise<Woke>;
}

const at = (room: Room, rest = '') => `/api/rooms/${encodeURIComponent(room.id)}${rest}?provider=${encodeURIComponent(room.provider)}`;

/** The rooms signum's paths, mirroring rooms.proto's calls, each naming the provider the room is held by. */
export const theRooms: Rooms = {
    list: () => apiJson<{ list: Room[] }>('/api/rooms').then(answer => answer.list ?? []),
    get: room => apiJson<RoomDetail>(at(room)),
    read: room => apiJson<RoomRead>(at(room, '/read')),
    post: (room, body) => apiJson<{ id: string }>(at(room, '/post'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ provider: room.provider, room: room.id, body }) }),
    wake: (room, agents, says) => apiJson<Woke>(at(room, '/wake'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ provider: room.provider, room: room.id, agents: agents.map(agent => agent.name).join(','), says }) }),
};

function part<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    el.className = className;
    return el;
}

function wordsOf(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/** What a room is of, in words. */
export function ofSaid(of: RoomOf | undefined): string {
    if (!of) return '';
    if (of.node) return 'the Node Room';
    if (of.namespace) return `the room of ${of.namespace}`;
    if (of.element) return `the room of the ${of.element} element`;
    if (of.purpose) return `the ${of.purpose} room`;
    return '';
}

/** The agents of the room that words address, by their name after an @: the ones a send wakes. */
export function addressed(words: string, agents: RoomAgent[]): RoomAgent[] {
    const named = new Set<string>();
    for (const word of words.split(/\s+/)) {
        if (word.startsWith('@') && word.length > 1) named.add(word.slice(1).replace(/[.,;:!?]+$/, ''));
    }
    return agents.filter(agent => named.has(agent.name));
}

/** What a wake's reach says, in words. */
export function reachSaid(woken: RoomWoken): string {
    switch (woken.reach) {
        case 'ROOM_REACH_ARRIVES': return `arrives for ${woken.agent.name}`;
        case 'ROOM_REACH_WAITS': return `waits for ${woken.agent.name} to read the room`;
        case 'ROOM_REACH_DECLINED': return `${woken.agent.name} is not addressed by this sender, the provider says`;
    }
    return `${woken.agent.name}: ${woken.reach}`;
}

/**
 * The agent a room agent is, as this page reaches it: a RoomAgent names a DID
 * and a harness, and what the page reaches is an agent at a path (Reachable).
 * The room says which: the Node Room holds the Node Agents, a namespace's room
 * its agent, an element's room its element's. A purpose room names no agent
 * the page knows a path for.
 */
export function reachableOf(room: Room, agent: RoomAgent): Reachable | undefined {
    const of = room.of ?? {};
    if (of.node) return { id: 'node', called: 'Node Agent', at: '/api/agent', kind: 'node' };
    if (of.namespace) {
        const namespace = of.namespace;
        return { id: `namespace:${namespace}`, called: `the agent of ${namespace}`, at: `/api/agents/${encodeURIComponent(namespace)}`, kind: 'namespace',
            unwrap: a => ({ claude: (a as { agent?: ClaudeAm }).agent }) };
    }
    if (of.element) return { id: `element:${of.element}`, called: of.element, at: `/api/elements/${encodeURIComponent(of.element)}`, kind: 'element' };
    log.info(SEG.ELEMENT, `[Rooms] ${agent.name} in ${room.name}: the page knows no path to it`);
    return undefined;
}

/** Opens the agent's own element: its chat, as Agents opens it. */
export function openAgentOf(room: Room, agent: RoomAgent): void {
    const reached = reachableOf(room, agent);
    if (reached) openAgentChat(reached);
}

/** One thing said in the room, as the board shows it: who said it, then what. */
export function messageRow(message: RoomMessage): HTMLElement {
    const who = part('span', 'room-sender');
    who.textContent = message.sender_name || message.sender;
    const words = part('span', 'chat-words');
    if (message.agent) words.innerHTML = renderAssistant(message.body);
    else words.append(chatText(message.body));
    const row = chatRow(message.agent ? 'said' : 'you', who, words);
    row.classList.add('room-row');
    row.dataset.message = message.id;
    if (message.agent) row.dataset.agent = message.agent.name;
    return row;
}

/**
 * One room drawn into body: what it is connected to, the agents in it, the
 * board, and where something is said into it. What it gives back stops reading.
 */
export function drawRoom(body: HTMLElement, room: Room, rooms: Rooms = theRooms, every: number = FOLLOW_MS, open: (room: Room, agent: RoomAgent) => void = openAgentOf): () => void {
    const connected = part('div', 'room-connected');
    connected.textContent = 'Asking the node about the room…';
    const agents = part('div', 'room-agents');
    const board = part('div', 'room-board');
    const scroller = part('div', 'chat-scroll room-scroll');
    scroller.append(board);
    const reach = part('div', 'room-reach');
    const failed = part('div', 'room-failed');
    const says = part('textarea', 'room-says');
    says.rows = 2;
    says.placeholder = `Say something in ${room.name}`;
    // "instead of 'say' i want a right arrow > glyph"
    const send = part('button', 'qntx-btn qntx-btn-small room-send');
    send.type = 'button';
    send.textContent = '→';
    send.setAttribute('aria-label', 'Say');
    send.title = 'Say';
    const form = part('div', 'room-say');
    form.append(says, send);
    declareSay(says);
    preventDrag(form);
    preventDrag(board);
    body.replaceChildren(connected, agents, scroller, reach, failed, form);

    let held: RoomAgent[] = [];
    let following: ReturnType<typeof setInterval> | null = null;
    let gone = false;
    let drawnIds = '';

    const fails = (what: string, err: unknown) => {
        log.error(SEG.ELEMENT, `[Rooms] ${room.name} ${what}: ${wordsOf(err)}`);
        failed.replaceChildren(errorOf(`${what}: ${wordsOf(err)}`));
    };

    // Pressing an agent addresses it: its name after an @ goes into the box, and the box is where to type.
    const address = (agent: RoomAgent) => {
        const mention = `@${agent.name}`;
        if (!says.value.split(/\s+/).includes(mention)) {
            says.value = says.value.trim() ? `${says.value.trimEnd()} ${mention} ` : `${mention} `;
        }
        says.focus();
    };

    const read = () => rooms.read(room).then(answer => {
        if (gone) return;
        const ids = answer.messages.map(m => m.id).join(',') + '|' + answer.joined.map(j => `${j.member}@${j.at}`).join(',');
        if (ids === drawnIds) return;
        drawnIds = ids;
        const drawn = board.childElementCount > 0;
        const follow = !drawn || atBottom(scroller);
        const stood = scroller.scrollTop;
        const rows: Array<{ at: string; row: HTMLElement }> = [];
        if (answer.truncated) rows.push({ at: '', row: chatRow('marker', chatText('older than this was not answered: the board read is not the whole board')) });
        for (const joined of answer.joined) rows.push({ at: joined.at, row: chatRow('marker', chatText(`${joined.member_name || joined.member} arrived  ${when(joined.at)}`)) });
        for (const message of answer.messages) rows.push({ at: message.at, row: messageRow(message) });
        rows.sort((a, b) => a.at.localeCompare(b.at));
        board.replaceChildren(...rows.map(r => r.row));
        if (answer.messages.length === 0 && answer.joined.length === 0) board.append(chatRow('marker', chatText('Nothing has been said here yet.')));
        if (!drawn) jumpToBottom(scroller); else if (follow) scrollToBottom(scroller); else scroller.scrollTop = stood;
    }).catch((err: unknown) => { if (!gone) fails('read', err); });

    // Addressed to agents, what is said wakes them; addressed to nobody, it stands on the board for everyone.
    const sendIt = () => {
        const words = says.value.trim();
        if (!words) return;
        says.value = '';
        failed.replaceChildren();
        reach.replaceChildren();
        const woken = addressed(words, held);
        const said: Promise<unknown> = woken.length > 0
            ? rooms.wake(room, woken, words).then(answer => {
                for (const each of answer.woken) {
                    const line = part('div', 'room-reach-line');
                    line.dataset.reach = each.reach;
                    line.textContent = reachSaid(each);
                    reach.append(line);
                }
            })
            : rooms.post(room, words);
        said.then(read).catch((err: unknown) => {
            fails('say', err);
            // A refusal does not cost the words: they go back in the box.
            if (!says.value.trim()) says.value = words;
        });
    };
    send.addEventListener('click', sendIt);
    says.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendIt(); }
    });

    rooms.get(room).then(detail => {
        if (gone) return;
        held = detail.agents;
        // The room's name is the window's title; this line says only what it is connected to (Room.connected).
        const to = detail.room.connected ?? '';
        connected.textContent = to ? `connected to ${to}` : 'connected to nothing';
        connected.title = [ofSaid(detail.room.of), detail.room.description].filter(Boolean).join('  ');
        connected.dataset.connected = to ? '1' : '0';
        agents.replaceChildren();
        if (held.length === 0) {
            const none = part('span', 'room-no-agents');
            none.textContent = 'No agent is in this room.';
            agents.append(none);
        }
        for (const agent of held) {
            const press = part('button', 'qntx-btn qntx-btn-small room-agent');
            press.type = 'button';
            press.dataset.agent = agent.name;
            press.dataset.harness = agent.harness;
            press.textContent = agent.harness ? `${agent.name}  ${agent.harness}` : agent.name;
            // Pressed once: highlighted, and addressed. Pressed while highlighted: its own element opens.
            press.addEventListener('click', () => {
                if (press.classList.contains('room-agent-on')) { open(detail.room, agent); return; }
                for (const each of agents.querySelectorAll('.room-agent')) each.classList.toggle('room-agent-on', each === press);
                address(agent);
            });
            agents.append(press);
        }
        preventDrag(agents);
    }).catch((err: unknown) => { if (!gone) { connected.textContent = wordsOf(err); send.disabled = true; } });

    void read();
    following = setInterval(() => { void read(); }, every);

    return () => {
        gone = true;
        if (following) { clearInterval(following); following = null; }
    };
}

/** Where a room rests in the tray. */
export function roomIdOf(room: Room): string {
    return `room:${room.id}`;
}

/** Opens a room: a window on a desktop, the screen on a phone, as a chat is. */
export function openRoom(room: Room, rooms: Rooms = theRooms): void {
    const id = roomIdOf(room);
    if (!tray.has(id)) {
        tray.add({
            id,
            title: room.name,
            symbol: RoomSymbol,
            opensAs: window.matchMedia?.(PHONE).matches ? 'panel' : 'window',
            opensAt: 'end',
            renderContent: () => {
                const body = part('div', 'content-area chat room');
                drawRoom(body, room, rooms);
                return body;
            },
        });
    }
    tray.open(id);
}

/** Every room listed, as rows of the Rooms level of the sidebar; pressing one opens it. */
export function fillRoomsLevel(into: HTMLElement, rooms: Promise<Room[]>, open: (room: Room) => void = room => openRoom(room)): void {
    const waiting = part('div', 'sidebar-level-note');
    waiting.textContent = 'Asking the node which rooms there are…';
    into.appendChild(waiting);
    rooms.then(found => {
        waiting.remove();
        if (found.length === 0) { waiting.textContent = 'There is no room here.'; into.appendChild(waiting); return; }
        for (const room of found) {
            const row = levelRow(into, { id: `room:${room.id}`, title: room.name, symbol: RoomSymbol }, () => {
                for (const each of into.querySelectorAll('.sidebar-level-row')) each.classList.toggle('sidebar-row-on', each === row);
                open(room);
            });
            row.classList.add('rooms-row');
            row.dataset.provider = room.provider;
        }
    }).catch((err: unknown) => {
        waiting.textContent = wordsOf(err);
        into.appendChild(waiting);
    });
}

// Who this is for: whoever reaches the rooms, and that is ROOT (the rooms signum's line).
export const needs = ['/api/rooms'] as const;

/** Rooms rests in the sidebar as a level: its row opens the rooms listed, each a row that opens the room. */
export function restRoomsInSidebar(rooms: () => Promise<Room[]> = () => theRooms.list()): void {
    restLevelInSidebar({ id: LEVEL_ID, title: 'Rooms', symbol: RoomSymbol }, into => fillRoomsLevel(into, rooms()));
}

/** Opens the Rooms level of the sidebar. */
export function openRoomsElement(): void {
    enterLevel({ id: LEVEL_ID, title: 'Rooms', symbol: RoomSymbol }, into => fillRoomsLevel(into, theRooms.list()));
}
