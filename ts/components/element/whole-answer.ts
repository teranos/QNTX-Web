// A streamed answer that cannot finish where it was sent is drawn whole.
//
// "3. who? the receiver?"
// The node sends a prompt's stream to the socket that asked for it and to no
// other, and answers the prompt whole in its response as well. A socket that
// closed before the stream finished takes the rest of it with it: the socket
// after it has a name of its own. So the response, once it is in, is drawn in
// place of what streamed whenever the stream can no longer finish.

// Imported from ws itself: the client facade is a stand-in in every test (test-setup.ts).
import { ownSocket, whenSocketGone } from '../../client/ws';

// Each stream going, by the box it is drawn in: a prompt run twice is two
// boxes under one job id, and each answer belongs to the box of its own run.
// Once the response is in: the socket it was asked on, and the answer.
type Going = { jobId: string; drawWhole: (text: string) => void; asked?: string; answer?: string; timer?: ReturnType<typeof setTimeout> };
const going = new Map<object, Going>();

/**
 * How long an answer the node says it streamed waits for its stream to finish
 * before it is drawn whole: the node drops what a socket's queue cannot hold,
 * and says it streamed all the same.
 */
export const wholeAfter = { ms: 5000 };

let listening = false;

/** A stream for jobId is going into owner; drawWhole draws its answer in place of what streamed. */
export function awaitWhole(jobId: string, owner: object, drawWhole: (text: string) => void): void {
    if (!listening) {
        listening = true;
        whenSocketGone(gone => {
            for (const [owner, stream] of going) {
                if (stream.answer !== undefined && stream.asked === gone) whole(owner);
            }
        });
    }
    forget(owner);
    going.set(owner, { jobId, drawWhole });
}

/** The stream for jobId finished in owner, or in every box of jobId when none is named: what it drew stands. */
export function streamDone(jobId: string, owner?: object): void {
    if (owner) {
        if (going.get(owner)?.jobId === jobId) forget(owner);
        return;
    }
    for (const [each, stream] of going) if (stream.jobId === jobId) forget(each);
}

/**
 * The response for owner's run is in, asked on the socket named asked ('' for
 * none); streamed is what the node said of it, and undefined from a node that
 * says nothing, which is drawn whole when drewAny says nothing streamed. It is
 * drawn whole now when no stream was sent or its socket is gone, when that
 * socket closes before the stream finishes, and when the stream has not
 * finished wholeAfter.ms after.
 */
export function answerArrived(owner: object, asked: string, answer: string, streamed: boolean | undefined, drewAny = false): void {
    const stream = going.get(owner);
    if (!stream) return;
    stream.asked = asked;
    stream.answer = answer;
    const noStream = streamed === false || (streamed === undefined && !drewAny);
    if (noStream || !asked || ownSocket() !== asked) { whole(owner); return; }
    stream.timer = setTimeout(() => whole(owner), wholeAfter.ms);
}

function forget(owner: object): void {
    const stream = going.get(owner);
    if (stream?.timer) clearTimeout(stream.timer);
    going.delete(owner);
}

function whole(owner: object): void {
    const stream = going.get(owner);
    if (!stream || stream.answer === undefined) return;
    forget(owner);
    stream.drawWhole(stream.answer);
}
