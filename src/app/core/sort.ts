import { LinkItem, LinkStat, SortMode } from './model';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

type Compare = (a: LinkItem, b: LinkItem) => number;

const byPosition: Compare = (a, b) => a.position - b.position;

/** View-only ordering (spec §8). Returns a new array; never touches `position`. */
export function sortLinks(links: readonly LinkItem[], mode: SortMode, stats: Record<string, LinkStat>): LinkItem[] {
  const compare: Record<SortMode, Compare> = {
    manual: byPosition,
    az: (a, b) => collator.compare(a.name, b.name) || byPosition(a, b),
    recent: (a, b) => {
      if (a.createdAt !== undefined && b.createdAt !== undefined) return b.createdAt - a.createdAt || byPosition(a, b);
      if (a.createdAt !== undefined) return -1;
      if (b.createdAt !== undefined) return 1;
      return byPosition(a, b);
    },
    'most-used': (a, b) => {
      const sa = stats[a.id];
      const sb = stats[b.id];
      return (sb?.count ?? 0) - (sa?.count ?? 0) || (sb?.lastOpenedAt ?? 0) - (sa?.lastOpenedAt ?? 0) || byPosition(a, b);
    },
  };
  return [...links].sort(compare[mode]);
}
