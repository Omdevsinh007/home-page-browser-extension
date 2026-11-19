import { TopItem } from './model';
import { BuiltInId, isBuiltIn } from './wallpapers';

/**
 * A copy of what the page last showed, kept in localStorage because it reads synchronously: the first frame
 * paints from it while the real (async) storage loads. It is display-only — never saved back as link data.
 */
export const RENDER_SNAPSHOT_KEY = 'renderSnapshot_v1';

type SnapshotStyle = 'tiles' | 'compact';

export interface RenderSnapshot {
  items?: TopItem[];
  style?: SnapshotStyle;
  /** The background last shown: a built-in, or 'upload' when one of the user's files was active. */
  wallpaper?: BuiltInId | 'upload';
  /** Whether the built-in wallpaper drifts. */
  motion?: boolean;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isString = (v: unknown): v is string => typeof v === 'string';

function isTopItem(v: unknown): v is TopItem {
  if (!isObject(v) || !isString(v['id']) || !isString(v['name'])) return false;
  if (v['type'] === 'Shortcut') return isString(v['url']);
  if (v['type'] === 'Group') {
    const sections = v['sections'];
    return Array.isArray(sections) && sections.every((s) => isObject(s) && isString(s['id']) && Array.isArray(s['links']));
  }
  return false;
}

function readRaw(): Record<string, unknown> | null {
  try {
    const raw = JSON.parse(localStorage.getItem(RENDER_SNAPSHOT_KEY) ?? 'null');
    return isObject(raw) && raw['v'] === 1 ? raw : null;
  } catch {
    return null;
  }
}

/** The last snapshot, keeping only the parts that are valid. Null when there is none or it is unreadable. */
export function readSnapshot(): RenderSnapshot | null {
  const raw = readRaw();
  if (!raw) return null;
  const snap: RenderSnapshot = {};
  if (Array.isArray(raw['items']) && raw['items'].every(isTopItem)) snap.items = raw['items'] as TopItem[];
  if (raw['style'] === 'tiles' || raw['style'] === 'compact') snap.style = raw['style'];
  if (raw['wallpaper'] === 'upload' || isBuiltIn(raw['wallpaper'])) snap.wallpaper = raw['wallpaper'];
  if (typeof raw['motion'] === 'boolean') snap.motion = raw['motion'];
  return snap.items || snap.style || snap.wallpaper || snap.motion !== undefined ? snap : null;
}

/** Merges `patch` into the snapshot. Failures (quota, blocked storage) are ignored: it is only a cache. */
export function writeSnapshot(patch: RenderSnapshot): void {
  try {
    localStorage.setItem(RENDER_SNAPSHOT_KEY, JSON.stringify({ ...readSnapshot(), ...patch, v: 1 }));
  } catch {
    // cache only
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(RENDER_SNAPSHOT_KEY);
  } catch {
    // cache only
  }
}
