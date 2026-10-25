// Codex — one session per target, read through the node's transcript endpoint.
// Authentication and agent configuration belong to the node, not this element.
import { declareSay, pressFrom, preventDrag, sizeText, type Element } from '@teranos/elements';
import { apiJson } from './client/http';
import { askTheNode } from './audience';
import { standingNamespace } from './standing';
import { Codex } from './sym';
import { renderTranscript, type TranscriptRead } from './components/element/transcript-element';
import { apiError, sacredEntry } from './components/sacred';
import { log, SEG } from './logger';

export interface CodexAm {
    did: string;
    model: string;
    sandbox: string;
    gateway: string;
    session: string;
    answering: boolean;
    codex: string;
    codex_version: string;
    not_ready: string;
}

export interface CodexSaid {
    answer: string;
    session: string;
    model: string;
    codex_version: string;
    input_tokens: string;
    output_tokens: string;
    took_ms: number;
    unwritten: string;
}

export interface CodexAgent {
    am(): Promise<CodexAm>;
    say(says: string): Promise<CodexSaid>;
    read(): Promise<TranscriptRead | null | undefined>;
}

export interface CodexTarget { label: string; path: string }
const NODE_PATH = '/api/agent';
const NAMESPACE_PATH = '/api/agents/{namespace}';

/** The same wire protocol for the Node Agent and an opted-in namespace agent. */
export function codexAt(path: string): CodexAgent {
    const codex = <T>(answer: { codex: T | null }): T => {
        if (!answer.codex) throw new Error(`${path}: the node returned no Codex response`);
        return answer.codex;
    };
    return {
        am: () => apiJson<{ codex: CodexAm | null }>(`${path}?harness=codex`).then(codex),
        say: says => apiJson<{ codex: CodexSaid | null }>(`${path}/say`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ harness: 'codex', says }),
        }).then(codex),
        read: () => apiJson<{ transcript: TranscriptRead | null }>(`${path}/session?harness=codex`)
            .then(answer => answer.transcript),
    };
}

interface AgentDocument {
    paths?: Record<string, { get?: { parameters?: Array<{ name: string; in: string; schema?: { enum?: string[] } }> } }>;
}

/** No speculative namespace calls: offer one only when the serving node advertises it. */
export async function namespaceCodexTarget(namespace: string): Promise<CodexTarget[]> {
    if (!namespace) return [];
    const reached = await askTheNode([NAMESPACE_PATH, '/openapi.json']);
    if (!reached.includes(NAMESPACE_PATH) || !reached.includes('/openapi.json')) return [];
    const document = await apiJson<AgentDocument>('/openapi.json');
    const harness = document.paths?.[NAMESPACE_PATH]?.get?.parameters?.find(p => p.name === 'harness' && p.in === 'query');
    return harness?.schema?.enum?.includes('codex')
        ? [{ label: `Namespace: ${namespace}`, path: `/api/agents/${encodeURIComponent(namespace)}` }]
        : [];
}

/** Draw once; selecting a target retains each target's draft and conversation DOM. */
export function drawCodex(
    body: HTMLElement,
    targets: CodexTarget[],
    agent: (path: string) => CodexAgent = codexAt,
    every = 2000,
): () => void {
    const select = document.createElement('select');
    select.className = 'codex-target';
    select.setAttribute('aria-label', 'Codex agent');
    sizeText(select, 'sm');
    for (const target of targets) {
        const option = document.createElement('option');
        option.value = target.path;
        option.textContent = target.label;
        select.append(option);
    }
    select.hidden = targets.length < 2;
    preventDrag(select);
    body.append(select);
    const conversations = new Map<string, { body: HTMLElement; stop: () => void }>();
    const choose = () => {
        for (const held of conversations.values()) held.body.hidden = true;
        const target = targets.find(t => t.path === select.value);
        if (!target) return;
        let held = conversations.get(target.path);
        if (!held) {
            const talk = document.createElement('div');
            talk.className = 'codex-talk';
            body.append(talk);
            held = { body: talk, stop: drawConversation(talk, target.label, agent(target.path), every) };
            conversations.set(target.path, held);
        }
        held.body.hidden = false;
    };
    select.addEventListener('change', choose);
    choose();
    return () => {
        select.removeEventListener('change', choose);
        for (const held of conversations.values()) held.stop();
    };
}

