/** Storage model (spec §6.1). v1 types describe data written by v2.x of the extension. */

export type SortMode = 'manual' | 'az' | 'recent' | 'most-used';

export const DEFAULT_SECTION_NAME = 'General';

export interface LinkItem {
  id: string;
  name: string;
  url: string;
  /** Manual order, contiguous 0..n-1 after every write. */
  position: number;
  /** Epoch ms. Absent on migrated links. */
  createdAt?: number;
}

export interface Section {
  id: string;
  name: string;
  position: number;
  color?: string;
  collapsed?: boolean;
  sort: SortMode;
  links: LinkItem[];
}

export interface ShortcutTile {
  id: string;
  type: 'Shortcut';
  name: string;
  url: string;
  position: number;
  createdAt?: number;
}

export interface GroupTile {
  id: string;
  type: 'Group';
  name: string;
  position: number;
  createdAt?: number;
  /** At least one. */
  sections: Section[];
}

export type TopItem = ShortcutTile | GroupTile;

export interface V1Link {
  id: string;
  name: string;
  url: string;
  position: number;
}

export interface V1Shortcut {
  id: string;
  type: 'Shortcut' | 'Group';
  name: string | null;
  url: string | null;
  group: V1Link[] | null;
  position: number;
}

export interface LinkStat {
  count: number;
  lastOpenedAt: number;
}
