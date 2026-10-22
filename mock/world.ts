// The world the mock node holds: who you can be, and what each sees.

// > so a pond namespace, garden namespace

// > Users being ROOT, USER, PUBLIC_REGISTRATION

import type { Person } from '../ts/self-person';
import type { CanvasRow } from '../ts/api/canvases';
import type { CanvasElement, Composition, MinimizedWindow } from '../ts/generated/proto/element/proto/canvas';
import type { Level } from './reach';

const ROOT_DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
const MADE_AT = '2026-10-16T20:25:00Z';

/** The three people, by level. The DIDs of the two who are not ROOT say what they are. */
export const PEOPLE: Record<Level, Person> = {
    ROOT: {
        user: 'US-ROOT-1',
        display_name: 'root',
        name: 'root',
        picture: '',
        level: 'ROOT',
        namespaces: ['system', 'pond', 'garden'],
        door: 'pond',
        standing: 'pond',
        identity: ROOT_DID,
        via: 'session',
        accounts: [{ provider: 'google', canonical_id: 'google:104729', handle: 'root@garden.test' }],
        keys: [ROOT_DID],
    },
    USER: {
        user: 'US-SPIKE-1',
        display_name: 'Spike',
        name: 'Spike',
        picture: '',
        level: 'USER',
        namespaces: ['pond'],
        door: 'pond',
        standing: 'pond',
        identity: 'did:key:mock-spike',
        via: 'session',
        accounts: [{ provider: 'google', canonical_id: 'google:2', handle: 'spike@pond.test' }],
        keys: ['did:key:mock-spike'],
    },
    PUBLIC_REGISTRATION: {
        user: 'US-OTHER-1',
        display_name: 'newcomer',
        name: 'newcomer',
        picture: '',
        level: 'PUBLIC_REGISTRATION',
        namespaces: ['pond'],
        door: 'pond',
        standing: 'pond',
        identity: 'did:key:mock-newcomer',
        via: 'session',
        accounts: [{ provider: 'google', canonical_id: 'google:3', handle: 'newcomer@pond.test' }],
        keys: ['did:key:mock-newcomer'],
    },
};

/** `GET /auth/status`, as the page reads it: the identity, and the node's owner. */
export function authStatus(level: Level): Record<string, unknown> {
    return { identity: PEOPLE[level].identity, level, owner_did: ROOT_DID, registered: true };
}

/** `GET /api/canvases`: pond's own canvas, which everyone in pond sees. */
export function canvases(level: Level): CanvasRow[] {
    return [{
        id: 'CV-POND',
        name: 'pond',
        kind: 'namespace',
        created_by: 'US-ROOT-1',
        created_at: MADE_AT,
        disabled_by: '',
        owners: ['US-ROOT-1'],
        access: ['US-SPIKE-1', 'US-OTHER-1'],
        owner_views: [{ id: 'US-ROOT-1', name: 'root', picture: '' }],
        mine: level === 'ROOT',
    }];
}

// Symbols as ts/sym.ts has them. The registry maps a symbol to its element.
const NOTE = '▣';
const AX = '⋈';
const PROMPT = '⟶';

// A size, because the canvas draws a saved element at the size it saved (canvas-element.ts).
function element(id: string, symbol: string, x: number, y: number, width: number, height: number, content: string): CanvasElement {
    return { id, symbol, x, y, width, height, content, canvas_id: '', created_at: MADE_AT, updated_at: MADE_AT, plugin_name: '' };
}

// > the note element should clearly say its mock
function noteSaying(level: Level): string {
    const who = PEOPLE[level];
    return [
        'MOCK. This is the QNTX-Web mock: no node, no ATS, no Laye.',
        'Every answer comes from mock/fixtures and mock/world.ts; who reaches what is mock/tablet-of-reach.',
        `You are ${who.name} (${level}), standing in ${who.standing}. Switch who you are at the bottom of the page.`,
    ].join('\n\n');
}

// > the mock would have some elements placed on the canvas by default
export function canvasElements(level: Level): CanvasElement[] {
    const placed = [element('mock-note', NOTE, 80, 80, 440, 260, noteSaying(level))];
    if (level === 'PUBLIC_REGISTRATION') return placed;
    placed.push(element('mock-ax', AX, 80, 380, 440, 300, ''));
    if (level === 'ROOT') placed.push(element('mock-prompt', PROMPT, 560, 80, 440, 220, 'Say what the pond holds.'));
    return placed;
}

export function compositions(): Composition[] {
    return [];
}

export function minimizedWindows(): MinimizedWindow[] {
    return [];
}
