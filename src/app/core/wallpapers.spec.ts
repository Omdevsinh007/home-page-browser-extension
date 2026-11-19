import { BUILT_IN_WALLPAPERS, DEFAULT_WALLPAPER, isBuiltIn } from './wallpapers';

describe('built-in wallpapers', () => {
  it('catalogue lists four built-ins in order', () => {
    expect(BUILT_IN_WALLPAPERS).toEqual([
      { id: 'midnight', name: 'Midnight' },
      { id: 'lagoon', name: 'Lagoon' },
      { id: 'dusk', name: 'Dusk' },
      { id: 'graphite', name: 'Graphite' },
    ]);
  });

  it('default is lagoon', () => {
    expect(DEFAULT_WALLPAPER).toBe('lagoon');
  });

  it("isBuiltIn accepts ids and rejects 'upload', 'neon', {}", () => {
    expect(BUILT_IN_WALLPAPERS.every((w) => isBuiltIn(w.id))).toBe(true);
    expect(isBuiltIn('upload')).toBe(false);
    expect(isBuiltIn('neon')).toBe(false);
    expect(isBuiltIn({})).toBe(false);
  });
});
