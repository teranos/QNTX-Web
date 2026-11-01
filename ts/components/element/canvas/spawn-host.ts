/**
 * The host's side of the spawn menu.
 *
 * "on mobile, can't get into spawn menu"
 *
 * The menu, a right-click or a finger held still opening it, carrying the choice
 * and the morph that puts it down are @teranos/elements' (`configureElements({ spawn })`).
 * What is said here is which element types a press offers (`entries`), what becomes
 * of a choice (`place`: its id, its place under the canvas's pan and zoom, its
 * persistence), and the thread, which is built by pressing symbols one after
 * another and so is the host's to carry (`take`).
 *
 * Element types and their spawn configuration come from element-registry.ts.
 */

import type { Element, SpawnEntry, SpawnHost } from '@teranos/elements';
import { putDownCarried } from '@teranos/elements';
import { log, SEG } from '../../../logger';
import { uiState } from '../../../state/ui';
import { getTransform } from './canvas-pan';
import {
    type ElementTypeEntry,
    getAllElementTypes,
    getSpawnableElements,
    getElementTypeBySymbol,
    getCommandEntry,
    getMatchingCommandNames,
    getCommandLabel,
} from '../element-registry';
import { enterThreadBuildingMode } from './thread-line';
import { getThreadColor } from '../thread-element';
import { addSpine } from './spine-renderer';

/** Part Alternation Mark — thread/spine symbol */
const THREAD_SYMBOL = '\u303D'; // 〽

/** Element descriptions for context reveal */
const ELEMENT_DESCRIPTIONS: Record<string, { desc: string; hint?: string }> = {
    'AX':        { desc: 'Query the attestation graph', hint: 'subject predicate context actor' },
    'SE':        { desc: 'Semantic similarity search', hint: 'Find attestations by meaning' },
    'Py':        { desc: 'Python code editor', hint: 'Runs in embedded interpreter' },
    'TS':        { desc: 'TypeScript code editor', hint: 'Runs in browser via Bun' },
    'Prompt':    { desc: 'AI prompt with context', hint: 'Attach attestations as grounding' },
    'Note':      { desc: 'Freeform text note', hint: 'Select text → convert to prompt' },
    'Subcanvas': { desc: 'Nested canvas workspace', hint: 'Infinite depth' },
    'Thread':    { desc: 'Navigational thread', hint: 'Connect elements into a path' },
};

/** What the menu says of a type: its symbol is its id, since a symbol finds its type. */
function entryOf(type: ElementTypeEntry): SpawnEntry {
    const info = ELEMENT_DESCRIPTIONS[type.label];
    return {
        id: type.symbol,
        symbol: type.symbol,
        title: type.title,
        ...(info && { description: info.desc, ...(info.hint !== undefined && { hint: info.hint }) }),
    };
}

/** The thread entry shown when pressing an element symbol */
function symbolContextEntries(): SpawnEntry[] {
    const type = getElementTypeBySymbol(THREAD_SYMBOL);
    return type ? [entryOf({ ...type, spawnMenuOrder: 0 })] : [];
}

/** The actual symbol span: the one pressed, or the one in the element pressed. */
function symbolOf(target: HTMLElement): HTMLElement | null {
    const elementEl = target.closest('.canvas-element') as HTMLElement | null;
    return (target.closest('.symbol') as HTMLElement | null)
        ?? (elementEl?.querySelector('.symbol') as HTMLElement | null)
        ?? null;
}

/** What a canvas workspace holds, as buildCanvasWorkspace makes it. */
function workspaceOf(canvas: HTMLElement): { contentLayer: HTMLElement; items: Element[]; canvasId: string } {
    const contentLayer = canvas.querySelector('.canvas-content-layer') as HTMLElement | null;
    if (!contentLayer) throw new Error('the canvas has no content layer to place an element on');
    return {
        contentLayer,
        items: (canvas as any).__elements ?? [],
        canvasId: canvas.dataset.canvasId || 'canvas-workspace',
    };
}

/** A screen point as a place on the canvas, under its pan and zoom. */
function onCanvas(canvas: HTMLElement, canvasId: string, clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const { panX, panY, scale } = getTransform(canvasId);
    return {
        x: Math.round((clientX - rect.left - panX) / scale),
        y: Math.round((clientY - rect.top - panY) / scale),
    };
}

/** The id each placed element was given, by the element, for whoever put it down. */
const placedIds = new WeakMap<HTMLElement, string>();

export const spawnHost: SpawnHost = {
    // Right-click on an element symbol: thread actions (〽). On the background: element types.
    entries({ target }) {
        const types = symbolOf(target)
            ? symbolContextEntries()
            : [
                ...getSpawnableElements().map(entryOf),
                ...getAllElementTypes()
                    .filter(g => g.className.includes('canvas-plugin-element') || g.publishedName !== undefined)
                    .map(entryOf),
            ];
        return types;
    },

    async place({ entry, canvas, at, carried, symbol, content }) {
        const type = getElementTypeBySymbol(entry.id);
        if (!type) throw new Error(`no element type for ${entry.id}`);
        const { contentLayer, items, canvasId } = workspaceOf(canvas);
        const { x, y } = onCanvas(canvas, canvasId, at.clientX, at.clientY);
        const placed = await spawnElement(x, y, contentLayer, items, canvasId, type, carried, symbol, content);
        placedIds.set(placed.el, placed.id);
        return placed.el;
    },

    // Thread building: press symbols to build a path, press empty canvas to finish.
    take({ entry, canvas, target }) {
        if (entry.id !== THREAD_SYMBOL) return false;
        const origin = symbolOf(target);
        if (!origin) return false;
        startThread(origin, canvas, entry);
        return true;
    },
};

