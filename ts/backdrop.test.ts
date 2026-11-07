// The ground under everything: offered by an element, chosen by the viewer, taken over by an element and given back.

// "via /g/"
// "i want backdrop glovbal"
// "i want element to be able to override global backdrop"
// "Goal set: global backdrop, element backdrop overwrite, via /g/, default global backdrop can be boring is ok. option to choose between backdrops by clicking on profile pic."

import { describe, test, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { NONE, backdropHeldBy, backdropLayer, chooseBackdrop, chosenBackdrop, fishOf, holdBackdrop, offerBackdrop, offeredBackdrops, resetBackdrop, takeBackdrop, type BackdropFn } from './backdrop';

const nodeFish = ['node-claude', 'node-codex', 'node-agy'].map(name => fishOf({ name, harness: name.slice(5) }));

// The node, as the pulse reads it: one item, well. Stubbed at fetch, as ts/client/http.test.ts does, and put back after.
const originalFetch = globalThis.fetch;
beforeAll(() => {
    globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({ items: [{ name: 'q', symbol: '+', note: 'up' }] }), { status: 200 }))) as typeof fetch;
});
// The pulse a showing ground starts would keep asking the node into the next file's fetches: stop it with the file.
afterAll(() => { resetBackdrop(); globalThis.fetch = originalFetch; });

// Where the choice is kept: a Map standing in for this browser's storage, which cannot open under happy-dom.
const kept = new Map<string, string>();
const keepInMap = { get: (key: string) => kept.get(key) ?? null, set: (key: string, value: string) => { kept.set(key, value); } };

function aGround(name: string, stops: string[]): BackdropFn {
    return (layer, held) => {
        const canvas = document.createElement('canvas');
        canvas.dataset.ground = name;
        if (held.room) canvas.dataset.agents = held.room.agents.map(fish => fish.name).join(',');
        layer.appendChild(canvas);
        return () => { stops.push(name); canvas.remove(); };
    };
}

