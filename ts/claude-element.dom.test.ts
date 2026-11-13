/**
 * @jest-environment jsdom
 *
 * Claude element — the Node Agent: said to, and read as the session it continues.
 *
 * Personas: Tim (happy path), Spike (edge cases), Jenny (complex scenarios).
 */

import { describe, test, expect, mock } from 'bun:test';
import * as realFiles from './api/files';

// The picture a say carries is sent up through uploadFile, and apiJson answers {} in every test
// (test-setup.ts). mock.module is process-global: this stands in only while a test sets shelved,
// and is the real uploadFile otherwise.
let shelved: ((file: File) => Promise<realFiles.FileUploadResult>) | null = null;
const realUpload = realFiles.uploadFile;
mock.module('./api/files', () => ({ ...realFiles, uploadFile: (file: File) => (shelved ?? realUpload)(file) }));

import { drawClaude, type ClaudeAm, type ClaudeSaid, type LiveEvent, type NodeAgent } from './claude-element';
import type { SessionRead } from './chat';

const USE_JSDOM = process.env.USE_JSDOM === '1';

const MODES = ['acceptEdits', 'auto', 'bypassPermissions', 'manual', 'dontAsk', 'plan'];

const am: ClaudeAm = {
    did: 'did:key:z6MkqViDuPd5kCy75dWMjEaqwrgQyDCRZhn53yV39ycSaJHB',
    model: 'claude-opus-5-5',
    effort: 'low',
    permission_mode: 'dontAsk',
    permission_modes: MODES,
    allow: ['Bash', 'Read', 'mcp__qntx'],
    session: '',
    answering: false,
    claude_code: '/root/.qntx/claude-code/2.1.289/claude',
    not_ready: '',
};

const SESSION = '2ed899af-e95e-53f2-bf39-e58440f09df4';

const answered: ClaudeSaid = {
    answer: 'Up 3 days.',
    is_error: false,
    subtype: 'success',
    session: SESSION,
    model: 'claude-opus-5-5',
    claude_code: '2.1.289',
    permission_mode: 'dontAsk',
    denied: [],
    cost_usd: 0.05,
    took_ms: 2592,
    unwritten: '',
};

const session: SessionRead = {
    session: SESSION,
    subjects: ['qntx/root-agent'],
    started: '2026-10-05T09:00:00Z',
    ended: '2026-10-05T09:00:04Z',
    folded: 0,
    model: 'claude-opus-5-5',
    effort: '',
    turns: [
        { at: '2026-10-05T09:00:00Z', speaker: 'human', text: 'how long has the box been up?', of: 'p-1' },
        { at: '2026-10-05T09:00:02Z', speaker: 'tool', text: 'uptime', of: 't-2' },
        { at: '2026-10-05T09:00:04Z', speaker: 'assistant', text: 'Up 3 days.', of: 's-3' },
    ],
};

// A node standing in for the one the element asks, keeping what it was sent.
function node(over: Partial<NodeAgent> = {}, is: ClaudeAm = am): NodeAgent & { sent: Array<[string, string]> } {
    const sent: Array<[string, string]> = [];
    return {
        sent,
        am: () => Promise.resolve(is),
        say: (says, mode) => { sent.push([says, mode]); return Promise.resolve(answered); },
        read: () => Promise.resolve(session),
        ...over,
    };
}

