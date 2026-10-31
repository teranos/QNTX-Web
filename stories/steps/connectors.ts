// The steps of the Connectors stories, walked against the mock as ROOT, standing in pond.

import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

Given('I am in Connectors', async ({ page }) => {
    await page.goto('/__mock__/as/ROOT');
    await page.locator('.sidebar-button', { hasText: 'Connectors' }).click();
    await expect(page.locator('[data-platform]').first()).toBeVisible();
});

When('I press Anthropic', async ({ page }) => {
    await page.locator('[data-connect="Anthropic"]').click();
});

When(/^I press (add QNTX MCP to Claude|Claude Code)$/, async ({ page }, part: string) => {
    await page.locator(`[data-part="${part}"]`).click();
});

// What each story's first step shows, once its part is pressed.
const STARTS: Record<string, string> = {
    '20-user-adds-qntx-mcp-to-claude.feature': '[data-press="connect-claude"]',
    '22-user-signs-claude-code-in.feature': '[data-element-id="agent-element"]',
};

Then(/^(\S+\.feature) starts$/, async ({ page }, story: string) => {
    await expect(page.locator(STARTS[story]!).first()).toBeVisible();
});
