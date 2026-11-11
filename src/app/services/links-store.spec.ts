import { TestBed } from '@angular/core/testing';
import { futureV3, v1RealShape, v1RealShapeWrapped } from '../core/__fixtures__/v1';
import { flattenToV1 } from '../core/flatten';
import { stableHash } from '../core/hash';
import { GroupTile, TopItem } from '../core/model';
import { FakeStorage } from '../testing/fake-storage';
import { KEYS, LinksStore } from './links-store';
import { KeyValueStorage } from './storage.service';

function setup(initial: Record<string, unknown>) {
  const fake = new FakeStorage();
  fake.data = structuredClone(initial);
  TestBed.configureTestingModule({ providers: [{ provide: KeyValueStorage, useValue: fake }] });
  return { fake, store: TestBed.inject(LinksStore) };
}

const linkIds = (items: TopItem[]) =>
  items.flatMap((i) => (i.type === 'Group' ? i.sections.flatMap((s) => s.links.map((l) => l.id)) : []));

describe('LinksStore.load', () => {
  it('first upgrade: backs up v1, migrates, writes v2 and the flat mirror in one call', async () => {
    const { fake, store } = setup({ [KEYS.v1]: v1RealShapeWrapped });
    await store.load();

    expect(store.status()).toBe('ready');
    expect(fake.data[KEYS.backupV1]).toEqual(v1RealShapeWrapped);
    const v2 = fake.data[KEYS.v2] as { version: number; data: TopItem[]; mirrorHash: string };
    expect(v2.version).toBe(2);
    expect(linkIds(v2.data).sort()).toEqual(v1RealShape.flatMap((i) => i.group ?? []).map((l) => l.id).sort());
    const mirror = fake.data[KEYS.v1] as { version: number; data: unknown };
    expect(mirror).toEqual({ version: 1, data: flattenToV1(v2.data) });
    expect(v2.mirrorHash).toBe(stableHash(mirror.data));
    const lastWrite = fake.setCalls.at(-1)!;
    expect(Object.keys(lastWrite).sort()).toEqual([KEYS.v1, KEYS.v2].sort());
  });

  it('second load with no changes writes nothing', async () => {
    const first = setup({ [KEYS.v1]: v1RealShapeWrapped });
    await first.store.load();
    TestBed.resetTestingModule();
    const { fake, store } = setup(first.fake.data);
    await store.load();
    expect(fake.setCalls).toEqual([]);
    expect(store.items().map((i) => i.id)).toEqual(v1RealShape.map((i) => i.id));
  });

  it('reconciles edits made by v2.6.0 in the mirror and backs up v2 first', async () => {
    const first = setup({ [KEYS.v1]: v1RealShapeWrapped });
    await first.store.load();
    const edited = structuredClone(first.fake.data[KEYS.v1]) as { version: number; data: any[] };
    edited.data[0].name = 'Renamed in 2.6';
    TestBed.resetTestingModule();
    const { fake, store } = setup({ ...first.fake.data, [KEYS.v1]: edited });
    await store.load();

    expect(store.items()[0].name).toBe('Renamed in 2.6');
    expect(fake.data[KEYS.backupPreReconcile]).toEqual(first.fake.data[KEYS.v2]);
  });

  it('stores quarantined items', async () => {
    const odd = { id: 'x', type: 'Folder', name: 'x', url: null, group: null, position: 9 };
    const { fake, store } = setup({ [KEYS.v1]: { version: 1, data: [...v1RealShape, odd] } });
    await store.load();
    expect(fake.data[KEYS.quarantine]).toEqual([odd]);
  });

  it('future version: read-only and never writes', async () => {
    const { fake, store } = setup({ [KEYS.v2]: futureV3 });
    await store.load();
    expect(store.status()).toBe('readonly-future');
    await expect(store.save([])).rejects.toThrow('read-only');
    expect(fake.setCalls).toEqual([]);
  });

  it('corrupt data: status corrupt, no writes, raw kept for export', async () => {
    const { fake, store } = setup({ [KEYS.v1]: 'garbage' });
    await store.load();
    expect(store.status()).toBe('corrupt');
    expect(fake.setCalls).toEqual([]);
    expect(await store.rawForExport()).toBe('garbage');
  });

  it('empty storage: ready with no items and no writes', async () => {
    const { fake, store } = setup({});
    await store.load();
    expect(store.status()).toBe('ready');
    expect(store.items()).toEqual([]);
    expect(fake.setCalls).toEqual([]);
  });
});

describe('LinksStore.save', () => {
  it('writes v2, mirror and hash in a single setMany call', async () => {
    const { fake, store } = setup({});
    await store.load();
    await store.save([{ id: 's', type: 'Shortcut', name: 'A', url: 'https://a', position: 3 }]);
    expect(fake.setCalls).toHaveLength(1);
    expect(Object.keys(fake.setCalls[0]).sort()).toEqual([KEYS.v1, KEYS.v2].sort());
    expect(store.items()[0].position).toBe(0);
  });

  it('a failed write leaves storage and items unchanged', async () => {
    const { fake, store } = setup({ [KEYS.v1]: v1RealShapeWrapped });
    await store.load();
    const before = structuredClone(fake.data);
    const itemsBefore = store.items();
    fake.failNextSet = true;
    await expect(store.save([])).rejects.toThrow('quota');
    expect(fake.data).toEqual(before);
    expect(store.items()).toBe(itemsBefore);
  });

  it('update applies a function to the current items', async () => {
    const { store } = setup({ [KEYS.v1]: v1RealShapeWrapped });
    await store.load();
    await store.update((items) => items.filter((i) => i.type === 'Group'));
    expect(store.items().every((i) => i.type === 'Group')).toBe(true);
    expect((store.groups()[0] as GroupTile).sections).toHaveLength(1);
  });
});

describe('LinksStore cross-tab changes', () => {
  it('reloads when another tab writes savedLinks_v2', async () => {
    const { fake, store } = setup({});
    await store.load();
    const data = [{ id: 'remote', type: 'Shortcut', name: 'R', url: 'https://r', position: 0 }];
    const mirror = flattenToV1(data as TopItem[]);
    fake.data[KEYS.v2] = { version: 2, data, mirrorHash: stableHash(mirror) };
    fake.data[KEYS.v1] = { version: 1, data: mirror };
    fake.emitChange([KEYS.v2]);
    await vi.waitFor(() => expect(store.items().map((i) => i.id)).toEqual(['remote']));
  });
});
