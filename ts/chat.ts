// Chat — a conversation with an agent, and nothing else.
// "I WANT A CHAT, I DONT WANT A READER"
// "WHEN I AM IN A CHAT, I WANT A CHAT ONLY"
// "ONLY CHAT FROM NOW ON"

import { apiError, sacredEntry } from './components/sacred';

// One thing said or done in a session (protocol.Turn).
export interface Turn {
    at: string;
    speaker: string;
    text: string;
    of: string;
}

// One session as the node answers it (protocol.Transcript).
export interface SessionRead {
    session: string;
    subjects: string[];
    started: string;
    ended: string;
    turns: Turn[];
    folded: number;
    model: string;
    effort: string;
}

/** A moment, as a chat says one. */
export function when(at: string): string {
    const d = new Date(Date.parse(at));
    return d.toLocaleString('en', { month: 'short' }) + ' ' + d.getDate() + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function between(text: string, mark: string, open: string, close: string): string {
    let out = '';
    let pos = 0;
    while (pos < text.length) {
        const start = text.indexOf(mark, pos);
        if (start < 0) { out += text.substring(pos); break; }
        const end = text.indexOf(mark, start + mark.length);
        if (end < 0) { out += text.substring(pos); break; }
        out += text.substring(pos, start) + open + text.substring(start + mark.length, end) + close;
        pos = end + mark.length;
    }
    return out;
}

/** Minimal markdown for what the agent said: code blocks, bold, inline code. */
export function renderAssistant(text: string): string {
    let out = '';
    let inCode = false;
    for (const line of text.split('\n')) {
        if (line.startsWith('```')) {
            out += inCode ? '</code></pre>' : '<pre class="chat-code"><code>';
            inCode = !inCode;
            continue;
        }
        if (inCode) { out += escapeHtml(line) + '\n'; continue; }
        out += between(between(escapeHtml(line), '**', '<b>', '</b>'), '`', '<code class="chat-inline-code">', '</code>') + '\n';
    }
    if (inCode) out += '</code></pre>';
    return out;
}

function part<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    el.className = className;
    return el;
}

/** Plain text as the chat shows it, whole, wrapped. */
export function chatText(text: string): HTMLElement {
    const pre = part('pre', 'chat-text');
    pre.textContent = text;
    return pre;
}

/** One line of a diff: - for what was, + for what is. */
export function diffLine(sign: '-' | '+', text: string): HTMLElement {
    const line = part('div', sign === '-' ? 'chat-del' : 'chat-add');
    line.textContent = `${sign} ${text}`;
    return line;
}

// "[TOOL] NEEDS TO NOT EXIST, IT SHOULD JUST TELL ME WHAT IT DID"
/** What a tool did, in words: ran, edited, wrote, read, searched, or asked a server. */
export function didSay(kind: string, what: string): string {
    switch (kind) {
        case 'tool': return `$ ${what}`;
        case 'edit': return `edited ${what}`;
        case 'write': return `wrote ${what}`;
        case 'read': return `read ${what}`;
        case 'search': return `searched with ${what}`;
        case 'mcp': return `asked ${mcpSaid(what)}`;
    }
    return what;
}

/** mcp__server__tool as "server: tool". */
export function mcpSaid(tool: string): string {
    const parts = tool.split('__');
    return parts.length >= 3 ? `${parts[1]}: ${parts.slice(2).join('__')}` : tool;
}

/** A tool reached for, as the thing it does: the command, the edit as +/-, the file, or its input whole. */
export function toolUseShown(tool: string, input: string): HTMLElement {
    let sent: Record<string, unknown> = {};
    try { sent = input ? JSON.parse(input) as Record<string, unknown> : {}; } catch { /* shown whole below */ }
    const str = (key: string) => typeof sent[key] === 'string' ? sent[key] as string : '';
    const head = (text: string) => { const h = part('div', 'chat-head'); h.textContent = text; return h; };
    const out = part('pre', 'chat-tool');
    switch (tool.toLowerCase()) {
        case 'bash':
            out.textContent = `$ ${str('command')}`;
            return out;
        case 'edit':
            out.append(head(`edited ${str('file_path')}`));
            for (const line of str('old_string').split('\n')) out.append(diffLine('-', line));
            for (const line of str('new_string').split('\n')) out.append(diffLine('+', line));
            return out;
        case 'write':
            out.append(head(`wrote ${str('file_path')}`));
            for (const line of str('content').split('\n')) out.append(diffLine('+', line));
            return out;
        case 'read':
            out.textContent = `read ${str('file_path')}`;
            return out;
        case 'grep':
        case 'glob': {
            const where = str('path') ? ` in ${str('path')}` : '';
            out.textContent = `searched ${str('pattern')}${where}`;
            return out;
        }
    }
    out.append(head(tool.startsWith('mcp__') ? `asked ${mcpSaid(tool)}` : tool));
    out.append(chatText(Object.keys(sent).length ? JSON.stringify(sent, null, 2) : input));
    return out;
}