// Everything already settled has been drawn.
async function settled(): Promise<void> {
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

function say(body: HTMLElement, words: string): void {
    body.querySelector<HTMLTextAreaElement>('.claude-says')!.value = words;
    body.querySelector<HTMLButtonElement>('.claude-send')!.click();
}

describe('Claude - Tim', () => {
    if (!USE_JSDOM) {
        test.skip('Skipped locally (run with USE_JSDOM=1 to enable)', () => {});
        return;
    }

    // Tim: opening it says who answers, before anything is said.
    // "No need to show did key to user"
    test('it says how it runs, and not its did', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node());
        await settled();
        const who = body.querySelector('.claude-who')?.textContent ?? '';
        expect(who).not.toContain('did:key');
        expect(who).toContain('claude-opus-5-5');
        expect(who).toContain('low');
        stop();
    });

    // "would like ability to pick model as well"
    test('the models the node offers are picked from, its own chosen, and the one picked is what is said with', async () => {
        const body = document.createElement('div');
        const models: string[] = [];
        const stop = drawClaude(body, node({
            say: (_says, _mode, _carried, model) => { models.push(model ?? ''); return Promise.resolve(answered); },
        }, { ...am, models: ['claude-opus-5-5', 'claude-sonnet-5-5'] }));
        await settled();
        const pick = body.querySelector<HTMLSelectElement>('.claude-model')!;
        expect(pick.hidden).toBe(false);
        expect(Array.from(pick.options).map(o => o.value)).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5']);
        expect(pick.value).toBe('claude-opus-5-5');
        pick.value = 'claude-sonnet-5-5';
        say(body, 'how long has the box been up?');
        await settled();
        expect(models).toEqual(['claude-sonnet-5-5']);
        stop();
    });

    test('a node that offers no models shows no model to pick', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node());
        await settled();
        expect(body.querySelector<HTMLSelectElement>('.claude-model')!.hidden).toBe(true);
        stop();
    });

    // "make sure we only use titlebar, so red part should not exist"
    test('nothing heads the chat, and who answers is hidden once it answered', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node());
        await settled();
        expect(body.querySelector('.claude-head')).toBeNull();
        expect(body.querySelector<HTMLElement>('.claude-who')!.hidden).toBe(true);
        stop();
    });

    // "make sure --permission-mode is configurable in the Claude Element"
    // "claude element 'dontask' doesnt make sense there"
    test('every permission mode but dontAsk is offered', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node());
        await settled();
        const mode = body.querySelector<HTMLSelectElement>('.claude-mode')!;
        // The modes, not the "permission mode" that stands for the node's own (Spike).
        expect([...mode.options].map(o => o.value).filter(Boolean)).toEqual(MODES.filter(m => m !== 'dontAsk'));
        stop();
    });

    // Tim: what he says is sent in the mode he chose, and the session is drawn when it answers.
    test('what is said is sent in the mode chosen, and its session is read', async () => {
        const body = document.createElement('div');
        const asked = node();
        const stop = drawClaude(body, asked);
        await settled();
        body.querySelector<HTMLSelectElement>('.claude-mode')!.value = 'plan';
        say(body, 'how long has the box been up?');
        await settled();

        expect(asked.sent).toEqual([['how long has the box been up?', 'plan']]);
        const rows = [...body.querySelectorAll('.chat-row')].map(t => t.textContent?.trim());
        expect(rows).toEqual(['last talked Oct 5 09:00', 'how long has the box been up?', '$ uptime', 'Up 3 days.']);
        expect(body.querySelector<HTMLTextAreaElement>('.claude-says')!.value).toBe('');
        stop();
    });

    // Tim: tomorrow it is the same session, drawn on opening.
    test('a session it continues is drawn on opening', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node({}, { ...am, session: SESSION }));
        await settled();
        expect(body.querySelectorAll('.chat-row')).toHaveLength(4);
        stop();
    });
});

