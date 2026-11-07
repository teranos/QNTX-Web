// Glass: the colour an element wears over the ground, read from the tokens
// (css/tokens.css --glass-pane), so the ground under everything shows through.

// "i want more tranparency"

/** The pane's glass, as the tokens say it; the package's own colour when the tokens are not up. */
export function glassPane(): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const said = getComputedStyle(document.documentElement).getPropertyValue('--glass-pane').trim();
    return said || undefined;
}
