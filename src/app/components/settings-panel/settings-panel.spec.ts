import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppIcons } from '../../core/icons';
import { DataTransferService } from '../../services/data-transfer.service';
import { ShortcutStyle, UiPrefsService } from '../../services/ui-prefs.service';
import { SettingsPanel } from './settings-panel';

function setup(style: ShortcutStyle = 'compact') {
  const prefs = { shortcutStyle: signal<ShortcutStyle>(style), setShortcutStyle: vi.fn(async () => undefined) };
  const data = { exportAll: vi.fn(), exportForV2x: vi.fn(), downloadBackups: vi.fn(async () => undefined) };
  TestBed.configureTestingModule({
    imports: [SettingsPanel],
    providers: [
      provideAppIcons(),
      { provide: UiPrefsService, useValue: prefs },
      { provide: DataTransferService, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(SettingsPanel);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === text) as HTMLButtonElement;
  return { fixture, prefs, data, el, button };
}

describe('SettingsPanel', () => {
  it('is a labelled dialog', () => {
    const { el } = setup();
    const root = el.querySelector('[role="dialog"]')!;
    expect(root.getAttribute('aria-label')).toBe('Settings');
  });

  it('shows the current style as checked', () => {
    const { button } = setup('compact');
    expect(button('Compact').getAttribute('aria-checked')).toBe('true');
    expect(button('Tiles').getAttribute('aria-checked')).toBe('false');
  });

  it('uses one tab stop for the style switch', () => {
    const { button } = setup('compact');
    expect(button('Compact').tabIndex).toBe(0);
    expect(button('Tiles').tabIndex).toBe(-1);
  });

  it('arrow keys move the style choice and focus', () => {
    const { button, prefs, fixture } = setup('tiles');
    button('Tiles').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(prefs.setShortcutStyle).toHaveBeenCalledWith('compact');
    prefs.shortcutStyle.set('compact');
    fixture.detectChanges();
    expect(document.activeElement).toBe(button('Compact'));
    button('Compact').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(prefs.setShortcutStyle).toHaveBeenLastCalledWith('tiles');
  });

  it('changes the style', () => {
    const { button, prefs } = setup('compact');
    button('Tiles').click();
    expect(prefs.setShortcutStyle).toHaveBeenCalledWith('tiles');
  });

  it('lists the actions with plain labels', () => {
    const { el } = setup();
    for (const label of ['Backgrounds…', 'Export data', 'Export for older version (2.x)', 'Import data', 'Download backups']) {
      expect(el.textContent).toContain(label);
    }
  });

  it('emits backgrounds and importFile', () => {
    const { fixture, button } = setup();
    const backgrounds = vi.fn();
    const importFile = vi.fn();
    fixture.componentInstance.backgrounds.subscribe(backgrounds);
    fixture.componentInstance.importFile.subscribe(importFile);
    button('Backgrounds…').click();
    button('Import data').click();
    expect(backgrounds).toHaveBeenCalledTimes(1);
    expect(importFile).toHaveBeenCalledTimes(1);
  });

  it('emits done after each data action so the popover closes', () => {
    const { fixture, button } = setup();
    const done = vi.fn();
    fixture.componentInstance.done.subscribe(done);
    button('Export data').click();
    button('Export for older version (2.x)').click();
    button('Download backups').click();
    expect(done).toHaveBeenCalledTimes(3);
  });

  it('traps focus inside the panel', () => {
    const { el } = setup();
    expect(el.querySelector('[role="dialog"]')!.hasAttribute('cdktrapfocus')).toBe(true);
  });

  it('calls the data service', () => {
    const { button, data } = setup();
    button('Export data').click();
    button('Export for older version (2.x)').click();
    button('Download backups').click();
    expect(data.exportAll).toHaveBeenCalledTimes(1);
    expect(data.exportForV2x).toHaveBeenCalledTimes(1);
    expect(data.downloadBackups).toHaveBeenCalledTimes(1);
  });
});