describe('Claude - Spike', () => {
    if (!USE_JSDOM) {
        test.skip('Skipped locally (run with USE_JSDOM=1 to enable)', () => {});
        return;
    }

    // "The two red X indicates inefficient use of space": the node runs dontAsk, which is not
    // offered, and the choice showed nothing at all.
    test('a node running in a mode not offered: the choice says what it is, and sends none', async () => {
        const body = document.createElement('div');
        const asked = node();
        const stop = drawClaude(body, asked);
        await settled();
        const mode = body.querySelector<HTMLSelectElement>('.claude-mode')!;
        expect(mode.selectedIndex).toBeGreaterThanOrEqual(0);
        expect(mode.options[mode.selectedIndex].textContent).toBe('permission mode');
        say(body, 'how long has the box been up?');
        await settled();
        expect(asked.sent).toEqual([['how long has the box been up?', '']]);
        stop();
    });

    // Spike: nothing typed is nothing said.
    test('an empty box sends nothing', async () => {
        const body = document.createElement('div');
        const asked = node();
        const stop = drawClaude(body, asked);
        await settled();
        say(body, '   ');
        await settled();
        expect(asked.sent).toEqual([]);
        stop();
    });

    // Spike: a refusal is said in the words it came in, and what he typed is still there.
    test('a refusal is drawn, and the words are kept', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node({
            say: () => Promise.reject(new Error('/api/agent/say: HTTP 500 Claude Code did not answer: exit status 1')),
        }));
        await settled();
        say(body, 'install htop');
        await settled();
        // Through the one render an error has, which holds what it was handed.
        const drawn = body.querySelector<HTMLElement & { error: { title: string; why: string } | null }>('.claude-failed sacred-error');
        expect(`${drawn?.error?.title}: ${drawn?.error?.why}`).toContain('Claude Code did not answer: exit status 1');
        expect(body.querySelector<HTMLTextAreaElement>('.claude-says')!.value).toBe('install htop');
        expect(body.querySelector<HTMLButtonElement>('.claude-send')!.disabled).toBe(false);
        stop();
    });

    // Spike: a tool it reached for and was not allowed is said with the answer.
    test('what it was not allowed is said', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node({
            say: () => Promise.resolve({ ...answered, denied: ['Write', 'WebFetch'] }),
        }));
        await settled();
        say(body, 'write it down');
        await settled();
        const denied = body.querySelector('.claude-denied')?.textContent ?? '';
        expect(denied).toContain('Write');
        expect(denied).toContain('WebFetch');
        stop();
    });

    // Spike: a node with no Node Agent says so, in the node's words.
    test('a node with no Node Agent says why', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node({
            am: () => Promise.reject(new Error("/api/agent?harness=claude: HTTP 404 this node's am.toml names no Node Agent")),
        }));
        await settled();
        expect(body.querySelector('.claude-who')?.textContent).toContain('names no Node Agent');
        expect(body.querySelector<HTMLButtonElement>('.claude-send')!.disabled).toBe(true);
        stop();
    });

    // Spike: Claude Code still being fetched is said, and saying is still possible.
    test('why it is not ready is said', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node({}, { ...am, claude_code: '', not_ready: 'Claude Code is still being fetched' }));
        await settled();
        expect(body.querySelector('.claude-who')?.textContent).toContain('Claude Code is still being fetched');
        stop();
    });
});

