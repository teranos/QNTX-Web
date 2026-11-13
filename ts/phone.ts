// 「[Opus 5.5] The phone ROOT carries: it hands the node the token it is reached by, and」
// 「[Opus 5.5] when ROOT comes in from a notification it opens on what is about to be said.」
// "「[Opus 5.5] i want to see it on my phone, for the duration of 15 minutes before a collected message is sent」"
// "「[Opus 5.5] listen, a simpler version will work for me, i just want to get the hard part out of the way」"
// 「[Opus 5.5] The node says it (QNTX server/phones.go); the app asks Apple for the token (QNTX-App push/).」

import { invoke } from '@tauri-apps/api/core';
import { apiJson } from './client';
import { log, SEG } from './logger.ts';
import { theCollection, openWhenShown, type Collected } from './collected-element';

/** What the app answers when asked for the phone's token (QNTX-App push/src/lib.rs). */
export interface PhoneToken {
    token: string;
    platform: string;
}

/** Who is signed in on this page now, as /auth/status says it. */
export interface SignedIn {
    identity?: string;
    level?: string;
}

/** Everything the phone asks of the app, the node and the page: what a test stands in for. */
export interface Phone {
    who(): Promise<SignedIn>;
    token(): Promise<PhoneToken>;
    keep(held: PhoneToken): Promise<unknown>;
    waits(): Promise<Collected[]>;
    /** The Node Agent's own DID, which what is collected for it waits under. */
    nodeAgent(): Promise<string>;
    open(did: string, due: string): void;
    visible(): boolean;
}

// 「[Opus 5.5] How long before it is sent the node tells the phone: what is sent within it is what the phone opens on.」
const ABOUT_TO_MS = 900_000;
// 「[Opus 5.5] How often it is asked again while the app stays in front: a batch comes within the fifteen minutes without the app being left.」
const LOOK_MS = 60_000;

const wordsOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** What waits that is sent within the time the node tells the phone of it, soonest first. */
export function aboutToBeSaid(all: Collected[], now: number = Date.now()): Collected[] {
    return all
        .filter(one => one.waiting.length > 0)
        .filter(one => { const left = Date.parse(one.due) - now; return left > 0 && left <= ABOUT_TO_MS; })
        .sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
}

const theApp: Phone = {
    who: () => apiJson<SignedIn>('/auth/status'),
    token: () => invoke<PhoneToken>('plugin:push|token'),
    keep: held => apiJson('/api/phones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: held.token, platform: held.platform }),
    }),
    waits: () => theCollection.list(),
    nodeAgent: () => apiJson<{ claude?: { did?: string } | null }>('/api/agent?harness=claude').then(is => is.claude?.did ?? ''),
    open: openOnWhatWaits,
    visible: () => document.visibilityState === 'visible',
};

/**
 * 「[Opus 5.5] ROOT's phone, for as long as the page is open: whoever is signed in is asked」
 * 「[Opus 5.5] each time, so a session that begins later hands over its own token. In front」
 * 「[Opus 5.5] and as ROOT, the token is handed over once for that session, and the Node」
 * 「[Opus 5.5] Agent's chat is opened on what is about to be said to it, once for each time」
 * 「[Opus 5.5] it is due. What it gives back stops it.」
 */
export function rootsPhone(phone: Phone = theApp, every: number = LOOK_MS): () => void {
    // 「[Opus 5.5] Who the token was last handed over as, tried once for each: one who turned notifications off is not asked every minute.」
    let handedAs = '';
    let nodeAgent = '';
    // 「[Opus 5.5] Each time it is due is opened on once: closed by the person, it is not opened again for that time.」
    const opened = new Set<string>();
    let looking = false;

    const look = async (): Promise<void> => {
        if (looking || !phone.visible()) return;
        looking = true;
        try {
            const is = await phone.who();
            if (is.level !== 'ROOT' || !is.identity) {
                // 「[Opus 5.5] Nobody, or somebody else: the next ROOT hands over their own, and the Node Agent is asked for anew.」
                handedAs = '';
                nodeAgent = '';
                return;
            }
            if (handedAs !== is.identity) {
                handedAs = is.identity;
                // 「[Opus 5.5] Refused off iOS, and when notifications are off for QNTX: said, and nothing else changes.」
                phone.token()
                    .then(held => phone.keep(held))
                    .then(() => log.info(SEG.UI, '[Phone] the node holds the token it reaches this phone by'))
                    .catch((err: unknown) => log.warn(SEG.UI, `[Phone] the node was not handed this phone's token: ${wordsOf(err)}`));
            }
            if (!nodeAgent) nodeAgent = await phone.nodeAgent();
            const all = await phone.waits();
            // 「[Opus 5.5] Left for the background while the node answered: nothing is opened behind the person's back.」
            if (!phone.visible()) return;
            // 「[Opus 5.5] The chat that is opened is the Node Agent's, so what is opened on is what waits for it, and the first of it not opened on yet.」
            const next = aboutToBeSaid(all).find(one => one.did === nodeAgent && !opened.has(`${one.did} ${one.due}`));
            if (!next) return;
            opened.add(`${next.did} ${next.due}`);
            phone.open(next.did, next.due);
        } catch (err) {
            log.warn(SEG.UI, `[Phone] what is about to be said was not asked: ${wordsOf(err)}`);
        } finally {
            looking = false;
        }
    };
    const front = () => { void look(); };
    document.addEventListener('visibilitychange', front);
    const again = setInterval(front, every);
    front();
    return () => {
        document.removeEventListener('visibilitychange', front);
        clearInterval(again);
    };
}

/** The Node Agent's chat, opened, with what waits for it at that time opened in front. */
function openOnWhatWaits(did: string, due: string): void {
    openWhenShown(did, due);
    import('./agents-element.ts')
        .then(({ openAgentChat }) => openAgentChat({ id: 'node', called: 'Node Agent', at: '/api/agent', kind: 'node' }))
        .catch((err: unknown) => log.error(SEG.UI, `[Phone] the Node Agent's chat was not opened: ${wordsOf(err)}`));
}
