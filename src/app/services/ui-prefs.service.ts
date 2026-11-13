import { Injectable, inject, signal } from '@angular/core';
import { NotifyService } from './notify.service';
import { KeyValueStorage } from './storage.service';

/** Display preferences, kept apart from links data so exports and the v1 mirror never carry them. */
export const UI_PREFS_KEY = 'uiPrefs';

export type ShortcutStyle = 'tiles' | 'compact';

interface UiPrefs {
  shortcutStyle: ShortcutStyle;
}

const isStyle = (value: unknown): value is ShortcutStyle => value === 'tiles' || value === 'compact';

@Injectable({ providedIn: 'root' })
export class UiPrefsService {
  private storage = inject(KeyValueStorage);
  private notify = inject(NotifyService);
  private readonly _shortcutStyle = signal<ShortcutStyle>('tiles');
  readonly shortcutStyle = this._shortcutStyle.asReadonly();

  /** Reads saved preferences. A missing or unreadable value means the default; nothing is written. */
  async load(): Promise<void> {
    const raw = (await this.storage.getMany([UI_PREFS_KEY]))[UI_PREFS_KEY];
    const style = raw && typeof raw === 'object' ? (raw as Partial<UiPrefs>).shortcutStyle : undefined;
    this._shortcutStyle.set(isStyle(style) ? style : 'tiles');
  }

  /** Switches at once; if saving fails, switches back and says so. */
  async setShortcutStyle(style: ShortcutStyle): Promise<void> {
    const previous = this._shortcutStyle();
    this._shortcutStyle.set(style);
    try {
      await this.storage.setMany({ [UI_PREFS_KEY]: { shortcutStyle: style } satisfies UiPrefs });
    } catch {
      this._shortcutStyle.set(previous);
      this.notify.error('Could not save the shortcut style.');
    }
  }
}
