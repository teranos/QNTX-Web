/**
 * Tray restore — a window resting in the tray rests there again after a restart.
 *
 * "tray persistence between Mobile App restarts"
 *
 * The tray keeps the id of each window in it (uiState's minimizedWindows, and
 * the node's /api/canvas/minimized-windows), not the window. A placed result is
 * rebuilt from the canvas element its id names (main.ts); every other window is
 * rebuilt here, by the kind its id names, from the id alone. An id no kind here
 * names, and no canvas element holds, is dropped as it was before.
 */

import { log, SEG } from './logger';

type Restorer = (rest: string) => Promise<void>;

/** Each kind of window that can be rebuilt from its id: the id's prefix, and how. */
const RESTORERS: ReadonlyArray<readonly [string, Restorer]> = [
    // One agent session's Transcript, opened from Ground.
    ['transcript-', async (session) => {
        const { restTranscriptElement } = await import('./components/element/transcript-element');
        restTranscriptElement(session);
    }],
    // One User, opened from Users.
    ['user-element-', async (id) => {
        const { restUserElementById } = await import('./user-element');
        await restUserElementById(id);
    }],
];

/** How the window id names is rebuilt, or null when no kind here names it. */
export function restorerOf(id: string): (() => Promise<void>) | null {
    for (const [prefix, restore] of RESTORERS) {
        if (id.startsWith(prefix) && id.length > prefix.length) {
            const rest = id.slice(prefix.length);
            return () => restore(rest);
        }
    }
    return null;
}

/**
 * Rebuilds the window id names into the tray, without opening it, and without
 * holding up the start: a kind may ask the node first. Returns whether a kind
 * here names the id. One that fails says why and keeps the id, so the next
 * start tries again: a phone starting offline loses nothing.
 */
export function restoreToTray(id: string): boolean {
    const restore = restorerOf(id);
    if (!restore) return false;
    restore().then(
        () => log.debug(SEG.ELEMENT, `[TrayRestore] ${id} rests in the tray again`),
        (err: unknown) => log.warn(SEG.ELEMENT, `[TrayRestore] ${id} was not rebuilt: ${err instanceof Error ? err.message : String(err)}`),
    );
    return true;
}
