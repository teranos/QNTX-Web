// The chat: an agent said to, and what it answers, as it answers it (drawClaude).
// "WHEN I AM IN A CHAT, I WANT A CHAT ONLY"
// "in terms of ui, this will be the Claude Element"
// What it is and why is ADR-048's; this draws what the claude signum answers.

import { declareSay, preventDrag } from '@teranos/elements';
import { apiJson } from './client';
import { log, SEG } from './logger.ts';
import { apiError, sacredEntry } from './components/sacred';
import { renderAssistant, renderChat, chatRow, chatText, toolUseShown, contextOf, atBottom, keepingBottom, jumpToBottom, scrollToBottom, type SessionRead } from './chat';
import { spark } from './claude-spark';
import { uploadFile } from './api/files';
import { backendPath } from './client/url';
import { bearing } from './client/session';

// Who the Node Agent is and how the node runs it (claude am).
export interface ClaudeAm {
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
    // Whether Claude Code says it is signed in, by claude login, and how.
    signed_in: boolean;
    auth_method: string;
    // Every model a turn can be said to answer with; a node from before it says none.
    models?: string[];
}

// What it answered (claude say).
export interface ClaudeSaid {
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

// What travels with the words: a picture, as the id /api/files gave it.
// > say being able to carry an image sounds usefull to me
export interface Carried {
    file_id?: string;
}

// One line of the turn's stream as the harness printed it (protocol.SessionEvent):
// the session while it runs, beside the transcript, which is it after the fact.
// > it doesnt stream in, only the [tool] and [mcp] pieces fly in.
export interface LiveEvent {
    kind: string;
    text: string;
    tool: string;
    tool_use_id: string;
    input?: string;
    raw?: string;
    at: string;
    mark: string;
}

// The node, as this element asks it.
export interface NodeAgent {
    am(): Promise<ClaudeAm>;
    say(says: string, mode: string, carried?: Carried, model?: string): Promise<ClaudeSaid>;
    read(): Promise<SessionRead | undefined>;
    // The turn going, each event as it lands, and ended when the node closes
    // it or nothing answers; what it gives back stops listening.
    live?(onEvent: (event: LiveEvent) => void, onEnd: () => void): () => void;
    // Stops the turn going, as a person stops it. Only an agent the node can stop has it.
    stop?(): Promise<ClaudeAm>;
}

/** The say body: harness, words, the mode when one is chosen, and what is carried. */
export function sayBody(says: string, mode: string, carried: Carried | undefined, model = ''): string {
    const body: Record<string, string> = { harness: 'claude', says };
    if (mode) body.permission_mode = mode;
    if (model) body.model = model;
    if (carried?.file_id) body.file_id = carried.file_id;
    return JSON.stringify(body);
}

/** An agent of ROOT's kind at its path: the Node Agent at /api/agent, an element at /api/elements/<id>. */
function agentAt(at: string): NodeAgent {
    return {
        am: () => apiJson<{ claude: ClaudeAm }>(`${at}?harness=claude`).then(is => is.claude),
        say: (says, mode, carried, model) => apiJson<{ claude: ClaudeSaid }>(`${at}/say`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: sayBody(says, mode, carried, model),
        }).then(said => said.claude),
        // Its one session, read whole wherever whoever reads it stands.
        read: () => apiJson<{ transcript: SessionRead }>(`${at}/session?harness=claude`)
            .then(answer => answer.transcript),
        // Server-sent events read off fetch, with the cookie every other call
        // carries: what EventSource does after a refusal is each browser's own,
        // and this is one thing in every browser. Nothing answers between turns
        // (404) and before the turn prints: that ends it, said in the console,
        // and whoever listens asks again.
        live: (onEvent, onEnd) => readLive(backendPath(`${at}/live?harness=claude`), onEvent, onEnd),
    };
}

