// The user stories, for ROOT: each one an agent of its own, its one story its contract.
// "ROOT or developer oriented Stories Element should exist"

import type { Element } from '@teranos/elements';
import { log, SEG } from './logger';
import { shakeAbout } from './shake';

export const ELEMENT_ID = 'stories-element';

/** A story as the build lists it (build.ts): its file's name, and its Feature line. */
export interface Story {
    name: string;
    feature: string;
}

/** What a story's agent is named by on the node (server/element_agent.go storyPrefix). */
export const storyAgent = (story: Story) => `story-${story.name}`;

/** Each story, a press that opens ROOT SHAKE with its agent. */
export function drawStories(into: HTMLElement, stories: Story[]): void {
    const list = document.createElement('div');
    list.dataset.stories = '';
    list.style.cssText = 'display:flex;flex-direction:column;gap:2px';
    for (const story of stories) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'qntx-btn qntx-btn-ghost qntx-btn-small';
        row.dataset.story = story.name;
        row.style.cssText = 'text-align:left;justify-content:flex-start';
        row.textContent = `${story.name.split('-')[0]}  ${story.feature}`;
        row.title = `Talk to ${storyAgent(story)}`;
        row.addEventListener('click', () => { void shakeAbout(storyAgent(story), '§'); });
        list.appendChild(row);
    }
    into.replaceChildren(list);
}

export function createStoriesElement(): Element {
    return {
        id: ELEMENT_ID,
        title: 'Stories',
        symbol: '§',
        // Beside the sidebar, as Node Connectors opens: a window, not the screen.
        defaultX: 260,
        defaultY: 40,
        renderContent: () => {
            const content = document.createElement('div');
            // One height that scrolls: every story at once is taller than a window may be, and would make it a panel.
            content.style.cssText = 'width:440px;height:480px;overflow-y:auto';
            content.textContent = 'Reading the stories…';
            // Relative, so it is found under whatever path the page is served from.
            fetch('stories.json')
                .then((r) => {
                    if (!r.ok) throw new Error(`stories.json: HTTP ${r.status}`);
                    return r.json() as Promise<Story[]>;
                })
                .then((stories) => drawStories(content, stories))
                .catch((err: unknown) => {
                    const said = err instanceof Error ? err.message : String(err);
                    log.warn(SEG.ELEMENT, `[stories] ${said}`);
                    content.textContent = said;
                });
            return content;
        },
    };
}
