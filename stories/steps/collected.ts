// 「[Opus 5.5] The steps of what agents said to an agent, collected, walked against the mock as ROOT on a phone.」

import { expect, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// 「[Opus 5.5] Where the pictures of the walk are kept, to be looked at.」
const SHOTS = 'test-results/collected';

const batch = (page: Page) => page.locator('[data-element-id^="collected:"]');
const chat = (page: Page) => page.locator('[data-element-id]').filter({ has: page.locator('.claude-says') }).last();
const press = (page: Page, id: string) => batch(page).locator(`[data-press="${id}"]`);

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
// 「[Opus 5.5] What was due when the batch was pressed, for the steps that ask how much later it is.」
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
    // 「[Fable 5.2] The App opens into the Node Room on a phone: out of it, and the sidebar is where the agents are.」
    await expect(page.locator('[data-element-id^="room:"][data-form="panel"]')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-element-id^="room:"][data-form="panel"]')).toHaveCount(0);
    await page.locator('[aria-label="the sidebar"], [title="the sidebar"]').first().click();
    await page.locator('.sidebar-button', { hasText: 'Agents' }).click();
    await page.locator('.sidebar-level-row', { hasText: 'Node Agent' }).click();
    await expect(page.locator('.claude-says')).toBeVisible();
});

Then('I see the batch that waits bottom left of the chat, slightly transparent', async ({ page }) => {
    await expect(batch(page)).toHaveAttribute('data-form', 'overlay');
    const mine = (await batch(page).boundingBox())!;
    const over = (await chat(page).boundingBox())!;
    const field = (await page.locator('.claude-says').boundingBox())!;
    // 「[Opus 5.5] Left in the chat, low in it, and above where I type.」
    expect(mine.x - over.x).toBeLessThan(24);
    expect(mine.y + mine.height).toBeLessThanOrEqual(field.y);
    expect(mine.y).toBeGreaterThan(over.y + over.height / 2);
    const ground = await batch(page).evaluate(el => getComputedStyle(el).backgroundColor);
    const alpha = Number(ground.slice(ground.lastIndexOf(',') + 1).replace(')', ''));
    expect(alpha).toBeLessThan(1);
    expect(alpha).toBeGreaterThan(0.5);
    await page.screenshot({ path: `${SHOTS}/1-it-waits-bottom-left.png` });
});

Then('it says how many wait and when they are sent', async ({ page }) => {
    const waits = (await held(page))!;
    const due = new Date(waits.due);
    const time = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
    await expect(batch(page)).toContainText('3 wait');
    await expect(batch(page)).toContainText(time);
});

When('I drag the batch up', async ({ page }) => {
    await expect(batch(page)).toHaveAttribute('data-form', 'overlay');
    const mine = (await batch(page).boundingBox())!;
    await page.mouse.move(mine.x + mine.width / 2, mine.y + mine.height / 2);
    await page.mouse.down();
    await page.mouse.move(mine.x + mine.width / 2, mine.y - 300, { steps: 8 });
    await page.mouse.up();
});

Then('it stands higher in the chat, and nothing opened', async ({ page }) => {
    await expect(batch(page)).toHaveAttribute('data-form', 'overlay');
    const mine = (await batch(page).boundingBox())!;
    const field = (await page.locator('.claude-says').boundingBox())!;
    expect(field.y - (mine.y + mine.height)).toBeGreaterThan(250);
    await page.screenshot({ path: `${SHOTS}/2-moved-up.png` });
});

async function pressTheBatch(page: Page): Promise<void> {
    await expect(batch(page)).toHaveAttribute('data-form', 'overlay');
    dueWas = Date.parse((await held(page))!.due);
    await batch(page).click();
    await expect(batch(page)).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => batch(page).evaluate(el => el.classList.contains('morphing'))).toBe(false);
}

When('I press the batch', async ({ page }) => { await pressTheBatch(page); });
Given('I pressed the batch', async ({ page }) => { await pressTheBatch(page); });

Then('it opens fullscreen', async ({ page }) => {
    const mine = (await batch(page).boundingBox())!;
    expect(mine.width).toBeGreaterThanOrEqual(389);
    expect(mine.height).toBeGreaterThanOrEqual(800);
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

Then('send now, later, hold and cancel are in its header', async ({ page }) => {
    const header = batch(page).locator('.collected-header');
    await expect(header.locator('[data-press="collected-now"]')).toBeVisible();
    await expect(header.locator('[data-press="collected-later"]')).toBeVisible();
    await expect(header.locator('.collected-hold')).toBeVisible();
    await expect(header.locator('[data-press="collected-cancel"]')).toBeVisible();
    // 「[Opus 5.5] The header is above what was said, and stays there.」
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
    // 「[Opus 5.5] And it is in the chat I was in all along, as a turn of the agent's.」
    await expect(page.locator('.chat-scroll')).toContainText('Collected for you', { timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}/6-sent.png` });
});

Then('nothing waits in the chat', async ({ page }) => {
    await expect(batch(page)).toHaveCount(0);
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
    // 「[Opus 5.5] Up for more, then down a little for less: fifteen hours in all.」
    await page.mouse.move(hold.x + hold.width / 2, hold.y + hold.height / 2 - 200, { steps: 10 });
    await page.mouse.move(hold.x + hold.width / 2, hold.y + hold.height / 2 - 150, { steps: 5 });
});

Then('it says how much longer as I drag', async ({ page }) => {
    await expect(batch(page).locator('.collected-longer')).toContainText('15h longer');
    // 「[Opus 5.5] Still pressed: nothing to confirm yet, and the node holds what it held.」
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

// 「[Fable 5.2] What waits is the Node Agent's own, whatever harness its chat is in.」
When('I press the codex tab of the chat', async ({ page }) => {
    await expect(batch(page)).toHaveAttribute('data-form', 'overlay');
    await page.locator('.agents-tab', { hasText: 'codex' }).click();
    await expect(page.locator('.agents-tab-on')).toHaveText('codex');
    await expect(page.locator('.claude-says')).toBeVisible();
});
