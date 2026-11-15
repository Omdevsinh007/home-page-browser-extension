import { Injectable, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';
import { LinkStatsService } from './link-stats.service';

export const OPEN_ALL_CONFIRM_THRESHOLD = 10;

export interface OpenableLink {
  id: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class LinkOpenerService {
  private stats = inject(LinkStatsService);
  private confirm = inject(ConfirmService);

  /** Counts the use first, then opens in a new tab (foreground unless `background`). */
  async open(link: OpenableLink, opts: { background?: boolean } = {}): Promise<void> {
    await this.stats.record([link.id]);
    await this.openTab(link.url, !opts.background);
  }

  /** Opens every link in order in inactive tabs. Asks first above the threshold. Returns false if cancelled. */
  async openAll(links: OpenableLink[]): Promise<boolean> {
    if (links.length > OPEN_ALL_CONFIRM_THRESHOLD) {
      const ok = await this.confirm.ask({
        title: `Open ${links.length} links in new tabs?`,
        message: 'Each link opens in its own background tab.',
        confirmText: 'Open all',
      });
      if (!ok) return false;
    }
    await this.stats.record(links.map((l) => l.id));
    for (const link of links) await this.openTab(link.url, false);
    return true;
  }

  private async openTab(url: string, active: boolean): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome?.tabs?.create) {
      await chrome.tabs.create({ url, active });
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }
}
