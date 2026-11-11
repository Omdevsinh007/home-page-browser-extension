import { Injectable, inject, signal } from '@angular/core';
import { LinkStat } from '../core/model';
import { KeyValueStorage } from './storage.service';

export const STATS_KEY = 'linkStats';

/** Local-only open counter for "most used" sort and search ranking (spec §6.1). */
@Injectable({ providedIn: 'root' })
export class LinkStatsService {
  private storage = inject(KeyValueStorage);
  private readonly _stats = signal<Record<string, LinkStat>>({});
  readonly stats = this._stats.asReadonly();

  async load(): Promise<void> {
    const raw = (await this.storage.getMany([STATS_KEY]))[STATS_KEY] as { data?: Record<string, LinkStat> } | undefined;
    if (raw?.data && typeof raw.data === 'object') this._stats.set(raw.data);
  }

  async replace(stats: Record<string, LinkStat>): Promise<void> {
    this._stats.set({ ...stats });
    await this.storage.setMany({ [STATS_KEY]: { version: 1, data: stats } });
  }

  async record(ids: string[], now = Date.now()): Promise<void> {
    const next = { ...this._stats() };
    for (const id of ids) next[id] = { count: (next[id]?.count ?? 0) + 1, lastOpenedAt: now };
    this._stats.set(next);
    try {
      await this.storage.setMany({ [STATS_KEY]: { version: 1, data: next } });
    } catch (error) {
      console.warn('Could not save link stats', error); // stats are best effort; never block opening
    }
  }
}
