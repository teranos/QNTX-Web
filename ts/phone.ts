// The phone ROOT carries: it hands the node the token it is reached by, and
// when ROOT comes in from a notification it opens on what is about to be said.
// "i want to see it on my phone, for the duration of 15 minutes before a collected message is sent"
// "listen, a simpler version will work for me, i just want to get the hard part out of the way"
// The node says it (QNTX server/phones.go); the app asks Apple for the token (QNTX-App push/).

import { invoke } from '@tauri-apps/api/core';
import { apiJson } from './client';
import { log, SEG } from './logger.ts';
import { theCollection, openWhenShown, type Collected, type Collection } from './collected-element';
import type { Person } from './self-person';

/** What the app answers when asked for the phone's token (QNTX-App push/src/lib.rs). */
export interface PhoneToken {
    token: string;
    platform: string;
}

// How long before it is sent the node tells the phone: what is sent within it is what the phone opens on.
const ABOUT_TO_MS = 900_000;

const wordsOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** What waits that is sent within the time the node tells the phone of it, soonest first. */
export function aboutToBeSaid(all: Collected[], now: number = Date.now()): Collected[] {
    return all
        .filter(one => one.waiting.length > 0)
        .filter(one => { const left = Date.parse(one.due) - now; return left > 0 && left <= ABOUT_TO_MS; })
        .sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
}

/** The phone's token, handed to the node in the person's own session. */
export async function handOver(
    ask: () => Promise<PhoneToken> = () => invoke<PhoneToken>('plugin:push|token'),
    keep: (held: PhoneToken) => Promise<unknown> = held => apiJson('/api/phones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: held.token, platform: held.platform }),
    }),
): Promise<boolean> {
    const held = await ask();
    await keep(held);
    return true;
}

/**
 * ROOT's phone: the token handed over once, and the chat opened on what is
 * about to be said whenever the app comes to the front. What it gives back is
 * whether this is a phone the node can tell: only the app, and only ROOT.
 */
export function rootsPhone(
    who: Person | null,
    node: Collection = theCollection,
    open: (did: string) => void = openOnWhatWaits,
    inApp: boolean = !!window.__TAURI__,
    hand: () => Promise<boolean> = handOver,
): boolean {
    if (!inApp || who?.level !== 'ROOT') return false;

    // Refused off iOS, and when notifications are off for QNTX: said, and nothing else changes.
    hand()
        .then(() => log.info(SEG.UI, '[Phone] the node holds the token it reaches this phone by'))
        .catch((err: unknown) => log.warn(SEG.UI, `[Phone] the node was not handed this phone's token: ${wordsOf(err)}`));

    // Each time it is due is opened on once: closed by the person, it is not opened again for that time.
    const opened = new Set<string>();
    const look = () => {
        if (document.visibilityState !== 'visible') return;
        node.list()
            .then(all => {
                const next = aboutToBeSaid(all)[0];
                if (!next || opened.has(`${next.did} ${next.due}`)) return;
                opened.add(`${next.did} ${next.due}`);
                open(next.did);
            })
            .catch((err: unknown) => log.warn(SEG.UI, `[Phone] what is about to be said was not asked: ${wordsOf(err)}`));
    };
    document.addEventListener('visibilitychange', look);
    look();
    return true;
}

/** The Node Agent's chat, opened, with what waits for it opened in front. */
function openOnWhatWaits(did: string): void {
    openWhenShown(did);
    import('./agents-element.ts')
        .then(({ openAgentChat }) => openAgentChat({ id: 'node', called: 'Node Agent', at: '/api/agent', kind: 'node' }))
        .catch((err: unknown) => log.error(SEG.UI, `[Phone] the Node Agent's chat was not opened: ${wordsOf(err)}`));
}
