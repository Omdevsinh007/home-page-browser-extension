import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { FakeStorage } from '../testing/fake-storage';
import { BackgroundStore, LEGACY_KEY, MIGRATED_FLAG, readAllRecords } from './background.store';
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

  it('removing the active background activates another one; the last one cannot be removed', async () => {
    const { store } = setup();
    await store.load();
    await store.add(file('a.png'));
    await store.add(file('b.png'));
    await store.remove(store.active()!.meta.id);
    expect(store.list().map((b) => b.name)).toEqual(['a.png']);
    expect(store.active()!.meta.name).toBe('a.png');
    await expect(store.remove(store.list()[0].id)).rejects.toThrow('At least one background must remain.');
  });

  it('uses random UUID ids', async () => {
    const { store } = setup();
    await store.load();
    await store.add(file('a.png'));
    expect(store.list()[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