function startThread(origin: HTMLElement, canvas: HTMLElement, entry: SpawnEntry): void {
    const { contentLayer, canvasId } = workspaceOf(canvas);
    const threadColor = getThreadColor(0);
    enterThreadBuildingMode(origin, threadColor, (result) => {
        // The cursor 〽 is the element put down: one element, from the cursor to the end of the thread.
        const carried = result.cursorElement;
        void putDownCarried({
            entry,
            canvas,
            at: { clientX: result.placeX, clientY: result.placeY },
            carried,
            symbol: result.symbolElement,
        }).then(() => {
            const threadElementId = placedIds.get(carried);
            if (!threadElementId) throw new Error('the thread element was not placed');
            const spine = {
                id: `spine-${crypto.randomUUID()}`,
                color: threadColor,
                nodes: [...result.nodeIds, threadElementId],
            };
            addSpine(canvasId, contentLayer, spine);
            uiState.addCanvasSpine(spine);
        }).catch((err: unknown) => log.error(SEG.ELEMENT, '[SpawnMenu] thread element spawn failed:', err));
    }, () => {
        // Cancelled
    });
}

/** Normalize canvasId for storage: 'canvas-workspace' → '' (root) */
function storageCanvasId(canvasId: string): string {
    return canvasId === 'canvas-workspace' ? '' : canvasId;
}

/**
 * Spawn an element of the given type at a position on the canvas.
 *
 * With a carried element (a cursor from the menu) the type renders into it: one
 * element, from the menu's button to the placed element. The package morphs it
 * into place once this has put it on the canvas.
 */
export async function spawnElement(
    x: number,
    y: number,
    canvas: HTMLElement,
    items: Element[],
    canvasId: string,
    entry: ElementTypeEntry,
    cursorElement?: HTMLElement,
    symbolElement?: HTMLElement | null,
    content?: string
): Promise<{ id: string; el: HTMLElement }> {
    const elementId = `${entry.label.toLowerCase()}-${crypto.randomUUID()}`;
    const item: Element = {
        id: elementId,
        title: entry.title,
        symbol: entry.symbol,
        x,
        y,
        content,
        cursorElement,
        symbolElement: symbolElement ?? undefined,
        renderContent: () => {
            const el = document.createElement('div');
            el.textContent = `${entry.title} element`;
            return el;
        }
    };

    items.push(item);

    const elementElement = await entry.render(item);
    canvas.appendChild(elementElement);
    persistElement(elementElement, item, entry, canvasId);
    return { id: elementId, el: elementElement };
}

/** Persist element to UI state */
function persistElement(
    elementElement: HTMLElement,
    item: Element,
    entry: ElementTypeEntry,
    canvasId: string
): void {
    // Layout size, not getBoundingClientRect: the rect carries every transform on
    // the element and above it. Persisted during the cursor morph it is the
    // cursor's 44x44 (the morph's first keyframe scales the element down to the
    // cursor), and on a zoomed canvas it is the zoomed size.
    const width = elementElement.offsetWidth;
    const height = elementElement.offsetHeight;

    uiState.addCanvasElement({
        id: item.id,
        symbol: entry.symbol,
        x: item.x!,
        y: item.y!,
        width,
        height,
        canvas_id: storageCanvasId(canvasId),
        ...(item.content !== undefined ? { content: item.content } : entry.defaultContent !== undefined ? { content: entry.defaultContent } : {}),
        ...(entry.pluginName !== undefined && { plugin_name: entry.pluginName }),
    });

    log.debug(SEG.ELEMENT, `[Canvas] Spawned ${entry.label} element at (${item.x}, ${item.y}) with size ${width}x${height}`);
}

/** Re-export registry command helpers for existing callers */
export { getMatchingCommandNames as getMatchingCommands, getCommandLabel };

/**
 * Spawn an element on the active canvas by command name.
 * Returns true if an element was spawned.
 */
export function spawnElementByCommand(command: string): boolean {
    const entry = getCommandEntry(command);
    if (!entry) return false;

    const workspace = document.querySelector('.canvas-workspace') as HTMLElement | null;
    if (!workspace) return false;

    const contentLayer = workspace.querySelector('.canvas-content-layer') as HTMLElement | null;
    if (!contentLayer) return false;

    const items: Element[] = (workspace as any).__elements || [];
    const canvasId = workspace.dataset.canvasId || 'canvas-workspace';

    // Spawn at center of visible canvas
    const rect = workspace.getBoundingClientRect();
    const x = Math.round(rect.width / 2);
    const y = Math.round(rect.height / 2);

    // TODO(#547): Element spawning from search bar needs refinement — ghost preview under cursor, click-to-place, visual distinction in search results
    spawnElement(x, y, contentLayer, items, canvasId, entry)
        .catch(err => log.error(SEG.ELEMENT, `Failed to spawn element "${command}": ${err}`));
    return true;
}