describe('Claude - Jenny', () => {
    if (!USE_JSDOM) {
        test.skip('Skipped locally (run with USE_JSDOM=1 to enable)', () => {});
        return;
    }

    // Jenny: opened while it answers somebody else, it draws that turn as it goes.
    test('a turn already going is followed', async () => {
        const body = document.createElement('div');
        let reads = 0;
        const stop = drawClaude(body, node(
            { read: () => { reads++; return Promise.resolve(session); } },
            { ...am, session: SESSION, answering: true },
        ), 1);
        await settled();
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(reads).toBeGreaterThan(1);
        expect(body.querySelector('.claude-status')?.textContent).toContain('answering');
        stop();
    });

    // "kinda buggy still is, the text linger even after i sent it"
    test('the box empties when it is said, before the agent answers', async () => {
        const body = document.createElement('div');
        const asked = node({ say: () => new Promise<ClaudeSaid>(() => {}) });
        const stop = drawClaude(body, asked, 1);
        await settled();
        say(body, 'hey, own https://github.com/teranos/QNTX/pull/1508 please');
        await settled();
        expect(body.querySelector<HTMLTextAreaElement>('.claude-says')!.value).toBe('');
        expect(body.querySelector('.claude-status')?.textContent).toContain('answering');
        stop();
    });

    // "the sent button needs to change"
    // "into a stop button"
    test('while it answers, an empty box\'s button stops the turn, and words in the box are said instead', async () => {
        const body = document.createElement('div');
        let stopped = 0;
        const sent: string[] = [];
        const stop = drawClaude(body, node({
            say: (says) => { sent.push(says); return new Promise<ClaudeSaid>(() => {}); },
            stop: () => { stopped++; return Promise.resolve({ ...am, answering: false }); },
        }), 1);
        await settled();
        const button = () => body.querySelector<HTMLButtonElement>('.claude-send')!;
        expect(button().textContent).toBe('→');

        say(body, 'count to a million');
        await settled();
        expect(button().textContent).toBe('■');
        expect(button().getAttribute('aria-label')).toBe('Stop');

        // Words typed while it answers: the button says them.
        const box = body.querySelector<HTMLTextAreaElement>('.claude-says')!;
        box.value = 'and then?';
        box.dispatchEvent(new Event('input'));
        expect(button().textContent).toBe('→');
        box.value = '';
        box.dispatchEvent(new Event('input'));

        button().click();
        await settled();
        expect(stopped).toBe(1);
        expect(sent).toEqual(['count to a million']);
        stop();
    });

    // "WHEN I PRESS ON THE PENDING MESSAGE AGAIN, IT IS SAYING, SEND NOW? AND THEN YOU CLICK ON IT, AND YOU INTERRUPT AND SEND IT NOW"
    test('a waiting message pressed asks send now, and pressed again stops the turn and is said next', async () => {
        const body = document.createElement('div');
        const sent: string[] = [];
        const ends: Array<{ resolve: (said: ClaudeSaid) => void; reject: (err: Error) => void }> = [];
        let stopped = 0;
        const stop = drawClaude(body, node({
            say: (says) => { sent.push(says); return new Promise<ClaudeSaid>((resolve, reject) => { ends.push({ resolve, reject }); }); },
            // Stopped, the turn going ends unanswered, as the node says it.
            stop: () => { stopped++; ends[0].reject(new Error('Claude Code did not answer')); return Promise.resolve({ ...am, answering: false }); },
        }), 1);
        await settled();
        say(body, 'count to a million');
        await settled();
        say(body, 'first that waits');
        say(body, 'the urgent one');
        await settled();
        const rows = () => Array.from(body.querySelectorAll<HTMLElement>('.chat-waiting'));
        const urgent = rows()[1];
        expect(urgent.querySelector('.chat-waiting-said')?.textContent).toBe('waiting');

        // Pressed once: it asks, and nothing is stopped.
        urgent.click();
        expect(urgent.querySelector('.chat-waiting-said')?.textContent).toBe('send now?');
        expect(stopped).toBe(0);
        expect(sent).toEqual(['count to a million']);

        // Pressed again: the turn is stopped, and it is said ahead of what waited before it.
        urgent.click();
        await settled();
        expect(stopped).toBe(1);
        expect(sent).toEqual(['count to a million', 'the urgent one']);
        expect(rows().map(r => r.querySelector('.chat-text')?.textContent)).toEqual(['first that waits']);
        // What the stopped turn was said with is not said again, and no failure is drawn for it.
        expect(body.querySelector('.claude-failed')?.textContent).toBe('');
        stop();
    });

    // An agent the node cannot stop keeps its send button.
    test('an agent with no stop keeps its send button while it answers', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node({ say: () => new Promise<ClaudeSaid>(() => {}) }), 1);
        await settled();
        say(body, 'count to a million');
        await settled();
        expect(body.querySelector<HTMLButtonElement>('.claude-send')!.textContent).toBe('→');
        stop();
    });

    // "i wish to be able to send multipl emessahes, like i do now, here in claude code, if you get me"
    test('what is said while it answers waits, shown as waiting, and is said when the turn before it ends', async () => {
        const body = document.createElement('div');
        const answers: Array<(said: ClaudeSaid) => void> = [];
        const sent: string[] = [];
        const stop = drawClaude(body, node({
            say: (says) => { sent.push(says); return new Promise<ClaudeSaid>(resolve => { answers.push(resolve); }); },
        }), 1);
        await settled();
        say(body, 'first');
        await settled();
        expect(body.querySelector<HTMLButtonElement>('.claude-send')!.disabled).toBe(false);
        say(body, 'second');
        say(body, 'third');
        await settled();
        const waiting = () => Array.from(body.querySelectorAll('.chat-waiting')).map(r => r.querySelector('.chat-text')?.textContent);
        expect(sent).toEqual(['first']);
        expect(waiting()).toEqual(['second', 'third']);
        expect(body.querySelector<HTMLTextAreaElement>('.claude-says')!.value).toBe('');

        answers[0](answered);
        await settled();
        expect(sent).toEqual(['first', 'second']);
        expect(waiting()).toEqual(['third']);
        expect(body.querySelector('.claude-status')?.textContent).toContain('answering');

        answers[1](answered);
        await settled();
        expect(sent).toEqual(['first', 'second', 'third']);
        expect(waiting()).toEqual([]);

        answers[2](answered);
        await settled();
        expect(body.querySelector('.claude-status')?.textContent).not.toContain('answering');
        stop();
    });

    // "i wish to be able to send multipl emessahes, like i do now, here in claude code, if you get me"
    // In Claude Code a message that waits stays with the session it was typed in: a chat left for
    // another harness's tab still says what waits to the harness it was typed for.
    test('what waits is said to the harness it was typed for, after its chat was left for another tab', async () => {
        const body = document.createElement('div');
        const answers: Array<(said: ClaudeSaid) => void> = [];
        const sent: string[] = [];
        const stop = drawClaude(body, node({
            say: (says) => { sent.push(says); return new Promise<ClaudeSaid>(resolve => { answers.push(resolve); }); },
        }), 1);
        await settled();
        say(body, 'first');
        await settled();
        say(body, 'second');
        await settled();
        // Another tab pressed: this chat is settled and another drawn in its place.
        stop();
        answers[0](answered);
        await settled();
        expect(sent).toEqual(['first', 'second']);
        answers[1](answered);
        await settled();
    });

    // A refusal does not cost the words: what was refused is back in the box, what waited behind it still waits, and none of it is said.
    test('a refusal puts what was refused back in the box, keeps what waited waiting, and says none of it until Say', async () => {
        const body = document.createElement('div');
        const answers: Array<{ resolve: (said: ClaudeSaid) => void; reject: (err: Error) => void }> = [];
        const sent: string[] = [];
        const stop = drawClaude(body, node({
            say: (says) => { sent.push(says); return new Promise<ClaudeSaid>((resolve, reject) => { answers.push({ resolve, reject }); }); },
        }), 1);
        await settled();
        say(body, 'first');
        await settled();
        say(body, 'second');
        await settled();
        answers[0].reject(new Error('/api/agent/say: HTTP 500 Claude Code did not answer: exit status 1'));
        await settled();
        const waiting = () => Array.from(body.querySelectorAll('.chat-waiting')).map(r => r.querySelector('.chat-text')?.textContent);
        expect(sent).toEqual(['first']);
        expect(body.querySelector<HTMLTextAreaElement>('.claude-says')!.value).toBe('first');
        expect(waiting()).toEqual(['second']);

        body.querySelector<HTMLButtonElement>('.claude-send')!.click();
        await settled();
        expect(sent).toEqual(['first', 'first']);
        answers[1].resolve(answered);
        await settled();
        expect(sent).toEqual(['first', 'first', 'second']);
        expect(waiting()).toEqual([]);
        stop();
    });

    // A node standing in for /api/files: each picture sent up is a file of its own.
    const files = () => {
        shelved = (file: File) => file.text().then(named => ({ id: `f-${named}`, filename: 'said.png', size: named.length }) as realFiles.FileUploadResult);
        return { restore: () => { shelved = null; } };
    };
    const picked = (body: HTMLElement, named: string) => {
        const pick = body.querySelector<HTMLInputElement>('.claude-pick')!;
        Object.defineProperty(pick, 'files', { value: [new Blob([named], { type: 'image/png' })], configurable: true });
        pick.dispatchEvent(new Event('change'));
    };

    // Each thing said keeps the picture it was said with, through a refusal.
    test('a refusal costs no picture: each waiting one keeps its own, and a picture picked since is left in the box', async () => {
        const body = document.createElement('div');
        const answers: Array<{ resolve: (said: ClaudeSaid) => void; reject: (err: Error) => void }> = [];
        const sent: Array<[string, string]> = [];
        const shelf = files();
        try {
            const stop = drawClaude(body, node({
                say: (says, _mode, carried) => { sent.push([says, carried?.file_id ?? '']); return new Promise<ClaudeSaid>((resolve, reject) => { answers.push({ resolve, reject }); }); },
            }), 1);
            await settled();
            picked(body, 'one');
            say(body, 'first');
            await settled();
            picked(body, 'two');
            say(body, 'second');
            await settled();
            // Typed and picked since, not yet said.
            picked(body, 'three');
            body.querySelector<HTMLTextAreaElement>('.claude-says')!.value = 'third';
            answers[0].reject(new Error('/api/agent/say: HTTP 500 Claude Code did not answer: exit status 1'));
            await settled();
            const waiting = () => Array.from(body.querySelectorAll('.chat-waiting')).map(r => r.querySelector('.chat-text')?.textContent);
            expect(waiting()).toEqual(['first', 'second']);
            expect(body.querySelector<HTMLTextAreaElement>('.claude-says')!.value).toBe('third');

            body.querySelector<HTMLButtonElement>('.claude-send')!.click();
            // Each say answered once it has been made, in the order made; one never made fails here.
            for (let i = 1; i <= 3; i++) {
                for (let tries = 0; answers.length <= i && tries < 50; tries++) await settled();
                expect(answers.length).toBeGreaterThan(i);
                answers[i].resolve(answered);
            }
            await settled();
            expect(sent).toEqual([['first', 'f-one'], ['first', 'f-one'], ['second', 'f-two'], ['third', 'f-three']]);
            stop();
        } finally { shelf.restore(); }
    });

    // An answer read before a later one is not drawn over it.
    test('a session read that comes back after a later one does not draw over it', async () => {
        const body = document.createElement('div');
        const answers: Array<(said: ClaudeSaid) => void> = [];
        let answeredCount = 0;
        const reads: Array<() => void> = [];
        const sessionAfter = (n: number): SessionRead => ({ ...session, turns: [...session.turns, { at: '2026-10-05T09:00:05Z', speaker: 'assistant', text: `answer ${n}`, of: `s-${n}` }] });
        const stop = drawClaude(body, node({
            say: () => new Promise<ClaudeSaid>(resolve => { answers.push(said => { answeredCount++; resolve(said); }); }),
            read: () => { const n = answeredCount; return new Promise<SessionRead>(resolve => { reads.push(() => resolve(sessionAfter(n))); }); },
        }), 1);
        await settled();
        say(body, 'first');
        await settled();
        say(body, 'second');
        await settled();
        answers[0](answered);
        await settled();
        // The read say's answer asked for, then settle's, which is held back.
        reads[0]();
        await settled();
        const held = reads[1];
        answers[1](answered);
        await settled();
        for (const [i, read] of reads.entries()) if (i > 1) read();
        await settled();
        for (const [i, read] of reads.entries()) if (i > 1) read();
        await settled();
        expect(body.querySelector('.claude-session')!.textContent).toContain('answer 2');
        held();
        await settled();
        expect(body.querySelector('.claude-session')!.textContent).toContain('answer 2');
        stop();
    });
});

