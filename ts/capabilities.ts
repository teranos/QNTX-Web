// What this node can do, asked of the store it keeps rather than assumed.
// The node names it on connect; before that we know nothing, and an affordance
// shown on a guess is worse than one that arrives a moment late.

// Namespaces are the top-level prefix at a storage location (ADR-026), which
// only parquet has — sqlite keeps one universe and the word is decoration.
export function namespacesBelongHere(store: string): boolean {
    return store === 'parquet';
}
