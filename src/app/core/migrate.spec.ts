import {
  corruptObject,
  corruptString,
  corruptTypes,
  futureV3,
  legacyUnversioned,
  v1RealShape,
  v1RealShapeWrapped,
  v2Data,
  v2ShapeWithV1Version,
} from './__fixtures__/v1';
import { detectShape, migrateV1toV2 } from './migrate';
import { GroupTile } from './model';

let counter = 0;
const newId = () => `new-${++counter}`;

describe('detectShape', () => {
  it.each([
    ['undefined', undefined, 'empty'],
    ['null', null, 'empty'],
    ['empty array', [], 'empty'],
    ['wrapped v1', v1RealShapeWrapped, 'v1'],
    ['bare legacy array', legacyUnversioned, 'v1'],
    ['v2', v2Data, 'v2'],
    ['v2 shape saved with version 1', v2ShapeWithV1Version, 'v2'],
    ['future v3', futureV3, 'future'],
    ['string', corruptString, 'corrupt'],
    ['object without data', corruptObject, 'corrupt'],
    ['wrong field types', corruptTypes, 'corrupt'],
  ])('%s → %s', (_label, raw, expected) => {
    expect(detectShape(raw)).toBe(expected);
  });
});

describe('migrateV1toV2', () => {
  it('keeps every top-level id and renumbers duplicate positions in array order', () => {
    const { items } = migrateV1toV2(v1RealShape, newId);
    expect(items).toHaveLength(9);
    expect(items.map((i) => i.id)).toEqual(v1RealShape.map((i) => i.id));
    expect(items.map((i) => i.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('puts each group into exactly one manual General section with all links', () => {
    const { items } = migrateV1toV2(v1RealShape, newId);
    const groups = items.filter((i): i is GroupTile => i.type === 'Group');
    expect(groups).toHaveLength(8);
    for (const g of groups) {
      expect(g.sections).toHaveLength(1);
      expect(g.sections[0]).toMatchObject({ name: 'General', position: 0, sort: 'manual' });
    }
    const total = groups.reduce((n, g) => n + g.sections[0].links.length, 0);
    expect(total).toBe(41);
  });

  it('keeps link ids, urls and order, including bare-IP and empty urls', () => {
    const { items } = migrateV1toV2(v1RealShape, newId);
    const g1 = items.find((i) => i.id === 'group-1') as GroupTile;
    const links = g1.sections[0].links;
    expect(links.map((l) => l.id)).toEqual(v1RealShape[2].group!.map((l) => l.id));
    expect(links[1].url).toBe('52.0.205.252');
    expect(links[16].url).toBe('');
    expect(links.map((l) => l.position)).toEqual([...Array(18).keys()]);
  });

  it('sorts legacy links by their old position', () => {
    const { items } = migrateV1toV2(legacyUnversioned, newId);
    const g = items[0] as GroupTile;
    expect(g.sections[0].links.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('drops the v1-only group url and shortcut group fields', () => {
    const { items } = migrateV1toV2(v1RealShape, newId);
    expect(items[0]).not.toHaveProperty('group');
    expect(items[1]).not.toHaveProperty('url');
  });

  it('quarantines items with an unknown type instead of dropping them', () => {
    const odd = { id: 'x', type: 'Folder', name: 'x', url: null, group: null, position: 0 };
    const { items, quarantine } = migrateV1toV2([...legacyUnversioned, odd], newId);
    expect(items.map((i) => i.id)).toEqual(['g']);
    expect(quarantine).toEqual([odd]);
  });

  it('returns nothing for empty input', () => {
    expect(migrateV1toV2([], newId)).toEqual({ items: [], quarantine: [] });
  });

  it('does not mutate the input', () => {
    const snapshot = structuredClone(v1RealShape);
    migrateV1toV2(v1RealShape, newId);
    expect(v1RealShape).toEqual(snapshot);
  });
});
