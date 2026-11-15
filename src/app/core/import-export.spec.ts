import { legacyUnversioned, v1RealShape, v1RealShapeWrapped } from './__fixtures__/v1';
import { buildExport, parseImport } from './import-export';
import { GroupTile, TopItem } from './model';

const items: TopItem[] = [
  { id: 's', type: 'Shortcut', name: 'Mail', url: 'https://mail.example', position: 0 },
  {
    id: 'g',
    type: 'Group',
    name: 'G',
    position: 1,
    sections: [
      {
        id: 'sec',
        name: 'Git',
        position: 0,
        sort: 'az',
        links: [
          { id: 'ok', name: 'Repo', url: 'https://github.com', position: 0 },
          { id: 'bad', name: 'Evil', url: 'javascript:alert(1)', position: 1 },
        ],
      },
    ],
  },
];

describe('buildExport', () => {
  it('wraps links with app, version and timestamp', () => {
    const file = buildExport(items, { ok: { count: 1, lastOpenedAt: 2 } }, new Date('2026-11-11T10:00:00Z'));
    expect(file).toEqual({
      app: 'custom-homepage',
      version: 2,
      exportedAt: '2026-11-11T10:00:00.000Z',
      links: items,
      linkStats: { ok: { count: 1, lastOpenedAt: 2 } },
    });
  });
});

describe('parseImport', () => {
  it('round-trips a v2 export and skips unsafe links with a reason', () => {
    const json = JSON.stringify(buildExport(items, { ok: { count: 1, lastOpenedAt: 2 } }, new Date()));
    const result = parseImport(json);
    const g = result.items[1] as GroupTile;
    expect(g.sections[0].links.map((l) => l.id)).toEqual(['ok']);
    expect(g.sections[0].sort).toBe('az');
    expect(result.skipped).toEqual([{ name: 'Evil', reason: 'unsafe-url' }]);
    expect(result.stats).toEqual({ ok: { count: 1, lastOpenedAt: 2 } });
  });

  it('migrates an old v2.x export (bare v1 array)', () => {
    const result = parseImport(JSON.stringify(v1RealShape));
    expect(result.items).toHaveLength(9);
    expect((result.items[1] as GroupTile).sections[0].name).toBe('General');
  });

  it('migrates a {version:1,data} file', () => {
    expect(parseImport(JSON.stringify(v1RealShapeWrapped)).items).toHaveLength(9);
  });

  it('migrates a legacy unversioned array', () => {
    expect(parseImport(JSON.stringify(legacyUnversioned)).items).toHaveLength(1);
  });

  it('skips an unsafe top-level shortcut', () => {
    const bad = [{ id: 'x', type: 'Shortcut', name: 'Bad', url: 'data:text/html,hi', group: null, position: 0 }];
    const result = parseImport(JSON.stringify(bad));
    expect(result.items).toEqual([]);
    expect(result.skipped).toEqual([{ name: 'Bad', reason: 'unsafe-url' }]);
  });

  it.each(['not json', '"a string"', '{"foo":1}', '[{"id":5}]', '{"version":9,"data":[]}'])('rejects %s', (text) => {
    expect(() => parseImport(text)).toThrow('Invalid file');
  });
});
