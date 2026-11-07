// The Backdrop element: the grounds offered, the one chosen, and who holds the
// layer now. Opened from the viewer's picture, top left.

// "option to choose between backdrops by clicking on profile pic."

import { pressFrom, tray } from '@teranos/elements';
import { NONE, backdropHeldBy, chooseBackdrop, chosenBackdrop, offeredBackdrops, onBackdropChange } from './backdrop.ts';
import { glassPane } from './glass.ts';

export const ELEMENT_ID = 'backdrop-element';

function part<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    el.className = className;
    return el;
}

/** The choice drawn into body, and drawn again when a ground is offered or taken. What it gives back stops listening. */
export function drawBackdropChoice(body: HTMLElement): () => void {
    const held = part('div', 'backdrop-held');
    const choices = part('div', 'backdrop-choices');
    body.replaceChildren(held, choices);
    const draw = () => {
        const by = backdropHeldBy();
        held.textContent = by === NONE ? 'the ground is plain' : `the ground is ${by}`;
        choices.replaceChildren();
        for (const name of [NONE, ...offeredBackdrops()]) {
            const press = pressFrom({ id: `backdrop-choose-${name}`, title: name === NONE ? 'plain' : name, does: () => { chooseBackdrop(name); } });
            press.element.classList.add('backdrop-choice');
            press.element.dataset.ground = name;
            if (chosenBackdrop() === name) press.element.classList.add('backdrop-choice-on');
            choices.append(press.element);
        }
        if (offeredBackdrops().length === 0) {
            const none = part('div', 'backdrop-none');
            none.textContent = 'No element on this node offers a ground.';
            choices.append(none);
        }
    };
    draw();
    return onBackdropChange(draw);
}

/** Opens the Backdrop element, a small window at the end of the tray. */
export function openBackdropElement(): void {
    if (!tray.has(ELEMENT_ID)) {
        tray.add({
            id: ELEMENT_ID,
            title: 'Backdrop',
            symbol: '▣',
            color: glassPane(),
            opensAs: 'window',
            opensAt: 'end',
            renderContent: () => {
                const body = part('div', 'content-area backdrop-body');
                drawBackdropChoice(body);
                return body;
            },
        });
    }
    tray.open(ELEMENT_ID);
}
