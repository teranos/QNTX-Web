// The steps of story 202: piranha as an element, the Node Room with piranha behind it, the App opening into the Node Room.
// The @piranha scenarios walk only where PIRANHA_ELEMENT names the module (playwright.config.ts): piranha is not in this repository.

import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

const SHOTS = 'test-results/app';
const LAYER = '#backdrop';
const NODE_ROOM = 'room:switchai-py/node-room';

Given('piranha is published on the node as an element', async ({ page }) => {
    const published = await (await page.request.get('/g/')).json() as { elements: Array<{ name: string }> };
    expect(published.elements.map(e => e.name)).toContain('piranha');
    // The page has placed it: its symbol is in the registry once /g/ is read, which the spawn menu shows.
    await expect(page.locator('#who-picture')).toBeVisible();
});

When('I place piranha on the canvas', async ({ page }) => {
    // The spawn menu is a right-click on the canvas workspace; piranha is one of its entries.
    const workspace = page.locator('[data-canvas-id]').first();
    await workspace.click({ button: 'right', position: { x: 600, y: 500 } });
    // An item is taken on mousedown (the package's spawn.ts), and the items keep moving while the menu is up.
    const item = page.getByRole('menuitem', { name: 'piranha', exact: true });
    await item.waitFor();
    await item.dispatchEvent('mousedown', { button: 0 });
    // Chosen, it is carried; a press on the canvas sets it down there. The events are dispatched at the
    // spot, since a window of the tray may stand over that spot and take a real click.
    const box = (await workspace.boundingBox())!;
    for (const type of ['mousedown', 'mouseup', 'click']) {
        await workspace.dispatchEvent(type, { button: 0, clientX: box.x + 700, clientY: box.y + 450, bubbles: true });
    }
});

Then('it swims there, live', async ({ page }) => {
    // A placed published element is wrapped as a plugin element of that name (element-module-loader.ts).
    const placed = page.locator('.plugin-piranha canvas').first();
    await expect(placed).toBeVisible();
    // Live: the picture is not the same picture a moment later.
    const frame = () => placed.evaluate(c => (c as HTMLCanvasElement).toDataURL().length + (c as HTMLCanvasElement).toDataURL().slice(-64));
    const first = await frame();
    await expect.poll(frame, { message: 'the fish moves' }).not.toBe(first);
    await page.screenshot({ path: `${SHOTS}/1-piranha-on-the-canvas.png` });
});

Then('piranha swims behind the board', async ({ page }) => {
    // The ground chosen is piranha; the room holds it.
    if (await page.locator(`${LAYER}[data-holds="piranha"]`).count() === 0) {
        await page.locator('#who-picture').click();
        await page.locator('.backdrop-choice[data-ground="piranha"]').click();
    }
    await expect(page.locator(`${LAYER}[data-held-by="${NODE_ROOM}"][data-holds="piranha"] canvas`)).toHaveCount(1);
    await page.screenshot({ path: `${SHOTS}/2-piranha-behind-the-board.png` });
});

Then('what is said in the room is drawn on top, legible', async ({ page }) => {
    const board = page.locator('.room .chat-scroll');
    await expect(board.locator('.chat-you, .chat-said').first()).toBeVisible();
    // The board paints nothing of its own behind the words: the glass of the window is what is behind them.
    await expect(board).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

Then('each Agent in the room is a fish', async ({ page }) => {
    const agents = await page.locator('.room-agent').count();
    await expect(page.locator(`${LAYER} [data-fish]`)).toHaveAttribute('data-fish', String(agents));
});

When('I open the App', async ({ page }) => {
    await page.goto('/__mock__/as/ROOT');
});

Then('I am in the Node Room Element, with that backdrop', async ({ page }) => {
    await expect(page.locator(`[data-element-id="${NODE_ROOM}"]`)).toBeVisible();
    await expect(page.locator('.room-says')).toBeVisible();
    await expect(page.locator(`${LAYER}[data-held-by="${NODE_ROOM}"] canvas`)).toHaveCount(1);
    await page.screenshot({ path: `${SHOTS}/3-the-app-opens-into-the-node-room.png` });
});
