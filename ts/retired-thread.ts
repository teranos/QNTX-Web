/**
 * The thread's end marker (〽, Part Alternation Mark). The thread is gone, and a canvas saved
 * before it went still holds records under this symbol. No type may take it: a saved 〽 is that
 * marker, whatever has registered by the time it is read.
 */
export const RESERVED_SYMBOLS: readonly string[] = ['〽'];

/** Whether a saved record is a thread's end marker. */
export function isRetiredThreadMarker(item: { symbol?: string }): boolean {
    return item.symbol !== undefined && RESERVED_SYMBOLS.includes(item.symbol);
}
