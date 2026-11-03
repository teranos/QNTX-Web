// The Node Agent as it answers in agy: a conversation of its own, as the node keeps
// one session per harness. Only the Node Agent runs in agy, and the node says so of any other.
import { Agent } from './agents';
import type { AgyAm, AgySaid } from '../ts/agents-element';

export class AgyAgents {
    private agent = new Agent('agy at /api/agent', 'did:key:mock-agy', undefined, 'gemini-3.8-flash');

    /** The answer when the request is the Node Agent's, in agy; null hands it on. */
    async answer(req: Request): Promise<Response | null> {
        const url = new URL(req.url);
        const rest = url.pathname === '/api/agent' ? '' : url.pathname.startsWith('/api/agent/') ? url.pathname.slice('/api/agent'.length) : null;
        if (rest === null || !['', '/say', '/session'].includes(rest)) return null;
        const sent = req.method === 'POST' ? (await req.clone().json()) as { harness?: string; says?: string } : undefined;
        if ((sent?.harness ?? url.searchParams.get('harness')) !== 'agy') return null;

        const json = (body: unknown, status = 200) => Response.json(body, { status });
        if (rest === '' && req.method === 'GET') {
            const is = this.agent.am('');
            const agy: AgyAm = {
                did: is.did, model: is.model, session: is.session, answering: is.answering,
                agy: 'mock', agy_version: 'mock', not_ready: '',
            };
            return json({ agy });
        }
        if (rest === '/session' && req.method === 'GET') {
            const transcript = this.agent.read('');
            return transcript ? json({ transcript }) : json({ error: `${this.agent.of} has no session yet` }, 404);
        }
        if (rest === '/say' && req.method === 'POST') {
            if (!sent?.says?.trim()) return json({ error: 'says is required' }, 400);
            const said = await this.agent.say(sent.says, '', '', '');
            const agy: AgySaid = {
                answer: said.answer, session: said.session, model: said.model, agy_version: 'mock',
                took_ms: said.took_ms, unwritten: said.unwritten,
            };
            return json({ agy });
        }
        return json({ error: `${req.method} ${url.pathname}: the agy mock answers am, session and say` }, 405);
    }
}
