/**
 * Tests for the scrim a thread dims the canvas with
 *
 * Personas:
 * - Tim: Happy path — a scrim shows, and goes
 * - Spike: Edge cases — a second replaces the first, none to remove
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { showMenuScrim, removeScrim } from './scrim';

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('Scrim - Tim (Happy Path)', () => {
    test('showMenuScrim creates a scrim element', () => {
        const scrim = showMenuScrim();
        expect(document.querySelector('.placement-scrim')).toBe(scrim);
        expect(scrim.classList.contains('placement-scrim--menu')).toBe(true);
    });

    test('removeScrim cleans up', () => {
        showMenuScrim();
        removeScrim();
        expect(document.querySelector('.placement-scrim')).toBeNull();
    });
});

describe('Scrim - Spike (Edge Cases)', () => {
    test('showMenuScrim replaces existing scrim', () => {
        showMenuScrim();
        showMenuScrim();
        expect(document.querySelectorAll('.placement-scrim')).toHaveLength(1);
    });

    test('removeScrim with none is no crash', () => {
        expect(() => removeScrim()).not.toThrow();
    });
});
