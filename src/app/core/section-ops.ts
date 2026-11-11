import { DEFAULT_SECTION_NAME, GroupTile, LinkItem, Section, TopItem } from './model';
import { nextPosition, renumber } from './positions';

/** All operations are pure: they return new arrays/objects and renumber every list they touch. */

const uuid = () => crypto.randomUUID();

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(Math.max(0, Math.min(to, copy.length)), 0, item);
  return copy;
}

const contiguous = <T extends { position: number }>(list: T[]): T[] => list.map((x, position) => ({ ...x, position }));

// ── top-level tiles ─────────────────────────────────────────────

export function addShortcut(items: TopItem[], name: string, url: string, now: number, id: string = uuid()): TopItem[] {
  return renumber([...items, { id, type: 'Shortcut', name, url, position: nextPosition(items), createdAt: now }]);
}

export function updateTile(items: TopItem[], id: string, patch: { name?: string; url?: string }): TopItem[] {
  return items.map((item) => {
    if (item.id !== id) return item;
    if (item.type === 'Group') return { ...item, ...(patch.name !== undefined && { name: patch.name }) };
    return { ...item, ...patch };
  });
}

export function addGroup(items: TopItem[], name: string, now: number, id: string = uuid()): TopItem[] {
  const group: GroupTile = {
    id,
    type: 'Group',
    name,
    position: nextPosition(items),
    createdAt: now,
    sections: [{ id: uuid(), name: DEFAULT_SECTION_NAME, position: 0, sort: 'manual', links: [] }],
  };
  return renumber([...items, group]);
}

export function removeTile(items: TopItem[], id: string): TopItem[] {
  return renumber(items.filter((i) => i.id !== id));
}

export function moveTile(items: TopItem[], from: number, to: number): TopItem[] {
  return contiguous(move(renumber(items), from, to));
}

export function replaceGroup(items: TopItem[], group: GroupTile): TopItem[] {
  return items.map((i) => (i.id === group.id ? group : i));
}

// ── sections ────────────────────────────────────────────────────

function mapSection(g: GroupTile, sectionId: string, fn: (s: Section) => Section): GroupTile {
  return { ...g, sections: g.sections.map((s) => (s.id === sectionId ? fn(s) : s)) };
}

export function addSection(g: GroupTile, name: string, id: string = uuid()): GroupTile {
  const section: Section = { id, name, position: nextPosition(g.sections), sort: 'manual', links: [] };
  return { ...g, sections: renumber([...g.sections, section]) };
}

export function renameSection(g: GroupTile, sectionId: string, name: string): GroupTile {
  return mapSection(g, sectionId, (s) => ({ ...s, name }));
}

export function deleteSection(g: GroupTile, sectionId: string): GroupTile {
  if (g.sections.length <= 1) throw new Error('Cannot delete the last section');
  const doomed = g.sections.find((s) => s.id === sectionId);
  if (!doomed) return g;
  const remaining = renumber(g.sections.filter((s) => s.id !== sectionId));
  const [first, ...rest] = remaining;
  const merged = { ...first, links: contiguous([...renumber(first.links), ...renumber(doomed.links)]) };
  return { ...g, sections: [merged, ...rest] };
}

export function moveSection(g: GroupTile, from: number, to: number): GroupTile {
  return { ...g, sections: contiguous(move(renumber(g.sections), from, to)) };
}

export function patchSection(
  g: GroupTile,
  sectionId: string,
  patch: Partial<Pick<Section, 'color' | 'collapsed' | 'sort'>>,
): GroupTile {
  return mapSection(g, sectionId, (s) => ({ ...s, ...patch }));
}

// ── links ───────────────────────────────────────────────────────

export function addLink(g: GroupTile, sectionId: string, name: string, url: string, now: number, id: string = uuid()): GroupTile {
  return mapSection(g, sectionId, (s) => ({
    ...s,
    links: renumber([...s.links, { id, name, url, position: nextPosition(s.links), createdAt: now }]),
  }));
}

export function updateLink(g: GroupTile, linkId: string, patch: { name?: string; url?: string }): GroupTile {
  return {
    ...g,
    sections: g.sections.map((s) => ({ ...s, links: s.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)) })),
  };
}

export function removeLink(g: GroupTile, linkId: string): GroupTile {
  return {
    ...g,
    sections: g.sections.map((s) =>
      s.links.some((l) => l.id === linkId) ? { ...s, links: renumber(s.links.filter((l) => l.id !== linkId)) } : s,
    ),
  };
}

/**
 * Indexes are manual-order indexes. When the target section is not manually sorted, `toIndex` is ignored
 * and the link is appended to its manual order.
 */
export function moveLink(g: GroupTile, fromSectionId: string, toSectionId: string, fromIndex: number, toIndex: number): GroupTile {
  const from = g.sections.find((s) => s.id === fromSectionId);
  const to = g.sections.find((s) => s.id === toSectionId);
  if (!from || !to) return g;

  if (fromSectionId === toSectionId) {
    return mapSection(g, fromSectionId, (s) => ({ ...s, links: contiguous(move(renumber(s.links), fromIndex, toIndex)) }));
  }

  const source = renumber(from.links);
  const [moved] = source.splice(fromIndex, 1);
  if (!moved) return g;
  const target: LinkItem[] = renumber(to.links);
  target.splice(to.sort === 'manual' ? Math.min(toIndex, target.length) : target.length, 0, moved);

  return {
    ...g,
    sections: g.sections.map((s) =>
      s.id === fromSectionId ? { ...s, links: contiguous(source) } : s.id === toSectionId ? { ...s, links: contiguous(target) } : s,
    ),
  };
}
