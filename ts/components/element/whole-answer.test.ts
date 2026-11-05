/**
 * A streamed answer that cannot finish on the socket it was sent to is drawn
 * whole from the response: the node sends a stream to the socket that asked
 * for it, and a socket that closed is not reopened under the same name.
 */

import { describe, test, expect } from 'bun:test';
import { routeMessage, socketClosed } from '../../client/ws';
import { awaitWhole, answerArrived, streamDone } from './whole-answer';

const named = (socket: string) => routeMessage({ type: 'version', version: 'v1', commit: 'abc1234', socket } as never, {});

describe('An answer drawn whole when its stream cannot finish', () => {
    test('a stream that finished keeps what it drew', () => {
        named('s-1');
        const drawn: string[] = [];
        awaitWhole('job-1', text => drawn.push(text));
        streamDone('job-1');
        answerArrived('job-1', 's-1', 'Up 3 days.', true);
        expect(drawn).toEqual([]);
    });

    test('an answer asked for with no socket named comes whole, and is drawn so', () => {
        const drawn: string[] = [];
        awaitWhole('job-2', text => drawn.push(text));
        answerArrived('job-2', '', 'Up 3 days.', false);
        expect(drawn).toEqual(['Up 3 days.']);
    });

    test('the socket it was sent to is gone by the time the answer arrives: drawn whole', () => {
        named('s-3');
        const drawn: string[] = [];
        awaitWhole('job-3', text => drawn.push(text));
        socketClosed();
        named('s-4');
        answerArrived('job-3', 's-3', 'Up 3 days.', true);
        expect(drawn).toEqual(['Up 3 days.']);
    });

    test('the socket is still the one asked on: the rest of the stream comes on it, unless it closes first', () => {
        named('s-5');
        const drawn: string[] = [];
        awaitWhole('job-5', text => drawn.push(text));
        answerArrived('job-5', 's-5', 'Up 3 days.', true);
        expect(drawn).toEqual([]);
        socketClosed();
        expect(drawn).toEqual(['Up 3 days.']);
    });

    test('a stream that finishes after the answer arrived is not drawn over when its socket later closes', () => {
        named('s-6');
        const drawn: string[] = [];
        awaitWhole('job-6', text => drawn.push(text));
        answerArrived('job-6', 's-6', 'Up 3 days.', true);
        streamDone('job-6');
        socketClosed();
        expect(drawn).toEqual([]);
    });

    // The node says it answered whole: the socket it named is open, and no stream comes on it.
    test('an answer the node did not stream is drawn at once, the socket open', () => {
        named('s-7');
        const drawn: string[] = [];
        awaitWhole('job-7', text => drawn.push(text));
        answerArrived('job-7', 's-7', 'Up 3 days.', false);
        expect(drawn).toEqual(['Up 3 days.']);
    });

    // A node from before streamed says nothing of it: it is drawn whole when nothing streamed.
    test('a node that does not say whether it streamed: drawn whole when nothing was drawn, left when something was', () => {
        named('s-8');
        const nothing: string[] = [];
        awaitWhole('job-8', text => nothing.push(text));
        answerArrived('job-8', 's-8', 'Up 3 days.', undefined, false);
        expect(nothing).toEqual(['Up 3 days.']);
        const some: string[] = [];
        awaitWhole('job-9', text => some.push(text));
        answerArrived('job-9', 's-8', 'Up 3 days.', undefined, true);
        expect(some).toEqual([]);
    });
});
