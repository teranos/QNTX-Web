// The steps of the Connectors stories, walked against the mock as ROOT, standing in pond.
// The mock's providers issued every key ending in -issued (mock/server.ts).

import { expect, type Locator } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

const STANDING = 'pond';
const ISSUED = 'sk-ant-api03-mock-issued';
const NOT_ISSUED = 'sk-ant-api03-mistyped';

// The key given in this scenario, to look for where it must not be.
let given = '';

/** Whether the light is green or red, as the browser draws it. Its exact colour is MEANS', held by ts/connector-element.test.ts. */
async function hueOf(light: Locator): Promise<'green' | 'red'> {
    const color = await light.evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r, g] = (color.match(/\d+/g) ?? []).map(Number);
    return (g ?? 0) > (r ?? 0) ? 'green' : 'red';
}

const anthropic = (page: import('@playwright/test').Page) => page.locator('[data-platform="Anthropic"]');
const light = (page: import('@playwright/test').Page) => page.locator('[data-light="anthropic"]');

async function keep(page: import('@playwright/test').Page, key: string): Promise<void> {
    given = key;
    await anthropic(page).locator('input').fill(key);
    // The second press creates: the first arms it.
    const press = page.locator('[data-press="connect-anthropic"]');
    await press.click();
    await press.click();
}

Given('I am in Connectors', async ({ page }) => {
    await page.goto('/__mock__/as/ROOT');
    await page.locator('.sidebar-button', { hasText: 'Connectors' }).click();
    await expect(page.locator('[data-platform]').first()).toBeVisible();
});

When('I press Anthropic', async ({ page }) => {
    await page.locator('[data-connect="Anthropic"]').click();
});

When('I press Anthropic API key', async ({ page }) => {
    await page.locator('[data-part="Anthropic API key"]').click();
});

Given('I am at the Anthropic API key', async ({ page }) => {
    await page.goto('/__mock__/as/ROOT');
    await page.locator('.sidebar-button', { hasText: 'Connectors' }).click();
    await page.locator('[data-connect="Anthropic"]').click();
    await page.locator('[data-part="Anthropic API key"]').click();
});

// A Cucumber expression reads / as "or", so a step naming a URL is matched whole.
Then(/^I am told to go to https:\/\/platform\.claude\.com\/settings\/keys$/, async ({ page }) => {
    const out = anthropic(page).locator('a[href="https://platform.claude.com/settings/keys"]');
    await expect(out).toBeVisible();
    await expect(out).toHaveAttribute('target', '_blank');
});

When('I give the key I made there', async ({ page }) => {
    await keep(page, ISSUED);
});

When('I give a key Anthropic did not issue', async ({ page }) => {
    await keep(page, NOT_ISSUED);
});

async function keptSealed(page: import('@playwright/test').Page): Promise<void> {
    await expect(light(page)).toHaveAttribute('data-accepted', /true|false/);
    const kept = await (await page.request.get(`/api/keys/${STANDING}`)).json() as { keys: { name: string }[] };
    expect(kept.keys.map((k) => k.name)).toContain('anthropic');
    expect(JSON.stringify(kept)).not.toContain(given);
}

Then('the namespace I am standing in keeps it sealed, as ADR-051 says', async ({ page }) => {
    await keptSealed(page);
});

Then('the namespace I am standing in keeps it sealed', async ({ page }) => {
    await keptSealed(page);
});

Then('I am never shown the key again', async ({ page }) => {
    await expect(anthropic(page).locator('input')).toHaveValue('');
    await expect(page.locator('body')).not.toContainText(given);
});

Then('the key is asked of Anthropic', async ({ page }) => {
    await expect(light(page)).toBeVisible();
    await expect(light(page)).toHaveAttribute('data-accepted', /true|false/);
});

Then("I immediately see if it's setup correcty with green indicator light.", async ({ page }) => {
    await expect(light(page)).toHaveAttribute('data-accepted', 'true');
    expect(await hueOf(light(page))).toBe('green');
});

Then('I see a red indicator light', async ({ page }) => {
    await expect(light(page)).toHaveAttribute('data-accepted', 'false');
    expect(await hueOf(light(page))).toBe('red');
});
