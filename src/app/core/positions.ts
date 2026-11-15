/** Stable sort by position, then renumber 0..n-1. Returns new objects. */
export function renumber<T extends { position: number }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.position - b.item.position || a.index - b.index)
    .map(({ item }, position) => ({ ...item, position }));
}

export function nextPosition(items: readonly { position: number }[]): number {
  return items.length === 0 ? 0 : Math.max(...items.map((i) => i.position)) + 1;
}
