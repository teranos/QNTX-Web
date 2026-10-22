import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Tablet } from './reach';

const tablet = Tablet.from(readFileSync(join(import.meta.dir, 'tablet-of-reach'), 'utf8'));

describe('the mock reaches what the tablet says', () => {
    test('ROOT reaches everything, named or not', () => {
        expect(tablet.reaches('ROOT', '/api/plugins')).toBe(true);
        expect(tablet.reaches('ROOT', '/api/never-written')).toBe(true);
    });

    test('USER reaches i, the canvas and the namespace agent, not the plugins', () => {
        expect(tablet.reaches('USER', '/i/')).toBe(true);
        expect(tablet.reaches('USER', '/api/canvas/elements')).toBe(true);
        expect(tablet.reaches('USER', '/api/agents/pond')).toBe(true);
        expect(tablet.reaches('USER', '/api/plugins')).toBe(false);
        expect(tablet.reaches('USER', '/api/namespaces')).toBe(false);
    });

    test('PUBLIC_REGISTRATION reaches i and the canvas, not the agent', () => {
        expect(tablet.reaches('PUBLIC_REGISTRATION', '/i/reaches')).toBe(true);
        expect(tablet.reaches('PUBLIC_REGISTRATION', '/api/canvases')).toBe(true);
        expect(tablet.reaches('PUBLIC_REGISTRATION', '/api/agents/pond')).toBe(false);
        expect(tablet.reaches('PUBLIC_REGISTRATION', '/api/attestations')).toBe(false);
    });

    test('ANYONE is served without asking', () => {
        expect(tablet.reaches('PUBLIC_REGISTRATION', '/health')).toBe(true);
        expect(tablet.reaches('USER', '/auth/status')).toBe(true);
        expect(tablet.reaches('USER', '/g/')).toBe(true);
    });

    test('not defined is no access', () => {
        expect(tablet.reaches('USER', '/api/never-written')).toBe(false);
    });

    test('a longer path wins over the prefix', () => {
        expect(tablet.reaches('USER', '/api/namespaces/default/nuke')).toBe(false);
        expect(tablet.line('/api/namespaces/default/nuke')?.path).toBe('/api/namespaces/default/nuke');
    });

    test('a prefix line covers what is under it', () => {
        expect(tablet.reaches('USER', '/g/pond-element.js')).toBe(true);
        expect(tablet.reaches('USER', '/api/canvases/CV-1')).toBe(true);
    });

    test('i reaches answers the paths asked', () => {
        expect(tablet.reached('USER', ['/api/canvas', '/api/plugins', '/i/'])).toEqual(['/api/canvas', '/i/']);
    });
});
