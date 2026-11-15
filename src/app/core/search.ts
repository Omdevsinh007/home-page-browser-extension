import { fuzzyScore } from './fuzzy';
import { LinkStat, TopItem } from './model';
import { renumber } from './positions';
import { hostnameOf } from './url';

export interface SearchEntry {
  linkId: string;
  name: string;
  url: string;
  host: string;
  /** ['Group', 'Section', 'Link'] for group links, ['Shortcut'] for top-level shortcuts. */
  path: string[];
}

export interface SearchResult {
  query: string;
  matches: SearchEntry[];
  noMatch: boolean;
  all: SearchEntry[];
}

/** Field weights: a hit on the link's own name counts most. */
const WEIGHTS = { name: 1, host: 0.9, section: 0.85, group: 0.8, url: 0.7 };

export function buildIndex(items: TopItem[]): SearchEntry[] {
  const host = (url: string) => hostnameOf(url).replace(/^www\./, '');
  return renumber(items).flatMap((item): SearchEntry[] => {
    if (item.type === 'Shortcut') {
      return [{ linkId: item.id, name: item.name, url: item.url, host: host(item.url), path: [item.name] }];
    }
    return renumber(item.sections).flatMap((section) =>
      renumber(section.links).map((link) => ({
        linkId: link.id,
        name: link.name,
        url: link.url,
        host: host(link.url),
        path: [item.name, section.name, link.name],
      })),
    );
  });
}

function scoreEntry(entry: SearchEntry, query: string): number | null {
  const isGroupLink = entry.path.length === 3;
  const candidates: [string, number][] = [
    [entry.name, WEIGHTS.name],
    [entry.host, WEIGHTS.host],
    [entry.url, WEIGHTS.url],
  ];
  if (isGroupLink) candidates.push([entry.path[1], WEIGHTS.section], [entry.path[0], WEIGHTS.group]);
  let best: number | null = null;
  for (const [text, weight] of candidates) {
    const s = fuzzyScore(query, text);
    if (s !== null && (best === null || s * weight > best)) best = s * weight;
  }
  return best;
}

export function search(index: SearchEntry[], query: string, stats: Record<string, LinkStat>, limit = 20): SearchResult {
  if (!query.trim()) return { query, matches: [], noMatch: false, all: index };
  const scored = index
    .map((entry, order) => ({ entry, order, score: scoreEntry(entry, query) }))
    .filter((x): x is { entry: SearchEntry; order: number; score: number } => x.score !== null)
    .sort(
      (a, b) =>
        b.score - a.score || (stats[b.entry.linkId]?.count ?? 0) - (stats[a.entry.linkId]?.count ?? 0) || a.order - b.order,
    );
  const matches = scored.slice(0, limit).map((x) => x.entry);
  return { query, matches, noMatch: matches.length === 0, all: index };
}
