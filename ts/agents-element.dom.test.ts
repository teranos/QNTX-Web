/**
 * @jest-environment jsdom
 *
 * Agents element: every agent this person reaches, each a chat, the harness a tab.
 */

import { describe, test, expect } from 'bun:test';
import { drawAgents, piAsAm, piAsSaid, type Reachable, type Harness } from './agents-element';
import type { ClaudeAm, ClaudeSaid, NodeAgent } from './claude-element';

const USE_JSDOM = process.env.USE_JSDOM === '1';

const am: ClaudeAm = {
    did: 'did:key:z6Mkq', model: 'claude-opus-5-5', effort: 'low', permission_mode: 'dontAsk',
    permission_modes: ['acceptEdits', 'plan'], allow: ['Bash'], session: '', answering: false,
    claude_code: '/claude', not_ready: '', signed_in: true, auth_method: 'claude.ai',
};
const said: ClaudeSaid = {
    answer: 'Up 3 days.', is_error: false, subtype: 'success', session: 's-1', model: 'claude-opus-5-5',
    claude_code: '2.1.289', permission_mode: 'dontAsk', denied: [], cost_usd: 0, took_ms: 1, unwritten: '',
};

async function settled(): Promise<void> {
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

describe('Agents', () => {
    if (!USE_JSDOM) {
        test.skip('Skipped locally (run with USE_JSDOM=1 to enable)', () => {});
        return;
    }

    const reached: Reachable[] = [
        { id: 'node', called: 'Node Agent', at: '/api/agent', kind: 'node' },
        { id: 'story:story-1-x', called: '1  ROOT invites a user', at: '/api/elements/story-1-x', kind: 'story' },
    ];
    const asked: Array<[string, Harness]> = [];
    const chatOf = (agent: Reachable, harness: Harness): NodeAgent => {
        asked.push([agent.id, harness]);
        return { am: () => Promise.resolve({ ...am, model: `${harness}-model` }), say: () => Promise.resolve(said), read: () => Promise.resolve(undefined) };
    };

    // "the Agents Element as the main entry-point into all Agents that User has access to"
    test('every agent reached is listed, the first is the chat, and another is chosen by pressing it', async () => {
        const body = document.createElement('div');
        asked.length = 0;
        const stop = drawAgents(body, Promise.resolve(reached), chatOf);
        await settled();
        const rows = Array.from(body.querySelectorAll('.agents-row')).map(r => r.textContent);
        expect(rows).toEqual(['Node Agent', '1  ROOT invites a user']);
        expect(body.querySelector('.agents-row-on')?.textContent).toBe('Node Agent');
        expect(body.querySelector('.claude-says')).not.toBeNull();
        expect(asked[0]).toEqual(['node', 'claude']);
        body.querySelectorAll<HTMLButtonElement>('.agents-row')[1]!.click();
        await settled();
        expect(body.querySelector('.agents-row-on')?.textContent).toBe('1  ROOT invites a user');
        expect(asked[asked.length - 1]).toEqual(['story:story-1-x', 'claude']);
        stop();
    });

    // "THEY ARE MORE LIKE TABS WITHIN A WINDOW"
    test('the harness is a tab: pressing pi draws the same agent in Pi', async () => {
        const body = document.createElement('div');
        asked.length = 0;
        const stop = drawAgents(body, Promise.resolve(reached), chatOf);
        await settled();
        const tabs = Array.from(body.querySelectorAll('.agents-tab')).map(t => t.textContent);
        expect(tabs).toEqual(['claude', 'pi', 'codex']);
        expect(body.querySelector('.agents-tab-on')?.textContent).toBe('claude');
        body.querySelectorAll<HTMLButtonElement>('.agents-tab')[1]!.click();
        await settled();
        expect(body.querySelector('.agents-tab-on')?.textContent).toBe('pi');
        expect(asked[asked.length - 1]).toEqual(['node', 'pi']);
        stop();
    });

    // "each element is an agent as well": every element the viewer was given is listed, shaken or not.
    test('every element the viewer was given is an agent to talk to, the held ones beside them, none twice', async () => {
        const { reachableAgents } = await import('./agents-element');
        const { elementsOfTheViewer } = await import('./default-elements');
        elementsOfTheViewer.length = 0;
        elementsOfTheViewer.push({ id: 'db-element', title: 'Database' }, { id: 'agent-element', title: 'Agents' }, { id: 'ground-element', title: 'Ground' });
        const ask = (async (path: string) => {
            if (path === '/api/agent?harness=claude') return { claude: am };
            if (path === '/api/elements') return { agents: [{ element: 'ground-element', session: 's-g', answering: false }, { element: 'shaken-thing', session: 's-x', answering: false }, { element: 'story-1-x', session: '', answering: false }] };
            throw new Error(`${path}: not in this test`);
        }) as <T>(path: string) => Promise<T>;
        const found = await reachableAgents('', ask);
        const elements = found.filter(a => a.kind === 'element').map(a => a.called);
        expect(elements).toEqual(['Database', 'Ground', 'shaken-thing']);
        expect(found.filter(a => a.kind === 'element').map(a => a.at)).toContain('/api/elements/shaken-thing');
    });

    test('pi am and pi say are drawn as the chat draws any harness', () => {
        const is = piAsAm({ did: 'd', model: 'm', thinking: 'low', gateway: 'g', session: 's', answering: false, pi: '/pi', pi_version: '1', not_ready: '' });
        expect(is.model).toBe('m');
        expect(is.permission_modes).toEqual([]);
        const answer = piAsSaid({ answer: 'hi', is_error: false, stop: 'end', session: 's', model: 'm', pi_version: '1', cost_usd: 0, took_ms: 1, unwritten: '' });
        expect(answer.answer).toBe('hi');
    });
});