describe('Claude - the session while it runs', () => {
    if (!USE_JSDOM) {
        test.skip('Skipped locally (run with USE_JSDOM=1 to enable)', () => {});
        return;
    }

    const event = (kind: string, text: string, tool = ''): LiveEvent => ({ kind, text, tool, tool_use_id: '', at: '2026-10-28T22:35:16Z', mark: '1' });

    // "it doesnt stream in, only the [tool] and [mcp] pieces fly in."
    // The words are drawn as the stream hands them, while say has not answered.
    test('the words of a turn going are drawn before say answers, and the live view empties when it has', async () => {
        const body = document.createElement('div');
        let landed: ((e: LiveEvent) => void) | null = null;
        let ended: (() => void) | null = null;
        let answer: ((said: ClaudeSaid) => void) | null = null;
        const stop = drawClaude(body, node({
            say: () => new Promise(resolve => { answer = resolve; }),
            live: (onEvent, onEnd) => { landed = onEvent; ended = onEnd; return () => {}; },
        }));
        await settled();
        say(body, 'how long has the box been up?');
        await settled();
        expect(landed).not.toBeNull();
        const live = body.querySelector<HTMLElement>('.chat-live')!;
        // What was said is the transcript's to show, written down before the turn: not drawn twice.
        expect(live.textContent).not.toContain('[human]');
        expect(live.querySelector('.chat-you')?.textContent).toBe('how long has the box been up?');

        landed!({ ...event('tool_use', 'Bash', 'Bash'), input: '{"command":"uptime"}' });
        landed!(event('tool_result', 'up 3 days, 2 users'));
        landed!(event('delta', 'Up 3'));
        landed!(event('delta', ' days.'));
        // The thing itself, no speaker in front of it.
        const rows = Array.from(live.querySelectorAll('.chat-row')).map(r => r.textContent?.trim());
        expect(rows).toEqual(['how long has the box been up?', '$ uptime', 'up 3 days, 2 users', 'Up 3 days.']);
        expect(live.textContent).not.toContain('[tool]');
        // Still answering: say has not come back.
        expect(body.querySelector('.claude-status')?.textContent).toContain('answering');

        landed!(event('text', 'Up 3 days.'));
        expect(live.querySelectorAll('.chat-said').length).toBe(1);
        landed!(event('ended', 'Up 3 days.'));
        ended!();
        answer!(answered);
        await settled();
        // The transcript has it now, and the live view is empty.
        expect(live.childElementCount).toBe(0);
        expect(body.querySelector('.claude-session')!.textContent).toContain('Up 3 days.');
        expect(body.querySelector<HTMLButtonElement>('.claude-send')!.disabled).toBe(false);
        stop();
    });

    // "including +/- diffs fly by"
    test('an edit flies by as what was and what is, a write as what is, and a tool with no shape as its input whole', async () => {
        const { toolUseShown } = await import('./chat');
        const edit = toolUseShown('Edit', JSON.stringify({ file_path: 'a.go', old_string: 'x := 1\ny := 2', new_string: 'x := 3' }));
        expect(Array.from(edit.children).map(c => c.textContent)).toEqual(['edited a.go', '- x := 1', '- y := 2', '+ x := 3']);
        expect(edit.querySelectorAll('.chat-del').length).toBe(2);
        expect(edit.querySelectorAll('.chat-add').length).toBe(1);
        const write = toolUseShown('Write', JSON.stringify({ file_path: 'b.md', content: 'hi' }));
        expect(Array.from(write.children).map(c => c.textContent)).toEqual(['wrote b.md', '+ hi']);
        const mcp = toolUseShown('mcp__qntx__reach_list', '{"path":"/api/agent"}');
        expect(mcp.textContent).toContain('asked qntx: reach_list');
        expect(mcp.textContent).not.toContain('mcp__');
        expect(mcp.textContent).toContain('"path": "/api/agent"');
        expect(toolUseShown('Read', '{"file_path":"c.ts"}').textContent).toBe('read c.ts');
    });

    // "I WANT A CHAT, I DONT WANT A READER": the session is drawn as the chat, never by the reader.
    test('the session is the chat: text to select, no row to press, no label, no chip, no spacer', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node({}, { ...am, session: SESSION }));
        await settled();
        const chat = body.querySelector<HTMLElement>('.claude-session')!;
        expect(chat.querySelector('.tr-turn')).toBeNull();
        expect(chat.querySelector('.tr-chip')).toBeNull();
        expect(chat.querySelector('.tr-spacer')).toBeNull();
        expect(chat.textContent).not.toContain('[human]');
        expect(chat.textContent).not.toContain('[assistant]');
        expect(chat.textContent).not.toContain('[tool]');
        const rows = Array.from(chat.querySelectorAll('.chat-row')).map(r => r.textContent?.trim());
        expect(rows).toEqual(['last talked Oct 5 09:00', 'how long has the box been up?', '$ uptime', 'Up 3 days.']);
        expect(chat.querySelector('.chat-you')).not.toBeNull();
        // It has been a while since 2026-10-05: the chat says when we last talked, once, at the top.
        expect(chat.querySelector('.chat-row')!.textContent).toContain('last talked');
        stop();
    });

    test('the harness starting or resuming is not a line of the conversation', async () => {
        const { renderChat } = await import('./chat');
        const body = document.createElement('div');
        renderChat(body, { ...session, turns: [...session.turns, { at: '2026-10-05T09:00:05Z', speaker: 'session', text: 'Start resume', of: 'x-1' }] });
        expect(body.textContent).not.toContain('Start resume');
        expect(body.textContent).not.toContain('session');
    });

    test('after the fact a tool says what it did, a compaction says it happened, and nothing hovers', async () => {
        const { renderChat } = await import('./chat');
        const body = document.createElement('div');
        renderChat(body, { ...session, turns: [
            { at: '2026-10-05T09:00:01Z', speaker: 'edit', text: 'server/a.go', of: 'e-1' },
            { at: '2026-10-05T09:00:02Z', speaker: 'mcp', text: 'mcp__qntx__reach_list', of: 'm-1' },
            { at: '2026-10-05T09:00:03Z', speaker: 'compaction', text: 'compacted', of: 'c-1' },
        ] });
        const rows = Array.from(body.querySelectorAll('.chat-row')).map(r => r.textContent?.trim());
        expect(rows.slice(-3)).toEqual(['edited server/a.go', 'asked qntx: reach_list', 'the context was compacted here']);
        expect(body.textContent).not.toContain('[');
        expect(body.querySelector('[title]')).toBeNull();
    });

    // A node from before live has no stream: the element reads the session as it did.
    test('a node with no live still answers through the transcript', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node());
        await settled();
        say(body, 'how long has the box been up?');
        await settled();
        expect(body.querySelector('.claude-session')!.textContent).toContain('Up 3 days.');
        expect(body.querySelector('.chat-live')!.childElementCount).toBe(0);
        stop();
    });
});


