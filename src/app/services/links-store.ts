import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { flattenToV1 } from '../core/flatten';
import { stableHash } from '../core/hash';
import { CURRENT_VERSION, detectShape, migrateV1toV2, unwrap } from '../core/migrate';
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
} as const;

export type LoadStatus = 'loading' | 'ready' | 'readonly-future' | 'corrupt';

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

  readonly items = this._items.asReadonly();
  readonly status = this._status.asReadonly();
  readonly groups = computed(() => this._items().filter((i): i is GroupTile => i.type === 'Group'));

  constructor() {
    const off = this.storage.onChange((keys) => {
      if (keys.includes(KEYS.v2) && this._status() !== 'loading') void this.load();
    });
    inject(DestroyRef).onDestroy(off);
  }

  async load(): Promise<void> {
    const raw = await this.storage.getMany([KEYS.v2, KEYS.v1, KEYS.backupV1]);
    const v2Raw = raw[KEYS.v2];
    const mirrorRaw = raw[KEYS.v1];

    if (v2Raw !== undefined) {
      const shape = detectShape(v2Raw);
      if (shape === 'future') return this.readonly(unwrap(v2Raw).data);
      if (shape === 'corrupt') return this.corrupt(v2Raw);
      const record = v2Raw as V2Record;
      const data = shape === 'empty' ? [] : record.data;
      const mirrorShape = detectShape(mirrorRaw);
      const mirrorData = (mirrorShape === 'v1' || mirrorShape === 'empty' ? unwrap(mirrorRaw).data ?? [] : null) as
        | V1Shortcut[]
        | null;

      if (mirrorData && stableHash(mirrorData) !== record.mirrorHash) {
        // v2.6.0 edited the flat mirror: merge its edits back.
        await this.storage.setMany({ [KEYS.backupPreReconcile]: v2Raw });
        this._status.set('ready');
        return this.persist(reconcile(data, mirrorData));
      }
      this._items.set(renumber(data));
      this._status.set('ready');
      if (!mirrorData) await this.persist(data); // mirror missing/corrupt: rewrite it
      return;
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
        this._status.set('ready');
        return this.persist(unwrap(mirrorRaw).data as TopItem[]);
      case 'v1': {
        const { items, quarantine } = migrateV1toV2(unwrap(mirrorRaw).data as unknown[]);
        const backup: Record<string, unknown> = {};
        if (raw[KEYS.backupV1] === undefined) backup[KEYS.backupV1] = mirrorRaw;
        if (quarantine.length) backup[KEYS.quarantine] = quarantine;
        if (Object.keys(backup).length) await this.storage.setMany(backup);
        this._status.set('ready');
        return this.persist(items);
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

  async rawForExport(): Promise<unknown> {
    return this.corruptRaw;
  }

  private async persist(next: TopItem[]): Promise<void> {
    const items = renumber(next);
    const mirror = flattenToV1(items);
    const record: V2Record = { version: CURRENT_VERSION, data: items, mirrorHash: stableHash(mirror) };
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
