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

// Each stream going, by job id: how it is drawn whole, and once the response is
// in, the socket it was asked on and the answer.
const going = new Map<string, { drawWhole: (text: string) => void; asked?: string; answer?: string }>();

let listening = false;

/** A stream for jobId is going; drawWhole draws its answer in place of what streamed. */
export function awaitWhole(jobId: string, drawWhole: (text: string) => void): void {
    if (!listening) {
        listening = true;
        whenSocketGone(gone => {
            for (const [jobId, stream] of going) {
                if (stream.answer !== undefined && stream.asked === gone) whole(jobId);
            }
        });
    }
    going.set(jobId, { drawWhole });
}

/** The stream for jobId finished: what it drew stands. */
export function streamDone(jobId: string): void {
    going.delete(jobId);
}

/**
 * The response for jobId is in, asked on the socket named asked ('' for none);
 * streamed is what the node said of it, and undefined from a node that says
 * nothing, which is drawn whole when drewAny says nothing streamed. It is drawn
 * whole now when no stream was sent or its socket is gone, and when that
 * socket closes before the stream finishes otherwise.
 */
export function answerArrived(jobId: string, asked: string, answer: string, streamed: boolean | undefined, drewAny = false): void {
    const stream = going.get(jobId);
    if (!stream) return;
    stream.asked = asked;
    stream.answer = answer;
    const noStream = streamed === false || (streamed === undefined && !drewAny);
    if (noStream || !asked || ownSocket() !== asked) whole(jobId);
}

function whole(jobId: string): void {
    const stream = going.get(jobId);
    if (!stream || stream.answer === undefined) return;
    going.delete(jobId);
    stream.drawWhole(stream.answer);
}
