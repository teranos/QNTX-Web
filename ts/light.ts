// A light: the status line's dot, glowing, with a word beside it, as Connected is. One for every light the page shows.
// "there is a light indicator, reuse it, or get it into its own component."

/** Off: nothing set up yet. On: it works. Low: it works, and is running out. Refused: it was asked and said no. Waiting: it is being asked. */
export type LightState = 'off' | 'on' | 'low' | 'refused' | 'waiting';

export interface Light {
    element: HTMLElement;
    show: (state: LightState, words?: string) => void;
}

/** A light named of, its state on data-state for the stylesheet to light (css/drawer.css). */
export function lightFrom(of: string, words = ''): Light {
    const element = document.createElement('span');
    element.className = 'light';
    element.dataset.light = of;
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    const said = document.createElement('span');
    said.className = 'light-words';
    element.append(dot, said);
    const show = (state: LightState, words_ = '') => {
        element.dataset.state = state;
        said.textContent = words_;
        said.hidden = words_ === '';
    };
    show('off', words);
    return { element, show };
}
