import { RENDER_SNAPSHOT_KEY, clearSnapshot, readSnapshot, writeSnapshot } from './render-snapshot';
import { TopItem } from './model';

const items: TopItem[] = [
  { id: 'a', type: 'Shortcut', name: 'A', url: 'https://a.example', position: 0 },
  { id: 'g', type: 'Group', name: 'G', position: 1, sections: [{ id: 's', name: 'S', position: 0, sort: 'manual', links: [] }] },
];

describe('render snapshot', () => {
  it('round-trips items and style', () => {
    writeSnapshot({ items });
    writeSnapshot({ style: 'compact' });
    expect(readSnapshot()).toEqual({ items, style: 'compact' });
  });

  it('is null when nothing was written', () => {
    expect(readSnapshot()).toBeNull();
  });

  it.each([
    ['a string', '"x"'],
    ['an object without items', '{}'],
    ['an item without fields', '{"v":1,"items":[{}]}'],
    ['a v1 group', JSON.stringify({ v: 1, items: [{ id: 'g', type: 'Group', name: 'G', url: null, group: [], position: 0 }] })],
    ['invalid JSON', '{nope'],
    ['an unknown style', JSON.stringify({ v: 1, items, style: 'huge' })],
  ])('ignores %s', (_label, raw) => {
    localStorage.setItem(RENDER_SNAPSHOT_KEY, raw);
    const snap = readSnapshot();
    expect(snap?.items ?? []).toEqual(_label === 'an unknown style' ? items : []);
    expect(snap?.style).toBeUndefined();
  });

  it('clearSnapshot removes it', () => {
    writeSnapshot({ items });
    clearSnapshot();
    expect(localStorage.getItem(RENDER_SNAPSHOT_KEY)).toBeNull();
  });

  it('never throws when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readSnapshot()).toBeNull();
    spy.mockRestore();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => writeSnapshot({ items })).not.toThrow();
    set.mockRestore();
  });

  it('round-trips wallpaper', () => {
    writeSnapshot({ wallpaper: 'dusk' });
    expect(readSnapshot()?.wallpaper).toBe('dusk');
    writeSnapshot({ wallpaper: 'upload' });
    expect(readSnapshot()?.wallpaper).toBe('upload');
  });

  it('ignores unknown wallpaper', () => {
    localStorage.setItem(RENDER_SNAPSHOT_KEY, JSON.stringify({ v: 1, items, wallpaper: 'neon' }));
    expect(readSnapshot()?.wallpaper).toBeUndefined();
  });

  it('round-trips motion and ignores non-boolean motion', () => {
    writeSnapshot({ motion: false });
    expect(readSnapshot()?.motion).toBe(false);
    localStorage.setItem(RENDER_SNAPSHOT_KEY, JSON.stringify({ v: 1, items, motion: 'x' }));
    expect(readSnapshot()?.motion).toBeUndefined();
  });
});
