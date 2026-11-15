import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { hostnameOf } from '../../core/url';

const ACCENT_COUNT = 8;

function extensionFaviconBase(): string | null {
  return typeof chrome !== 'undefined' && chrome?.runtime?.id && chrome.runtime.getURL ? chrome.runtime.getURL('/_favicon/') : null;
}

/**
 * Site icon via the MV3 `_favicon` endpoint (needs the "favicon" permission), so link URLs never leave the
 * browser. Anything else, or a failed load, shows a coloured letter avatar.
 */
@Component({
  selector: 'app-favicon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center justify-center' },
  template: `
    @if (src(); as s) {
      <img [src]="s" alt="" [width]="displaySize()" [height]="displaySize()" loading="lazy" (error)="failed.set(true)" />
    } @else {
      <span
        class="flex items-center justify-center rounded-full font-semibold text-[color:var(--text)]"
        [style.width.px]="displaySize()"
        [style.height.px]="displaySize()"
        [style.font-size.px]="displaySize() * 0.55"
        [style.background]="'var(--accent-' + accent() + ')'"
        aria-hidden="true"
        >{{ letter() }}</span
      >
    }
  `,
})
export class Favicon {
  readonly url = input.required<string>();
  readonly name = input.required<string>();
  /** Requested icon size from the browser (px). */
  readonly size = input(32);
  readonly displaySize = input(16);

  readonly failed = signal(false);

  readonly src = computed(() => {
    const base = extensionFaviconBase();
    if (!base || this.failed() || !/^https?:\/\//i.test(this.url())) return null;
    return `${base}?pageUrl=${encodeURIComponent(this.url())}&size=${this.size()}`;
  });

  readonly letter = computed(() => (this.name().trim()[0] ?? '?').toUpperCase());

  readonly accent = computed(() => {
    const key = hostnameOf(this.url()) || this.name();
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return (h % ACCENT_COUNT) + 1;
  });
}
