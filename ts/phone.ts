// What is about to be said to the Node Agent, in front of ROOT while they are in the app.
// "as you may believe, i want to see it on my phone, for the duration of 15 minutes before a collected message is sent, the preview and the buttons to send now, delay and cancel"
// Out of the app it stands as a Live Activity the node starts, with its
// answers on it (teranos/QNTX docs/adr/ADR-060). In the app, the Node Agent's
// chat opens on it. The page hands the node nothing for that: the app's own
// side does (QNTX-App island/).

import { apiJson } from './client';
import { log, SEG } from './logger.ts';
import { theCollection, openWhenShown, type Collected } from './collected-element';

/** Who is signed in on this page now, as /auth/status says it. */
export interface SignedIn {
    identity?: string;
    level?: string;
}

/** Everything the page asks of the node and of itself: what a test stands in for. */
export interface Phone {
    who(): Promise<SignedIn>;
    waits(): Promise<Collected[]>;
    /** The Node Agent's own DID, which what is collected for it waits under. */
    nodeAgent(): Promise<string>;
    open(did: string, due: string): void;
    visible(): boolean;
}

// How long before it is sent what waits stands in front of ROOT: the node's own fifteen minutes (QNTX server/phones.go, shownBefore).
const ABOUT_TO_MS = 900_000;
// How often it is asked again while the app stays in front: a batch comes within the fifteen minutes without the app being left.
const LOOK_MS = 60_000;

const wordsOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** What waits that is sent within the fifteen minutes, soonest first. */
export function aboutToBeSaid(all: Collected[], now: number = Date.now()): Collected[] {
    return all
        .filter(one => one.waiting.length > 0)
        .filter(one => { const left = Date.parse(one.due) - now; return left > 0 && left <= ABOUT_TO_MS; })
        .sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
}

const theApp: Phone = {
    who: () => apiJson<SignedIn>('/auth/status'),
    waits: () => theCollection.list(),
    nodeAgent: () => apiJson<{ claude?: { did?: string } | null }>('/api/agent?harness=claude').then(is => is.claude?.did ?? ''),
    open: openOnWhatWaits,
    visible: () => document.visibilityState === 'visible',
};

/**
 * For as long as the page is open: whoever is signed in is asked each time, so
 * a session that begins later is ROOT's too. In front and as ROOT, the Node
 * Agent's chat is opened on what is about to be said to it, once for each
 * time it is due. What it gives back stops it.
 */
export function rootsPhone(phone: Phone = theApp, every: number = LOOK_MS): () => void {
    let nodeAgent = '';
    // Each time it is due is opened on once: closed by the person, it is not opened again for that time.
    const opened = new Set<string>();
    let looking = false;

    const look = async (): Promise<void> => {
        if (looking || !phone.visible()) return;
        looking = true;
        try {
            const is = await phone.who();
            if (is.level !== 'ROOT' || !is.identity) {
                // Nobody, or somebody else: the Node Agent is asked for anew for the next ROOT.
                nodeAgent = '';
                return;
            }
            if (!nodeAgent) nodeAgent = await phone.nodeAgent();
            const all = await phone.waits();
            // Left for the background while the node answered: nothing is opened behind the person's back.
            if (!phone.visible()) return;
            // The chat that is opened is the Node Agent's, so what is opened on is what waits for it, and the first of it not opened on yet.
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
