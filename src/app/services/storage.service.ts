import { Injectable } from '@angular/core';

/** True inside the extension; false on localhost / in tests (where `chrome` may be undeclared). */
export function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

/** Thin key/value adapter. `setMany` writes all keys in one call so related keys never diverge. */
@Injectable({ providedIn: 'root', useFactory: () => new BrowserStorage() })
export abstract class KeyValueStorage {
  abstract getMany(keys: string[]): Promise<Record<string, unknown>>;
  abstract setMany(values: Record<string, unknown>): Promise<void>;
  /** Calls back with changed keys when storage changes (other tabs; own writes in chrome). Returns unsubscribe. */
  abstract onChange(cb: (changedKeys: string[]) => void): () => void;
}

export class BrowserStorage extends KeyValueStorage {
  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    if (hasChromeStorage()) return chrome.storage.local.get(keys);
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          out[key] = JSON.parse(raw);
        } catch {
          out[key] = raw;
        }
      }
    }
    return out;
  }

  async setMany(values: Record<string, unknown>): Promise<void> {
    if (hasChromeStorage()) {
      await chrome.storage.local.set(values);
      return;
    }
    const previous = new Map(Object.keys(values).map((k) => [k, localStorage.getItem(k)]));
    try {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      for (const [key, raw] of previous) raw === null ? localStorage.removeItem(key) : localStorage.setItem(key, raw);
      throw error;
    }
  }

  onChange(cb: (changedKeys: string[]) => void): () => void {
    if (hasChromeStorage()) {
      const listener = (changes: Record<string, unknown>, area: string) => {
        if (area === 'local') cb(Object.keys(changes));
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
    const listener = (e: StorageEvent) => e.key && cb([e.key]);
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }
}
