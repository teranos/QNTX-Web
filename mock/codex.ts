// Codex's own mock conversations, never the Claude agent's session.
import { Agent } from './agents';
import type { CodexAm, CodexSaid } from '../ts/codex-element';

export const codexDocument = {
    paths: Object.fromEntries(['/api/agent', '/api/agents/{namespace}'].map(path => [path, {
        get: { parameters: [{ name: 'harness', in: 'query', schema: { enum: ['claude', 'pi', 'codex'] } }] },
    }])),
};

export class CodexAgents {
    private agents = new Map<string, Agent>();

    async answer(req: Request): Promise<Response | null> {
        const url = new URL(req.url);
        const match = url.pathname.match(/^(\/api\/agent|\/api\/agents\/[^/]+)(\/say|\/session)?$/);
        if (!match) return null;
        const sent = req.method === 'POST' ? await req.clone().json() as { harness?: string; says?: string } : undefined;
        if ((sent?.harness ?? url.searchParams.get('harness')) !== 'codex') return null;
        const path = match[1]!;
        let agent = this.agents.get(path);
        if (!agent) {
            agent = new Agent(`Codex at ${path}`, `did:key:mock-codex-${path}`, undefined, 'mock-codex');
            this.agents.set(path, agent);
        }
        const json = (body: unknown, status = 200) => Response.json(body, { status });
        if (!match[2] && req.method === 'GET') {
            const is = agent.am('');
            const codex: CodexAm = {
                did: is.did, model: is.model, sandbox: 'read-only', gateway: 'mock',
                session: is.session, answering: false, codex: 'mock', codex_version: 'mock', not_ready: '',
            };
            return json({ codex });
        }
        if (match[2] === '/session' && req.method === 'GET') {
            const transcript = agent.read('');
            return json({ transcript: transcript ? {
                ...transcript,
                turns: transcript.turns.map(turn => ({ ...turn, speaker: turn.speaker === 'person' ? 'human' : 'assistant' })),
            } : null });
        }
        if (match[2] === '/say' && req.method === 'POST') {
            if (!sent?.says?.trim()) return json({ error: 'says is required' }, 400);
            const said = agent.say(sent.says, '', '', '');
            const codex: CodexSaid = {
                answer: said.answer, session: said.session, model: said.model, codex_version: 'mock',
                input_tokens: '0', output_tokens: '0', took_ms: 1, unwritten: '',
            };
            return json({ codex });
        }
        return json({ error: 'unsupported Codex mock operation' }, 405);
    }
}
