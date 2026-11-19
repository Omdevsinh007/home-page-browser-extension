import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackgroundStore } from './services/background.store';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { App } from './app';
import { provideAppIcons } from './core/icons';
import { ConfirmService } from './services/confirm.service';
import { LinkOpenerService } from './services/link-opener.service';
import { LinksStore } from './services/links-store';
import { KeyValueStorage } from './services/storage.service';
import { UI_PREFS_KEY } from './services/ui-prefs.service';
import { FakeStorage } from './testing/fake-storage';
import { storeHarness } from './testing/store-harness';
import { writeSnapshot } from './core/render-snapshot';
import { TopItem } from './core/model';
import { KEYS } from './services/links-store';

/** Saved data for the sample items, captured from a real LinksStore write. */
async function savedSample(): Promise<Record<string, unknown>> {
  const { fake } = await storeHarness();
  const data = structuredClone(fake.data);
  TestBed.resetTestingModule();
  localStorage.clear(); // the harness's save wrote a render snapshot
  return data;
}

function configure(data: Record<string, unknown>): FakeStorage {
  const fake = new FakeStorage();
  fake.data = data;
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideAppIcons(),
      { provide: KeyValueStorage, useValue: fake },
      { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(undefined), close: vi.fn() })) } },
      { provide: ConfirmService, useValue: { ask: vi.fn(async () => true) } },
      { provide: LinkOpenerService, useValue: { open: vi.fn(), openAll: vi.fn() } },
    ],
  });
  return fake;
}

