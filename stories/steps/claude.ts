// The steps of the Claude element's stories, walked against the mock as ROOT.

import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// Where the pictures of the walk are kept, to be looked at.
const SHOTS = 'test-results/streams';

Given('I am ROOT with the Claude element open', async ({ page }) => {
    await page.goto('/__mock__/as/ROOT');
    await page.locator('.sidebar-button', { hasText: 'Agents' }).click();
    await page.locator('.agents-row', { hasText: 'Node Agent' }).click();
    await expect(page.locator('.claude-says')).toBeVisible();
});

When(/^I say "(.+)" to it$/, async ({ page }, words: string) => {
    await page.locator('.claude-says').fill(words);
    await page.locator('.claude-send').click();
});

Then('its words arrive while it answers', async ({ page }) => {
    const live = page.locator('.chat-live');
    const assistant = live.locator('.chat-said .chat-words');
    // What it did lands first, as the thing itself, then the words, while the send button is still held.
    await expect(live.locator('.chat-did').first()).toHaveText('$ echo MOCK uptime');
    await expect(live.locator('.chat-did').nth(1)).toContainText('+ MOCK line 40 of 40, written by the mock');
    await expect(live.locator('.chat-got')).toHaveText('MOCK uptime: up 0 days, this is the mock');
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

// "i scroll, why is the time spacer interfering?"
Then('when I scroll up in them, I am left where I am while more arrive', async ({ page }) => {
    const scroll = page.locator('.chat-scroll');
    const assistant = page.locator('.chat-live .chat-said .chat-words');
    // There is more than fits: the write's lines, so the conversation scrolls.
    await expect.poll(() => scroll.evaluate(el => el.scrollHeight > el.clientHeight + 40)).toBe(true);
    await scroll.evaluate(el => { el.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); });
    const before = await assistant.textContent();
    await expect.poll(() => assistant.textContent()).not.toBe(before);
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(0);
    await page.screenshot({ path: `${SHOTS}/2b-scrolled-up.png` });
});

Then('when I scroll back down, what arrives follows', async ({ page }) => {
    const scroll = page.locator('.chat-scroll');
    const assistant = page.locator('.chat-live .chat-said .chat-words');
    await scroll.evaluate(el => { el.scrollTo({ top: el.scrollHeight, behavior: 'instant' as ScrollBehavior }); });
    const before = await assistant.textContent();
    await expect.poll(() => assistant.textContent()).not.toBe(before);
    await expect.poll(() => scroll.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight < 8)).toBe(true);
});

Then('once it has answered, the transcript holds them and the live view is gone', async ({ page }) => {
    await expect(page.locator('.claude-send')).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator('.chat-live .chat-row')).toHaveCount(0);
    await expect(page.locator('.claude-session')).toContainText('You said: What would you tell people at a claude code community meetup?');
    await page.screenshot({ path: `${SHOTS}/3-answered.png` });
});
