import { Injectable, inject } from '@angular/core';
import { flattenToV1 } from '../core/flatten';
import { buildExport, parseImport } from '../core/import-export';
import { ConfirmService } from './confirm.service';
import { LinkStatsService } from './link-stats.service';
import { LinksStore } from './links-store';
import { NotifyService } from './notify.service';

/** Export, import and backup downloads (spec §6.4, §6.5). */
@Injectable({ providedIn: 'root' })
export class DataTransferService {
  private store = inject(LinksStore);
  private stats = inject(LinkStatsService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);

  exportAll(now = new Date()): void {
    const name = `custom-homepage-${now.toISOString().slice(0, 10)}.json`;
    this.download(name, buildExport(this.store.items(), this.stats.stats(), now));
  }

  /** Flat file the v2.x extension can import (sections merged). */
  exportForV2x(): void {
    this.download('custom-homepage-v2x.json', flattenToV1(this.store.items()));
  }

  async importText(text: string): Promise<boolean> {
    let parsed: ReturnType<typeof parseImport>;
    try {
      parsed = parseImport(text);
    } catch {
      this.notify.error('This file is not a Custom Homepage export.');
      return false;
    }
    const plural = (n: number) => `${n} item${n === 1 ? '' : 's'}`;
    const ok = await this.confirm.ask({
      title: `Replace ${plural(this.store.items().length)} with ${plural(parsed.items.length)}?`,
      message: 'Your current links are backed up first and can be downloaded from this menu.',
      confirmText: 'Replace',
      danger: true,
      details: parsed.skipped.map((s) => `Skipped “${s.name}”: unsafe URL`),
    });
    if (!ok) return false;
    try {
      await this.store.importReplace(parsed.items);
      if (parsed.stats) await this.stats.replace(parsed.stats);
      this.notify.info(`Imported ${plural(parsed.items.length)}.`);
      return true;
    } catch (error) {
      this.notify.error(error instanceof Error ? error.message : 'Import failed');
      return false;
    }
  }

  async downloadBackups(): Promise<void> {
    const backups = await this.store.readBackups();
    const entries = Object.entries(backups);
    if (entries.length === 0) {
      this.notify.info('No backups yet.');
      return;
    }
    for (const [key, value] of entries) this.download(`${key}.json`, value);
  }

  download(filename: string, data: unknown): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
