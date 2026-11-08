// The steps of story 200, walked against the mock as ROOT: Rooms is a level of
// the sidebar, the Node Room a row of it, and the room opens from the row.

import { expect, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// Where the pictures of the walk are kept, to be looked at.
const SHOTS = 'test-results/rooms';
const mediaWake = new WeakMap<Page, string>();
const voiceMessage = new WeakMap<Page, string>();
const otherPlayer = new WeakMap<Page, import('@playwright/test').ElementHandle<HTMLAudioElement>>();

/**
 * The sidebar, open: on a desktop the column stands open as remembered, and
 * Rooms is a button in it once the node has said what the viewer reaches.
 * Waiting for that button is waiting for both; a press on the latch is not
 * needed here, and the latch is the system bar's, which a desktop does not show.
 */
async function sidebarOpen(page: Page): Promise<void> {
    await expect(page.locator('#sidebar .sidebar-button', { hasText: 'Rooms' })).toBeVisible({ timeout: 15_000 });
}

async function intoTheNodeRoom(page: Page): Promise<void> {
    await page.goto('/__mock__/as/ROOT');
    await sidebarOpen(page);
    await page.locator('.sidebar-button', { hasText: 'Rooms' }).click();
    await page.locator('.sidebar-level-row', { hasText: 'Node Room' }).click();
    await expect(page.locator('.room-says')).toBeVisible();
}

Given('I am ROOT', async ({ page }) => {
    await page.goto('/__mock__/as/ROOT');
    await expect(page.locator('#sidebar')).toBeAttached();
});

When('I open the leftside bar', async ({ page }) => {
    await sidebarOpen(page);
});

When('I open the Rooms Element', async ({ page }) => {
    await page.locator('.sidebar-button', { hasText: 'Rooms' }).click();
    await expect(page.locator('.sidebar-level[data-level="rooms"]')).toBeVisible();
});

When('I open a specific Room, like the Node Room', async ({ page }) => {
    await page.locator('.sidebar-level-row', { hasText: 'Node Room' }).click();
});

// Said as Then after opening the room, and as Given before talking in it: one step, the way there taken when not there yet.
Given('I am in the Node Room Element', async ({ page }) => {
    if (!(await page.locator('.room-says').count())) await intoTheNodeRoom(page);
    await expect(page.locator('[data-element-id="room:switchai-py/node-room"]')).toBeVisible();
    await expect(page.locator('.room-says')).toBeVisible();
});

Then("here I see what it's connected to and what Agents are in it", async ({ page }) => {
    await expect(page.locator('.room-connected')).toContainText('connected to Telegram group');
    await expect(page.locator('.room-agent')).toHaveCount(3);
    await expect(page.locator('.room-agent').nth(0)).toContainText('node-claude');
    await page.screenshot({ path: `${SHOTS}/1-the-node-room.png` });
});

When('I press on an Agent', async ({ page }) => {
    await page.locator('.room-agent[data-agent="node-claude"]').click();
});

Then('`@agent_name` appears in the inputfield and I can type something', async ({ page }) => {
    const says = page.locator('.room-says');
    await expect(says).toHaveValue('@node-claude ');
    await expect(says).toBeFocused();
    await expect(page.locator('.room-agent.room-agent-on')).toHaveAttribute('data-agent', 'node-claude');
    await says.pressSequentially('what is the node up to?');
    await expect(says).toHaveValue('@node-claude what is the node up to?');
    await page.screenshot({ path: `${SHOTS}/2-addressed.png` });
});

When('I press send', async ({ page }) => {
    await page.locator('.room-send').click();
});

Then('the message gets to the Agent via the room', async ({ page }) => {
    // What was said stands on the board, and the provider says the wake arrives for the agent.
    await expect(page.locator('.room-board .chat-you').last()).toContainText('@node-claude what is the node up to?');
    await expect(page.locator('.room-reach-line[data-reach="ROOM_REACH_ARRIVES"]')).toHaveText('arrives for node-claude');
    await expect(page.locator('.room-says')).toHaveValue('');
    await page.screenshot({ path: `${SHOTS}/3-sent.png` });
});

Then('the Agent can put something back into the room', async ({ page }) => {
    const back = page.locator('.room-board .room-row[data-agent="node-claude"]').last();
    await expect(back).toContainText('MOCK node-claude answers in Node Room', { timeout: 15_000 });
    await expect(back).toContainText('you said "@node-claude what is the node up to?"');
    await page.screenshot({ path: `${SHOTS}/4-answered.png` });
});

When('I ask an Agent for a picture in the room', async ({ page }) => {
    await page.locator('.room-says').fill('@node-claude make a picture of the pond');
    const response = page.waitForResponse(response => response.url().includes('/wake') && response.request().method() === 'POST');
    await page.locator('.room-send').click();
    mediaWake.set(page, (await (await response).json()).id);
});

Then('its picture arrives inside its reply', async ({ page }) => {
    const reply = page.locator(`.room-row[data-agent="node-claude"][data-thread="${mediaWake.get(page)}"]`);
    const picture = reply.locator('.room-media img');
    await expect(picture).toBeVisible({ timeout: 15_000 });
    await expect(picture).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => picture.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(800);
    await expect(reply).toContainText('This is a fixture, not a generated image.');
    await expect(reply.locator('.room-media-error')).toHaveCount(0);
    await expect(page.locator('.room-reach-line[data-reach="ROOM_REACH_ARRIVES"]')).toHaveCount(0);
    await picture.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/returned-picture-${page.viewportSize()!.width}.png` });
});

Then('I can save the returned picture', async ({ page }) => {
    const download = page.waitForEvent('download');
    await page.locator('.room-media-caption a').last().click();
    expect((await download).suggestedFilename()).toBe('pond-study.svg');
});

Then('the picture stays in place when someone speaks again', async ({ page }) => {
    const picture = page.locator('.room-media img').last();
    const original = await picture.elementHandle();
    const src = await picture.getAttribute('src');
    await page.locator('.room-says').fill('Keep the blue; simplify the outline.');
    await page.locator('.room-send').click();
    await expect(page.locator('.room-board .chat-you').last()).toContainText('Keep the blue; simplify the outline.');
    expect(await original!.evaluate(img => img.isConnected)).toBe(true);
    await expect(picture).toHaveAttribute('src', src!);
});

Then('the picture and composer fit the phone', async ({ page }) => {
    const width = page.viewportSize()!.width;
    for (const selector of ['.room-media img', '.room-says', '.room-send']) {
        const box = await page.locator(selector).last().boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await expect(page.locator('.room-says')).toBeInViewport();
    await expect(page.locator('.room-send')).toBeInViewport();
    await page.screenshot({ path: `${SHOTS}/returned-picture-phone.png` });
});

Given('the browser grants microphone access', async ({ context }) => {
    await context.grantPermissions(['microphone']);
});

When('I record a short voice message', async ({ page }) => {
    await page.getByRole('button', { name: 'Record', exact: true }).click();
    await expect(page.locator('.room-voice [role="status"]')).toContainText('Recording · 0:01');
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
});

Then('I can review the recording and the mock transcript', async ({ page }) => {
    await expect(page.locator('.room-says')).toHaveValue('MOCK transcript: let us work on this together.');
    await expect(page.locator('.room-voice audio')).toBeVisible();
    await expect(page.locator('.room-voice audio')).toHaveAttribute('src', /^blob:/);
    await page.locator('.room-says').fill('Let us work on this together.');
    await page.screenshot({ path: `${SHOTS}/voice-review-${page.viewportSize()!.width}.png` });
});

Then('the words and my original audio arrive together', async ({ page }) => {
    const row = page.locator('.room-row').filter({ hasText: 'Let us work on this together.' }).last();
    await expect(row.locator('.room-audio')).toBeVisible();
    voiceMessage.set(page, (await row.getAttribute('data-message'))!);
    await expect(page.locator('.room-says')).toHaveValue('');
    await expect(page.locator('.room-voice audio')).toBeHidden();
});

Then('I can listen to my recording after reopening the room', async ({ page }) => {
    await page.reload();
    // The phone opens straight into the Node Room.
    const row = page.locator(`.room-row[data-message="${voiceMessage.get(page)}"]`);
    await row.getByRole('button', { name: 'Listen', exact: true }).click();
    await expect(row.locator('audio')).toBeVisible();
    await expect.poll(() => row.locator('audio').evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
    const download = page.waitForEvent('download');
    await row.locator('.room-media-caption a').click();
    expect((await download).suggestedFilename()).toMatch(/^voice\.(webm|m4a|ogg)$/);
});

Then('the audio and composer fit the phone', async ({ page }) => {
    for (const selector of ['.room-audio audio:not([hidden])', '.room-says', '.room-send', '.room-voice']) {
        const box = await page.locator(selector).last().boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
    await expect(page.locator('.room-says')).toBeInViewport();
    await page.screenshot({ path: `${SHOTS}/voice-phone.png` });
});

When("I listen to another participant's recording", async ({ page }) => {
    const row = page.locator('.room-row').filter({ hasText: 'MOCK audio fixture: a quiet tone from another participant.' });
    await row.getByRole('button', { name: 'Listen', exact: true }).click();
    await expect.poll(() => row.locator('audio').evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
    otherPlayer.set(page, await row.locator('audio').elementHandle() as import('@playwright/test').ElementHandle<HTMLAudioElement>);
});

Then('its player stays mounted when someone speaks again', async ({ page }) => {
    const player = otherPlayer.get(page)!;
    const before = await player.evaluate(audio => ({ src: audio.src, time: audio.currentTime }));
    await page.locator('.room-says').fill('Keep the recording alongside the words.');
    await page.locator('.room-send').click();
    await expect(page.locator('.room-row').last()).toContainText('Keep the recording alongside the words.');
    const after = await player.evaluate(audio => ({ connected: audio.isConnected, src: audio.src, time: audio.currentTime }));
    expect(after.connected).toBe(true);
    expect(after.src).toBe(before.src);
    expect(after.time).toBeGreaterThanOrEqual(before.time);
});

When('the mock refuses my voice message', async ({ page }) => {
    await page.route('**/__mock__/rooms/*/voice', route => route.fulfill({ status: 503, body: 'Voice storage refused this send' }), { times: 1 });
    await page.locator('.room-send').click();
});

Then('my words and recording remain for another send', async ({ page }) => {
    await expect(page.locator('.room-failed')).toContainText('Voice storage refused this send');
    await expect(page.locator('.room-says')).toHaveValue('Let us work on this together.');
    await expect(page.locator('.room-voice audio')).toBeVisible();
});

When('I discard the audio', async ({ page }) => {
    await page.getByRole('button', { name: 'Discard audio', exact: true }).click();
});

Then('my reviewed words remain in the composer', async ({ page }) => {
    await expect(page.locator('.room-says')).toHaveValue('Let us work on this together.');
    await expect(page.locator('.room-voice audio')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeVisible();
});
