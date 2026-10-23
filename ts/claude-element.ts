// Claude Element — the Node Agent: said to, and read as the session it continues.
// "in terms of ui, this will be the Claude Element"
// What it is and why is ADR-048's; this draws what the claude signum answers.

import type { Element } from '@teranos/elements';
import { declareSay, preventDrag } from '@teranos/elements';
import { openElement } from './sidebar.ts';
import { apiJson } from './client';
import { log, SEG } from './logger.ts';
import { Claude } from './sym';
import { spark } from './claude-spark';
import { apiError, sacredEntry } from './components/sacred';
import { renderTranscript, type TranscriptRead } from './components/element/transcript-element';
import { uploadFile } from './api/files';

const ELEMENT_ID = 'claude-element';

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

// The node, as this element asks it.
export interface NodeAgent {
    am(): Promise<ClaudeAm>;
    say(says: string, mode: string, carried?: Carried): Promise<ClaudeSaid>;
    read(): Promise<TranscriptRead | undefined>;
}

/** The say body: harness, words, the mode when one is chosen, what is carried, and the element when the talk is one element's. */
export function sayBody(says: string, mode: string, carried: Carried | undefined, element: string): string {
    const body: Record<string, string> = { harness: 'claude', says };
    if (mode) body.permission_mode = mode;
    if (carried?.file_id) body.file_id = carried.file_id;
    if (element) body.element = element;
    return JSON.stringify(body);
}

/** `?harness=claude`, and the element when the session read is one element's. */
export function askOf(element: string): string {
    return element ? `?harness=claude&element=${encodeURIComponent(element)}` : '?harness=claude';
}

// The Node Agent in Claude Code, at the agent signum's path. Given an element,
// the talk is that element's own session with it.
// > each element is an agent as well, we default to claude
export function theNodeFor(element = ''): NodeAgent {
    return {
        am: () => apiJson<{ claude: ClaudeAm }>(`/api/agent${askOf(element)}`).then(is => is.claude),
        say: (says, mode, carried) => apiJson<{ claude: ClaudeSaid }>('/api/agent/say', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: sayBody(says, mode, carried, element),
        }).then(said => said.claude),
        // Its one session, read whole wherever whoever reads it stands.
        read: () => apiJson<{ transcript: TranscriptRead }>(`/api/agent/session${askOf(element)}`)
            .then(answer => answer.transcript),
    };
}

const theNode: NodeAgent = theNodeFor();

