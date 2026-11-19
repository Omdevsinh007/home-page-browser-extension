import { Injectable, computed, inject, signal } from '@angular/core';
import { KeyValueStorage } from './storage.service';
import { readSnapshot, writeSnapshot } from '../core/render-snapshot';
import { BuiltInId, DEFAULT_WALLPAPER, isBuiltIn } from '../core/wallpapers';

/** v2.x stored backgrounds as data URLs under this chrome.storage key. Left untouched (v2.6.0 can still read it). */
export const LEGACY_KEY = 'backgroundVideos';
export const MIGRATED_FLAG = 'backgrounds_idb_migrated';
export const MAX_BACKGROUNDS = 3;
/** The built-in wallpaper choice, `{ builtIn: BuiltInId; motion: boolean }`. Kept apart from links data, so exports never carry it. */
export const WALLPAPER_KEY = 'wallpaper';

const DB_NAME = 'custom-homepage';
const STORE = 'backgrounds';

export type ObjectFit = 'cover' | 'contain' | 'fill';

export interface BackgroundMeta {
  id: string;
  name: string;
  type: 'video' | 'image';
  isActive: boolean;
  objectFit: ObjectFit;
  brightness: number;
  blur: number;
  order: number;
}

interface BackgroundRecord extends BackgroundMeta {
  blob: Blob;
}

interface LegacyVideo {
  id?: string;
  name?: string;
  dataUrl?: string;
  type?: 'video' | 'image';
  isActive?: boolean;
  objectFit?: ObjectFit;
  brightness?: number;
  blur?: number;
}

// ── IndexedDB helpers ─────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error ?? new Error('Transaction aborted'));
    });
  } finally {
    db.close();
  }
}

export async function readAllRecords(): Promise<BackgroundRecord[]> {
  const all = (await tx<BackgroundRecord[]>('readonly', (s) => s.getAll())) ?? [];
  return all.sort((a, b) => a.order - b.order);
}

function putAll(records: BackgroundRecord[]): Promise<unknown> {
  return tx('readwrite', (s) => void records.forEach((r) => s.put(r)));
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload = ''] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'application/octet-stream';
  const bytes = header.includes(';base64') ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(payload));
  return new Blob([bytes], { type: mime });
}

const meta = ({ blob: _blob, ...rest }: BackgroundRecord): BackgroundMeta => rest;

/**
 * Backgrounds as Blobs in IndexedDB (no chrome.storage quota, no base64 bloat). Settings changes are previewed
 * in memory and written once on commit, instead of on every slider tick. With no upload active, the chosen
 * built-in wallpaper shows.
 */
@Injectable({ providedIn: 'root' })
export class BackgroundStore {
  private storage = inject(KeyValueStorage);
  private records: BackgroundRecord[] = [];
  private readonly _list = signal<BackgroundMeta[]>([]);
  private readonly _active = signal<{ meta: BackgroundMeta; objectUrl: string } | null>(null);

  readonly list = this._list.asReadonly();
  readonly active = this._active.asReadonly();
  readonly count = computed(() => this._list().length);

  private readonly _builtIn = signal<BuiltInId>(this.initialBuiltIn());
  /** The built-in wallpaper used whenever no upload is active. */
  readonly builtIn = this._builtIn.asReadonly();
  /** What the page shows: the chosen built-in, or 'upload' while one of the user's files is active. */
  readonly shown = computed<BuiltInId | 'upload'>(() => (this._active() ? 'upload' : this._builtIn()));

  private readonly _motion = signal<boolean>(readSnapshot()?.motion ?? true);
  /** Whether the built-in wallpaper drifts (off also under the OS reduced-motion setting, in CSS). */
  readonly motion = this._motion.asReadonly();

  async load(): Promise<void> {
    await this.importLegacyOnce();
    const stored = (await this.storage.getMany([WALLPAPER_KEY]))[WALLPAPER_KEY];
    const choice = stored && typeof stored === 'object' ? (stored as { builtIn?: unknown; motion?: unknown }) : {};
    this._builtIn.set(isBuiltIn(choice.builtIn) ? choice.builtIn : DEFAULT_WALLPAPER);
    this._motion.set(choice.motion !== false);
    this.records = await readAllRecords();
    this.publish();
  }

