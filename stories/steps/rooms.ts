// The steps of story 200, walked against the mock as ROOT: Rooms is a level of
// the sidebar, the Node Room a row of it, and the room opens from the row.

import { expect, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// Where the pictures of the walk are kept, to be looked at.
const SHOTS = 'test-results/rooms';

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
