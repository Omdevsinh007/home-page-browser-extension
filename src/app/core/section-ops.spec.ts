import { GroupTile, TopItem } from './model';
import {
  addGroup,
  addLink,
  addSection,
  addShortcut,
  deleteSection,
  moveLink,
  moveSection,
  moveTile,
  patchSection,
  removeLink,
  removeTile,
  renameSection,
  replaceGroup,
  updateLink,
  updateTile,
} from './section-ops';

const link = (id: string, position: number) => ({ id, name: id.toUpperCase(), url: `https://${id}.x`, position });

function group(): GroupTile {
  return {
    id: 'g',
    type: 'Group',
    name: 'G',
    position: 1,
    sections: [
      { id: 's1', name: 'Git', position: 0, sort: 'manual', links: [link('a', 0), link('b', 1)] },
      { id: 's2', name: 'Docs', position: 1, sort: 'manual', links: [link('c', 0), link('d', 1), link('e', 2)] },
    ],
  };
}

function items(): TopItem[] {
  return [{ id: 'x', type: 'Shortcut', name: 'X', url: 'https://x', position: 0 }, group()];
}

const ids = (g: GroupTile, s: string) => g.sections.find((x) => x.id === s)!.links.map((l) => l.id);
const positions = (g: GroupTile, s: string) => g.sections.find((x) => x.id === s)!.links.map((l) => l.position);

/** Runs fn and asserts the input was not mutated. */
function pure<T, R>(input: T, fn: (i: T) => R): R {
  const snapshot = structuredClone(input);
  const out = fn(input);
  expect(input).toEqual(snapshot);
  return out;
}

describe('top-level tiles', () => {
  it('updateTile keeps the tile position (rename must not move a group)', () => {
    const out = pure(items(), (i) => updateTile(i, 'g', { name: 'Renamed' }));
    expect(out[1]).toMatchObject({ id: 'g', name: 'Renamed', position: 1 });
  });

  it('remove then add keeps positions unique and contiguous', () => {
    const out = addShortcut(removeTile(items(), 'x'), 'New', 'https://n', 10, 'n');
    expect(out.map((i) => i.id)).toEqual(['g', 'n']);
    expect(out.map((i) => i.position)).toEqual([0, 1]);
    expect(out[1]).toMatchObject({ createdAt: 10, type: 'Shortcut' });
  });

  it('addGroup creates one manual General section', () => {
    const out = pure(items(), (i) => addGroup(i, 'New', 7, 'ng'));
    const g = out.find((i) => i.id === 'ng') as GroupTile;
    expect(g.sections).toHaveLength(1);
    expect(g.sections[0]).toMatchObject({ name: 'General', sort: 'manual', links: [] });
  });

  it('moveTile reorders and renumbers', () => {
    const out = pure(items(), (i) => moveTile(i, 0, 1));
    expect(out.map((i) => [i.id, i.position])).toEqual([['g', 0], ['x', 1]]);
  });

  it('replaceGroup swaps the group by id', () => {
    const g = { ...group(), name: 'Swapped' };
    expect((replaceGroup(items(), g)[1] as GroupTile).name).toBe('Swapped');
  });
});

describe('sections', () => {
  it('addSection appends a manual section', () => {
    const g = pure(group(), (x) => addSection(x, 'Design', 'nd'));
    expect(g.sections.at(-1)).toMatchObject({ id: 'nd', name: 'Design', position: 2, sort: 'manual', links: [] });
  });

  it('renameSection changes only the name', () => {
    const g = pure(group(), (x) => renameSection(x, 's2', 'Docs 2'));
    expect(g.sections[1]).toMatchObject({ id: 's2', name: 'Docs 2', position: 1 });
  });

  it('deleteSection moves its links in order to the end of the first remaining section', () => {
    const g = pure(group(), (x) => deleteSection(x, 's2'));
    expect(g.sections.map((s) => s.id)).toEqual(['s1']);
    expect(ids(g, 's1')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(positions(g, 's1')).toEqual([0, 1, 2, 3, 4]);
  });

  it('deleting the first section moves links into the next one', () => {
    const g = deleteSection(group(), 's1');
    expect(ids(g, 's2')).toEqual(['c', 'd', 'e', 'a', 'b']);
    expect(g.sections[0].position).toBe(0);
  });

  it('refuses to delete the last section', () => {
    const one = deleteSection(group(), 's2');
    expect(() => deleteSection(one, 's1')).toThrow('Cannot delete the last section');
  });

  it('moveSection reorders and renumbers', () => {
    const g = pure(group(), (x) => moveSection(x, 1, 0));
    expect(g.sections.map((s) => [s.id, s.position])).toEqual([['s2', 0], ['s1', 1]]);
  });

  it('patchSection sets colour, collapsed and sort', () => {
    const g = pure(group(), (x) => patchSection(x, 's1', { color: 'accent-3', collapsed: true, sort: 'az' }));
    expect(g.sections[0]).toMatchObject({ color: 'accent-3', collapsed: true, sort: 'az' });
  });
});

describe('links', () => {
  it('addLink appends with createdAt', () => {
    const g = pure(group(), (x) => addLink(x, 's1', 'New', 'https://n', 99, 'n'));
    expect(ids(g, 's1')).toEqual(['a', 'b', 'n']);
    expect(g.sections[0].links[2]).toMatchObject({ createdAt: 99, position: 2 });
  });

  it('updateLink patches name and url, keeps position', () => {
    const g = pure(group(), (x) => updateLink(x, 'd', { name: 'Dee', url: 'https://dee' }));
    expect(g.sections[1].links[1]).toMatchObject({ id: 'd', name: 'Dee', url: 'https://dee', position: 1 });
  });

  it('removeLink removes and renumbers', () => {
    const g = pure(group(), (x) => removeLink(x, 'c'));
    expect(ids(g, 's2')).toEqual(['d', 'e']);
    expect(positions(g, 's2')).toEqual([0, 1]);
  });

  it('moveLink within a section reorders', () => {
    const g = pure(group(), (x) => moveLink(x, 's2', 's2', 0, 2));
    expect(ids(g, 's2')).toEqual(['d', 'e', 'c']);
  });

  it('moveLink across sections keeps ids and renumbers both', () => {
    const g = pure(group(), (x) => moveLink(x, 's2', 's1', 1, 1));
    expect(ids(g, 's1')).toEqual(['a', 'd', 'b']);
    expect(ids(g, 's2')).toEqual(['c', 'e']);
    expect(positions(g, 's1')).toEqual([0, 1, 2]);
    expect(positions(g, 's2')).toEqual([0, 1]);
  });

  it('moveLink into a sorted section appends to its manual order', () => {
    const sorted = patchSection(group(), 's1', { sort: 'az' });
    const g = moveLink(sorted, 's2', 's1', 0, 0);
    expect(ids(g, 's1')).toEqual(['a', 'b', 'c']);
  });
});
