// The stories, walked in a browser against the mock (BDD.md).

import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// The mock this run starts, on a port of its own.
const PORT = 8839;

const testDir = defineBddConfig({
    features: ['stories/12-user-connects-anthropic.feature', 'stories/32-the-session-streams-in.feature', 'stories/33-root-uses-a-chat.feature', 'stories/35-root-chooses-the-ground.feature', 'stories/200-root-talks-to-agent-via-room.feature', 'stories/202-root-opens-the-app-into-the-node-room.feature'],
    steps: 'stories/steps/*.ts',
    // A scenario of the phone app's (@phone) is walked nowhere yet: no step binds it.
    // 「[Fable 5.1] A scenario needing piranha (@piranha) walks only where PIRANHA_ELEMENT names the module, which is not CI.」
    tags: process.env.PIRANHA_ELEMENT ? 'not @phone' : 'not @phone and not @piranha',
    outputDir: '.features-gen',
});

export default defineConfig({
    testDir,
    // The mock is one node, and its Node Agent one agent: what one story says
    // to it is answered in every chat open on it. A chat opened while another
    // story's turn prints follows that turn, a line at a time, and is not the
    // quiet chat its own story opens. So the stories are walked one at a time.
    workers: 1,
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
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        // Firefox is walked where it is installed (STORIES_FIREFOX=1, after `bunx playwright install firefox`); CI holds Chromium.
        ...(process.env.STORIES_FIREFOX === '1' ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } }] : []),
    ],
});