async function settle(fixture: ComponentFixture<App>): Promise<HTMLElement> {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('App background video', () => {
  let state: DocumentVisibilityState;

  async function setupVideo(opts: { reducedMotion?: boolean } = {}) {
    if (opts.reducedMotion) vi.stubGlobal('matchMedia', () => ({ matches: true }));
    state = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    const meta = { id: 'v', name: 'v.mp4', type: 'video', isActive: true, objectFit: 'cover', brightness: 100, blur: 0, order: 0 };
    configure(await savedSample());
    TestBed.overrideProvider(BackgroundStore, {
      useValue: { active: signal({ meta, objectUrl: 'blob:v' }), list: signal([meta]), shown: signal('upload'), motion: signal(true), load: async () => undefined },
    });
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const video = (fixture.nativeElement as HTMLElement).querySelector('video')!;
    const play = vi.fn(async () => undefined);
    const pause = vi.fn();
    video.play = play;
    video.pause = pause;
    const setPaused = (paused: boolean) => Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
    const setVisibility = (next: DocumentVisibilityState) => {
      state = next;
      document.dispatchEvent(new Event('visibilitychange'));
    };
    return { play, pause, setPaused, setVisibility };
  }

  afterEach(() => vi.unstubAllGlobals());

  it('pauses a playing video when the tab is hidden and resumes when shown', async () => {
    const { play, pause, setPaused, setVisibility } = await setupVideo();
    setPaused(false);
    setVisibility('hidden');
    expect(pause).toHaveBeenCalledTimes(1);
    setPaused(true);
    setVisibility('visible');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('does not resume a video that was paused before hiding', async () => {
    const { play, pause, setPaused, setVisibility } = await setupVideo();
    setPaused(true);
    setVisibility('hidden');
    setVisibility('visible');
    expect(pause).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('does not resume under reduced motion', async () => {
    const { play, setPaused, setVisibility } = await setupVideo({ reducedMotion: true });
    setPaused(false);
    setVisibility('hidden');
    setPaused(true);
    setVisibility('visible');
    expect(play).not.toHaveBeenCalled();
  });
});

describe('App', () => {
  it('renders the add tile', async () => {
    configure(await savedSample());
    const el = await settle(TestBed.createComponent(App));
    expect(el.querySelector('button[aria-label="Add shortcut or group"]')).toBeTruthy();
  });

  it('shows nothing but search while loading', async () => {
    const fake = configure(await savedSample());
    const release = fake.holdGets();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input[aria-label="Search links"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="shortcuts"]')).toBeNull();
    expect(el.querySelector('button[aria-label="Add shortcut or group"]')).toBeNull();
    release();
  });

  it('tiles render while loading when a snapshot exists; Add is disabled', async () => {
    const data = await savedSample();
    const fake = configure(data);
    writeSnapshot({ items: (data[KEYS.v2] as { data: TopItem[] }).data });
    const release = fake.holdGets();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="shortcuts"]')).toBeTruthy();
    expect(el.querySelector<HTMLButtonElement>('button[aria-label="Add shortcut or group"]')!.disabled).toBe(true);
    release();
    await settle(fixture);
    expect(el.querySelector<HTMLButtonElement>('button[aria-label="Add shortcut or group"]')!.disabled).toBe(false);
  });

  it('switches to compact pills', async () => {
    const data = await savedSample();
    configure({ ...data, [UI_PREFS_KEY]: { shortcutStyle: 'compact' } });
    const el = await settle(TestBed.createComponent(App));
    expect(el.querySelector('[data-testid="shortcuts"][data-style="compact"]')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid="pill"]').length).toBe(TestBed.inject(LinksStore).items().length);
  });

  it('syncs html[data-wallpaper] with the shown wallpaper', async () => {
    configure(await savedSample());
    const shown = signal<string>('dusk');
    const motion = signal(true);
    TestBed.overrideProvider(BackgroundStore, {
      useValue: { active: signal(null), list: signal([]), shown, motion, load: async () => undefined },
    });
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    expect(document.documentElement.dataset['wallpaper']).toBe('dusk');
    shown.set('upload');
    await settle(fixture);
    expect(document.documentElement.dataset['wallpaper']).toBe('upload');
    expect(document.documentElement.dataset['motion']).toBe('on');
    motion.set(false);
    await settle(fixture);
    expect(document.documentElement.dataset['motion']).toBe('off');
  });

  it('going back from Backgrounds reopens Settings', async () => {
    configure(await savedSample());
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const open = TestBed.inject(MatDialog).open as unknown as ReturnType<typeof vi.fn>;
    open.mockReturnValueOnce({ afterClosed: () => of('back'), close: vi.fn() });
    await fixture.componentInstance.openBackgrounds();
    expect(fixture.componentInstance.settingsOpen()).toBe(true);
  });

  it('closing Backgrounds normally leaves Settings closed', async () => {
    configure(await savedSample());
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    await fixture.componentInstance.openBackgrounds();
    expect(fixture.componentInstance.settingsOpen()).toBe(false);
  });

  it('has one settings button and no other corner buttons', async () => {
    configure(await savedSample());
    const el = await settle(TestBed.createComponent(App));
    expect(el.querySelectorAll('button[aria-label="Settings"]').length).toBe(1);
    expect(el.querySelector('button[aria-label="Backgrounds"]')).toBeNull();
  });

  describe('Add menu', () => {
    async function openAdd() {
      configure(await savedSample());
      const fixture = TestBed.createComponent(App);
      const el = await settle(fixture);
      const add = el.querySelector<HTMLButtonElement>('button[aria-label="Add shortcut or group"]')!;
      add.focus();
      add.click();
      await settle(fixture);
      return { fixture, add };
    }
    const menu = () => document.querySelector<HTMLElement>('[role="menu"]');
    const items = () => [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')];

    it('Add opens a menu with Add shortcut and Add group', async () => {
      const { add } = await openAdd();
      expect(menu()).toBeTruthy();
      expect(items().map((i) => i.textContent!.trim())).toEqual(['Add shortcut', 'Add group']);
      expect(add.getAttribute('aria-expanded')).toBe('true');
    });

    it('Escape closes the Add menu and returns focus to Add', async () => {
      const { fixture, add } = await openAdd();
      items()[0].focus();
      menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle(fixture);
      expect(menu()).toBeNull();
      expect(document.activeElement).toBe(add);
    });

    it('closes the menu before the dialog opens', async () => {
      const { fixture, add } = await openAdd();
      items()[1].click();
      await settle(fixture);
      expect(menu()).toBeNull();
      expect(TestBed.inject(MatDialog).open).toHaveBeenCalled();
      expect(document.activeElement).toBe(add);
    });

    it('drops the Add menu from the + icon, not the whole tile', async () => {
      const { add } = await openAdd();
      expect(add.querySelector('.shortcut-icon')!.hasAttribute('data-menu-origin')).toBe(true);
      expect(add.hasAttribute('data-menu-origin')).toBe(false);
    });

    it('opens the Add menu centred below the + icon', async () => {
      await openAdd();
      expect(menu()!.closest('.cdk-overlay-pane')!.classList.contains('placement-below')).toBe(true);
    });
  });
});