/** A row of the chat: the thing itself, with no speaker in front of it. */
export function chatRow(kind: string, ...parts: Node[]): HTMLElement {
    const row = part('div', `chat-row chat-${kind}`);
    row.append(...parts);
    return row;
}

/** One turn of a session, as the chat shows it. */
export function turnRow(turn: Turn): HTMLElement {
    switch (turn.speaker) {
        case 'human':
        case 'person':
            return chatRow('you', chatText(turn.text));
        case 'assistant':
        case 'agent': {
            const said = part('span', 'chat-words');
            said.innerHTML = renderAssistant(turn.text);
            return chatRow('said', said);
        }
        case 'tool':
        case 'edit':
        case 'write':
        case 'read':
        case 'search':
        case 'mcp': {
            // The node keeps of a tool its command or its path (server/transcripts.go).
            const did = part('pre', 'chat-tool');
            did.textContent = didSay(turn.speaker, turn.text);
            return chatRow('did', did);
        }
        case 'error':
            return chatRow('error', sacredEntry(apiError(turn.of, turn.at, turn.text, { surface: 'chat', region: turn.of })));
        case 'session':
            // The harness starting or resuming is its business, not the conversation's.
            return chatRow('nothing');
        case 'compaction':
            return chatRow('marker', chatText('the context was compacted here'));
    }
    // agent, task, rite, ground: a marker, small and quiet.
    return chatRow('marker', chatText(`${turn.speaker}: ${turn.text}`));
}

// "TIMESPACING WE DONT NEED IT HERE INT HE CHAT"
// "JUST NEEDS TO SAY WHEN WE LAST TALKED"
const A_WHILE_MS = 60 * 60 * 1000;

/** When we last talked, said once at the top when it has been a while; empty otherwise. */
export function lastTalked(read: SessionRead, now = Date.now()): string {
    const last = read.turns.length ? read.turns[read.turns.length - 1]!.at : read.ended;
    const ms = Date.parse(last);
    if (!Number.isFinite(ms) || now - ms < A_WHILE_MS) return '';
    return `last talked ${when(last)}`;
}

// "AND HOW CLOSE WE ARE TO COMPACTION"
/** The context a message was answered on, in tokens, read from the harness's own line; 0 when it says none. */
export function contextOf(raw: string): number {
    try {
        const m = JSON.parse(raw) as { message?: { usage?: Record<string, number> } };
        const u = m.message?.usage;
        if (!u) return 0;
        return (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    } catch { return 0; }
}

/** Whether a scrolling box is at its bottom. A reader who scrolled up is reading, and is left there. */
export function atBottom(box: HTMLElement): boolean {
    return box.scrollHeight - box.scrollTop - box.clientHeight < 8;
}

/** Runs change, and keeps box at its bottom when it was there before. */
export function keepingBottom(box: HTMLElement, change: () => void): void {
    const follow = atBottom(box);
    change();
    if (follow) scrollToBottom(box);
}

// "THINGS NEED TO SCROLL"
// "AND NOT JUST TELEPORT INTO PLACE"
/** Scrolls box to its bottom, moving there where the browser can. */
export function scrollToBottom(box: HTMLElement): void {
    if (typeof box.scrollTo === 'function') box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    else box.scrollTop = box.scrollHeight;
}

/** The session drawn into body as the chat: every turn in order, what was folded counted. */
export function renderChat(body: HTMLElement, read: SessionRead): void {
    const column = part('div', 'chat-col');
    const ago = lastTalked(read);
    if (ago) column.append(chatRow('marker', chatText(ago)));
    if (read.folded > 0) column.append(chatRow('marker', chatText(`${read.folded} earlier events folded by the store`)));
    for (const turn of read.turns) {
        const row = turnRow(turn);
        if (!row.classList.contains('chat-nothing')) column.append(row);
    }
    body.replaceChildren(column);
}
