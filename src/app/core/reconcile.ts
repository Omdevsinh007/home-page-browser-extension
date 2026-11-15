import { DEFAULT_SECTION_NAME, GroupTile, LinkItem, Section, TopItem, V1Link, V1Shortcut } from './model';
import { renumber } from './positions';

/**
 * Merges edits made by v2.6.0 (in the flat `savedLinks` mirror) back into v2 data (spec §6.4a step 2).
 * Mirror wins for top-level order, names, urls, adds and deletes. Surviving links keep their section
 * and in-section order; links new to a group are appended to its first section in mirror order.
 */
export function reconcile(v2: TopItem[], mirror: V1Shortcut[], newId: () => string = () => crypto.randomUUID()): TopItem[] {
  const byId = new Map(v2.map((item) => [item.id, item]));

  const merged: TopItem[] = [];
  for (const m of mirror) {
    const prev = byId.get(m.id);
    const base = { id: m.id, name: m.name ?? '', position: m.position };

    if (m.type === 'Shortcut') {
      const kept = prev?.type === 'Shortcut' ? prev : undefined;
      merged.push({ ...kept, ...base, type: 'Shortcut', url: m.url ?? '' });
      continue;
    }

    const seen = new Set<string>();
    const mirrorLinks = renumber(m.group ?? [])
      .filter((l) => !seen.has(l.id) && seen.add(l.id))
      .map((l) => ({ ...l, name: l.name ?? '', url: l.url ?? '' }));
    if (prev?.type !== 'Group') {
      merged.push({
        ...base,
        type: 'Group',
        sections: [{ id: newId(), name: DEFAULT_SECTION_NAME, position: 0, sort: 'manual', links: mirrorLinks.map(toLink) }],
      });
      continue;
    }
    merged.push({ ...prev, ...base, sections: mergeSections(prev, mirrorLinks) });
  }
  return renumber(merged);
}

function toLink({ id, name, url, position }: V1Link): LinkItem {
  return { id, name, url, position };
}

function mergeSections(prev: GroupTile, mirrorLinks: V1Link[]): Section[] {
  const home = new Map<string, { sectionId: string; link: LinkItem }>();
  for (const section of prev.sections) {
    for (const link of section.links) home.set(link.id, { sectionId: section.id, link });
  }

  const kept = new Map<string, LinkItem[]>(prev.sections.map((s) => [s.id, []]));
  const added: LinkItem[] = [];
  for (const m of mirrorLinks) {
    const found = home.get(m.id);
    if (found) {
      kept.get(found.sectionId)!.push({ ...found.link, name: m.name, url: m.url });
    } else {
      added.push(toLink(m));
    }
  }

  const firstId = renumber(prev.sections)[0]?.id;
  return prev.sections.map((section) => {
    const survivors = renumber(kept.get(section.id)!);
    const links = section.id === firstId ? [...survivors, ...added] : survivors;
    return { ...section, links: links.map((l, position) => ({ ...l, position })) };
  });
}
