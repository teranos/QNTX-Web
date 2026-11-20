// The steps of what agents said to an agent, collected, walked against the mock as ROOT on a phone.

import { expect, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// Where the pictures of the walk are kept, to be looked at.
const SHOTS = 'test-results/collected';

// "I want you to use the pills for it instead": what waits is a pill in the chat's field (@teranos/elements Pill Form).
const batch = (page: Page) => page.locator('[data-collected]');
const press = (page: Page, id: string) => batch(page).locator(`[data-press^="${id}-"]`);

interface Waits { due: string; held_until: string; waiting: { from: string; says: string; id: string; edited: boolean }[] }

/** What the node holds for the Node Agent, asked as the page asks it. */
const held = (page: Page): Promise<Waits | null> =>
    page.evaluate(async () => {
        const answer = await fetch('/api/collected', { credentials: 'include' });
        const all = (await answer.json()) as { collected: Waits[] };
        return all.collected[0] ?? null;
    });

/** What became of what the mock's agents said. */
const became = (page: Page): Promise<{ sent: string[]; canceled: { says: string }[] }> =>
    page.evaluate(async () => (await fetch('/__mock__/collected')).json());

const HOUR = 3_600_000;
// What was due when the batch was pressed, for the steps that ask how much later it is.
let dueWas = 0;

Given('I am ROOT on my phone, and agents said three things to the Node Agent that wait', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/__mock__/as/ROOT');
    await page.evaluate(async () => {
        await fetch('/__mock__/collected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                forget: true,
                said: [
                    { from: 'Alder', says: 'pull request one is open' },
                    { from: 'Hazel', says: 'the pond is drained' },
                    { from: 'Alder', says: 'pull request two is open' },
                ],
            }),
        });
    });
});

Given('I open the Node Agent', async ({ page }) => {
    // The App opens into the Node Room on a phone: out of it, and the sidebar is where the agents are.
    await expect(page.locator('[data-element-id^="room:"][data-form="panel"]')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-element-id^="room:"][data-form="panel"]')).toHaveCount(0);
    await page.locator('[aria-label="the sidebar"], [title="the sidebar"]').first().click();
    await page.locator('.sidebar-button', { hasText: 'Agents' }).click();
    await page.locator('.sidebar-level-row', { hasText: 'Node Agent' }).click();
    await expect(page.locator('.claude-says')).toBeVisible();
});

Then('I see the batch that waits as a pill above where I type', async ({ page }) => {
    await expect(batch(page)).toHaveAttribute('data-form', 'pill');
    const mine = (await batch(page).boundingBox())!;
    const box = (await page.locator('[data-say-box]').boundingBox())!;
    // "The pills should be above, and outside of inputfield area".
    expect(mine.y + mine.height).toBeLessThanOrEqual(box.y);
    expect(mine.x).toBeGreaterThanOrEqual(box.x - 24);
    await page.screenshot({ path: `${SHOTS}/1-it-waits-above-the-field.png` });
});

Then('it says how many wait and when they are sent', async ({ page }) => {
    const waits = (await held(page))!;
    const due = new Date(waits.due);
    const time = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
    await expect(batch(page)).toContainText('3 wait');
    await expect(batch(page)).toContainText(time);
});

async function pressTheBatch(page: Page): Promise<void> {
    await expect(batch(page)).toHaveAttribute('data-form', 'pill');
    dueWas = Date.parse((await held(page))!.due);
    await batch(page).click();
    await expect(batch(page)).toHaveAttribute('data-form', 'pillOpen');
    await expect.poll(() => batch(page).evaluate(el => el.dataset.pillMoving === undefined)).toBe(true);
}

When('I press the batch', async ({ page }) => { await pressTheBatch(page); });
Given('I pressed the batch', async ({ page }) => { await pressTheBatch(page); });

Then('it is across its row, and where I type is still there', async ({ page }) => {
    const mine = (await batch(page).boundingBox())!;
    const box = (await page.locator('[data-say-box]').boundingBox())!;
    // "About it taking over everything for no good reason?": across the row, not the screen.
    expect(mine.height).toBeLessThan(700);
    expect(Math.abs(mine.width - box.width)).toBeLessThan(40);
    // "I want inputfield to still be there".
    await expect(page.locator('.claude-says')).toBeVisible();
    expect(mine.y + mine.height).toBeLessThanOrEqual(box.y + 1);
});

Then('I see who said what', async ({ page }) => {
    const rows = batch(page).locator('.collected-one');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).locator('.collected-who')).toContainText('Alder');
    await expect(rows.nth(0).locator('.collected-says')).toHaveValue('pull request one is open');
    await expect(rows.nth(1).locator('.collected-who')).toContainText('Hazel');
    await expect(rows.nth(1).locator('.collected-says')).toHaveValue('the pond is drained');
    await expect(rows.nth(2).locator('.collected-says')).toHaveValue('pull request two is open');
    await page.screenshot({ path: `${SHOTS}/3-who-said-what.png` });
});

Then('send now, later, hold and cancel are on one line above it', async ({ page }) => {
    const header = batch(page).locator('.collected-actions');
    await expect(header.locator('[data-press^="collected-now-"]')).toBeVisible();
    await expect(header.locator('[data-press^="collected-later-"]')).toBeVisible();
    await expect(header.locator('.collected-hold')).toBeVisible();
    await expect(header.locator('[data-press^="collected-cancel-"]')).toBeVisible();
    // The header is above what was said, and stays there.
    const top = (await header.boundingBox())!;
    const first = (await batch(page).locator('.collected-one').first().boundingBox())!;
    expect(top.y + top.height).toBeLessThanOrEqual(first.y + 1);
});

When('I change what Alder said first', async ({ page }) => {
    const says = batch(page).locator('.collected-says').first();
    await says.fill('look at pull request one before anything else');
    await says.blur();
});

