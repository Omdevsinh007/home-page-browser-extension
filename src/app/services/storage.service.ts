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

export interface StorageData<T> {
  version: number;
  data: T;
}

/**
 * Legacy v1 wrapper used by SaveLinks and VideoService until they move to LinksStore / BackgroundStore.
 * @deprecated removed in Task 7 / Task 14.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly CURRENT_VERSION = 1;

  async get<T>(key: string): Promise<T | undefined> {
    try {
      if (hasChromeStorage()) {
        const result = await chrome.storage.local.get([key]);
        return this.processData<T>(result[key]);
      }
      const result = localStorage.getItem(key);
      return result ? this.processData<T>(JSON.parse(result)) : undefined;
    } catch (error) {
      console.error('Exception in storage get:', error);
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const storageObj: StorageData<T> = { version: this.CURRENT_VERSION, data: value };
    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [key]: storageObj });
    } else {
      localStorage.setItem(key, JSON.stringify(storageObj));
    }
  }

  private processData<T>(rawResult: any): T | undefined {
    if (!rawResult) return undefined;
    if (rawResult.version !== undefined && rawResult.data !== undefined) return rawResult.data as T;
    return rawResult as T;
  }
}
