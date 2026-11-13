import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { DataTransferService } from '../../services/data-transfer.service';
import { ShortcutStyle, UiPrefsService } from '../../services/ui-prefs.service';

/** The one Settings popover: shortcut style, backgrounds and data actions. */
@Component({
  selector: 'app-settings-panel',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.css',
})
export class SettingsPanel {
  readonly prefs = inject(UiPrefsService);
  readonly data = inject(DataTransferService);

  readonly backgrounds = output<void>();
  readonly importFile = output<void>();

  readonly styles: { value: ShortcutStyle; label: string }[] = [
    { value: 'tiles', label: 'Tiles' },
    { value: 'compact', label: 'Compact' },
  ];
}
