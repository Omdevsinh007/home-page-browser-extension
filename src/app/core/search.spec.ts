import { fuzzyScore } from './fuzzy';
import { TopItem } from './model';
import { buildIndex, search } from './search';

describe('fuzzyScore', () => {
  it('returns null when nothing matches', () => {
    expect(fuzzyScore('zzzz', 'Strapi CMS')).toBeNull();
  });

  it('ranks exact > prefix > substring > subsequence > typo', () => {
    const exact = fuzzyScore('strapi', 'Strapi')!;
    const prefix = fuzzyScore('stra', 'Strapi CMS')!;
    const substring = fuzzyScore('rapi', 'Strapi CMS')!;
    const subsequence = fuzzyScore('strpi', 'Strapi CMS')!;
    const typo = fuzzyScore('strapo', 'Strapi CMS')!;
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(subsequence);
    expect(subsequence).toBeGreaterThan(typo);
    expect(typo).toBeGreaterThan(0);
  });

  it('is case- and accent-insensitive', () => {
    expect(fuzzyScore('café', 'Cafe menu')).not.toBeNull();
    expect(fuzzyScore('CAFE', 'café')).not.toBeNull();
  });

  it.each(['c++', '(', '[', '.*', '\\'])('treats %s literally without throwing', (q) => {
    expect(() => fuzzyScore(q, 'C++ notes (draft) [x] .* \\')).not.toThrow();
    expect(fuzzyScore(q, 'C++ notes (draft) [x] .* \\')).not.toBeNull();
  });

  it('does not allow typos for short queries', () => {
    expect(fuzzyScore('gix', 'git')).toBeNull();
  });
});

const items: TopItem[] = [
  { id: 'mail', type: 'Shortcut', name: 'Gmail', url: 'https://mail.google.com', position: 0 },
  {
    id: 'p',
    type: 'Group',
    name: 'Propera',
    position: 1,
    sections: [
      {
        id: 'git',
        name: 'Git',
        position: 0,
        sort: 'manual',
        links: [
          { id: 'cms', name: 'CMS repo', url: 'https://github.com/acme/cms', position: 0 },
          { id: 'user', name: 'User repo', url: 'https://github.com/acme/user', position: 1 },
        ],
      },
      {
        id: 'design',
        name: 'Design',
        position: 1,
        sort: 'manual',
        links: [{ id: 'fig', name: 'Dashboard', url: 'https://www.figma.com/file/1', position: 0 }],
      },
      {
        id: 'env',
        name: 'Environments',
        position: 2,
        sort: 'manual',
        links: [{ id: 'strapi', name: 'Strapi CMS', url: '52.0.205.252', position: 0 }],
      },
    ],
  },
];

describe('buildIndex', () => {
  it('indexes shortcuts and group links with their path', () => {
    const index = buildIndex(items);
    expect(index.map((e) => e.linkId)).toEqual(['mail', 'cms', 'user', 'fig', 'strapi']);
    expect(index.find((e) => e.linkId === 'cms')!.path).toEqual(['Propera', 'Git', 'CMS repo']);
    expect(index.find((e) => e.linkId === 'mail')!.path).toEqual(['Gmail']);
    expect(index.find((e) => e.linkId === 'fig')!.host).toBe('figma.com');
  });
});

describe('search', () => {
  const index = buildIndex(items);
  const ids = (q: string, stats = {}) => search(index, q, stats).matches.map((e) => e.linkId);

  it('finds a link despite a dropped letter', () => {
    expect(ids('strpi')).toEqual(['strapi']);
  });

  it('matches by hostname', () => {
    expect(ids('figma')).toEqual(['fig']);
  });

  it('matches a section name and returns all its links', () => {
    expect(ids('git')).toEqual(expect.arrayContaining(['cms', 'user']));
  });

  it('matches a group name', () => {
    expect(ids('propera')).toHaveLength(4);
  });

  it('ranks a name prefix above a substring', () => {
    expect(ids('cms')[0]).toBe('cms');
  });

  it('breaks ties by usage count', () => {
    expect(ids('repo', { user: { count: 3, lastOpenedAt: 1 } })).toEqual(['user', 'cms']);
  });

  it('reports noMatch and returns every link in all', () => {
    const r = search(index, 'zzzz', {});
    expect(r.noMatch).toBe(true);
    expect(r.matches).toEqual([]);
    expect(r.all).toHaveLength(5);
  });

  it('returns nothing for a blank query', () => {
    expect(search(index, '   ', {})).toMatchObject({ matches: [], noMatch: false });
  });

  it('limits the number of matches', () => {
    expect(search(index, 'e', {}, 2).matches).toHaveLength(2);
  });
});
