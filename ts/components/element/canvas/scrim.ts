/**
 * The scrim — dims the canvas while a thread is built through its symbols.
 *
 * "on mobile, can't get into spawn menu"
 *
 * The spawn menu, carrying a choice, placing it and the scrim behind them are
 * @teranos/elements'. What is left here is the thread's: building one is
 * pressing symbols one after another, which is not carrying and pressing once,
 * so the host takes it (`take`, spawn-host.ts) and dims the canvas itself.
 */

const SCRIM_CLASS = 'placement-scrim';
const SCRIM_MENU_CLASS = 'placement-scrim--menu';

/** Dim the canvas heavily; the thread then lightens it to its carrying phase. */
export function showMenuScrim(): HTMLElement {
    removeScrim();
    const scrim = document.createElement('div');
    scrim.className = `${SCRIM_CLASS} ${SCRIM_MENU_CLASS}`;
    document.body.appendChild(scrim);
    return scrim;
}

/** Remove any existing scrim. */
export function removeScrim(): void {
    document.querySelector(`.${SCRIM_CLASS}`)?.remove();
}
