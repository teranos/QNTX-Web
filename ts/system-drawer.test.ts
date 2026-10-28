import { test, expect, mock } from 'bun:test';

mock.module('./signin', () => ({ standAtTheDoor: () => {}, signedIn: async () => true, openDoor: async () => {} }));
const spawned: string[] = [];
mock.module('./components/element/canvas/spawn-menu.ts', () => ({
    spawnElementByCommand: (command: string) => { spawned.push(command); return true; },
    getMatchingCommands: () => ['canvas'],
    getCommandLabel: () => 'Canvas',
}));

import { initSidebar, resetSidebar, sidebarOpen } from './sidebar';
import { initSystemDrawer, focusDrawerSearch } from './system-drawer';

test('mobile search keeps focus, and a tapped command acts and closes the sidebar', async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = (() => ({ matches: true, addEventListener: () => {} })) as unknown as typeof window.matchMedia;
    document.body.innerHTML = `<main id="container"><header id="header"></header></main>
        <div id="system-drawer"><div id="system-drawer-header"><div class="controls"></div></div>
        <div id="search-results-container"></div></div>`;
    try {
        initSystemDrawer();
        initSidebar();
        focusDrawerSearch();
        const input = document.getElementById('drawer-search-input') as HTMLInputElement;
        expect(sidebarOpen()).toBe(true);
        expect(document.activeElement).toBe(input);
        input.value = 'canvas';
        input.dispatchEvent(new Event('input'));
        await new Promise(resolve => setTimeout(resolve, 350));
        const result = document.querySelector<HTMLElement>('.search-result-line');
        expect(result).not.toBeNull();
        result!.click();
        expect(spawned).toEqual(['canvas']);
        expect(sidebarOpen()).toBe(false);
        expect(input.value).toBe('');
    } finally {
        resetSidebar();
        window.matchMedia = matchMedia;
    }
});
