// Agents Element — the one door to every agent this person reaches: the Node
// Agent, the agent of the namespace they stand in, the stories' agents. One
// chat each, with the harness picked like a tab in a window.

// "the Agents Element as the main entry-point into all Agents that User has
// access to. Like the Node Agent, Namespace Agent, Element Agent, Story
// Agent's, etc."

// "IN MY MIND, THERE IS ONE FUCKING CHAT, WHERE I CAN SWITCH HARNESS, AND THEN
// I TALK TO CODEX, AND THEN I TALK TO PI, AND THEY ARE MORE LIKE TABS WITHIN A WINDOW."

import type { Element } from '@teranos/elements';
import { preventDrag } from '@teranos/elements';
import { openElement } from './sidebar.ts';
import { apiJson } from './client';
import { log, SEG } from './logger.ts';
import { Agent } from './sym';
import { standingNamespace } from './standing.ts';
import { drawClaude, sayBody, readLive, type ClaudeAm, type ClaudeSaid, type NodeAgent } from './claude-element';
import type { SessionRead } from './chat';
import { backendPath } from './client/url';
import { drawNamespaceAgent, agentOf } from './agent-element';
import { storyAgent, type Story } from './stories-element';
import { elementsOfTheViewer } from './default-elements';

export const ELEMENT_ID = 'agent-element';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** The harnesses a chat can run in, as the node names them. */
export const HARNESSES = ['claude', 'pi', 'codex'] as const;
export type Harness = (typeof HARNESSES)[number];

// Who the Node Agent is in Pi (pi am), and what it answered there (pi say).
export interface PiAm {
    did: string; model: string; thinking: string; gateway: string; session: string;
    answering: boolean; pi: string; pi_version: string; not_ready: string;
}
export interface PiSaid {
    answer: string; is_error: boolean; stop: string; session: string; model: string;
    pi_version: string; cost_usd: number; took_ms: number; unwritten: string;
}
// In Codex (codex am, codex say).
export interface CodexAm {
    did: string; model: string; gateway: string; sandbox: string; session: string;
    answering: boolean; codex?: string; not_ready?: string;
}
export interface CodexSaid {
    answer: string; is_error?: boolean; session: string; model: string; codex_version: string;
    input_tokens?: number; output_tokens?: number; took_ms?: number; unwritten?: string;
}

/** pi am as the chat draws who answers. */
export function piAsAm(is: PiAm): ClaudeAm {
    return {
        did: is.did, model: is.model, effort: is.thinking,
        permission_mode: '', permission_modes: [], allow: [],
        session: is.session, answering: is.answering, claude_code: is.pi,
        not_ready: is.not_ready, signed_in: true, auth_method: is.gateway,
    };
}

/** pi say as the chat draws an answer. */
export function piAsSaid(said: PiSaid): ClaudeSaid {
    return {
        answer: said.answer, is_error: said.is_error, subtype: said.stop,
        session: said.session, model: said.model, claude_code: said.pi_version,
        permission_mode: '', denied: [], cost_usd: said.cost_usd,
        took_ms: said.took_ms, unwritten: said.unwritten,
    };
}

/** codex am as the chat draws who answers. */
export function codexAsAm(is: CodexAm): ClaudeAm {
    return {
        did: is.did, model: is.model, effort: is.sandbox,
        permission_mode: '', permission_modes: [], allow: [],
        session: is.session, answering: is.answering, claude_code: is.codex ?? '',
        not_ready: is.not_ready ?? '', signed_in: true, auth_method: is.gateway,
    };
}

/** codex say as the chat draws an answer. */
export function codexAsSaid(said: CodexSaid): ClaudeSaid {
    return {
        answer: said.answer, is_error: said.is_error ?? false, subtype: '',
        session: said.session, model: said.model, claude_code: said.codex_version,
        permission_mode: '', denied: [], cost_usd: 0,
        took_ms: said.took_ms ?? 0, unwritten: said.unwritten ?? '',
    };
}

/** What the node answers of an agent, by harness. */
interface AmAnswer { claude?: ClaudeAm | null; pi?: PiAm | null; codex?: CodexAm | null }
interface SaidAnswer { claude?: ClaudeSaid | null; pi?: PiSaid | null; codex?: CodexSaid | null }

