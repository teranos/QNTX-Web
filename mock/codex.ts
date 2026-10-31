// The agents as they answer in Codex: a conversation of their own per agent, never
// the one they hold in Claude, as the node keeps one session per harness.
import { Agent } from './agents';
import type { CodexAm, CodexSaid } from '../ts/agents-element';

/** The agent paths the chat asks (agentIn), and the rest of the path after them. */
function agentPath(path: string): { at: string; rest: string } | null {
    for (const root of ['/api/agents/', '/api/elements/']) {
        if (!path.startsWith(root)) continue;
        const [name, ...more] = path.slice(root.length).split('/');
        if (!name) return null;
        return { at: root + name, rest: more.length ? `/${more.join('/')}` : '' };
    }
    if (path === '/api/agent' || path.startsWith('/api/agent/')) return { at: '/api/agent', rest: path.slice('/api/agent'.length) };
    return null;
}

export class CodexAgents {
    private agents = new Map<string, Agent>();

    private agentAt(at: string): Agent {
        let agent = this.agents.get(at);
        if (!agent) {
            agent = new Agent(`Codex at ${at}`, `did:key:mock-codex${at.split('/').join('-')}`, undefined, 'mock-codex');
            this.agents.set(at, agent);
        }
        return agent;
    }

    /** The answer when the request is an agent's, in Codex; null hands it on. */
    async answer(req: Request): Promise<Response | null> {
        const url = new URL(req.url);
        const where = agentPath(url.pathname);
        if (!where || !['', '/say', '/session'].includes(where.rest)) return null;
        const sent = req.method === 'POST' ? (await req.clone().json()) as { harness?: string; says?: string } : undefined;
        if ((sent?.harness ?? url.searchParams.get('harness')) !== 'codex') return null;

        const agent = this.agentAt(where.at);
        const json = (body: unknown, status = 200) => Response.json(body, { status });
        if (where.rest === '' && req.method === 'GET') {
            const is = agent.am('');
            const codex: CodexAm = {
                did: is.did, model: is.model, gateway: 'mock', sandbox: 'read-only',
                session: is.session, answering: is.answering, codex: 'mock', not_ready: '',
            };
            return json({ codex });
        }
        if (where.rest === '/session' && req.method === 'GET') {
            const transcript = agent.read('');
            return transcript ? json({ transcript }) : json({ error: `${agent.of} has no session yet` }, 404);
        }
        if (where.rest === '/say' && req.method === 'POST') {
            if (!sent?.says?.trim()) return json({ error: 'says is required' }, 400);
            const said = await agent.say(sent.says, '', '', '');
            const codex: CodexSaid = {
                answer: said.answer, is_error: said.is_error, session: said.session, model: said.model,
                codex_version: 'mock', took_ms: said.took_ms, unwritten: said.unwritten,
            };
            return json({ codex });
        }
        return json({ error: `${req.method} ${url.pathname}: the Codex mock answers am, session and say` }, 405);
    }
}
