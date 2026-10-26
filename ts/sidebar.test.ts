/**
 * The sidebar — where the node's standing elements rest, on the left.
 *
 * Personas:
 * - Tim: happy path — mounts, takes who to its head, rests elements as buttons
 *   in order, the latch folds it away and back, the door is at its foot
 * - Spike: edge cases — a workspace is refused, resting before mounting is
 *   refused, an id it does not hold is the tray's, resting twice is once
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';

// The door is not walked through in a test of the sidebar.
mock.module('./signin', () => ({ standAtTheDoor: () => {}, signedIn: async () => true, openDoor: async () => {} }));

import { initSidebar, resetSidebar, restInSidebar, hasElement, openElement, toggleSidebar, openSidebar, closeSidebar, sidebarOpen } from './sidebar.ts';
import { tray, type Element } from '@teranos/elements';

const standing = (id: string, title: string, symbol: string): Element => ({
    id, title, symbol,
    renderContent: () => document.createElement('div'),
});

const originalMatchMedia = window.matchMedia;
afterEach(() => {
    resetSidebar();
    window.matchMedia = originalMatchMedia;
});

beforeEach(() => {
    resetSidebar();
    document.body.className = '';
    document.body.innerHTML = `
        <main id="container">
            <div id="left-panel">
                <header id="header">
                    <div class="who"><img id="who-picture" class="empty" alt=""><div class="who-words"><span id="who-name"></span><span id="who-namespace"></span></div></div>
                    <div class="build-stamp"><span id="build-hash"></span></div>
                </header>
            </div>
        </main>
        <div id="system-drawer"><div id="system-drawer-header"><div class="controls"></div></div></div>`;
});

describe('Tim: the sidebar stands beside the page', () => {
    test('mounts before the page, takes who to its head and the build stamp to its foot', () => {
        initSidebar();
        const nav = document.getElementById('sidebar')!;
        expect(nav).not.toBeNull();
        expect(nav.parentElement?.id).toBe('container');
        expect(nav.querySelector('.sidebar-head .who #who-picture')).not.toBeNull();
        expect(document.querySelector('#header .who')).toBeNull();
        expect(nav.querySelector('.sidebar-foot .build-stamp #build-hash')).not.toBeNull();
    });

    test('the door is at its foot, as a press', () => {
        initSidebar();
        const door = document.querySelector<HTMLButtonElement>('#sidebar .sidebar-foot button[data-press="sidebar-door"]');
        expect(door).not.toBeNull();
    });

    test('the latch is the first thing in the system bar, with a mirror of the picture', () => {
        initSidebar();
        const header = document.getElementById('system-drawer-header')!;
        const latch = header.firstElementChild as HTMLButtonElement;
        expect(latch.id).toBe('sidebar-latch');
        expect(latch.getAttribute('aria-controls')).toBe('sidebar');
        expect(latch.querySelector('img[data-who-mirror]')).not.toBeNull();
    });

    test('standing elements rest as buttons, in the order they came, each wearing its symbol', () => {
        initSidebar();
        restInSidebar(standing('users-element', 'Users', '⚇'));
        restInSidebar(standing('mail-element', 'Mail', '✉'));
        const rows = Array.from(document.querySelectorAll<HTMLElement>('#sidebar .sidebar-list .sidebar-button'));
        expect(rows.map(r => r.dataset.elementId)).toEqual(['users-element', 'mail-element']);
        expect(rows.map(r => r.dataset.symbol)).toEqual(['⚇', '✉']);
        expect(rows.map(r => r.textContent)).toEqual(['Users', 'Mail']);
        expect(rows.every(r => r.dataset.form === 'button')).toBe(true);
        expect(rows.every(r => r.getAttribute('role') === 'button')).toBe(true);
        expect(hasElement('users-element')).toBe(true);
    });

    test('the latch folds the column away and back, and says so', () => {
        initSidebar();
        const latch = document.getElementById('sidebar-latch') as HTMLButtonElement;
        expect(sidebarOpen()).toBe(true);
        expect(latch.getAttribute('aria-expanded')).toBe('true');
        latch.click();
        expect(sidebarOpen()).toBe(false);
        expect(document.body.classList.contains('sidebar-open')).toBe(false);
        expect(latch.getAttribute('aria-expanded')).toBe('false');
        latch.click();
        expect(sidebarOpen()).toBe(true);
    });

    test('the page gives way by the column, and takes it back', () => {
        initSidebar();
        openSidebar();
        expect(document.documentElement.style.getPropertyValue('--sidebar-width')).toBe('240px');
        closeSidebar();
        expect(document.documentElement.style.getPropertyValue('--sidebar-width')).toBe('0px');
        toggleSidebar();
        expect(sidebarOpen()).toBe(true);
    });

    test('a press on the latch does not reach the system bar header', () => {
        initSidebar();
        let reached = 0;
        document.getElementById('system-drawer-header')!.addEventListener('click', () => { reached += 1; });
        document.getElementById('sidebar-latch')!.click();
        expect(reached).toBe(0);
    });
});

describe('Spike: what the sidebar refuses', () => {
    test('a workspace cannot rest here: a button becomes a window and nothing else', () => {
        initSidebar();
        expect(() => restInSidebar({ ...standing('canvas-workspace', 'Canvas', '⌗'), opensAs: 'workspace' })).toThrow(/workspace/);
        expect(hasElement('canvas-workspace')).toBe(false);
    });

    test('nothing rests before the sidebar is up', () => {
        expect(() => restInSidebar(standing('users-element', 'Users', '⚇'))).toThrow(/not up/);
    });

    test('resting twice is resting once', () => {
        initSidebar();
        restInSidebar(standing('users-element', 'Users', '⚇'));
        restInSidebar(standing('users-element', 'Users', '⚇'));
        expect(document.querySelectorAll('[data-element-id="users-element"]').length).toBe(1);
    });

    test('an id the sidebar does not hold is the tray\'s to open', () => {
        initSidebar();
        const opened: string[] = [];
        const was = tray.open;
        tray.open = (id: string) => { opened.push(id); };
        try {
            openElement('a-chat');
        } finally {
            tray.open = was;
        }
        expect(opened).toEqual(['a-chat']);
        expect(hasElement('a-chat')).toBe(false);
    });

    test('without a container there is no sidebar, and nothing throws', () => {
        document.body.innerHTML = '';
        initSidebar();
        expect(document.getElementById('sidebar')).toBeNull();
    });
});

describe('phone system controls', () => {
    function phoneViewport() {
        const listeners: Array<() => void> = [];
        const media = {
            matches: true,
            addEventListener: (_: string, listener: () => void) => listeners.push(listener),
        };
        window.matchMedia = (() => media) as unknown as typeof window.matchMedia;
        return (matches: boolean) => {
            media.matches = matches;
            listeners.forEach(listener => listener());
        };
    }

    test('moves the same live controls into the swipe drawer and back on desktop', () => {
        const resize = phoneViewport();
        const system = document.getElementById('system-drawer')!;
        const input = document.createElement('input');
        input.value = 'retained query';
        system.append(input);
        let clicks = 0;
        input.addEventListener('click', () => clicks++);
        initSidebar();
        expect(system.parentElement?.id).toBe('sidebar');
        expect(sidebarOpen()).toBe(false);
        expect(document.getElementById('sidebar-latch')?.parentElement).toBe(document.body);
        openSidebar();
        input.click();
        expect(clicks).toBe(1);
        resize(false);
        expect(system.parentElement).toBe(document.body);
        expect(input.value).toBe('retained query');
        expect(document.querySelector('#system-drawer-header #sidebar-latch')).not.toBeNull();
        resize(true);
        expect(system.parentElement?.id).toBe('sidebar');
        expect(sidebarOpen()).toBe(false);
    });

    test('sign-in can take over the full-screen drawer, then return the controls', async () => {
        phoneViewport();
        initSidebar();
        const system = document.getElementById('system-drawer')!;
        system.classList.add('door-held');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(system.parentElement).toBe(document.body);
        expect(document.getElementById('sidebar-latch')!.hidden).toBe(true);
        system.classList.remove('door-held');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(system.parentElement?.id).toBe('sidebar');
        expect(document.getElementById('sidebar-latch')!.hidden).toBe(false);
    });
});
