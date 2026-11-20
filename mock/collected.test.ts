import { describe, expect, test } from 'bun:test';
import { Collections, TheCollected, type Collected } from './collected';

function fixture() {
    const delivered: string[] = [];
    const alder = new TheCollected('Alder', 'did:key:alder', 'model-a', text => delivered.push(text));
    const hazel = new TheCollected('Hazel', 'did:key:hazel', 'model-b', text => delivered.push(text));
    const collections = new Collections([alder, hazel]);
    const request = (method: string, path: string, body?: Record<string, string>) => collections.answer(method, path,
        new Request(`http://localhost${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}) }));
    const post = (action: string, body: Record<string, string>) => request('POST', `/api/collected/${action}`, body);
    alder.said('Node', 'for Alder', 'did:key:node');
    hazel.said('Node', 'for Hazel', 'did:key:node');
    return { alder, hazel, delivered, request, post };
}

async function batches(response: Response | null): Promise<Collected[]> {
    expect(response?.status).toBe(200);
    return (await response!.json()).collected;
}

describe('Collections routes actions to the addressed agent', () => {
    test('GET combines recipients and preserves sender identity with distinct message ids', async () => {
        const { request, hazel } = fixture();
        hazel.said('Other', 'anonymous sender');
        const all = await batches(await request('GET', '/api/collected'));
        expect(all.map(one => [one.to, one.did, one.model])).toEqual([
            ['Alder', 'did:key:alder', 'model-a'], ['Hazel', 'did:key:hazel', 'model-b'],
        ]);
        const messages = all.flatMap(one => one.waiting);
        expect(new Set(messages.map(one => one.id)).size).toBe(3);
        expect(messages.map(one => one.from_did)).toEqual(['did:key:node', 'did:key:node', undefined]);
        expect(messages[2]).not.toHaveProperty('from_did');
    });

    test('empty recipients are omitted, including when every recipient is empty', async () => {
        const { alder, hazel, request } = fixture();
        alder.forget();
        expect((await batches(await request('GET', '/api/collected'))).map(one => one.to)).toEqual(['Hazel']);
        hazel.forget();
        expect(await batches(await request('GET', '/api/collected'))).toEqual([]);
    });

    test('edit addresses names case insensitively and returns every recipient', async () => {
        const { alder, hazel, post } = fixture();
        const id = hazel.all().collected[0]!.waiting[0]!.id;
        const all = await batches(await post('edit', { to: 'hAzEl', id, says: 'revised' }));
        expect(all).toHaveLength(2);
        expect(all[1]!.waiting[0]).toMatchObject({ id, says: 'revised', edited: true, from_did: 'did:key:node' });
        expect(alder.all().collected[0]!.waiting[0]!.says).toBe('for Alder');
    });

    test('cancel removes only the addressed message and retains unrelated recipients', async () => {
        const { hazel, post } = fixture();
        hazel.said('Other', 'keep this');
        const id = hazel.all().collected[0]!.waiting[0]!.id;
        const all = await batches(await post('cancel', { to: 'Hazel', id }));
        expect(all.map(one => one.to)).toEqual(['Alder', 'Hazel']);
        expect(all[1]!.waiting.map(one => one.says)).toEqual(['keep this']);
        expect(hazel.canceled.map(one => one.id)).toEqual([id]);
    });

    test('release delivers only the addressed batch and returns remaining recipients', async () => {
        const { alder, hazel, delivered, post } = fixture();
        const all = await batches(await post('release', { to: 'Hazel' }));
        expect(all.map(one => one.to)).toEqual(['Alder']);
        expect(delivered).toHaveLength(1);
        expect(delivered[0]).toContain('for Hazel');
        expect(delivered[0]).not.toContain('for Alder');
        expect(hazel.sent).toEqual(delivered);
        expect(alder.sent).toEqual([]);
    });

    test.each(['hold', 'later'])('%s changes only the addressed schedule and returns all recipients', async action => {
        const { alder, hazel, post } = fixture();
        const original = alder.all().collected[0]!.due;
        const hazelDue = Date.parse(hazel.all().collected[0]!.due);
        const until = new Date(hazelDue + 12 * 3_600_000).toISOString();
        const all = await batches(await post(action, { to: 'Hazel', until }));
        expect(all).toHaveLength(2);
        expect(all[0]!.due).toBe(original);
        expect(Date.parse(all[1]!.due)).toBe(action === 'hold' ? Date.parse(until) : hazelDue + 6 * 3_600_000);
        expect(all[1]!.held_until).toBe(all[1]!.due);
    });

    test.each([
        ['edit', { to: 'missing', id: 'missing' }, 404],
        ['cancel', { to: 'Hazel', id: 'missing' }, 404],
        ['edit', { to: 'Hazel', id: 'missing', says: 'bad edit' }, 404],
        ['hold', { to: 'Hazel', until: 'invalid' }, 400],
        ['release', { to: 'Hazel', ids: 'missing' }, 500],
        ['cancel', {}, 404],
    ] as const)('%s errors are preserved without mutating any recipient (%j)', async (action, body, status) => {
        const { alder, hazel, delivered, post } = fixture();
        const before = JSON.stringify([alder.all(), hazel.all()]);
        const response = await post(action, body);
        expect(response?.status).toBe(status);
        expect(await response!.json()).toHaveProperty('error');
        expect(JSON.stringify([alder.all(), hazel.all()])).toBe(before);
        expect(delivered).toEqual([]);
    });

    test.each([
        ['GET', '/api/elsewhere'], ['GET', '/api/collected-other'],
        ['GET', '/api/collected/edit'], ['DELETE', '/api/collected'],
        ['POST', '/api/collected/unknown'],
    ])('leaves unsupported route %s %s unanswered', async (method, path) => {
        const { request, alder, hazel } = fixture();
        const before = JSON.stringify([alder.all(), hazel.all()]);
        expect(await request(method!, path!, method === 'POST' ? { to: 'Hazel' } : undefined)).toBeNull();
        expect(JSON.stringify([alder.all(), hazel.all()])).toBe(before);
    });
});
