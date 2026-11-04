/** Records saved under these symbols are dropped when read, and no type may take them. */
export const DROPPED_SYMBOLS: readonly string[] = ['\u303D'];

export function isDropped(item: { symbol?: string }): boolean {
    return item.symbol !== undefined && DROPPED_SYMBOLS.includes(item.symbol);
}
