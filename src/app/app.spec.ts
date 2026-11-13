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

/** Saved data for the sample items, captured from a real LinksStore write. */
async function savedSample(): Promise<Record<string, unknown>> {
  const { fake } = await storeHarness();
  const data = structuredClone(fake.data);
  TestBed.resetTestingModule();
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
      useValue: { active: signal({ meta, objectUrl: 'blob:v' }), list: signal([meta]), load: async () => undefined },
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

  it('switches to compact pills', async () => {
    const data = await savedSample();
    configure({ ...data, [UI_PREFS_KEY]: { shortcutStyle: 'compact' } });
    const el = await settle(TestBed.createComponent(App));
    expect(el.querySelector('[data-testid="shortcuts"][data-style="compact"]')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid="pill"]').length).toBe(TestBed.inject(LinksStore).items().length);
  });

  it('has one settings button and no other corner buttons', async () => {
    configure(await savedSample());
    const el = await settle(TestBed.createComponent(App));
    expect(el.querySelectorAll('button[aria-label="Settings"]').length).toBe(1);
    expect(el.querySelector('button[aria-label="Backgrounds"]')).toBeNull();
  });
});
