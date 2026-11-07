// The steps of the ground's story, walked against the mock as ROOT.
// The mock publishes pond at /g/ (mock/g/pond.js); the page offers it as the ground; the picture opens the choice.

import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// Where the pictures of the walk are kept, to be looked at.
const SHOTS = 'test-results/ground';

const LAYER = '#backdrop';
const PICTURE = '#who-picture';

Given('I am ROOT on the mock', async ({ page }) => {
    await page.goto('/__mock__/as/ROOT');
    await expect(page.locator(PICTURE)).toBeVisible();
});

Then('the ground under everything is pond, published at \\/g\\/', async ({ page }) => {
    const published = await (await page.request.get('/g/')).json() as { elements: Array<{ name: string }> };
    expect(published.elements.map(e => e.name)).toContain('pond');
    await expect(page.locator(`${LAYER}[data-ground="pond"] canvas`)).toHaveCount(1);
    await page.screenshot({ path: `${SHOTS}/1-pond.png` });
});

const NODE_ROOM = '[data-element-id="room:switchai-py/node-room"]';

Then('the Node Room holds the ground, with {int} agents in it', async ({ page }, agents: number) => {
    await expect(page.locator(`${LAYER}[data-held-by="room:switchai-py/node-room"] canvas`)).toHaveAttribute('data-agents', String(agents));
    await page.screenshot({ path: `${SHOTS}/5-room-holds-the-ground.png` });
});

When('I close the Node Room', async ({ page }) => {
    await page.locator(`${NODE_ROOM} [aria-label="Close"]`).click();
    await expect(page.locator(NODE_ROOM)).toHaveCount(0);
});

When('I click my picture', async ({ page }) => {
    await page.locator(PICTURE).click();
});

Then('the Backdrop element opens, naming pond and plain', async ({ page }) => {
    await expect(page.locator('.backdrop-held')).toHaveText('the ground is pond');
    await expect(page.locator('.backdrop-choice[data-ground="pond"]')).toHaveClass(/backdrop-choice-on/);
    await expect(page.locator('.backdrop-choice[data-ground="none"]')).toHaveText('plain');
    await page.screenshot({ path: `${SHOTS}/2-choice.png` });
});

When('I choose plain', async ({ page }) => {
    await page.locator('.backdrop-choice[data-ground="none"]').click();
});

When('I choose pond', async ({ page }) => {
    await page.locator('.backdrop-choice[data-ground="pond"]').click();
});

Then('the ground is plain', async ({ page }) => {
    await expect(page.locator(`${LAYER} > *`)).toHaveCount(0);
    await expect(page.locator('.backdrop-held')).toHaveText('the ground is plain');
    await page.screenshot({ path: `${SHOTS}/3-plain.png` });
});

When('I come back', async ({ page }) => {
    // The page again, from nothing: the choice is in this browser, not on the page.
    const discovered = page.waitForResponse(response => response.url().endsWith('/g/'));
    await page.reload();
    await discovered;
    await expect(page.locator(PICTURE)).toBeVisible();
});

Then('the ground is still plain', async ({ page }) => {
    await expect(page.locator(`${LAYER} > *`)).toHaveCount(0);
    // Nothing is held and nothing shows: the choice, and not the first ground offered, is what the page kept.
    await page.locator(PICTURE).click();
    await expect(page.locator('.backdrop-held')).toHaveText('the ground is plain');
    await expect(page.locator('.backdrop-choice[data-ground="none"]')).toHaveClass(/backdrop-choice-on/);
    await page.screenshot({ path: `${SHOTS}/4-still-plain.png` });
});
