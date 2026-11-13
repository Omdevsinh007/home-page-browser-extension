import { ComponentFixture, TestBed } from '@angular/core/testing';
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
