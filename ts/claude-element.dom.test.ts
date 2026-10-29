/**
 * @jest-environment jsdom
 *
 * Claude element — the Node Agent: said to, and read as the session it continues.
 *
 * Personas: Tim (happy path), Spike (edge cases), Jenny (complex scenarios).
 */

import { describe, test, expect } from 'bun:test';
import { createPiElement } from './pi-element';
import { createClaudeElement, drawClaude, type ClaudeAm, type ClaudeSaid, type LiveEvent, type NodeAgent } from './claude-element';
import type { TranscriptRead } from './components/element/transcript-element';

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

const session: TranscriptRead = {
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
    test('nothing heads the session but the titlebar, and who answers is hidden once it answered', async () => {
        const claude = createClaudeElement().renderContent!() as HTMLElement;
        expect(claude.querySelector('.claude-head')).toBeNull();
        expect(claude.querySelector('.claude-spark')).toBeNull();
        expect(claude.classList.contains('claude-brand')).toBe(true);

        const body = document.createElement('div');
        const stop = drawClaude(body, node());
        await settled();
        expect(body.querySelector<HTMLElement>('.claude-who')!.hidden).toBe(true);
        stop();

        const pi = createPiElement().renderContent!() as HTMLElement;
        expect(pi.classList.contains('claude-brand')).toBe(false);
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
        const rows = [...body.querySelectorAll('.tr-turn')].map(t => t.querySelector('.tr-text')?.textContent?.trim());
        expect(rows).toEqual(['how long has the box been up?', 'Up 3 days.']);
        expect(body.querySelector<HTMLTextAreaElement>('.claude-says')!.value).toBe('');
        stop();
    });

    // Tim: tomorrow it is the same session, drawn on opening.
    test('a session it continues is drawn on opening', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node({}, { ...am, session: SESSION }));
        await settled();
        expect(body.querySelectorAll('.tr-turn')).toHaveLength(2);
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

    // Jenny: while it answers, a second thing cannot be said from here.
    test('the box is held while it answers', async () => {
        const body = document.createElement('div');
        let answer: (said: ClaudeSaid) => void = () => {};
        const asked = node({ say: () => new Promise<ClaudeSaid>(resolve => { answer = resolve; }) });
        const stop = drawClaude(body, asked, 1);
        await settled();
        say(body, 'first');
        await settled();
        expect(body.querySelector<HTMLButtonElement>('.claude-send')!.disabled).toBe(true);
        answer(answered);
        await settled();
        expect(body.querySelector<HTMLButtonElement>('.claude-send')!.disabled).toBe(false);
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
        const live = body.querySelector<HTMLElement>('.claude-live')!;
        // What was said is the transcript's to show, written down before the turn: not drawn twice.
        expect(live.textContent).not.toContain('[human]');

        landed!({ ...event('tool_use', 'Bash', 'Bash'), input: '{"command":"uptime"}' });
        landed!(event('tool_result', 'up 3 days, 2 users'));
        landed!(event('delta', 'Up 3'));
        landed!(event('delta', ' days.'));
        // The thing itself, no speaker in front of it.
        const rows = Array.from(live.querySelectorAll('.claude-live-row')).map(r => r.textContent);
        expect(rows).toEqual(['$ uptime', 'up 3 days, 2 users', 'Up 3 days.']);
        expect(live.textContent).not.toContain('[tool]');
        // Still answering: say has not come back.
        expect(body.querySelector<HTMLButtonElement>('.claude-send')!.disabled).toBe(true);

        landed!(event('text', 'Up 3 days.'));
        expect(live.querySelectorAll('.claude-live-said').length).toBe(1);
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
        const { toolUseShown } = await import('./claude-element');
        const edit = toolUseShown('Edit', JSON.stringify({ file_path: 'a.go', old_string: 'x := 1\ny := 2', new_string: 'x := 3' }));
        expect(Array.from(edit.children).map(c => c.textContent)).toEqual(['a.go', '- x := 1', '- y := 2', '+ x := 3']);
        expect(edit.querySelectorAll('.claude-live-del').length).toBe(2);
        expect(edit.querySelectorAll('.claude-live-add').length).toBe(1);
        const write = toolUseShown('Write', JSON.stringify({ file_path: 'b.md', content: 'hi' }));
        expect(Array.from(write.children).map(c => c.textContent)).toEqual(['b.md', '+ hi']);
        const mcp = toolUseShown('mcp__qntx__reach_list', '{"path":"/api/agent"}');
        expect(mcp.textContent).toContain('mcp__qntx__reach_list');
        expect(mcp.textContent).toContain('"path": "/api/agent"');
        expect(toolUseShown('Read', '{"file_path":"c.ts"}').textContent).toBe('c.ts');
    });

    // A node from before live has no stream: the element reads the transcript as it did.
    test('a node with no live still answers through the transcript', async () => {
        const body = document.createElement('div');
        const stop = drawClaude(body, node());
        await settled();
        say(body, 'how long has the box been up?');
        await settled();
        expect(body.querySelector('.claude-session')!.textContent).toContain('Up 3 days.');
        expect(body.querySelector('.claude-live')!.childElementCount).toBe(0);
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
