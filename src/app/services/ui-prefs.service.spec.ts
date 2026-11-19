import { TestBed } from '@angular/core/testing';
import { FakeStorage } from '../testing/fake-storage';
import { NotifyService } from './notify.service';
import { KeyValueStorage } from './storage.service';
import { UI_PREFS_KEY, UiPrefsService } from './ui-prefs.service';
import { readSnapshot, writeSnapshot } from '../core/render-snapshot';

function setup(initial: Record<string, unknown> = {}) {
  const fake = new FakeStorage();
  fake.data = structuredClone(initial);
  const notify = { info: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: KeyValueStorage, useValue: fake },
      { provide: NotifyService, useValue: notify },
    ],
  });
  return { fake, notify, prefs: TestBed.inject(UiPrefsService) };
}

describe('UiPrefsService', () => {
  it('defaults to tiles and writes nothing when the key is missing', async () => {
    const { fake, prefs } = setup();
    await prefs.load();
    expect(prefs.shortcutStyle()).toBe('tiles');
    expect(fake.setCalls.length).toBe(0);
  });

  it('reads compact', async () => {
    const { prefs } = setup({ [UI_PREFS_KEY]: { shortcutStyle: 'compact' } });
    await prefs.load();
    expect(prefs.shortcutStyle()).toBe('compact');
  });

  it('treats junk as tiles', async () => {
    for (const junk of [{ shortcutStyle: 'grid' }, 'compact', null, {}]) {
      TestBed.resetTestingModule();
      const { prefs } = setup({ [UI_PREFS_KEY]: junk });
      await prefs.load();
      expect(prefs.shortcutStyle()).toBe('tiles');
    }
  });

  it('persists the style', async () => {
    const { fake, prefs } = setup();
    await prefs.load();
    await prefs.setShortcutStyle('compact');
    expect(prefs.shortcutStyle()).toBe('compact');
    expect(fake.data[UI_PREFS_KEY]).toEqual({ shortcutStyle: 'compact' });
  });

  it('falls back to tiles when reading fails', async () => {
    const { fake, prefs } = setup({ [UI_PREFS_KEY]: { shortcutStyle: 'compact' } });
    fake.getMany = async () => {
      throw new Error('storage unavailable');
    };
    await expect(prefs.load()).resolves.toBeUndefined();
    expect(prefs.shortcutStyle()).toBe('tiles');
  });

  it('keeps the latest choice when an earlier save fails late', async () => {
    const { fake, notify, prefs } = setup();
    await prefs.load();
    let failFirst!: (e: Error) => void;
    const original = fake.setMany.bind(fake);
    let calls = 0;
    fake.setMany = (values) => (++calls === 1 ? new Promise<void>((_, reject) => (failFirst = reject)) : original(values));
    const first = prefs.setShortcutStyle('compact');
    await prefs.setShortcutStyle('tiles');
    await prefs.setShortcutStyle('compact');
    failFirst(new Error('late failure'));
    await first;
    expect(prefs.shortcutStyle()).toBe('compact');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('reverts and reports when the write fails', async () => {
    const { fake, notify, prefs } = setup();
    await prefs.load();
    fake.failNextSet = true;
    await prefs.setShortcutStyle('compact');
    expect(prefs.shortcutStyle()).toBe('tiles');
    expect(notify.error).toHaveBeenCalledWith('Could not save the shortcut style.');
  });

  it('initial style comes from the snapshot', () => {
    writeSnapshot({ style: 'compact' });
    const { prefs } = setup();
    expect(prefs.shortcutStyle()).toBe('compact');
  });

  it('loaded and chosen styles are written to the snapshot', async () => {
    const { prefs } = setup({ [UI_PREFS_KEY]: { shortcutStyle: 'compact' } });
    await prefs.load();
    expect(readSnapshot()?.style).toBe('compact');
    await prefs.setShortcutStyle('tiles');
    expect(readSnapshot()?.style).toBe('tiles');
  });
});
