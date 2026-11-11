import { flattenToV1 } from './flatten';
import { stableHash } from './hash';
import { migrateV1toV2 } from './migrate';
import { GroupTile, TopItem, V1Shortcut } from './model';
import { reconcile } from './reconcile';

/** Verbatim copy of v2.6.0's import validator (src/app/app.ts isValidShortcutData). */
function legacyValidate(data: any): boolean {
  if (!Array.isArray(data)) return false;
  for (const item of data) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.id !== 'string') return false;
    if (item.type !== 'Shortcut' && item.type !== 'Group') return false;
    if (typeof item.position !== 'number') return false;
    if (item.name !== null && typeof item.name !== 'string') return false;
    if (item.url !== null && typeof item.url !== 'string') return false;
    if (item.group !== null) {
      if (!Array.isArray(item.group)) return false;
      for (const g of item.group) {
        if (!g || typeof g !== 'object') return false;
        if (typeof g.id !== 'string') return false;
        if (typeof g.name !== 'string') return false;
        if (typeof g.url !== 'string') return false;
        if (typeof g.position !== 'number') return false;
      }
    }
  }
  return true;
}

const link = (id: string, position: number) => ({ id, name: `N ${id}`, url: `https://${id}.example`, position });

function sample(): TopItem[] {
  return [
    { id: 's1', type: 'Shortcut', name: 'Mail', url: 'https://mail.example', position: 0, createdAt: 5 },
    {
      id: 'g1',
      type: 'Group',
      name: 'Propera',
      position: 1,
      sections: [
        { id: 'docs', name: 'Docs', position: 1, sort: 'az', links: [link('d1', 0), link('d2', 1)] },
        { id: 'git', name: 'Git', position: 0, sort: 'manual', color: 'accent-2', links: [link('r1', 0), link('r2', 1)] },
        { id: 'empty', name: 'Empty', position: 2, sort: 'manual', links: [] },
      ],
    },
    { id: 'g2', type: 'Group', name: 'Other', position: 2, sections: [{ id: 'o', name: 'General', position: 0, sort: 'manual', links: [link('o1', 0)] }] },
  ];
}

const groupOf = (items: TopItem[], id: string) => items.find((i) => i.id === id) as GroupTile;
const sectionLinks = (items: TopItem[], g: string, s: string) =>
  groupOf(items, g).sections.find((x) => x.id === s)!.links.map((l) => l.id);

describe('flattenToV1', () => {
  it('produces data the v2.6.0 validator accepts', () => {
    expect(legacyValidate(flattenToV1(sample()))).toBe(true);
  });

  it('orders group links by section position then link position, renumbered', () => {
    const g = flattenToV1(sample())[1];
    expect(g.group!.map((l) => l.id)).toEqual(['r1', 'r2', 'd1', 'd2']);
    expect(g.group!.map((l) => l.position)).toEqual([0, 1, 2, 3]);
    expect(g.url).toBe('');
  });

  it('round-trips every link id through migrateV1toV2', () => {
    const back = migrateV1toV2(flattenToV1(sample())).items;
    expect(groupOf(back, 'g1').sections[0].links.map((l) => l.id).sort()).toEqual(['d1', 'd2', 'r1', 'r2']);
    expect(back.map((i) => i.id)).toEqual(['s1', 'g1', 'g2']);
  });
});

describe('stableHash', () => {
  it('is equal for objects with reordered keys', () => {
    expect(stableHash({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(stableHash({ b: [1, { d: 3, c: 2 }], a: 1 }));
  });

  it('changes when one character changes', () => {
    expect(stableHash({ a: 'abc' })).not.toBe(stableHash({ a: 'abd' }));
  });
});

describe('reconcile', () => {
  const mirrorOf = () => flattenToV1(sample()) as V1Shortcut[];

  it('returns v2 unchanged when the mirror is unchanged', () => {
    expect(reconcile(sample(), mirrorOf())).toEqual(sample());
  });

  it('takes a renamed link from the mirror and keeps its section', () => {
    const m = mirrorOf();
    m[1].group![2] = { ...m[1].group![2], name: 'Renamed', url: 'https://new.example' };
    const out = reconcile(sample(), m);
    const d1 = groupOf(out, 'g1').sections.find((s) => s.id === 'docs')!.links[0];
    expect(d1).toMatchObject({ id: 'd1', name: 'Renamed', url: 'https://new.example' });
  });

  it('appends a link added in the old version to the first section', () => {
    const m = mirrorOf();
    m[1].group!.push({ id: 'n1', name: 'New', url: 'https://n.example', position: 4 });
    const out = reconcile(sample(), m);
    expect(sectionLinks(out, 'g1', 'git')).toEqual(['r1', 'r2', 'n1']);
  });

  it('removes a link deleted in the old version', () => {
    const m = mirrorOf();
    m[1].group = m[1].group!.filter((l) => l.id !== 'r2');
    expect(sectionLinks(reconcile(sample(), m), 'g1', 'git')).toEqual(['r1']);
  });

  it('gives a group added in the old version one General section', () => {
    const m = mirrorOf();
    m.push({ id: 'g3', type: 'Group', name: 'Added', url: '', group: [link('a1', 0)], position: 3 });
    const g3 = groupOf(reconcile(sample(), m, () => 'sec-new'), 'g3');
    expect(g3.sections).toEqual([{ id: 'sec-new', name: 'General', position: 0, sort: 'manual', links: [link('a1', 0)] }]);
  });

  it('removes a group deleted in the old version', () => {
    const m = mirrorOf().filter((i) => i.id !== 'g2');
    expect(reconcile(sample(), m).map((i) => i.id)).toEqual(['s1', 'g1']);
  });

  it('follows a top-level reorder from the old version', () => {
    const m = mirrorOf();
    m[0].position = 5;
    expect(reconcile(sample(), m).map((i) => i.id)).toEqual(['g1', 'g2', 's1']);
  });

  it('puts a link moved to another group into that group’s first section', () => {
    const m = mirrorOf();
    const moved = m[1].group!.find((l) => l.id === 'd2')!;
    m[1].group = m[1].group!.filter((l) => l.id !== 'd2');
    m[2].group!.push({ ...moved, position: 1 });
    const out = reconcile(sample(), m);
    expect(sectionLinks(out, 'g2', 'o')).toEqual(['o1', 'd2']);
    expect(sectionLinks(out, 'g1', 'docs')).toEqual(['d1']);
  });

  it('keeps empty sections and section settings', () => {
    const g1 = groupOf(reconcile(sample(), mirrorOf()), 'g1');
    expect(g1.sections.map((s) => s.id)).toEqual(['docs', 'git', 'empty']);
    expect(g1.sections.find((s) => s.id === 'git')).toMatchObject({ color: 'accent-2', sort: 'manual' });
  });

  it('keeps createdAt of surviving shortcuts', () => {
    const m = mirrorOf();
    m[0].name = 'Mail 2';
    expect(reconcile(sample(), m)[0]).toMatchObject({ name: 'Mail 2', createdAt: 5 });
  });
});
