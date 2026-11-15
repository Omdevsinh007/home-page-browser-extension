import { ChangeDetectionStrategy, Component, ElementRef, inject, output, viewChildren } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { MatIcon } from '@angular/material/icon';
import { DataTransferService } from '../../services/data-transfer.service';
import { ShortcutStyle, UiPrefsService } from '../../services/ui-prefs.service';

/** The one Settings popover: shortcut style, backgrounds and data actions. */
@Component({
  selector: 'app-settings-panel',
  imports: [MatIcon, CdkTrapFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.css',
})
export class SettingsPanel {
  readonly prefs = inject(UiPrefsService);
  readonly data = inject(DataTransferService);

  readonly backgrounds = output<void>();
  readonly importFile = output<void>();
  /** Emitted after a data action, so the host can close the popover. */
  readonly done = output<void>();

  readonly styles: { value: ShortcutStyle; label: string }[] = [
    { value: 'tiles', label: 'Tiles' },
    { value: 'compact', label: 'Compact' },
  ];

  private styleButtons = viewChildren<ElementRef<HTMLButtonElement>>('styleButton');

  /** Radio-group keys: arrows move the choice and focus; Home/End jump to the ends. */
  onStyleKeydown(event: KeyboardEvent, index: number): void {
    const last = this.styles.length - 1;
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : -1;
    if (next < 0) return;
    event.preventDefault();
    void this.prefs.setShortcutStyle(this.styles[next].value);
    this.styleButtons()[next]?.nativeElement.focus();
  }
}
