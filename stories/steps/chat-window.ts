// The steps of a chat in its window, walked against the mock as ROOT.

import { expect, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

/** The mock's session said many times over, so the chat has more than fits. */
async function aLongSession(page: Page): Promise<void> {
    await page.route('**/api/agent/session*', async (route) => {
        const response = await route.fetch();
        const many = (held: unknown): unknown => {
            if (Array.isArray(held) && held.length > 0) return Array.from({ length: 60 }, () => held).flat();
            if (held && typeof held === 'object') {
                const each = held as Record<string, unknown>;
                for (const key of Object.keys(each)) each[key] = many(each[key]);
            }
            return held;
        };
        await route.fulfill({ response, json: many(await response.json()) });
    });
}

/** The corner of the window the chat is in. */
const cornerOfTheChat = (page: Page) => page.locator('.content-area.chat').last()
    .locator('xpath=ancestor::*[./*[contains(@class, "resize-handle")]][1]/*[contains(@class, "resize-handle")]');

const below = (el: Element) => el.scrollHeight - el.scrollTop - el.clientHeight;

Given('I am ROOT with a long chat with the Node Agent open', async ({ page }) => {
    await aLongSession(page);
    await page.goto('/__mock__/as/ROOT');
    await page.locator('.sidebar-button', { hasText: 'Agents' }).click();
    await page.locator('.sidebar-level-row', { hasText: 'Node Agent' }).click();
    await expect(page.locator('.claude-says')).toBeVisible();
    await expect.poll(() => page.locator('.chat-scroll').evaluate(el => el.scrollHeight > el.clientHeight + 40)).toBe(true);
});

Then('it stands at its newest message, and stays there', async ({ page }) => {
    const scroll = page.locator('.chat-scroll');
    await expect.poll(() => scroll.evaluate(below)).toBeLessThan(8);
    // A read comes after the first: it does not put the chat back where it stood.
    await page.waitForTimeout(2500);
    expect(await scroll.evaluate(below)).toBeLessThan(8);
});

Then('I can press a harness from there', async ({ page }) => {
    await page.locator('.agents-tab', { hasText: 'codex' }).click();
    await expect(page.locator('.agents-tab-on')).toHaveText('codex');
});

When('I drag the corner of its window smaller', async ({ page }) => {
    const corner = cornerOfTheChat(page);
    // A window arrives animated, and takes its place once what it holds is drawn:
    // its corner is pressed where it has stayed.
    let was = '';
    let stayed = 0;
    await expect.poll(async () => {
        const now = JSON.stringify(await corner.boundingBox());
        stayed = now === was ? stayed + 1 : 0;
        was = now;
        return stayed;
    }, { intervals: [250] }).toBeGreaterThanOrEqual(3);
    const size = () => corner.evaluate(e => {
        const box = (e.parentElement as HTMLElement).getBoundingClientRect();
        return { width: box.width, height: box.height };
    });
    const before = await size();
    const at = await corner.boundingBox();
    if (!at) throw new Error('the window has no corner');
    await page.mouse.move(at.x + 8, at.y + 8);
    await page.mouse.down();
    await page.mouse.move(at.x - 92, at.y - 192, { steps: 8 });
    await page.mouse.up();
    // It takes the size it was dragged to: pressed for real, it collapsed under the press.
    const after = await size();
    expect(Math.abs(after.width - (before.width - 100))).toBeLessThan(4);
    expect(Math.abs(after.height - (before.height - 200))).toBeLessThan(4);
});

Then('what I say to it stays in the window, and the transcript scrolls inside', async ({ page }) => {
    const window = await cornerOfTheChat(page).boundingBox();
    const says = await page.locator('.claude-says').boundingBox();
    if (!window || !says) throw new Error('the window or what is said to it is not drawn');
    expect(says.y + says.height).toBeLessThanOrEqual(window.y + window.height);
    await expect.poll(() => page.locator('.chat-scroll').evaluate(el => el.clientHeight > 0 && el.scrollHeight > el.clientHeight)).toBe(true);
});

Given('I am ROOT on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // The page is up: it says ROOT SHAKE is felt, and an element is on screen to talk to.
    // A shake while it is still starting reaches no listener, or finds nothing in front.
    const felt = page.waitForEvent('console', message => message.text().includes('ROOT SHAKE is felt'));
    await page.goto('/__mock__/as/ROOT');
    await felt;
    await expect(page.locator('[data-element-id][data-form="canvasPlaced"]').first()).toBeVisible();
});

When('I shake it', async ({ page }) => {
    await page.getByText('shake', { exact: true }).last().click();
});

Then('the screenshot is in the chat, and what I say to it stays on the screen', async ({ page }) => {
    await expect(page.locator('.claude-attached img').last()).toBeVisible();
    const says = await page.locator('.claude-says').last().boundingBox();
    if (!says) throw new Error('what is said to it is not drawn');
    expect(says.y + says.height).toBeLessThanOrEqual(844);
});