/** One agent at its path, in one harness, as the chat asks it. */
export function agentIn(at: string, harness: Harness, unwrap: (answer: unknown) => AmAnswer = a => a as AmAnswer): NodeAgent {
    const amOf = (answer: unknown): ClaudeAm => {
        const is = unwrap(answer);
        if (harness === 'pi' && is.pi) return piAsAm(is.pi);
        if (harness === 'codex' && is.codex) return codexAsAm(is.codex);
        if (harness === 'claude' && is.claude) return is.claude;
        throw new Error(`${at} answers for no ${harness}`);
    };
    const saidOf = (answer: SaidAnswer): ClaudeSaid => {
        if (harness === 'pi' && answer.pi) return piAsSaid(answer.pi);
        if (harness === 'codex' && answer.codex) return codexAsSaid(answer.codex);
        if (answer.claude) return answer.claude;
        throw new Error(`${at} answered in no ${harness}`);
    };
    return {
        am: () => apiJson<unknown>(`${at}?harness=${harness}`).then(amOf),
        say: (says, mode, carried, model) => {
            const body = JSON.parse(sayBody(says, mode, carried, model)) as Record<string, string>;
            body.harness = harness;
            return apiJson<SaidAnswer>(`${at}/say`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }).then(saidOf);
        },
        read: () => apiJson<{ transcript: SessionRead }>(`${at}/session?harness=${harness}`).then(answer => answer.transcript),
        // Only Claude Code prints to a stream the node tails (QNTX server/agent_live.go).
        live: harness === 'claude' ? (onEvent, onEnd) => readLive(backendPath(`${at}/live?harness=claude`), onEvent, onEnd) : undefined,
    };
}

/** An agent this person reaches: what it is called, where it answers, and how its am is unwrapped. */
export interface Reachable {
    id: string;
    called: string;
    at: string;
    kind: 'node' | 'namespace' | 'story' | 'element';
    unwrap?: (answer: unknown) => AmAnswer;
}

function part<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    el.className = className;
    return el;
}