describe('Claude - live read off fetch', () => {
    if (!USE_JSDOM) {
        test.skip('Skipped locally (run with USE_JSDOM=1 to enable)', () => {});
        return;
    }

    const sse = (chunks: string[], status = 200) => {
        const utf8 = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
            start(controller) { for (const chunk of chunks) controller.enqueue(utf8.encode(chunk)); controller.close(); },
        });
        return new Response(status === 200 ? body : 'the Node Agent is not in a turn', { status, headers: { 'Content-Type': 'text/event-stream' } });
    };

    // An event split across chunks is one event, and end ends it once.
    test('events are read whole across chunks, and end is the end', async () => {
        const { readLive } = await import('./claude-element');
        const original = globalThis.fetch;
        const asked: string[] = [];
        globalThis.fetch = ((url: string) => { asked.push(url); return Promise.resolve(sse([
            'data: {"kind":"delta","text":"Up","tool":"","tool_use_id":"","at":"","mark":"1"}\n\n',
            'data: {"kind":"delta","text":" 3 da',
            'ys.","tool":"","tool_use_id":"","at":"","mark":"2"}\n\nevent: end\ndata: {"events":[],"live":false,"mark":"3"}\n\n',
        ])); }) as typeof fetch;
        try {
            const got: string[] = [];
            let ends = 0;
            readLive('/api/agent/live?harness=claude', e => got.push(e.text), () => { ends++; });
            await settled();
            expect(asked).toEqual(['/api/agent/live?harness=claude']);
            expect(got).toEqual(['Up', ' 3 days.']);
            expect(ends).toBe(1);
        } finally { globalThis.fetch = original; }
    });

    // Nothing answers between turns: that ends it, and whoever listens asks again.
    test('a refusal ends the read', async () => {
        const { readLive } = await import('./claude-element');
        const original = globalThis.fetch;
        globalThis.fetch = (() => Promise.resolve(sse([], 404))) as typeof fetch;
        try {
            let ends = 0;
            readLive('/api/agent/live?harness=claude', () => {}, () => { ends++; });
            await settled();
            expect(ends).toBe(1);
        } finally { globalThis.fetch = original; }
    });
});