  async add(file: File): Promise<void> {
    if (this.records.length >= MAX_BACKGROUNDS) throw new Error('Maximum limit of 3 backgrounds reached. Please delete one first.');
    const record: BackgroundRecord = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'video',
      isActive: true,
      objectFit: 'cover',
      brightness: 100,
      blur: 0,
      order: Math.max(0, ...this.records.map((r) => r.order + 1)),
      blob: file,
    };
    const next = [...this.records.map((r) => ({ ...r, isActive: false })), record];
    await putAll(next);
    this.records = next;
    this.publish();
  }

  /** Deleting the active upload falls back to the built-in wallpaper. */
  async remove(id: string): Promise<void> {
    await tx('readwrite', (s) => void s.delete(id));
    this.records = this.records.filter((r) => r.id !== id);
    this.publish();
  }

  /** Shows a built-in wallpaper: every upload becomes inactive (they stay in the list). */
  async setBuiltIn(id: BuiltInId): Promise<void> {
    const next = this.records.map((r) => ({ ...r, isActive: false }));
    await Promise.all([putAll(next), this.saveChoice(id, this._motion())]);
    this.records = next;
    this._builtIn.set(id);
    this.publish();
  }

  /** Turns the wallpaper drift on or off. */
  async setMotion(on: boolean): Promise<void> {
    await this.saveChoice(this._builtIn(), on);
    this._motion.set(on);
    writeSnapshot({ motion: on });
  }

  private saveChoice(builtIn: BuiltInId, motion: boolean): Promise<void> {
    return this.storage.setMany({ [WALLPAPER_KEY]: { builtIn, motion } });
  }

  async setActive(id: string): Promise<void> {
    const next = this.records.map((r) => ({ ...r, isActive: r.id === id }));
    await putAll(next);
    this.records = next;
    this.publish();
  }

  /** Updates the visible settings only (slider `input`). */
  preview(patch: Partial<Pick<BackgroundMeta, 'objectFit' | 'brightness' | 'blur'>>): void {
    const current = this._active();
    if (!current) return;
    this._active.set({ ...current, meta: { ...current.meta, ...patch } });
  }

  /** Persists the previewed settings of the active background (slider `change`, fit buttons). */
  async commit(): Promise<void> {
    const current = this._active();
    if (!current) return;
    const { objectFit, brightness, blur } = current.meta;
    const next = this.records.map((r) => (r.id === current.meta.id ? { ...r, objectFit, brightness, blur } : r));
    await putAll(next.filter((r) => r.id === current.meta.id));
    this.records = next;
    this._list.set(this.records.map(meta));
  }

  private publish(): void {
    this._list.set(this.records.map(meta));
    const active = this.records.find((r) => r.isActive);
    const previous = this._active();
    if (previous && previous.meta.id === active?.id) {
      this._active.set({ ...previous, meta: meta(active) });
      return;
    }
    if (previous) URL.revokeObjectURL(previous.objectUrl);
    this._active.set(active ? { meta: meta(active), objectUrl: URL.createObjectURL(active.blob) } : null);
    writeSnapshot({ wallpaper: this.shown(), motion: this._motion() });
  }

  private initialBuiltIn(): BuiltInId {
    const last = readSnapshot()?.wallpaper;
    return isBuiltIn(last) ? last : DEFAULT_WALLPAPER;
  }

  private async importLegacyOnce(): Promise<void> {
    const raw = await this.storage.getMany([LEGACY_KEY, MIGRATED_FLAG]);
    if (raw[MIGRATED_FLAG] === true) return;
    const legacy = Array.isArray(raw[LEGACY_KEY]) ? (raw[LEGACY_KEY] as LegacyVideo[]) : [];
    const records: BackgroundRecord[] = legacy
      .filter((v) => typeof v.dataUrl === 'string' && v.dataUrl.startsWith('data:'))
      .slice(0, MAX_BACKGROUNDS)
      .map((v, order) => ({
        id: crypto.randomUUID(),
        name: v.name ?? `Background ${order + 1}`,
        type: v.type === 'video' ? 'video' : 'image',
        isActive: !!v.isActive,
        objectFit: v.objectFit ?? 'cover',
        brightness: v.brightness ?? 100,
        blur: v.blur ?? 0,
        order,
        blob: dataUrlToBlob(v.dataUrl!),
      }));
    if (records.length) await putAll(records);
    await this.storage.setMany({ [MIGRATED_FLAG]: true });
  }
}
