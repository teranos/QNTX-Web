// "ROOT or developer oriented Stories Element should exist"

import { describe, test, expect } from 'bun:test';
import { drawStories, storyAgent } from './stories-element';

describe('Tim: ROOT sees the stories, each one an agent', () => {
    test('each story is listed by its number and its Feature line, and names its agent as the node does', () => {
        const held = document.createElement('div');
        const stories = [{ name: '27-root-registers-the-node-with-anthropic', feature: 'ROOT sets up OIDC for the node' }];
        drawStories(held, stories);
        const row = held.querySelector<HTMLButtonElement>('[data-story]')!;
        expect(row.textContent).toBe('27  ROOT sets up OIDC for the node');
        expect(storyAgent(stories[0]!)).toBe('story-27-root-registers-the-node-with-anthropic');
        expect(row.title).toBe('Talk to story-27-root-registers-the-node-with-anthropic');
    });
});
