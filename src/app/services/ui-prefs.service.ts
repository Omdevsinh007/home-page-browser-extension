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
  /** Increments on every change, so a late failure of an older save never undoes a newer choice. */
  private changeSeq = 0;
  readonly shortcutStyle = this._shortcutStyle.asReadonly();

  /** Reads saved preferences. A missing or unreadable value means the default; nothing is written. */
  async load(): Promise<void> {
    let raw: unknown;
    try {
      raw = (await this.storage.getMany([UI_PREFS_KEY]))[UI_PREFS_KEY];
    } catch (error) {
      console.error('Could not read display preferences', error);
    }
    const style = raw && typeof raw === 'object' ? (raw as Partial<UiPrefs>).shortcutStyle : undefined;
    this._shortcutStyle.set(isStyle(style) ? style : 'tiles');
  }

  /** Switches at once; if saving fails, switches back and says so. */
  async setShortcutStyle(style: ShortcutStyle): Promise<void> {
    const previous = this._shortcutStyle();
    const seq = ++this.changeSeq;
    this._shortcutStyle.set(style);
    try {
      await this.storage.setMany({ [UI_PREFS_KEY]: { shortcutStyle: style } satisfies UiPrefs });
    } catch {
      if (seq !== this.changeSeq) return;
      this._shortcutStyle.set(previous);
      this.notify.error('Could not save the shortcut style.');
    }
  }
}