// "Being able to annotate and send a picture is of critical importance"
// A screenshot marked up on the phone is saved as FullSizeRender.jpeg: JPEG bytes. Named said.png, the
// node refused it: HTTP 400 file content does not match extension .png.
describe('Claude - a picture goes up as what it is', () => {
    const sentUp = async (kind: string): Promise<File> => {
        const up: File[] = [];
        shelved = (file: File) => { up.push(file); return Promise.resolve({ id: 'f-1', filename: file.name, size: file.size } as realFiles.FileUploadResult); };
        try {
            const body = document.createElement('div');
            const stop = drawClaude(body, node(), 1);
            await settled();
            const pick = body.querySelector<HTMLInputElement>('.claude-pick')!;
            Object.defineProperty(pick, 'files', { value: [new File(['marked up'], 'FullSizeRender.jpeg', { type: kind })], configurable: true });
            pick.dispatchEvent(new Event('change'));
            say(body, 'look');
            for (let tries = 0; up.length === 0 && tries < 50; tries++) await settled();
            stop();
            return up[0]!;
        } finally { shelved = null; }
    };

    test('Tim: a picture marked up on the phone, a JPEG, goes up named a JPEG', async () => {
        const file = await sentUp('image/jpeg');
        expect(file.name).toBe('said.jpg');
        expect(file.type).toBe('image/jpeg');
    });

    test('Spike: each kind the node takes keeps its own name', async () => {
        expect((await sentUp('image/png')).name).toBe('said.png');
        expect((await sentUp('image/webp')).name).toBe('said.webp');
        expect((await sentUp('image/gif')).name).toBe('said.gif');
    });
});