/** Reads url as server-sent events until the node ends them or the reader stops; onEnd once, either way. */
export function readLive(url: string, onEvent: (event: LiveEvent) => void, onEnd: () => void): () => void {
    const stopping = new AbortController();
    let ended = false;
    const end = () => { if (!ended) { ended = true; onEnd(); } };
    fetch(url, { credentials: 'include', signal: stopping.signal, headers: bearing({ Accept: 'text/event-stream' }) })
        .then(async answer => {
            if (!answer.ok || !answer.body) {
                log.warn(SEG.ELEMENT, `[Claude] live: HTTP ${answer.status} ${(await answer.text()).slice(0, 200)}`);
                return;
            }
            const reader = answer.body.getReader();
            const utf8 = new TextDecoder();
            let held = '';
            for (;;) {
                const { value, done } = await reader.read();
                if (done) return;
                held += utf8.decode(value, { stream: true });
                // One event per blank line; each is its data line, and end is named.
                let cut = held.indexOf('\n\n');
                while (cut >= 0) {
                    const lines = held.slice(0, cut).split('\n');
                    held = held.slice(cut + 2);
                    const named = lines.find(line => line.startsWith('event: '))?.slice(7).trim() ?? '';
                    const data = lines.filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n');
                    if (named === 'end') return;
                    if (data) {
                        try { onEvent(JSON.parse(data) as LiveEvent); }
                        catch (err) { log.warn(SEG.ELEMENT, `[Claude] a live event did not parse: ${wordsOf(err)}`); }
                    }
                    cut = held.indexOf('\n\n');
                }
            }
        })
        .catch((err: unknown) => { if (!stopping.signal.aborted) log.warn(SEG.ELEMENT, `[Claude] live: ${wordsOf(err)}`); })
        .finally(end);
    return () => { stopping.abort(); end(); };
}

// The Node Agent in Claude Code, at the agent signum's path.
// "i want to be able to make it stop"
const theNode: NodeAgent = {
    ...agentAt('/api/agent'),
    stop: () => apiJson<{ claude: ClaudeAm }>('/api/agent/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ harness: 'claude' }),
    }).then(is => is.claude),
};

// > AGENT PER ELEMENT, EACH ELEMENT IS ITS OWN CONVERSATION

/** The element's own agent, at the elements signum's path (ADR-054). */
export function elementAgent(element: string): NodeAgent {
    return agentAt(`/api/elements/${encodeURIComponent(element)}`);
}

// What is said with a picture and no words.
const LOOK = 'Look at the picture.';

// "Being able to annotate and send a picture is of critical importance"
// The node takes a picture whose name says what its bytes are: one marked up on the phone is a JPEG.
const PICTURE_NAMES: Record<string, string> = {
    'image/png': 'said.png',
    'image/jpeg': 'said.jpg',
    'image/gif': 'said.gif',
    'image/webp': 'said.webp',
};

/** The picture as the node takes it: named for what it is. */
function pictureFile(picture: Blob): File {
    const type = picture.type || 'image/png';
    return new File([picture], PICTURE_NAMES[type] ?? `said.${type.split('/')[1] ?? 'png'}`, { type });
}

// How often a turn that is going is read again.
const FOLLOW_MS = 2000;

function part<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    el.className = className;
    return el;
}

function choice(value: string, label: string): HTMLOptionElement {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
}

