import { TopItem, V1Shortcut } from './model';
import { renumber } from './positions';

/** Flat v1 mirror for v2.6.0 (spec §6.4a): sections by position, then links by position, renumbered. */
export function flattenToV1(items: TopItem[]): V1Shortcut[] {
  return renumber(items).map((item) => {
    if (item.type === 'Shortcut') {
      return { id: item.id, type: 'Shortcut', name: item.name, url: item.url, group: null, position: item.position };
    }
    const links = renumber(item.sections).flatMap((section) =>
      renumber(section.links).map(({ id, name, url }) => ({ id, name, url, position: 0 })),
    );
    return {
      id: item.id,
      type: 'Group',
      name: item.name,
      url: '',
      group: links.map((l, position) => ({ ...l, position })),
      position: item.position,
    };
  });
}
