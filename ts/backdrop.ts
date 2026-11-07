// The backdrop: the ground under everything, a visual that is always there.
// A room or any other element can take it over, and give it back.

// "the visual backdrop needs to always be there regardless of being in a Room or not, but not as glitchy, and other elements can replace the backdrop kind of idea."

const LAYER = 'backdrop';

/** The layer itself, or null before the page has one. */
export function backdropLayer(): HTMLElement | null {
    return document.getElementById(LAYER);
}

/**
 * Takes the backdrop over with node, which fills the layer. What gives it
 * back is returned: the layer is emptied, and whatever held it before is put
 * back if it is still around.
 */
export function takeBackdrop(node: HTMLElement): () => void {
    const layer = backdropLayer();
    if (!layer) return () => {};
    const before = Array.from(layer.childNodes);
    layer.replaceChildren(node);
    layer.dataset.heldBy = node.dataset.elementId ?? node.className ?? 'something';
    return () => {
        if (layer.firstChild !== node) return;
        layer.replaceChildren(...before);
        delete layer.dataset.heldBy;
    };
}

/** Who holds the backdrop now, or empty when it is the page's own. */
export function backdropHeldBy(): string {
    return backdropLayer()?.dataset.heldBy ?? '';
}