async function settled(): Promise<void> {
    for (let i = 0; i < 4; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

describe('the ground', () => {
    beforeEach(() => {
        resetBackdrop(keepInMap);
        document.body.innerHTML = '<div id="backdrop" class="backdrop"></div>';
        kept.clear();
    });

    test('an element that offers a ground fills the layer; the first offered is the one showing', async () => {
        const stops: string[] = [];
        offerBackdrop('piranha', aGround('piranha', stops));
        await settled();
        expect(backdropLayer()?.querySelector('canvas')?.dataset.ground).toBe('piranha');
        expect(backdropHeldBy()).toBe('piranha');
        expect(offeredBackdrops()).toEqual(['piranha']);
    });

    test('an element takes the ground over, the offered ground stops, and giving it back brings the offered ground back', async () => {
        const stops: string[] = [];
        offerBackdrop('piranha', aGround('piranha', stops));
        await settled();
        const mine = document.createElement('div');
        mine.dataset.elementId = 'room:node-room';
        const giveBack = takeBackdrop(mine);
        expect(backdropLayer()?.firstElementChild).toBe(mine);
        expect(backdropLayer()?.dataset.heldBy).toBe('room:node-room');
        expect(backdropHeldBy()).toBe('room:node-room');
        expect(stops).toEqual(['piranha']);
        giveBack();
        await settled();
        expect(backdropLayer()?.dataset.heldBy).toBeUndefined();
        expect(backdropLayer()?.querySelector('canvas')?.dataset.ground).toBe('piranha');
        expect(backdropHeldBy()).toBe('piranha');
    });

    test('a room holds the ground with its agents in it; closed, the ground is as it was', async () => {
        const stops: string[] = [];
        offerBackdrop('piranha', aGround('piranha', stops));
        await settled();
        const giveBack = holdBackdrop('room:node-room', { room: { name: 'Node Room', agents: nodeFish } });
        expect(stops).toEqual(['piranha']);
        expect(backdropLayer()?.dataset.heldBy).toBe('room:node-room');
        expect(backdropHeldBy()).toBe('room:node-room');
        expect(backdropLayer()?.querySelector('canvas')?.dataset.agents).toBe('node-claude,node-codex,node-agy');
        giveBack();
        await settled();
        expect(stops).toEqual(['piranha', 'piranha']);
        expect(backdropHeldBy()).toBe('piranha');
        expect(backdropLayer()?.querySelector('canvas')?.dataset.agents).toBeUndefined();
    });

    test('the viewer chooses another ground while a room holds it: the room holds the one chosen now', async () => {
        const stops: string[] = [];
        offerBackdrop('pond', aGround('pond', stops));
        offerBackdrop('piranha', aGround('piranha', stops));
        await settled();
        const giveBack = holdBackdrop('room:node-room', { room: { name: 'Node Room', agents: nodeFish } });
        expect(backdropLayer()?.dataset.holds).toBe('pond');
        chooseBackdrop('piranha');
        expect(backdropLayer()?.dataset.holds).toBe('piranha');
        expect(backdropLayer()?.dataset.heldBy).toBe('room:node-room');
        expect(backdropLayer()?.querySelector('canvas')?.dataset.ground).toBe('piranha');
        expect(backdropLayer()?.querySelector('canvas')?.dataset.agents).toBe('node-claude,node-codex,node-agy');
        expect(stops).toEqual(['pond', 'pond']);
        chooseBackdrop(NONE);
        expect(backdropLayer()?.childElementCount).toBe(0);
        expect(backdropHeldBy()).toBe(NONE);
        giveBack();
        expect(backdropLayer()?.childElementCount).toBe(0);
    });

    test('a room holds nothing while the ground is plain', async () => {
        offerBackdrop('piranha', aGround('piranha', []));
        await settled();
        chooseBackdrop(NONE);
        const giveBack = holdBackdrop('room:node-room', { room: { name: 'Node Room', agents: nodeFish.slice(0, 1) } });
        expect(backdropLayer()?.childElementCount).toBe(0);
        expect(backdropHeldBy()).toBe(NONE);
        giveBack();
        expect(backdropHeldBy()).toBe(NONE);
    });

    test('a fish is its model and effort: stronger model, bigger; more effort, faster; unknown, the plain fish', () => {
        // "stronger model is stronger bigger fish"
        // "effort translated to speed"
        const opus = fishOf({ name: 'node-claude', harness: 'claude', model: 'claude-opus-5-5', effort: 'low' });
        const haiku = fishOf({ name: 'x', harness: 'claude', model: 'claude-haiku-5-5', effort: 'max' });
        const flash = fishOf({ name: 'node-agy', harness: 'agy', model: 'gemini-3.6-flash' });
        const plain = fishOf({ name: 'y', harness: 'codex' });
        expect(opus.strength).toBeGreaterThan(haiku.strength);
        expect(haiku.speed).toBeGreaterThan(opus.speed);
        expect(flash.strength).toBe(0.4);
        expect(flash.speed).toBe(0.6);
        expect(plain).toEqual({ name: 'y', harness: 'codex', model: '', effort: '', strength: 0.5, speed: 0.6 });
    });

    test('the viewer chooses plain, and the layer is empty; chooses piranha, and it is back; the choice is kept', async () => {
        const stops: string[] = [];
        offerBackdrop('piranha', aGround('piranha', stops));
        await settled();
        chooseBackdrop(NONE);
        expect(backdropLayer()?.childElementCount).toBe(0);
        expect(chosenBackdrop()).toBe(NONE);
        expect(backdropHeldBy()).toBe(NONE);
        expect(kept.get('backdrop-chosen')).toBe(NONE);
        chooseBackdrop('piranha');
        expect(backdropLayer()?.querySelector('canvas')?.dataset.ground).toBe('piranha');
        expect(chosenBackdrop()).toBe('piranha');
    });

    test('a second ground offered is listed, and shows only when chosen', async () => {
        const stops: string[] = [];
        offerBackdrop('piranha', aGround('piranha', stops));
        offerBackdrop('aurora', aGround('aurora', stops));
        await settled();
        expect(offeredBackdrops()).toEqual(['piranha', 'aurora']);
        expect(backdropHeldBy()).toBe('piranha');
        chooseBackdrop('aurora');
        expect(backdropLayer()?.querySelector('canvas')?.dataset.ground).toBe('aurora');
        expect(stops).toEqual(['piranha']);
    });
});