Then('the node holds what I wrote, and marks it changed by a person', async ({ page }) => {
    await expect.poll(async () => (await held(page))!.waiting[0]!.says).toBe('look at pull request one before anything else');
    expect((await held(page))!.waiting[0]!.edited).toBe(true);
    await expect(batch(page).locator('.collected-who').first()).toContainText('changed by you');
    await page.screenshot({ path: `${SHOTS}/4-edited.png` });
});

When('I press send now, twice', async ({ page }) => {
    await press(page, 'collected-now').click();
    await page.screenshot({ path: `${SHOTS}/5-send-now-asks.png` });
    await press(page, 'collected-now').click();
});

Then('the Node Agent receives all of it as one thing said', async ({ page }) => {
    await expect.poll(async () => (await became(page)).sent.length).toBe(1);
    const sent = (await became(page)).sent[0]!;
    for (const part of ['pull request one is open', 'the pond is drained', 'pull request two is open', 'Alder', 'Hazel']) expect(sent).toContain(part);
    // And it is in the chat I was in all along, as a turn of the agent's.
    await expect(page.locator('.chat-scroll')).toContainText('Collected for you', { timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}/6-sent.png` });
});

Then('nothing waits in the chat', async ({ page }) => {
    await expect(batch(page)).toBeHidden();
    expect(await held(page)).toBeNull();
});

When('I press later', async ({ page }) => {
    await press(page, 'collected-later').click();
});

Then('it is sent one wait later than it was', async ({ page }) => {
    await expect.poll(async () => Date.parse((await held(page))!.due) - dueWas).toBe(6 * HOUR);
    await page.screenshot({ path: `${SHOTS}/7-later.png` });
});

Then('what an agent says in the meantime is in the same batch', async ({ page }) => {
    await page.evaluate(async () => {
        await fetch('/__mock__/collected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ said: [{ from: 'Rowan', says: 'the build is red' }] }),
        });
    });
    await expect(batch(page).locator('.collected-one')).toHaveCount(4, { timeout: 15_000 });
    await expect(batch(page).locator('.collected-one').last().locator('.collected-who')).toContainText('Rowan');
    expect(Date.parse((await held(page))!.due) - dueWas).toBe(6 * HOUR);
});

When('I keep hold pressed and drag up', async ({ page }) => {
    const hold = (await batch(page).locator('.collected-hold').boundingBox())!;
    await page.mouse.move(hold.x + hold.width / 2, hold.y + hold.height / 2);
    await page.mouse.down();
    // Up for more, then down a little for less: fifteen hours in all.
    await page.mouse.move(hold.x + hold.width / 2, hold.y + hold.height / 2 - 200, { steps: 10 });
    await page.mouse.move(hold.x + hold.width / 2, hold.y + hold.height / 2 - 150, { steps: 5 });
});

Then('it says how much longer as I drag', async ({ page }) => {
    await expect(batch(page).locator('.collected-longer')).toContainText('15h longer');
    // Still pressed: nothing to confirm yet, and the node holds what it held.
    await expect(batch(page).locator('.collected-confirm')).toBeHidden();
    expect(Date.parse((await held(page))!.due)).toBe(dueWas);
    await page.screenshot({ path: `${SHOTS}/8-holding.png` });
});

When('I let go, and confirm', async ({ page }) => {
    await page.mouse.up();
    await expect(press(page, 'collected-hold-confirm')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/9-confirm.png` });
    await press(page, 'collected-hold-confirm').click();
});

Then('it is sent that much later than it was', async ({ page }) => {
    await expect.poll(async () => Date.parse((await held(page))!.due) - dueWas).toBe(15 * HOUR);
    await expect(batch(page).locator('.collected-when')).toContainText('held by you until');
    await page.screenshot({ path: `${SHOTS}/10-held.png` });
});

When('I press cancel, twice', async ({ page }) => {
    await press(page, 'collected-cancel').click();
    await page.screenshot({ path: `${SHOTS}/11-cancel-asks.png` });
    await press(page, 'collected-cancel').click();
});

Then('the Node Agent never receives it', async ({ page }) => {
    await expect.poll(async () => (await became(page)).canceled.length).toBe(3);
    expect((await became(page)).sent).toHaveLength(0);
});

// What waits is the Node Agent's own, whatever harness its chat is in.
When('I press the codex tab of the chat', async ({ page }) => {
    await expect(batch(page)).toHaveAttribute('data-form', 'pill');
    await page.locator('.agents-tab', { hasText: 'codex' }).click();
    await expect(page.locator('.agents-tab-on')).toHaveText('codex');
    await expect(page.locator('.claude-says')).toBeVisible();
});

When('I press what Hazel said, and cancel, twice', async ({ page }) => {
    // "A row pressed is chosen; Cancel takes what is chosen" (@teranos/elements examples/outbox.ts).
    await batch(page).locator('.collected-who', { hasText: 'Hazel' }).click();
    await expect(batch(page).locator('.collected-who', { hasText: 'Hazel' })).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: `${SHOTS}/12-one-chosen.png` });
    await press(page, 'collected-cancel').click();
    await press(page, 'collected-cancel').click();
});

Then('the Node Agent never receives what Hazel said', async ({ page }) => {
    await expect.poll(async () => (await became(page)).canceled.map(one => one.says)).toEqual(['the pond is drained']);
});

Then('what Alder said still waits', async ({ page }) => {
    await expect.poll(async () => (await held(page))?.waiting.map(one => one.says)).toEqual(['pull request one is open', 'pull request two is open']);
    await expect(batch(page).locator('.collected-one')).toHaveCount(2);
    await page.screenshot({ path: `${SHOTS}/13-one-canceled.png` });
});
