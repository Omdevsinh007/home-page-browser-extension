import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { BackgroundMeta, BackgroundStore } from '../../services/background.store';
import { NotifyService } from '../../services/notify.service';
import { BackgroundDialog } from './background-dialog';

const meta = (id: string, isActive: boolean): BackgroundMeta => ({
  id,
  name: `${id}.png`,
  type: 'image',
  isActive,
  objectFit: 'cover',
  brightness: 100,
  blur: 0,
  order: 0,
});

function setup(opts: { uploadActive?: boolean } = {}) {
  const uploadActive = opts.uploadActive ?? true;
  const list = signal([meta('a', uploadActive), meta('b', false)]);
  const bg = {
    list,
    active: signal(uploadActive ? { meta: meta('a', true), objectUrl: 'blob:x' } : null),
    builtIn: signal('lagoon'),
    shown: signal(uploadActive ? 'upload' : 'lagoon'),
    setBuiltIn: vi.fn(async () => undefined),
    motion: signal(true),
    setMotion: vi.fn(async () => undefined),
    preview: vi.fn(),
    commit: vi.fn(async () => undefined),
    setActive: vi.fn(async () => undefined),
    remove: vi.fn(async () => {
      throw new Error('Could not delete.');
    }),
    add: vi.fn(async () => undefined),
  };
  const notify = { info: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [BackgroundDialog],
    providers: [
      { provide: BackgroundStore, useValue: bg },
      { provide: NotifyService, useValue: notify },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(BackgroundDialog);
  fixture.detectChanges();
  return { bg, notify, el: fixture.nativeElement as HTMLElement, ref: TestBed.inject(MatDialogRef) as unknown as { close: ReturnType<typeof vi.fn> } };
}

describe('BackgroundDialog', () => {
  it('has a labelled heading and lists backgrounds', () => {
    const { el } = setup();
    expect(el.querySelector('#background-dialog-title')!.textContent).toContain('Backgrounds');
    expect(el.textContent).toContain('a.png');
    expect(el.textContent).toContain('b.png');
  });

  it('slider input previews without saving; change saves once', () => {
    const { el, bg } = setup();
    const slider = el.querySelector('input[aria-label="Brightness"]') as HTMLInputElement;
    slider.value = '150';
    slider.dispatchEvent(new Event('input'));
    expect(bg.preview).toHaveBeenCalledWith({ brightness: 150 });
    expect(bg.commit).not.toHaveBeenCalled();
    slider.dispatchEvent(new Event('change'));
    expect(bg.commit).toHaveBeenCalledTimes(1);
  });

  it('shows store errors as a snackbar instead of alert()', async () => {
    const { el, notify } = setup();
    (el.querySelector('button[aria-label="Delete a.png"]') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(notify.error).toHaveBeenCalledWith('Could not delete.');
  });

  it('says where the files are stored', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Stored locally in this browser.');
  });

  const swatches = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[aria-label="Built-in wallpapers"] [role="radio"]')];

  it('shows four built-in swatches as radios', () => {
    const { el } = setup();
    expect(swatches(el).map((s) => s.getAttribute('aria-label'))).toEqual(['Midnight', 'Lagoon', 'Dusk', 'Graphite']);
  });

  it('the chosen built-in is checked when no upload is active', () => {
    const shown = setup({ uploadActive: false });
    expect(swatches(shown.el).map((s) => s.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
    TestBed.resetTestingModule();
    const hidden = setup({ uploadActive: true });
    expect(swatches(hidden.el).every((s) => s.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  it('clicking a swatch calls setBuiltIn', () => {
    const { el, bg } = setup();
    swatches(el)[2].click();
    expect(bg.setBuiltIn).toHaveBeenCalledWith('dusk');
  });

  it('no longer says one must stay active', () => {
    const { el } = setup();
    expect(el.textContent).not.toContain('One must stay active');
  });

  it('Back closes the dialog with "back" so Settings opens again', () => {
    const { el, ref } = setup();
    (el.querySelector('button[aria-label="Back to Settings"]') as HTMLButtonElement).click();
    expect(ref.close).toHaveBeenCalledWith('back');
  });

  it('Motion switch shows the state and turns motion off', () => {
    const { el, bg } = setup();
    const sw = el.querySelector('[role="switch"][aria-label="Motion"]') as HTMLButtonElement;
    expect(sw.getAttribute('aria-checked')).toBe('true');
    sw.click();
    expect(bg.setMotion).toHaveBeenCalledWith(false);
  });
});
