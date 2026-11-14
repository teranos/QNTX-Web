/**
 * The island — an approval that waits, on the Dynamic Island (ADR-052).
 *
 * Tim: a pull request that waits starts an island, and moves it as its checks
 * do. Jenny: answered, it is gone from the list and its island ends.
 */

import { describe, test, expect } from 'bun:test';
import { islandMoves, type IslandCheck } from './island';
import type { Approval } from './generated/proto/plugin/grpc/protocol/approval';

function approval(over: Partial<Approval> = {}): Approval {
    return {
        subject: 'teranos/QNTX#1396', title: 'The extended card says how it is cached',
        link: '', repo: 'teranos/QNTX', pull: 1396, sha: 'abc1234', base: 'main',
        asked_at: '2026-10-26T09:00:00Z',
        checks: [{ name: 'Go Build', state: 'done', link: '' }, { name: 'Go Tests', state: 'running', link: '' }],
        option: '', said: '', waits: true,
        ...over,
    } as Approval;
}

describe('the island', () => {
    test('a pull request that waits starts its island, saying it waits', () => {
        const moves = islandMoves(new Map(), [approval()]);
        expect(moves).toEqual([{
            command: 'plugin:island|start', key: 'teranos/QNTX#1396',
            start: {
                pullRequest: 'teranos/QNTX#1396', title: 'The extended card says how it is cached', says: 'waits on you',
                checks: [{ name: 'Go Build', state: 'done' }, { name: 'Go Tests', state: 'running' }],
            },
        }]);
    });

    test('one it holds moves with its checks, and says what stands on it', () => {
        const held = new Map([['teranos/QNTX#1396', { id: 'a1', checks: [] as IslandCheck[] }]]);
        const moves = islandMoves(held, [approval({ said: 'merge when main CI passes' })]);
        expect(moves).toEqual([{
            command: 'plugin:island|update', key: 'teranos/QNTX#1396',
            moved: { id: 'a1', says: 'merge when main CI passes', checks: [{ name: 'Go Build', state: 'done' }, { name: 'Go Tests', state: 'running' }] },
        }]);
    });

    test('gone from the list, or no longer waiting, its island ends with the checks it last had', () => {
        const last = [{ name: 'Go Build', state: 'done' }];
        const held = new Map([['teranos/QNTX#1396', { id: 'a1', checks: last }]]);
        for (const listed of [[], [approval({ waits: false })]]) {
            expect(islandMoves(held, listed)).toEqual([{
                command: 'plugin:island|end', key: 'teranos/QNTX#1396', moved: { id: 'a1', says: 'answered', checks: last },
            }]);
        }
    });

    test('one that does not wait never starts an island', () => {
        expect(islandMoves(new Map(), [approval({ waits: false })])).toEqual([]);
    });
});
