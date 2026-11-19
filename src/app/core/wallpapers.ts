/** Built-in wallpapers, drawn in CSS (src/styles/wallpapers.css): no image files, so they paint on the first frame. */
export type BuiltInId = 'midnight' | 'lagoon' | 'dusk' | 'graphite';

export const BUILT_IN_WALLPAPERS: { id: BuiltInId; name: string }[] = [
  { id: 'midnight', name: 'Midnight' },
  { id: 'lagoon', name: 'Lagoon' },
  { id: 'dusk', name: 'Dusk' },
  { id: 'graphite', name: 'Graphite' },
];

export const DEFAULT_WALLPAPER: BuiltInId = 'lagoon';

export function isBuiltIn(value: unknown): value is BuiltInId {
  return BUILT_IN_WALLPAPERS.some((w) => w.id === value);
}
