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

function setup() {
  const list = signal([meta('a', true), meta('b', false)]);
  const bg = {
    list,
    active: signal({ meta: meta('a', true), objectUrl: 'blob:x' }),
    preview: vi.fn(),
    commit: vi.fn(async () => undefined),
    setActive: vi.fn(async () => undefined),
    remove: vi.fn(async () => {
      throw new Error('At least one background must remain.');
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
  return { bg, notify, el: fixture.nativeElement as HTMLElement };
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
    expect(notify.error).toHaveBeenCalledWith('At least one background must remain.');
  });

  it('says where the files are stored', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Stored locally in this browser.');
  });
});
