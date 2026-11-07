// Glass: the colour an element wears over the ground, read from the tokens
// (css/tokens.css, as vitreous makes glass), so the ground under everything
// shows through. The blur is the stylesheet's.

// "i want more tranparency"
// "and glass is already being explored in vitrous, take lessons from exisring vitrous"

function token(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const said = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return said || undefined;
}

/** The glass a window's copy sits in; the package's own colour when the tokens are not up. */
export function glass(): string | undefined {
    return token('--glass');
}

/** The thin glass over what is worth seeing through to: the canvas. */
export function glassThin(): string | undefined {
    return token('--glass-thin');
}

/** The room's glass, the thinnest: the ground the room holds is the thing to see. */
// "make sure a room element bg is more transparent and shows the visual"
export function glassRoom(): string | undefined {
    return token('--glass-room');
}
