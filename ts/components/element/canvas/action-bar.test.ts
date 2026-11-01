/**
 * Tests for canvas action bar
 *
 * Personas:
 * - Tim: Happy path user, normal workflows
 * - Spike: Tries to break things, edge cases
 * - Jenny: Power user, complex scenarios
 */

import { describe, test, expect } from 'bun:test';
import { showActionBar, hideActionBar } from './action-bar';

// Mock animate for tests
(globalThis.window as any).Element.prototype.animate = function() {
    return { finished: Promise.resolve() } as any;
};

describe('Canvas Action Bar - Tim (Happy Path)', () => {
    test('Tim selects two elements and sees the action bar, and its delete button deletes', () => {
        const container = document.createElement('div');
        container.style.position = 'relative';
        document.body.appendChild(container);

        let deleted = 0;
        let unmelded = 0;

        showActionBar(
            ['element-1', 'element-2'],
            container,
            () => { deleted++; },
            () => { unmelded++; }
        );

        const bar = container.querySelector('.canvas-action-bar');
        expect(bar).not.toBeNull();
        expect(bar!.getAttribute('role')).toBe('toolbar');
        // Neither is in a meld, so there is nothing to unmeld; the one press is the delete.
        expect(bar!.querySelector('.canvas-action-unmeld')).toBeNull();
        const del = bar!.querySelector<HTMLElement>('.canvas-action-delete')!;
        expect(del.dataset.tooltip).toBe('Delete 2 elements');
        del.click();
        expect(deleted).toBe(1);
        expect(unmelded).toBe(0);

        document.body.innerHTML = '';
    });
});
