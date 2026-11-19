import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { FakeStorage } from '../testing/fake-storage';
import { BackgroundStore, LEGACY_KEY, MIGRATED_FLAG, WALLPAPER_KEY, readAllRecords } from './background.store';
import { readSnapshot, writeSnapshot } from '../core/render-snapshot';
import { KeyValueStorage } from './storage.service';

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

let created: string[];
let revoked: string[];

function setup(initial: Record<string, unknown> = {}) {
  vi.stubGlobal('indexedDB', new IDBFactory());
  created = [];
  revoked = [];
  let n = 0;
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:test/${++n}`;
    created.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
  const fake = new FakeStorage();
  fake.data = structuredClone(initial);
  TestBed.configureTestingModule({ providers: [{ provide: KeyValueStorage, useValue: fake }] });
  return { fake, store: TestBed.inject(BackgroundStore) };
}

const file = (name: string, type = 'image/png') => new File([new Uint8Array([1, 2, 3])], name, { type });

afterEach(() => vi.unstubAllGlobals());

describe('BackgroundStore', () => {
  it('imports legacy data-URL backgrounds once and leaves the legacy key untouched', async () => {
    const legacy = [
      { id: '1', name: 'a.png', dataUrl: PNG_DATA_URL, type: 'image', isActive: false, objectFit: 'contain', brightness: 80, blur: 2 },
      { id: '2', name: 'b.png', dataUrl: PNG_DATA_URL, type: 'image', isActive: true },
    ];
    const { fake, store } = setup({ [LEGACY_KEY]: legacy });
    await store.load();
    expect(store.list().map((b) => b.name)).toEqual(['a.png', 'b.png']);
    expect(store.active()!.meta).toMatchObject({ name: 'b.png', objectFit: 'cover', brightness: 100, blur: 0 });
    expect(store.list()[0]).toMatchObject({ objectFit: 'contain', brightness: 80, blur: 2 });
    expect(fake.data[LEGACY_KEY]).toEqual(legacy);
    expect(fake.data[MIGRATED_FLAG]).toBe(true);

    await store.load();
    expect(await readAllRecords()).toHaveLength(2);
  });

  it('adds up to three backgrounds and makes the new one active', async () => {
    const { store } = setup();
    await store.load();
    await store.add(file('a.png'));
    await store.add(file('b.mp4', 'video/mp4'));
    await store.add(file('c.png'));
    expect(store.list()).toHaveLength(3);
    expect(store.active()!.meta).toMatchObject({ name: 'c.png', type: 'image' });
    await expect(store.add(file('d.png'))).rejects.toThrow('Maximum limit of 3 backgrounds reached');
  });

  it('preview changes the active settings without writing; commit writes once', async () => {
    const { store } = setup();
    await store.load();
    await store.add(file('a.png'));
    store.preview({ brightness: 150 });
    expect(store.active()!.meta.brightness).toBe(150);
    expect((await readAllRecords())[0].brightness).toBe(100);
    await store.commit();
    expect((await readAllRecords())[0].brightness).toBe(150);
  });

  it('revokes the previous object URL when switching backgrounds', async () => {
    const { store } = setup();
    await store.load();
    await store.add(file('a.png'));
    const first = store.active()!.objectUrl;
    await store.add(file('b.png'));
    expect(revoked).toContain(first);
    const second = store.list().find((b) => b.name === 'a.png')!.id;
    await store.setActive(second);
    expect(store.active()!.meta.name).toBe('a.png');
  });

  it('deleting the active upload falls back to the built-in', async () => {
    const { store } = setup();
    await store.load();
    await store.add(file('a.png'));
    await store.add(file('b.png'));
    await store.remove(store.active()!.meta.id);
    expect(store.list().map((b) => b.name)).toEqual(['a.png']);
    expect(store.active()).toBeNull();
    expect(store.shown()).toBe('lagoon');
  });

  it('the last upload can be removed', async () => {
    const { store } = setup();
    await store.load();
    await store.add(file('a.png'));
    await store.remove(store.list()[0].id);
    expect(store.list()).toEqual([]);
    expect(store.shown()).toBe('lagoon');
  });

  it('uses random UUID ids', async () => {
    const { store } = setup();
    await store.load();
    await store.add(file('a.png'));
    expect(store.list()[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('defaults to lagoon with no uploads', async () => {
    const { store } = setup();
    await store.load();
    expect(store.builtIn()).toBe('lagoon');
    expect(store.shown()).toBe('lagoon');
  });

  it('reads the stored built-in; junk falls back to lagoon', async () => {
    const first = setup({ [WALLPAPER_KEY]: { builtIn: 'dusk' } });
    await first.store.load();
    expect(first.store.shown()).toBe('dusk');
    TestBed.resetTestingModule();
    for (const junk of ['neon', {}, { builtIn: 'neon' }]) {
      const { store } = setup({ [WALLPAPER_KEY]: junk });
      await store.load();
      expect(store.builtIn()).toBe('lagoon');
      TestBed.resetTestingModule();
    }
  });

  it('keeps an existing active upload', async () => {
    const legacy = [{ id: '1', name: 'a.png', dataUrl: PNG_DATA_URL, type: 'image', isActive: true }];
    const { store } = setup({ [LEGACY_KEY]: legacy });
    await store.load();
    expect(store.shown()).toBe('upload');
  });

  it('setBuiltIn deactivates uploads and saves the choice', async () => {
    const { store, fake } = setup();
    await store.load();
    await store.add(file('a.png'));
    await store.setBuiltIn('lagoon');
    expect(store.active()).toBeNull();
    expect(store.shown()).toBe('lagoon');
    expect((await readAllRecords()).some((r) => r.isActive)).toBe(false);
    expect(fake.data[WALLPAPER_KEY]).toEqual({ builtIn: 'lagoon', motion: true });
  });

  it('snapshot follows shown()', async () => {
    const { store } = setup();
    await store.load();
    expect(readSnapshot()?.wallpaper).toBe('lagoon');
    await store.add(file('a.png'));
    expect(readSnapshot()?.wallpaper).toBe('upload');
    await store.setBuiltIn('graphite');
    expect(readSnapshot()?.wallpaper).toBe('graphite');
  });

  it('starts from the snapshot built-in before load', () => {
    writeSnapshot({ wallpaper: 'dusk' });
    const { store } = setup();
    expect(store.builtIn()).toBe('dusk');
  });

  it('motion is on by default and can be turned off and saved', async () => {
    const { store, fake } = setup({ [WALLPAPER_KEY]: { builtIn: 'dusk' } });
    await store.load();
    expect(store.motion()).toBe(true);
    await store.setMotion(false);
    expect(store.motion()).toBe(false);
    expect(fake.data[WALLPAPER_KEY]).toEqual({ builtIn: 'dusk', motion: false });
    expect(readSnapshot()?.motion).toBe(false);
  });

  it('reads saved motion; choosing a built-in keeps it', async () => {
    const { store, fake } = setup({ [WALLPAPER_KEY]: { builtIn: 'dusk', motion: false } });
    await store.load();
    expect(store.motion()).toBe(false);
    await store.setBuiltIn('graphite');
    expect(fake.data[WALLPAPER_KEY]).toEqual({ builtIn: 'graphite', motion: false });
  });

  it('junk motion value means on', async () => {
    const { store } = setup({ [WALLPAPER_KEY]: { builtIn: 'dusk', motion: 'nope' } });
    await store.load();
    expect(store.motion()).toBe(true);
  });
});
