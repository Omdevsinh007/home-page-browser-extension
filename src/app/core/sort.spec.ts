import { LinkItem } from './model';
import { sortLinks } from './sort';

const links: LinkItem[] = [
  { id: 'a', name: 'Git - 10', url: '', position: 0, createdAt: 100 },
  { id: 'b', name: 'git - 2', url: '', position: 1 },
  { id: 'c', name: 'Docs', url: '', position: 2, createdAt: 300 },
  { id: 'd', name: 'Board', url: '', position: 3 },
];
const ids = (l: LinkItem[]) => l.map((x) => x.id);

describe('sortLinks', () => {
  it('manual orders by position', () => {
    const shuffled = [links[2], links[0], links[3], links[1]];
    expect(ids(sortLinks(shuffled, 'manual', {}))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('az is case-insensitive and numeric aware', () => {
    expect(ids(sortLinks(links, 'az', {}))).toEqual(['d', 'c', 'b', 'a']);
  });

  it('recent puts dated links newest first, then undated in position order', () => {
    expect(ids(sortLinks(links, 'recent', {}))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('most-used sorts by count, then lastOpenedAt, then position', () => {
    const stats = { d: { count: 5, lastOpenedAt: 1 }, b: { count: 2, lastOpenedAt: 9 }, a: { count: 2, lastOpenedAt: 3 } };
    expect(ids(sortLinks(links, 'most-used', stats))).toEqual(['d', 'b', 'a', 'c']);
  });

  it('never changes the input or the stored positions', () => {
    const snapshot = structuredClone(links);
    const out = sortLinks(links, 'az', {});
    expect(links).toEqual(snapshot);
    expect(out.find((l) => l.id === 'a')!.position).toBe(0);
  });
});