function wordsOf(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/**
 * The Node Agent drawn into body: who it is, its session, and where something
 * is said to it. What it gives back stops reading a turn that is going.
 */
export function drawClaude(body: HTMLElement, node: NodeAgent = theNode, every: number = FOLLOW_MS, opening: { image?: Blob } = {}): () => void {
    const who = part('div', 'claude-who');
    who.textContent = 'Asking the node who answers…';
    const session = part('div', 'claude-session');
    // The turn going, as it is said: deltas as they land, each message whole
    // when it is, each tool as it is reached for. Emptied when the turn ends.
    const live = part('div', 'chat-live');
    // What was said while it answers, each said when the turn before it ends.
    // "i wish to be able to send multipl emessahes, like i do now, here in claude code, if you get me"
    const queued = part('div', 'chat-queued');
    // One conversation that scrolls: what was said, then what is being said, then what waits.
    const scroller = part('div', 'chat-scroll');
    scroller.append(session, live, queued);
    const status = part('div', 'claude-status');
    // The context the last message was answered on, in tokens.
    const context = part('span', 'claude-context');
    const denied = part('div', 'claude-denied');
    const failed = part('div', 'claude-failed');

    const mode = part('select', 'claude-mode');
    // "would like ability to pick model as well"
    const model = part('select', 'claude-model');
    model.hidden = true;
    const says = part('textarea', 'claude-says');
    says.rows = 2;
    says.placeholder = 'Say something to the Node Agent';
    const send = part('button', 'qntx-btn qntx-btn-small claude-send');
    // "I dont want to diverge from what industry is doing": a chat's buttons
    // are glyphs, as the Claude app's are and as the room's send is. The words
    // stay, for a reader and a hover.
    send.textContent = '→';
    send.setAttribute('aria-label', 'Say');
    send.title = 'Say';
    // > being able to attach an imagine whne in a mobile chat
    const pick = part('input', 'claude-pick');
    pick.type = 'file';
    pick.accept = 'image/*';
    pick.hidden = true;
    const attach = part('button', 'qntx-btn qntx-btn-small claude-attach');
    attach.textContent = '+';
    attach.setAttribute('aria-label', 'Picture');
    attach.title = 'Picture';
    const attached = part('div', 'claude-attached');
    const form = part('div', 'claude-say');
    form.append(mode, model, attach, pick, send, attached, says);
    // "the inputfield take up the entire bottom of the screen for chat elements like claude or pi"
    declareSay(says);
    // What is typed and pressed here is not a drag of the element.
    preventDrag(form);
    preventDrag(session);

    body.replaceChildren(who, scroller, status, denied, failed, form);

    let reading = '';
    let sending = false;
    let following: ReturnType<typeof setInterval> | null = null;
    let picture: Blob | null = null;
    let listening: (() => void) | null = null;
    let draft: HTMLElement | null = null;
    let drafted = '';
    // One thing said: its words, what was typed for them, its picture, the mode and model it was said in, and its row while it waits.
    interface Said { words: string; typed: string; picture: Blob | null; mode: string; model: string; row?: HTMLElement }
    const waiting: Said[] = [];
    // After a refusal, the box holds the first of what waits: it is said ahead of what waits behind it.
    let boxHoldsFirst = false;
    // Each read of the session in the order asked, and the latest drawn: one asked before it is not drawn over it.
    let readsAsked = 0;
    let readDrawn = 0;

    // "the sent button needs to change"
    // "into a stop button"
    // "like literally every ai app does"
    // While it answers, an empty box's button stops the turn; with words in
    // the box it says them, and they wait for the turn to end.
    let answeringNow = false;
    const stops = (): boolean => answeringNow && !!node.stop && !says.value.trim() && !picture;
    const showSend = () => {
        const stopping = stops();
        send.textContent = stopping ? '■' : '→';
        send.setAttribute('aria-label', stopping ? 'Stop' : 'Say');
        send.title = stopping ? 'Stop' : 'Say';
        send.classList.toggle('claude-stop', stopping);
    };
    says.addEventListener('input', showSend);


    // A row of the live view: the thing itself, with no speaker in front of it.
    // "i dont want [tool] [read] [write] etc. because im in a convo, i prefer to
    // just see the whole thing, including +/- diffs fly by"
    const liveRow = (kind: string, ...parts: Node[]): HTMLElement => {
        const row = chatRow(kind, ...parts);
        keepingBottom(scroller, () => live.appendChild(row));
        return row;
    };

    // What the stream says happened, drawn as it lands.
    const landed = (event: LiveEvent) => {
        switch (event.kind) {
            case 'delta':
                if (!draft) { draft = liveRow('said', part('span', 'chat-words')); drafted = ''; }
                drafted += event.text;
                keepingBottom(scroller, () => { draft!.querySelector('.chat-words')!.textContent = drafted; });
                return;
            case 'text': {
                // The message whole: the deltas it was said in are done.
                sayContext(contextOf(event.raw ?? ''));
                const row = draft ?? liveRow('said', part('span', 'chat-words'));
                keepingBottom(scroller, () => { row.querySelector('.chat-words')!.innerHTML = renderAssistant(event.text); });
                draft = null;
                return;
            }
            case 'thinking':
                draft = null;
                // A thinking block whose words are kept back is nothing to draw.
                if (event.text) liveRow('thought', chatText(event.text));
                return;
            case 'tool_use':
                draft = null;
                sayContext(contextOf(event.raw ?? ''));
                liveRow('did', toolUseShown(event.tool, event.input ?? ''));
                return;
            case 'tool_result':
                draft = null;
                if (event.text) liveRow('got', chatText(event.text));
                return;
            case 'ended':
            case 'failed':
                draft = null;
                return;
        }
    };

    // Listening to the turn going; asked again while it goes, since live
    // has nothing before the turn prints and nothing between turns.
    const listen = () => {
        if (listening || !node.live) return;
        listening = node.live(landed, () => {
            listening = null;
            if (sending || following) setTimeout(() => { if (sending || following) listen(); }, 1000);
        });
    };

    // The picture to be said, shown until it is sent or let go of.
    const carry = (image: Blob | null) => {
        picture = image;
        showSend();
        attached.replaceChildren();
        if (!image) return;
        const shown = part('img', 'claude-picture');
        shown.src = URL.createObjectURL(image);
        shown.alt = 'the picture to be said';
        shown.addEventListener('load', () => URL.revokeObjectURL(shown.src));
        const drop = part('button', 'qntx-btn qntx-btn-small claude-drop');
        drop.textContent = '×';
        drop.setAttribute('aria-label', 'Without it');
        drop.title = 'Without it';
        drop.addEventListener('click', () => carry(null));
        attached.append(shown, drop);
    };
    attach.addEventListener('click', () => pick.click());
    pick.addEventListener('change', () => {
        const chosen = pick.files?.[0] ?? null;
        pick.value = '';
        if (chosen) carry(chosen);
    });
    if (opening.image) carry(opening.image);

    const fails = (what: string, err: unknown) => {
        const said = wordsOf(err);
        log.error(SEG.ELEMENT, `[Claude] ${what}: ${said}`);
        failed.replaceChildren(sacredEntry(apiError(`claude-${Date.now()}`, new Date().toISOString(), said, { surface: 'claude', region: what })));
    };

    const read = (): Promise<void> => {
        const asked = ++readsAsked;
        return node.read()
        .then(answer => {
            if (!answer || asked < readDrawn) return;
            readDrawn = asked;
            // The column is drawn anew: where it stood is read before, and a
            // reader at the bottom is kept there; one who scrolled up is not moved.
            const drawn = session.querySelector('.chat-col') !== null;
            const follow = !drawn || atBottom(scroller);
            const stood = scroller.scrollTop;
            renderChat(session, answer);
            if (!drawn) jumpToBottom(scroller); else if (follow) scrollToBottom(scroller); else scroller.scrollTop = stood;
        })
        .catch((err: unknown) => fails('read', err));
    };

    // "CHAT MUST HAVE SOMETHING THAT ANIMATES"
    // "SO YOU KNOW THE SYSTEM IS THINKING"
    const sayContext = (tokens: number) => {
        if (tokens > 0) context.textContent = `${Math.round(tokens / 1000)}k of context`;
    };
    // A turn the person stopped is no refusal: what it was said with is not said again.
    let stoppedByThePerson = false;

    // A row of what waits to be said.
    // "WHEN I PRESS ON THE PENDING MESSAGE AGAIN, IT IS SAYING, SEND NOW? AND THEN YOU CLICK ON IT, AND YOU INTERRUPT AND SEND IT NOW"
    // Pressed, it asks; pressed again, the turn going is stopped and it is said next.
    const waits = (it: Said) => {
        const label = part('span', 'chat-waiting-said');
        label.textContent = 'waiting';
        it.row = chatRow('you', chatText(it.words), label);
        it.row.classList.add('chat-waiting');
        let asked = false;
        it.row.addEventListener('click', () => {
            if (!node.stop || !sending) return;
            if (!asked) { asked = true; label.textContent = 'send now?'; it.row!.classList.add('chat-send-now'); return; }
            const at = waiting.indexOf(it);
            if (at < 0) return;
            waiting.splice(at, 1);
            waiting.unshift(it);
            label.textContent = 'sending';
            stoppedByThePerson = true;
            node.stop().catch((err: unknown) => { stoppedByThePerson = false; label.textContent = 'waiting'; asked = false; fails('stop', err); });
        });
        keepingBottom(scroller, () => queued.appendChild(it.row!));
    };

    const hold = (answering: boolean) => {
        answeringNow = answering;
        showSend();
        if (answering) { const said = part('span', 'claude-status-text'); said.textContent = 'answering…'; status.replaceChildren(spark(), said, context); }
        else status.replaceChildren(context);
    };

    const settle = () => {
        if (following) { clearInterval(following); following = null; }
        if (listening) { listening(); listening = null; }
        // The turn is in the session now, read whole: its rows of the live view are done once it is drawn,
        // and the rows of a turn said after it are that turn's.
        const done = Array.from(live.children);
        if (reading) void read().then(() => { for (const row of done) row.remove(); });
        else live.replaceChildren();
        draft = null;
        hold(false);
    };

    // A turn that is going is read again and again until the node says it ended.
    const follow = () => {
        if (following) return;
        listen();
        following = setInterval(() => {
            node.am()
                .then(is => {
                    // With live in hand the turn is drawn as it goes; the session is read once it ended.
                    if (is.session) { reading = is.session; if (!node.live) void read(); }
                    if (is.answering) listen();
                    if (!is.answering && !sending) settle();
                })
                .catch((err: unknown) => { fails('follow', err); if (!sending) settle(); });
        }, every);
    };

    // One thing said, as one turn of the node's.
    const sayIt = (it: Said) => {
        sending = true;
        hold(true);
        failed.replaceChildren();
        denied.textContent = '';
        // Your words, at once, where the turn goes on from.
        if (node.live) liveRow('you', chatText(it.words));
        follow();
        // The picture goes up first, as a file of the node's; what comes back names it to say.
        const carries: Promise<Carried | undefined> = it.picture
            ? uploadFile(pictureFile(it.picture)).then(stored => ({ file_id: stored.id }))
            : Promise.resolve(undefined);
        carries
            .then(carried => node.say(it.words, it.mode, carried, it.model))
            .then(answer => {
                reading = answer.session;
                if (answer.denied.length > 0) denied.textContent = `It reached for ${answer.denied.join(', ')} and was not allowed.`;
                if (answer.unwritten) fails('session', new Error(`a row of the session was not written down: ${answer.unwritten}`));
                return read();
            })
            .then(() => {
                stoppedByThePerson = false;
                sending = false;
                settle();
                const next = waiting.shift();
                if (next) { next.row?.remove(); sayIt(next); }
            }, (err: unknown) => {
                // Stopped by the person: the turn ended as they asked, and what waits is said.
                if (stoppedByThePerson) {
                    stoppedByThePerson = false;
                    sending = false;
                    settle();
                    const next = waiting.shift();
                    if (next) { next.row?.remove(); sayIt(next); }
                    return;
                }
                fails('say', err);
                // A refusal does not cost the words, nor the picture they were said with: what was
                // refused waits again ahead of what waited behind it, and none of it is said until Say.
                waits(it);
                for (const one of waiting) queued.appendChild(one.row!);
                waiting.unshift(it);
                // An empty box takes it back, as it was typed, to be said again or changed.
                if (!says.value.trim() && !picture) {
                    waiting.shift();
                    it.row!.remove();
                    says.value = it.typed;
                    carry(it.picture);
                    boxHoldsFirst = true;
                }
                sending = false;
                settle();
            });
    };

    const sendIt = () => {
        if (sending) { const it = typedIn(); if (it) { waits(it); waiting.push(it); } return; }
        const it = typedIn();
        // What the box holds goes ahead of what waits only when it is the first of it.
        if (it && (boxHoldsFirst || waiting.length === 0)) { boxHoldsFirst = false; sayIt(it); return; }
        if (it) { waits(it); waiting.push(it); }
        boxHoldsFirst = false;
        const next = waiting.shift();
        if (next) { next.row?.remove(); sayIt(next); }
    };

    // What is in the box, taken out of it to be said.
    const typedIn = (): Said | null => {
        const words = says.value.trim() || (picture ? LOOK : '');
        if (!words) return null;
        const it: Said = { words, typed: says.value.trim(), picture, mode: mode.value, model: model.hidden ? '' : model.value };
        // "kinda buggy still is, the text linger even after i sent it": said is out of the box.
        says.value = '';
        carry(null);
        return it;
    };
    const stopIt = () => {
        send.disabled = true;
        failed.replaceChildren();
        stoppedByThePerson = true;
        node.stop!()
            .then(is => { if (!is.answering && !sending) settle(); })
            .catch((err: unknown) => { stoppedByThePerson = false; fails('stop', err); })
            .finally(() => { send.disabled = false; });
    };
    send.addEventListener('click', () => { if (stops()) stopIt(); else sendIt(); });
    says.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendIt(); }
    });

    node.am()
        .then(is => {
            // "No need to show did key to user"
            who.textContent = [is.model, is.effort, is.not_ready].filter(Boolean).join('  ');
            // The titlebar is the element's one head: who answers is said here only when it could not be asked.
            who.hidden = !is.not_ready;
            // A harness with no permission modes, Pi, has nothing to choose here.
            mode.hidden = is.permission_modes.length === 0;
            // "claude element 'dontask' doesnt make sense there"
            const offered = is.permission_modes.filter(name => name !== 'dontAsk');
            // am.toml that gives no mode, or one not offered here (dontAsk), leaves the choice here,
            // and none is made for the speaker: what is said runs in the node's own. Without this
            // the choice showed nothing at all.
            const ownMode = offered.includes(is.permission_mode) ? is.permission_mode : '';
            if (!ownMode && !mode.hidden) mode.appendChild(choice('', 'permission mode'));
            for (const name of offered) mode.appendChild(choice(name, name));
            mode.value = ownMode;
            const models = is.models ?? [];
            model.hidden = models.length === 0;
            for (const name of models) model.appendChild(choice(name, name));
            model.value = models.includes(is.model) ? is.model : (models[0] ?? '');
            reading = is.session;
            if (reading) void read();
            else session.textContent = 'Nothing has been said to it yet.';
            if (is.answering) { hold(true); follow(); }
        })
        .catch((err: unknown) => {
            who.textContent = wordsOf(err);
            send.disabled = true;
            log.warn(SEG.ELEMENT, `[Claude] the node did not say who answers: ${wordsOf(err)}`);
        });

    return settle;
}

