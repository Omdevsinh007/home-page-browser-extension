import { TestBed } from '@angular/core/testing';
import { v1RealShape } from '../core/__fixtures__/v1';
import { flattenToV1 } from '../core/flatten';
import { sampleItems, storeHarness } from '../testing/store-harness';
import { DataTransferService } from './data-transfer.service';
import { KEYS } from './links-store';
import { NotifyService } from './notify.service';

async function setup(confirm = true) {
  const notify = { info: vi.fn(), error: vi.fn() };
  const h = await storeHarness({ confirm, providers: [{ provide: NotifyService, useValue: notify }] });
  const svc = TestBed.inject(DataTransferService);
  const download = vi.spyOn(svc, 'download').mockImplementation(() => undefined);
  return { ...h, svc, download, notify };
}

describe('DataTransferService', () => {
  it('exports a versioned file', async () => {
    const { svc, download } = await setup();
    svc.exportAll(new Date('2026-11-11T00:00:00Z'));
    const [name, data] = download.mock.calls[0];
    expect(name).toBe('custom-homepage-2026-11-11.json');
    expect(data).toMatchObject({ app: 'custom-homepage', version: 2, links: sampleItems() });
  });

  it('exports a v2.x compatible file', async () => {
    const { svc, download, store } = await setup();
    svc.exportForV2x();
    expect(download).toHaveBeenCalledWith('custom-homepage-v2x.json', flattenToV1(store.items()));
  });

  it('asks before replacing and lists skipped items', async () => {
    const { svc, ask, store } = await setup(true);
    const bad = [...v1RealShape, { id: 'z', type: 'Shortcut', name: 'Evil', url: 'javascript:x', group: null, position: 99 }];
    expect(await svc.importText(JSON.stringify(bad))).toBe(true);
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Replace 3 items with 9 items?', details: ['Skipped “Evil”: unsafe URL'] }),
    );
    expect(store.items()).toHaveLength(9);
  });

  it('says the backups are in Settings', async () => {
    const { svc, ask } = await setup(true);
    await svc.importText(JSON.stringify(v1RealShape));
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Your current links are backed up first. You can download the backup from Settings.' }),
    );
  });

  it('imports without asking when there are no links yet', async () => {
    const notify = { info: vi.fn(), error: vi.fn() };
    const h = await storeHarness({ items: [], providers: [{ provide: NotifyService, useValue: notify }] });
    const svc = TestBed.inject(DataTransferService);
    expect(await svc.importText(JSON.stringify(v1RealShape))).toBe(true);
    expect(h.ask).not.toHaveBeenCalled();
    expect(h.store.items()).toHaveLength(9);
    expect(notify.info).toHaveBeenCalledWith('Imported 9 items.');
  });

  it('still asks when the file has skipped items, even with no links yet', async () => {
    const h = await storeHarness({ items: [] });
    const svc = TestBed.inject(DataTransferService);
    const bad = [...v1RealShape, { id: 'z', type: 'Shortcut', name: 'Evil', url: 'javascript:x', group: null, position: 99 }];
    await svc.importText(JSON.stringify(bad));
    expect(h.ask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Import 9 items?', details: ['Skipped “Evil”: unsafe URL'] }));
  });

  it('changes nothing when the import is cancelled', async () => {
    const { svc, store } = await setup(false);
    expect(await svc.importText(JSON.stringify(v1RealShape))).toBe(false);
    expect(store.items()).toHaveLength(3);
  });

  it('reports an invalid file', async () => {
    const { svc, notify, store } = await setup();
    expect(await svc.importText('nope')).toBe(false);
    expect(notify.error).toHaveBeenCalledWith('This file is not a Custom Homepage export.');
    expect(store.items()).toHaveLength(3);
  });

  it('downloads each existing backup', async () => {
    const { svc, download, fake } = await setup();
    fake.data[KEYS.backupV1] = { version: 1, data: [] };
    await svc.downloadBackups();
    expect(download).toHaveBeenCalledWith('savedLinks_backup_v1.json', { version: 1, data: [] });
  });

  it('says so when there are no backups', async () => {
    const { svc, notify, download } = await setup();
    await svc.downloadBackups();
    expect(download).not.toHaveBeenCalled();
    expect(notify.info).toHaveBeenCalledWith('No backups yet.');
  });
});