/** The agents this person reaches, asked of the node: each one that answers am is listed. */
export async function reachableAgents(namespace: string, ask: <T>(path: string) => Promise<T> = apiJson): Promise<Reachable[]> {
    const found: Reachable[] = [];
    const tryOne = async (agent: Reachable) => {
        try { await ask(`${agent.at}?harness=claude`); found.push(agent); }
        catch (err: unknown) { log.info(SEG.ELEMENT, `[Agents] ${agent.called} is not reached: ${err instanceof Error ? err.message : String(err)}`); }
    };
    await tryOne({ id: 'node', called: 'Node Agent', at: '/api/agent', kind: 'node' });
    // The agent of the namespace stood in is listed whether or not it is set up
    // yet: its chat is where it is signed in, or where the node says why not.
    if (namespace) {
        found.push({ id: `namespace:${namespace}`, called: `the agent of ${namespace}`, at: `/api/agents/${encodeURIComponent(namespace)}`, kind: 'namespace',
            unwrap: a => ({ claude: (a as { agent?: ClaudeAm }).agent }) });
    }
    // The element agents are ROOT's, as the Node Agent is: listed when it is.
    // "each element is an agent as well": every element this viewer was given,
    // shaken or not, and every one the node holds beyond those.
    if (found.some(a => a.kind === 'node')) {
        const listed = new Set<string>();
        const element = (id: string, called: string) => {
            if (listed.has(id) || id === ELEMENT_ID) return;
            listed.add(id);
            found.push({ id: `element:${id}`, called, at: `/api/elements/${encodeURIComponent(id)}`, kind: 'element' });
        };
        for (const each of elementsOfTheViewer) element(each.id, each.title);
        try {
            const held = await ask<{ agents: Array<{ element: string; session: string; answering: boolean }> }>('/api/elements');
            for (const each of held.agents) {
                if (each.element.startsWith('story-')) continue;
                element(each.element, each.element);
            }
        } catch (err: unknown) {
            log.info(SEG.ELEMENT, `[Agents] no element agents listed: ${err instanceof Error ? err.message : String(err)}`);
        }
        try {
            const r = await fetch('stories.json');
            if (r.ok) {
                const stories = await r.json() as Story[];
                for (const story of stories) {
                    const id = storyAgent(story);
                    found.push({ id: `story:${id}`, called: `${story.name.split('-')[0]}  ${story.feature}`, at: `/api/elements/${encodeURIComponent(id)}`, kind: 'story' });
                }
            }
        } catch (err: unknown) {
            log.info(SEG.ELEMENT, `[Agents] no stories listed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return found;
}

/**
 * One agent's chat drawn into body, with its harness picked as a tab: the chat
 * is drawn anew for the harness chosen, each harness its own session.
 */
export function drawAgentChat(body: HTMLElement, agent: Reachable, chatOf: (agent: Reachable, harness: Harness) => NodeAgent = (a, h) => agentIn(a.at, h, a.unwrap)): () => void {
    const tabs = part('div', 'agents-tabs');
    const talk = part('div', 'agents-talk');
    body.replaceChildren(tabs, talk);
    let settle = () => {};
    let chosen: Harness = 'claude';

    const draw = () => {
        settle();
        for (const tab of tabs.querySelectorAll<HTMLButtonElement>('.agents-tab')) tab.classList.toggle('agents-tab-on', tab.dataset.harness === chosen);
        if (agent.kind === 'namespace' && chosen === 'claude') {
            // The namespace agent signs in on its own account first (ADR-048).
            const namespace = decodeURIComponent(agent.at.slice('/api/agents/'.length));
            settle = drawNamespaceAgent(talk, namespace, agentOf(namespace));
            return;
        }
        settle = drawClaude(talk, chatOf(agent, chosen));
        const says = talk.querySelector<HTMLTextAreaElement>('.claude-says');
        if (says) says.placeholder = `Say something to ${agent.called}`;
    };

    for (const harness of HARNESSES) {
        const tab = part('button', 'qntx-btn qntx-btn-small agents-tab');
        tab.type = 'button';
        tab.dataset.harness = harness;
        tab.textContent = harness;
        tab.addEventListener('click', () => { if (chosen !== harness) { chosen = harness; draw(); } });
        tabs.append(tab);
    }
    preventDrag(tabs);
    draw();
    return () => settle();
}

/** The Agents element drawn into body: the agents reached, and the chat of the one chosen. */
export function drawAgents(body: HTMLElement, agents: Promise<Reachable[]>, chatOf?: (agent: Reachable, harness: Harness) => NodeAgent): () => void {
    const list = part('div', 'agents-list');
    const chat = part('div', 'agents-chat');
    body.replaceChildren(list, chat);
    list.textContent = 'Asking the node who you reach…';
    let settle = () => {};

    const choose = (agent: Reachable) => {
        for (const row of list.querySelectorAll<HTMLButtonElement>('.agents-row')) row.classList.toggle('agents-row-on', row.dataset.agent === agent.id);
        settle();
        settle = drawAgentChat(chat, agent, chatOf);
    };

    agents.then(found => {
        list.replaceChildren();
        if (found.length === 0) { list.textContent = 'You reach no agent here.'; return; }
        for (const agent of found) {
            const row = part('button', 'qntx-btn qntx-btn-ghost qntx-btn-small agents-row');
            row.type = 'button';
            row.dataset.agent = agent.id;
            row.dataset.kind = agent.kind;
            row.textContent = agent.called;
            row.addEventListener('click', () => choose(agent));
            list.append(row);
        }
        preventDrag(list);
        choose(found[0]!);
    }).catch((err: unknown) => {
        list.textContent = err instanceof Error ? err.message : String(err);
    });
    return () => settle();
}

// Who this is for: whoever reaches the agent of a namespace, which is everyone who stands in one (audience.ts).
export const needs = ['/api/agents/{namespace}'] as const;

export function createAgentsElement(): Element {
    return {
        id: ELEMENT_ID,
        title: 'Agents',
        symbol: Agent,
        opensAt: 'end',
        renderContent: () => {
            const body = part('div', 'content-area chat agents');
            drawAgents(body, reachableAgents(standingNamespace()));
            return body;
        },
    };
}

/** Opens the Agents element. */
export function openAgentsElement(): void {
    openElement(ELEMENT_ID);
}

/** The same, by its earlier name. */
export const openAgentElement = openAgentsElement;
