// The stories, walked in a browser against the mock (BDD.md).

import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// The mock this run starts, on a port of its own.
const PORT = 8839;

const testDir = defineBddConfig({
    features: 'stories/21-user-sets-the-anthropic-key.feature',
    steps: 'stories/steps/*.ts',
    outputDir: '.features-gen',
});

export default defineConfig({
    testDir,
    outputDir: 'test-results',
    reporter: 'list',
    use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1440, height: 900 } },
    webServer: {
        command: 'bun run mock',
        env: { FRONTEND_PORT: String(PORT) },
        url: `http://localhost:${PORT}/health`,
        reuseExistingServer: false,
        timeout: 120_000,
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
