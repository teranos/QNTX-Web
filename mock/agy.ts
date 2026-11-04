// The Node Agent and a namespace's agent as they answer in agy: a conversation of their
// own, as the node keeps one session per harness. A namespace's answers as the node
// wraps them, and its first am says its owner connects it to Google Cloud.
import { Agent } from './agents';
import type { AgyAm, AgySaid } from '../ts/agents-element';

/** The agent paths agy answers at, the namespace when it is one, and the rest of the path. */
function agyPath(path: string): { at: string; namespace: string; rest: string } | null {
    if (path === '/api/agent' || path.startsWith('/api/agent/')) return { at: '/api/agent', namespace: '', rest: path.slice('/api/agent'.length) };
    if (!path.startsWith('/api/agents/')) return null;
    const [name, ...more] = path.slice('/api/agents/'.length).split('/');
    if (!name) return null;
    return { at: '/api/agents/' + name, namespace: decodeURIComponent(name), rest: more.length ? `/${more.join('/')}` : '' };
}

export class AgyAgents {
    private agents = new Map<string, Agent>();

    private agentAt(at: string): Agent {
        let agent = this.agents.get(at);
        if (!agent) {
            agent = new Agent(`agy at ${at}`, `did:key:mock-agy${at.split('/').join('-')}`, undefined, 'gemini-3.8-flash');
            this.agents.set(at, agent);
        }
        return agent;
    }

    /** The answer when the request is an agent's, in agy; null hands it on. */
    async answer(req: Request): Promise<Response | null> {
        const url = new URL(req.url);
        const where = agyPath(url.pathname);
        if (!where || !['', '/say', '/session'].includes(where.rest)) return null;
        const { rest, namespace } = where;
        const agent = this.agentAt(where.at);
        const sent = req.method === 'POST' ? (await req.clone().json()) as { harness?: string; says?: string } : undefined;
        if ((sent?.harness ?? url.searchParams.get('harness')) !== 'agy') return null;

        const json = (body: unknown, status = 200) => Response.json(body, { status });
        if (rest === '' && req.method === 'GET') {
            const is = agent.am('');
            const agy: AgyAm = {
                did: is.did, model: is.model, session: is.session, answering: is.answering,
                agy: 'mock', agy_version: 'mock', not_ready: '',
            };
            if (namespace && !agent.read('')) {
                agy.not_ready = `its owner has not connected ${namespace} to Google Cloud, which its agent runs on in agy`;
                agy.google_connect = `/auth/google/cloud?namespace=${encodeURIComponent(namespace)}&thing=agy`;
            }
            return json(namespace ? { namespace, agy } : { agy });
        }
        if (rest === '/session' && req.method === 'GET') {
            const transcript = agent.read('');
            return transcript ? json({ transcript }) : json({ error: `${agent.of} has no session yet` }, 404);
        }
        if (rest === '/say' && req.method === 'POST') {
            if (!sent?.says?.trim()) return json({ error: 'says is required' }, 400);
            const said = await agent.say(sent.says, '', '', '');
            const agy: AgySaid = {
                answer: said.answer, session: said.session, model: said.model, agy_version: 'mock',
                took_ms: said.took_ms, unwritten: said.unwritten,
            };
            return json({ agy });
        }
        return json({ error: `${req.method} ${url.pathname}: the agy mock answers am, session and say` }, 405);
    }
}