function drawConversation(body: HTMLElement, target: string, agent: CodexAgent, every: number): () => void {
    const who = document.createElement('div');
    who.className = 'codex-who';
    who.textContent = `Asking who answers in ${target}…`;
    sizeText(who, 'xs');
    const session = document.createElement('div');
    session.className = 'codex-session tr';
    const failed = document.createElement('div');
    failed.className = 'codex-failed';
    const status = document.createElement('div');
    status.className = 'codex-status';
    status.setAttribute('role', 'status');
    sizeText(status, 'xs');
    const says = document.createElement('textarea');
    says.className = 'codex-says';
    says.rows = 2;
    says.placeholder = `Say something to ${target}`;
    says.setAttribute('aria-label', `Say something to ${target}`);
    declareSay(says);
    const form = document.createElement('div');
    form.className = 'codex-say';
    preventDrag(form);
    preventDrag(session);

    let disposed = false;
    let sending = false;
    let available = false;
    let answering = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const failure = (region: string, error: unknown) => {
        if (disposed) return;
        const words = error instanceof Error ? error.message : String(error);
        log.error(SEG.ELEMENT, `[Codex] ${region}: ${words}`);
        failed.replaceChildren(sacredEntry(apiError(`codex-${Date.now()}`, new Date().toISOString(), words, { surface: 'codex', region })));
    };
    const read = async () => {
        const transcript = await agent.read();
        if (disposed) return;
        if (!transcript) { session.textContent = 'Nothing has been said to it yet.'; return; }
        renderTranscript(session, transcript, text => {
            navigator.clipboard.writeText(text).catch(error => failure('copy', error));
        });
    };
    const hold = () => {
        send.hold(sending || answering ? 'Codex is answering' : available ? null : 'Codex is not ready; refresh its status');
        status.textContent = sending || answering ? 'answering…' : '';
    };
    const follow = () => {
        if (disposed || timer !== undefined) return;
        timer = setTimeout(() => {
            timer = undefined;
            void refresh().catch(error => { available = false; hold(); failure('follow', error); });
        }, every);
    };
    const refresh = async () => {
        const is = await agent.am();
        if (disposed) return;
        available = !is.not_ready;
        answering = is.answering;
        who.textContent = [is.model, is.sandbox, is.codex_version && `Codex ${is.codex_version}`, is.not_ready].filter(Boolean).join(' · ');
        hold();
        // Schedule before reading, so a transcript failure cannot strand a running turn.
        if (sending || answering) follow();
        if (is.session) await read();
        else session.textContent = 'Nothing has been said to it yet.';
    };
    const send = pressFrom({
        id: 'codex-say', title: 'Say',
        does: async () => {
            const words = says.value.trim();
            if (!words || sending || answering || !available || disposed) return;
            sending = true;
            hold();
            failed.replaceChildren();
            follow();
            try {
                const answer = await agent.say(words);
                if (disposed) return;
                // Keep anything typed while this turn ran.
                if (says.value.trim() === words) says.value = '';
                if (answer.unwritten) failure('session', `A row of the session was not written down: ${answer.unwritten}`);
                await read();
            } finally {
                sending = false;
                // A failed turn may still have a signed transcript, or be running on the node.
                if (!disposed) await refresh().catch(error => { available = false; hold(); failure('status', error); });
            }
        },
    });
    send.element.classList.add('codex-send');
    const reload = pressFrom({ id: 'codex-refresh', title: 'Refresh', does: async () => {
        failed.replaceChildren();
        try { await refresh(); }
        catch (error) { available = false; hold(); throw error; }
    } });
    reload.element.classList.add('codex-refresh');
    form.append(says, send.element, reload.element);
    says.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send.element.click(); }
    });
    body.append(who, session, failed, status, form);
    hold();
    void refresh().catch(error => { available = false; hold(); failure('status', error); });
    return () => { disposed = true; if (timer !== undefined) clearTimeout(timer); };
}

export const needs = ['/api/agent'] as const;

export function createCodexElement(): Element {
    let stop = () => {};
    return {
        id: 'codex-element', title: 'Codex', symbol: Codex, opensAt: 'end',
        renderContent: () => {
            stop();
            const body = document.createElement('div');
            body.className = 'content-area codex';
            // The Node Agent works on today's protocol, independently of namespace support.
            const targets = [{ label: 'Node Agent', path: NODE_PATH }];
            stop = drawCodex(body, targets);
            let active = true;
            const dispose = stop;
            stop = () => { active = false; dispose(); };
            void namespaceCodexTarget(standingNamespace()).then(extra => {
                if (!active || !extra.length) return;
                // Add the option to the existing selector; the chat DOM and draft stay put.
                targets.push(...extra);
                const select = body.querySelector<HTMLSelectElement>('.codex-target')!;
                for (const target of extra) {
                    const option = document.createElement('option');
                    option.value = target.path;
                    option.textContent = target.label;
                    select.append(option);
                }
                select.hidden = false;
            }).catch(error => {
                if (!active) return;
                log.error(SEG.ELEMENT, '[Codex] namespace availability', error);
                body.append(sacredEntry(apiError('codex-targets', new Date().toISOString(), String(error), { surface: 'codex', region: 'targets' })));
            });
            return body;
        },
    };
}
