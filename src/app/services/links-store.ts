import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { flattenToV1 } from '../core/flatten';
import { stableHash } from '../core/hash';
import { CURRENT_VERSION, detectShape, migrateV1toV2, normalizeV2Items, unwrap } from '../core/migrate';
import { GroupTile, TopItem, V1Shortcut } from '../core/model';
import { renumber } from '../core/positions';
import { reconcile } from '../core/reconcile';
import { KeyValueStorage } from './storage.service';

export const KEYS = {
  v2: 'savedLinks_v2',
  v1: 'savedLinks',
  backupV1: 'savedLinks_backup_v1',
  backupPreImport: 'savedLinks_backup_preimport',
  backupPreReconcile: 'savedLinks_backup_v2_prereconcile',
  quarantine: 'savedLinks_quarantine',
  backupMirror: 'savedLinks_backup_mirror',
} as const;

/**
 * `write-failed`: data loaded but the first write after migration/reconcile failed. Items are shown,
 * saving is blocked so nothing partial overwrites the stored data.
 */
export type LoadStatus = 'loading' | 'ready' | 'readonly-future' | 'corrupt' | 'write-failed';

interface V2Record {
  version: number;
  data: TopItem[];
  mirrorHash: string;
}

/** Owns link data: load/migrate/reconcile, and dual-write saves (spec §6). */
@Injectable({ providedIn: 'root' })
export class LinksStore {
  private storage = inject(KeyValueStorage);
  private readonly _items = signal<TopItem[]>([]);
  private readonly _status = signal<LoadStatus>('loading');
  private corruptRaw: unknown;
  /** Bumped on every local write; a load that read before a newer write discards its result. */
  private writeSeq = 0;

  readonly items = this._items.asReadonly();
  readonly status = this._status.asReadonly();
  readonly groups = computed(() => this._items().filter((i): i is GroupTile => i.type === 'Group'));

  constructor() {
    const off = this.storage.onChange((keys) => {
      if (keys.includes(KEYS.v2) && this._status() === 'ready') void this.load();
    });
    inject(DestroyRef).onDestroy(off);
  }

  async load(): Promise<void> {
    const seq = this.writeSeq;
    const raw = await this.storage.getMany([KEYS.v2, KEYS.v1, KEYS.backupV1, KEYS.quarantine]);
    if (seq !== this.writeSeq) return; // a local save happened while reading: our state is newer
    const v2Raw = raw[KEYS.v2];
    const mirrorRaw = raw[KEYS.v1];

    if (v2Raw !== undefined && v2Raw !== null) {
      const shape = detectShape(v2Raw);
      if (shape === 'future') return this.readonly(unwrap(v2Raw).data);
      if (shape === 'corrupt') return this.corrupt(v2Raw);
      const record = v2Raw as V2Record;
      const data = shape === 'empty' ? [] : normalizeV2Items(record.data);

      const mirrorPresent = mirrorRaw !== undefined && mirrorRaw !== null;
      const mirrorShape = mirrorPresent ? detectShape(mirrorRaw) : null;
      const mirrorUsable = mirrorShape === 'v1' || mirrorShape === 'empty';

      if (mirrorUsable) {
        const mirrorData = (unwrap(mirrorRaw).data ?? []) as V1Shortcut[];
        if (stableHash(mirrorData) === record.mirrorHash) {
          this._items.set(renumber(data));
          this._status.set('ready');
          return;
        }
        // v2.6.0 edited the flat mirror: merge its edits back, after backing up v2.
        await this.storage.setMany({ [KEYS.backupPreReconcile]: v2Raw });
        return this.persistOnLoad(reconcile(data, mirrorData));
      }
      // Mirror missing, corrupt, or not v1: keep it if present, then rewrite it from v2.
      if (mirrorPresent) await this.storage.setMany({ [KEYS.backupMirror]: mirrorRaw });
      return this.persistOnLoad(data);
    }

    const shape = detectShape(mirrorRaw);
    switch (shape) {
      case 'empty':
        this._items.set([]);
        this._status.set('ready');
        return;
      case 'future':
        return this.readonly(unwrap(mirrorRaw).data);
      case 'corrupt':
        return this.corrupt(mirrorRaw);
      case 'v2':
        return this.persistOnLoad(normalizeV2Items(unwrap(mirrorRaw).data as unknown[]));
      case 'v1': {
        const { items, quarantine } = migrateV1toV2(unwrap(mirrorRaw).data as unknown[]);
        const backup: Record<string, unknown> = {};
        if (raw[KEYS.backupV1] === undefined) backup[KEYS.backupV1] = mirrorRaw;
        if (quarantine.length) {
          const existing = Array.isArray(raw[KEYS.quarantine]) ? (raw[KEYS.quarantine] as unknown[]) : [];
          const seen = new Set(existing.map((q) => JSON.stringify(q)));
          backup[KEYS.quarantine] = [...existing, ...quarantine.filter((q) => !seen.has(JSON.stringify(q)))];
        }
        if (Object.keys(backup).length) await this.storage.setMany(backup);
        return this.persistOnLoad(items);
      }
    }
  }

  async save(next: TopItem[]): Promise<void> {
    if (this._status() !== 'ready') throw new Error('Links are read-only');
    await this.persist(next);
  }

  update(fn: (items: TopItem[]) => TopItem[]): Promise<void> {
    return this.save(fn(this._items()));
  }

  /** Replaces everything with imported items, after copying the current v2 record to the pre-import backup. */
  async importReplace(next: TopItem[]): Promise<void> {
    if (this._status() !== 'ready') throw new Error('Links are read-only');
    const current = (await this.storage.getMany([KEYS.v2]))[KEYS.v2];
    if (current !== undefined) await this.storage.setMany({ [KEYS.backupPreImport]: current });
    await this.persist(next);
  }

  /** Backups that exist, keyed by storage key, for "Download backup". */
  async readBackups(): Promise<Record<string, unknown>> {
    const keys = [KEYS.backupV1, KEYS.backupPreImport, KEYS.backupPreReconcile, KEYS.backupMirror, KEYS.quarantine];
    return this.storage.getMany(keys);
  }

  async rawForExport(): Promise<unknown> {
    return this.corruptRaw;
  }

  /** First write during load. Status becomes ready only after it succeeds. */
  private async persistOnLoad(next: TopItem[]): Promise<void> {
    try {
      await this.persist(next);
      this._status.set('ready');
    } catch (error) {
      console.error('Could not save migrated links', error);
      this._items.set(renumber(next));
      this._status.set('write-failed');
    }
  }

  private async persist(next: TopItem[]): Promise<void> {
    const items = renumber(next);
    const mirror = flattenToV1(items);
    const record: V2Record = { version: CURRENT_VERSION, data: items, mirrorHash: stableHash(mirror) };
    this.writeSeq++;
    await this.storage.setMany({ [KEYS.v2]: record, [KEYS.v1]: { version: 1, data: mirror } });
    this._items.set(items);
  }

  private readonly(data: unknown): void {
    this._items.set(Array.isArray(data) ? (data as TopItem[]) : []);
    this._status.set('readonly-future');
  }

  private corrupt(raw: unknown): void {
    this.corruptRaw = raw;
    this._items.set([]);
    this._status.set('corrupt');
  }
}
