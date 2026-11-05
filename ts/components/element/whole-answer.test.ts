/**
 * A streamed answer that cannot finish on the socket it was sent to is drawn
 * whole from the response: the node sends a stream to the socket that asked
 * for it, and a socket that closed is not reopened under the same name.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { routeMessage, socketClosed } from '../../client/ws';
import { awaitWhole, answerArrived, streamDone, wholeAfter } from './whole-answer';

const named = (socket: string) => routeMessage({ type: 'version', version: 'v1', commit: 'abc1234', socket } as never, {});
const after = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('An answer drawn whole when its stream cannot finish', () => {
    beforeEach(() => { wholeAfter.ms = 5000; });

    test('a stream that finished keeps what it drew', () => {
        named('s-1');
        const drawn: string[] = [];
        const box = {};
        awaitWhole('job-1', box, text => drawn.push(text));
        streamDone('job-1', box);
        answerArrived(box, 's-1', 'Up 3 days.', true);
        expect(drawn).toEqual([]);
    });

    test('an answer asked for with no socket named comes whole, and is drawn so', () => {
        const drawn: string[] = [];
        const box = {};
        awaitWhole('job-2', box, text => drawn.push(text));
        answerArrived(box, '', 'Up 3 days.', false);
        expect(drawn).toEqual(['Up 3 days.']);
    });

    test('the socket it was sent to is gone by the time the answer arrives: drawn whole', () => {
        named('s-3');
        const drawn: string[] = [];
        const box = {};
        awaitWhole('job-3', box, text => drawn.push(text));
        socketClosed();
        named('s-4');
        answerArrived(box, 's-3', 'Up 3 days.', true);
        expect(drawn).toEqual(['Up 3 days.']);
    });

    test('the socket is still the one asked on: the rest of the stream comes on it, unless it closes first', () => {
        named('s-5');
        const drawn: string[] = [];
        const box = {};
        awaitWhole('job-5', box, text => drawn.push(text));
        answerArrived(box, 's-5', 'Up 3 days.', true);
        expect(drawn).toEqual([]);
        socketClosed();
        expect(drawn).toEqual(['Up 3 days.']);
    });

    test('a stream that finishes after the answer arrived is not drawn over when its socket later closes', () => {
        named('s-6');
        const drawn: string[] = [];
        const box = {};
        awaitWhole('job-6', box, text => drawn.push(text));
        answerArrived(box, 's-6', 'Up 3 days.', true);
        streamDone('job-6', box);
        socketClosed();
        expect(drawn).toEqual([]);
    });

    // The node says it answered whole: the socket it named is open, and no stream comes on it.
    test('an answer the node did not stream is drawn at once, the socket open', () => {
        named('s-7');
        const drawn: string[] = [];
        const box = {};
        awaitWhole('job-7', box, text => drawn.push(text));
        answerArrived(box, 's-7', 'Up 3 days.', false);
        expect(drawn).toEqual(['Up 3 days.']);
    });

    // A node from before streamed says nothing of it: it is drawn whole when nothing streamed.
    test('a node that does not say whether it streamed: drawn whole when nothing was drawn, left when something was', () => {
        named('s-8');
        const nothing: string[] = [];
        const first = {};
        awaitWhole('job-8', first, text => nothing.push(text));
        answerArrived(first, 's-8', 'Up 3 days.', undefined, false);
        expect(nothing).toEqual(['Up 3 days.']);
        const some: string[] = [];
        const second = {};
        awaitWhole('job-9', second, text => some.push(text));
        answerArrived(second, 's-8', 'Up 3 days.', undefined, true);
        expect(some).toEqual([]);
    });

    // Qodo's review of QNTX-Web#56: a prompt run twice is two boxes under one job id.
    test('a prompt run twice: each answer is drawn in the box of its own run', () => {
        const drawn: string[] = [];
        const firstRun = {};
        const secondRun = {};
        awaitWhole('prompt-1', firstRun, text => drawn.push(`first: ${text}`));
        awaitWhole('prompt-1', secondRun, text => drawn.push(`second: ${text}`));
        answerArrived(firstRun, '', 'answer one', false);
        answerArrived(secondRun, '', 'answer two', false);
        expect(drawn).toEqual(['first: answer one', 'second: answer two']);
    });

    test('a run that finishes frees its own box, not a later run of the same prompt', () => {
        const drawn: string[] = [];
        const firstRun = {};
        const secondRun = {};
        awaitWhole('prompt-2', firstRun, text => drawn.push(`first: ${text}`));
        awaitWhole('prompt-2', secondRun, text => drawn.push(`second: ${text}`));
        streamDone('prompt-2', firstRun);
        answerArrived(secondRun, '', 'answer two', false);
        expect(drawn).toEqual(['second: answer two']);
    });

    // Qodo's review of QNTX-Web#56: the node drops what a socket's queue cannot hold, and still says it streamed.
    test('an answer said to be streamed whose stream does not finish soon after is drawn whole', async () => {
        wholeAfter.ms = 20;
        named('s-10');
        const drawn: string[] = [];
        const box = {};
        awaitWhole('job-10', box, text => drawn.push(text));
        answerArrived(box, 's-10', 'Up 3 days.', true);
        expect(drawn).toEqual([]);
        await after(60);
        expect(drawn).toEqual(['Up 3 days.']);
    });

    test('a stream that finishes before then keeps what it drew', async () => {
        wholeAfter.ms = 20;
        named('s-11');
        const drawn: string[] = [];
        const box = {};
        awaitWhole('job-11', box, text => drawn.push(text));
        answerArrived(box, 's-11', 'Up 3 days.', true);
        streamDone('job-11', box);
        await after(60);
        expect(drawn).toEqual([]);
    });
});
