import { DEFAULT_SECTION_NAME, GroupTile, LinkItem, ShortcutTile, TopItem, V1Link } from './model';
import { renumber } from './positions';

export type Shape = 'empty' | 'v1' | 'v2' | 'future' | 'corrupt';

export const CURRENT_VERSION = 2;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Returns the item array inside a `{version, data}` wrapper, or the value itself for legacy bare arrays. */
export function unwrap(raw: unknown): { version: number | undefined; data: unknown } {
  if (isObject(raw) && 'data' in raw) {
    return { version: typeof raw['version'] === 'number' ? raw['version'] : undefined, data: raw['data'] };
  }
  return { version: undefined, data: raw };
}

function isTopLevelLike(item: unknown): boolean {
  return isObject(item) && typeof item['id'] === 'string' && typeof item['position'] === 'number';
}

/**
 * Detects the stored shape. Never trusts `version` alone: v2.6.0 re-saves v2-shaped data with `version: 1`.
 */
export function detectShape(raw: unknown): Shape {
  if (raw === undefined || raw === null) return 'empty';
  const { version, data } = unwrap(raw);
  if (version !== undefined && version > CURRENT_VERSION) return 'future';
  if (!Array.isArray(data)) return 'corrupt';
  if (data.length === 0) return 'empty';
  if (!data.every(isTopLevelLike)) return 'corrupt';
  const groups = data.filter((i) => (i as Record<string, unknown>)['type'] === 'Group') as Record<string, unknown>[];
  if (groups.some((g) => Array.isArray(g['sections']))) return 'v2';
  return 'v1';
}

function toLink(link: Partial<V1Link>): LinkItem {
  return {
    id: String(link.id),
    name: link.name ?? '',
    url: link.url ?? '',
    position: typeof link.position === 'number' ? link.position : 0,
  };
}

/** Pure v1 → v2 migration (spec §6.2). Unknown item types go to `quarantine`, never dropped. */
export function migrateV1toV2(
  data: unknown[],
  newId: () => string = () => crypto.randomUUID(),
): { items: TopItem[]; quarantine: unknown[] } {
  const items: TopItem[] = [];
  const quarantine: unknown[] = [];

  for (const raw of data) {
    if (!isObject(raw)) {
      quarantine.push(raw);
      continue;
    }
    const base = {
      id: String(raw['id']),
      name: typeof raw['name'] === 'string' ? raw['name'] : '',
      position: typeof raw['position'] === 'number' ? raw['position'] : 0,
    };
    if (raw['type'] === 'Shortcut') {
      const tile: ShortcutTile = { ...base, type: 'Shortcut', url: typeof raw['url'] === 'string' ? raw['url'] : '' };
      items.push(tile);
    } else if (raw['type'] === 'Group') {
      const oldLinks = Array.isArray(raw['group']) ? (raw['group'] as Partial<V1Link>[]) : [];
      const group: GroupTile = {
        ...base,
        type: 'Group',
        sections: [
          {
            id: newId(),
            name: DEFAULT_SECTION_NAME,
            position: 0,
            sort: 'manual',
            links: renumber(oldLinks.filter(isObject).map(toLink)),
          },
        ],
      };
      items.push(group);
    } else {
      quarantine.push(raw);
    }
  }

  return { items: renumber(items), quarantine };
}

/** Makes every item of v2-detected data valid v2: v1-shaped groups (no `sections`) go through the v1 rule. */
export function normalizeV2Items(data: unknown[], newId: () => string = () => crypto.randomUUID()): TopItem[] {
  return data.map((raw) => {
    const item = raw as Record<string, unknown>;
    if (item['type'] === 'Group' && !Array.isArray(item['sections'])) {
      return migrateV1toV2([item], newId).items[0];
    }
    return raw as TopItem;
  });
}
