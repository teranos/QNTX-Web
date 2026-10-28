/**
 * The island — an approval that waits, on the Dynamic Island (ADR-052).
 */

// "the magic island"
// "Push notifications is something I want though, especially for approvals"

// QNTX-App draws it (plugin island, a Live Activity); the page says what stands.
// Read when the page starts in the shell and when the node tells it an approval
// moved, whether or not the Approvals element is open. The presses stay in the
// element: "Approvals is human only" "And only through it's element".

import { invoke } from '@tauri-apps/api/core';
import { apiJson } from './client';
import { log, SEG } from './logger';
import type { Approval, Approvals } from './generated/proto/plugin/grpc/protocol/approval';

const APPROVALS_PATH = '/api/approvals';

/** What the shell is asked to do with an island, as plugin island names it. */
export type IslandMove =
    | { command: 'plugin:island|start'; key: string; start: IslandStart }
    | { command: 'plugin:island|update'; key: string; moved: IslandMoved }
    | { command: 'plugin:island|end'; key: string; moved: IslandMoved };

export interface IslandCheck {
    name: string;
    state: string;
}

export interface IslandStart {
    pullRequest: string;
    title: string;
    says: string;
    checks: IslandCheck[];
}

export interface IslandMoved {
    id: string;
    says: string;
    checks: IslandCheck[];
}

/** One approval as the island keeps it: by its pull request, since a push to a new head is the same island. */
function keyOf(approval: Approval): string {
    return approval.subject;
}

/** What the island says now: what stands on the approval, or that it waits. */
function saysOf(approval: Approval): string {
    return approval.said || 'waits on you';
}

function checksOf(approval: Approval): IslandCheck[] {
    return approval.checks.map((c) => ({ name: c.name, state: c.state }));
}

/**
 * Exported for tests: what the shell is asked to do, from the islands it holds
 * (pull request → island id) and what the node lists now. One that waits and has
 * none starts; one it holds moves; one gone from the list, or no longer waiting,
 * ends with the checks it last had.
 */
export function islandMoves(held: Map<string, { id: string; checks: IslandCheck[] }>, approvals: Approval[]): IslandMove[] {
    const moves: IslandMove[] = [];
    const listed = new Set<string>();
    for (const approval of approvals) {
        if (!approval.waits) continue;
        const key = keyOf(approval);
        listed.add(key);
        const one = held.get(key);
        if (one) {
            moves.push({ command: 'plugin:island|update', key, moved: { id: one.id, says: saysOf(approval), checks: checksOf(approval) } });
            continue;
        }
        moves.push({
            command: 'plugin:island|start', key,
            start: { pullRequest: approval.subject, title: approval.title || approval.subject, says: saysOf(approval), checks: checksOf(approval) },
        });
    }
    for (const [key, one] of held) {
        if (listed.has(key)) continue;
        moves.push({ command: 'plugin:island|end', key, moved: { id: one.id, says: 'answered', checks: one.checks } });
    }
    return moves;
}

const held = new Map<string, { id: string; checks: IslandCheck[] }>();

/** Asks the shell for each move, keeping the ids it starts islands under. */
async function move(each: IslandMove): Promise<void> {
    if (each.command === 'plugin:island|start') {
        const { id } = await invoke<{ id: string }>(each.command, { start: each.start });
        held.set(each.key, { id, checks: each.start.checks });
        return;
    }
    await invoke(each.command, { moved: each.moved });
    if (each.command === 'plugin:island|end') held.delete(each.key);
    else held.set(each.key, { id: each.moved.id, checks: each.moved.checks });
}

/** In the shell, puts what the node lists as waiting on the island. Elsewhere there is no island. */
export async function followOnIsland(): Promise<void> {
    if (!window.__TAURI__) return;
    let approvals: Approval[];
    try {
        const answered = await apiJson<Approvals>(APPROVALS_PATH);
        if (!Array.isArray(answered.approvals)) throw new Error('the node answered the approvals with no list');
        approvals = answered.approvals;
    } catch (err: unknown) {
        log.warn(SEG.UI, 'The island did not read the approvals:', err instanceof Error ? err.message : String(err));
        return;
    }
    for (const each of islandMoves(held, approvals)) {
        try {
            await move(each);
        } catch (err: unknown) {
            log.warn(SEG.UI, `The island did not ${each.command.slice('plugin:island|'.length)} ${each.key}:`, err instanceof Error ? err.message : String(err));
        }
    }
}
