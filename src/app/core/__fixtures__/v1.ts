import { V1Shortcut } from '../model';

/**
 * Anonymised copy of the owner's real v1 data shape (2026-11-11):
 * 9 top items (1 shortcut, 8 groups with 6,18,5,1,3,4,2,2 links = 41 links),
 * duplicate top-level positions `1,1,2,...`, one bare-IP url and one empty url.
 */
const GROUP_SIZES = [6, 18, 5, 1, 3, 4, 2, 2];

function links(groupIndex: number, size: number) {
  return Array.from({ length: size }, (_, i) => {
    const n = `${groupIndex}-${String(i + 1).padStart(2, '0')}`;
    let url = `https://example.com/${n}`;
    if (groupIndex === 1 && i === 1) url = '52.0.205.252';
    if (groupIndex === 1 && i === 16) url = '';
    return { id: `link-${n}`, name: `Link ${n}`, url, position: i };
  });
}

export const v1RealShape: V1Shortcut[] = [
  { id: 'short-1', type: 'Shortcut', name: 'Support', url: 'https://example.com/support', group: null, position: 1 },
  ...GROUP_SIZES.map((size, g) => ({
    id: `group-${g}`,
    type: 'Group' as const,
    name: `Group ${g}`,
    url: '',
    group: links(g, size),
    position: g === 0 ? 1 : g + 1,
  })),
];

export const v1RealShapeWrapped = { version: 1, data: v1RealShape };

/** Pre-versioning data: bare array, group links out of position order. */
export const legacyUnversioned: V1Shortcut[] = [
  {
    id: 'g',
    type: 'Group',
    name: 'Legacy',
    url: null,
    group: [
      { id: 'b', name: 'B', url: 'https://b.example', position: 1 },
      { id: 'a', name: 'A', url: 'https://a.example', position: 0 },
    ],
    position: 0,
  },
];

export const corruptString = 'not an array';
export const corruptObject = { foo: 'bar' };
export const corruptTypes = { version: 1, data: [{ id: 5, type: 'Shortcut', position: 'x' }] };

export const v2Data = {
  version: 2,
  data: [
    {
      id: 'g2',
      type: 'Group',
      name: 'V2',
      position: 0,
      sections: [{ id: 's', name: 'Git', position: 0, sort: 'manual', links: [] }],
    },
  ],
};

/** v2.6.0 re-saves keep `version: 1` even when the data inside is v2-shaped. */
export const v2ShapeWithV1Version = { version: 1, data: v2Data.data };

export const futureV3 = { version: 3, data: [] };