// What is said with a picture and no words.
const LOOK = 'Look at the picture.';

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
    const session = part('div', 'claude-session tr');
    const status = part('div', 'claude-status');
    const denied = part('div', 'claude-denied');
    const failed = part('div', 'claude-failed');

    const mode = part('select', 'claude-mode');
    mode.title = 'The permission mode Claude Code runs this turn in';
    const says = part('textarea', 'claude-says');
    says.rows = 2;
    says.placeholder = 'Say something to the Node Agent';
    const send = part('button', 'qntx-btn qntx-btn-small claude-send');
    send.textContent = 'Say';
    // > being able to attach an imagine whne in a mobile chat
    const pick = part('input', 'claude-pick');
    pick.type = 'file';
    pick.accept = 'image/*';
    pick.hidden = true;
    const attach = part('button', 'qntx-btn qntx-btn-small claude-attach');
    attach.textContent = 'Picture';
    attach.title = 'A picture said with the words';
    const attached = part('div', 'claude-attached');
    const form = part('div', 'claude-say');
    form.append(mode, attach, pick, send, attached, says);
    // "the inputfield take up the entire bottom of the screen for chat elements like claude or pi"
    declareSay(says);
    // What is typed and pressed here is not a drag of the element.
    preventDrag(form);
    preventDrag(session);

    body.replaceChildren(who, session, status, denied, failed, form);

    let reading = '';
    let sending = false;
    let following: ReturnType<typeof setInterval> | null = null;
    let picture: Blob | null = null;

    // The picture to be said, shown until it is sent or let go of.
    const carry = (image: Blob | null) => {
        picture = image;
        attached.replaceChildren();
        if (!image) return;
        const shown = part('img', 'claude-picture');
        shown.src = URL.createObjectURL(image);
        shown.alt = 'the picture to be said';
        shown.addEventListener('load', () => URL.revokeObjectURL(shown.src));
        const drop = part('button', 'qntx-btn qntx-btn-small claude-drop');
        drop.textContent = 'Without it';
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

    const read = (): Promise<void> => node.read()
        .then(answer => {
            if (!answer) return;
            renderTranscript(session, answer, (text) => {
                navigator.clipboard.writeText(text).catch((err: unknown) => fails('copy', err));
            });
            // What was said last is what is looked at.
            const column = session.querySelector<HTMLElement>('.tr-col');
            if (column) column.scrollTop = column.scrollHeight;
        })
        .catch((err: unknown) => fails('read', err));

    const hold = (answering: boolean) => {
        send.disabled = answering;
        status.textContent = answering ? 'answering…' : '';
    };

    const settle = () => {
        if (following) { clearInterval(following); following = null; }
        hold(false);
    };

    // A turn that is going is read again and again until the node says it ended.
    const follow = () => {
        if (following) return;
        following = setInterval(() => {
            node.am()
                .then(is => {
                    if (is.session) { reading = is.session; void read(); }
                    if (!is.answering && !sending) settle();
                })
                .catch((err: unknown) => { fails('follow', err); if (!sending) settle(); });
        }, every);
    };

    // The picture goes up first, as a file of the node's; what comes back names it to say.
    const carried = (): Promise<Carried | undefined> => {
        if (!picture) return Promise.resolve(undefined);
        const file = new File([picture], 'said.png', { type: picture.type || 'image/png' });
        return uploadFile(file).then(stored => ({ file_id: stored.id }));
    };

    const sendIt = () => {
        const words = says.value.trim() || (picture ? LOOK : '');
        if (!words || sending) return;
        sending = true;
        hold(true);
        failed.replaceChildren();
        denied.textContent = '';
        follow();
        carried()
            .then(carries => node.say(words, mode.value, carries))
            .then(answer => {
                says.value = '';
                carry(null);
                reading = answer.session;
                if (answer.denied.length > 0) denied.textContent = `It reached for ${answer.denied.join(', ')} and was not allowed.`;
                if (answer.unwritten) fails('session', new Error(`a row of the session was not written down: ${answer.unwritten}`));
                return read();
            })
            // What was typed stays in the box: a refusal does not cost the words.
            .catch((err: unknown) => fails('say', err))
            .finally(() => { sending = false; settle(); });
    };
    send.addEventListener('click', sendIt);
    says.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendIt(); }
    });

    node.am()
        .then(is => {
            // "No need to show did key to user"
            who.textContent = [is.model, is.effort, is.not_ready].filter(Boolean).join('  ');
            who.title = is.allow.length > 0 ? `Allowed without being asked: ${is.allow.join(', ')}` : 'Nothing is allowed without being asked';
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

// Who this is for: whoever reaches these (audience.ts).
export const needs = ['/api/agent'] as const;

export function createClaudeElement(): Element {
    return {
        id: ELEMENT_ID,
        title: 'Claude',
        symbol: Claude,
        // "claude element should not start at top when opening requiring user to scroll down every single time"
        opensAt: 'end',
        renderContent: () => {
            const body = part('div', 'content-area claude claude-brand');
            drawClaude(body);
            // The Spark heads who answers, and turns while it answers.
            const who = body.querySelector<HTMLElement>('.claude-who')!;
            const head = part('div', 'claude-head');
            who.replaceWith(head);
            head.append(spark(), who);
            return body;
        },
    };
}

/** Opens the Claude element. */
export function openClaudeElement(): void {
    openElement(ELEMENT_ID);
}
