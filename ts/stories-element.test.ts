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

describe('Tim: the stories use the room the element gives them', () => {
    // "You didn't see how the list doesn't use the screenspace available? This suggests miscompliance with elements"
    test('the content sets no size and no scroller of its own, so the package sizes and scrolls it', async () => {
        const { createStoriesElement } = await import('./stories-element');
        const { expectScroll } = await import('@teranos/elements');
        const element = document.createElement('div');
        element.dataset.elementId = 'stories-element';
        const content = createStoriesElement().renderContent!() as HTMLElement;
        element.appendChild(content);
        drawStories(content, [{ name: '3-user-sets-up-a-new-namespace', feature: 'USER sets up a new namespace' }]);
        expect(content.style.height).toBe('');
        expect(content.style.width).toBe('');
        expect(() => expectScroll(element)).not.toThrow();
    });
});
