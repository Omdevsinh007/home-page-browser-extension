import { TestBed } from '@angular/core/testing';
import { FakeStorage } from '../testing/fake-storage';
import { NotifyService } from './notify.service';
import { KeyValueStorage } from './storage.service';
import { UI_PREFS_KEY, UiPrefsService } from './ui-prefs.service';

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

  it('reverts and reports when the write fails', async () => {
    const { fake, notify, prefs } = setup();
    await prefs.load();
    fake.failNextSet = true;
    await prefs.setShortcutStyle('compact');
    expect(prefs.shortcutStyle()).toBe('tiles');
    expect(notify.error).toHaveBeenCalledWith('Could not save the shortcut style.');
  });
});
