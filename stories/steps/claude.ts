// The steps of the Claude element's stories, walked against the mock as ROOT.

import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// Where the pictures of the walk are kept, to be looked at.
const SHOTS = 'test-results/streams';

Given('I am ROOT with the Claude element open', async ({ page }) => {
    await page.goto('/__mock__/as/ROOT');
    await page.locator('.sidebar-button', { hasText: 'Claude' }).click();
    await expect(page.locator('.claude-says')).toBeVisible();
});

When(/^I say "(.+)" to it$/, async ({ page }, words: string) => {
    await page.locator('.claude-says').fill(words);
    await page.locator('.claude-send').click();
});

Then('its words arrive while it answers', async ({ page }) => {
    const live = page.locator('.claude-live');
    const assistant = live.locator('.claude-live-said .tr-text');
    // What it did lands first, as the thing itself, then the words, while the send button is still held.
    await expect(live.locator('.claude-live-did')).toHaveText('$ uptime');
    await expect(live.locator('.claude-live-got')).toHaveText('up 3 days');
    await expect(live).not.toContainText('[tool]');
    await expect(assistant).toBeVisible();
    const first = await assistant.textContent();
    await page.screenshot({ path: `${SHOTS}/1-first-words.png` });
    await expect(page.locator('.claude-send')).toBeDisabled();
    await expect.poll(() => assistant.textContent(), { message: 'the words grow while it answers' }).not.toBe(first);
    await expect(page.locator('.claude-send')).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/2-more-words.png` });
    // What was said is not drawn twice: the transcript holds it, the live view does not.
    await expect(live).not.toContainText('[human]');
});

Then('once it has answered, the transcript holds them and the live view is gone', async ({ page }) => {
    await expect(page.locator('.claude-send')).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator('.claude-live .claude-live-row')).toHaveCount(0);
    await expect(page.locator('.claude-session')).toContainText('You said: What would you tell people at a claude code community meetup?');
    await page.screenshot({ path: `${SHOTS}/3-answered.png` });
});
