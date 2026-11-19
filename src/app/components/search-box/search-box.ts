import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Favicon } from '../favicon/favicon';
import { SearchEntry, buildIndex, search } from '../../core/search';
import { TextSegment, matchRanges, splitByRanges } from '../../core/fuzzy';
import { LinkOpenerService } from '../../services/link-opener.service';
import { LinkStatsService } from '../../services/link-stats.service';
import { LinksStore } from '../../services/links-store';

interface OptionGroup {
  label: string;
  options: { entry: SearchEntry; index: number; name: TextSegment[] }[];
}

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

/** One search box for every link (spec §7). `/` or Ctrl/Cmd+K focuses it. */
@Component({
  selector: 'app-search-box',
  imports: [MatIcon, Favicon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onDocumentKey($event)', class: 'block' },
  templateUrl: './search-box.html',
  styleUrl: './search-box.css',
})
export class SearchBox {
  private store = inject(LinksStore);
  private stats = inject(LinkStatsService);
  private opener = inject(LinkOpenerService);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  readonly query = signal('');
  readonly activeIndex = signal(0);

  private readonly index = computed(() => buildIndex(this.store.items()));
  readonly result = computed(() => search(this.index(), this.query(), this.stats.stats()));
  readonly open = computed(() => this.query().trim().length > 0);
  readonly options = computed(() => (this.result().noMatch ? this.result().all : this.result().matches));

  /** Matches are a flat list; the no-match fallback is grouped by Group › Section. */
  readonly groups = computed<OptionGroup[]>(() => {
    const noMatch = this.result().noMatch;
    const query = this.query();
    const options = this.options().map((entry, index) => ({
      entry,
      index,
      name: noMatch ? [{ text: entry.name, hit: false }] : splitByRanges(entry.name, matchRanges(query, entry.name)),
    }));
    if (!noMatch) return [{ label: '', options }];
    const groups = new Map<string, OptionGroup>();
    for (const option of options) {
      const p = option.entry.path;
      const label = p.length === 3 ? `${p[0]} › ${p[1]}` : 'Shortcuts';
      if (!groups.has(label)) groups.set(label, { label, options: [] });
      groups.get(label)!.options.push(option);
    }
    return [...groups.values()];
  });

  readonly activeId = computed(() => (this.open() && this.options().length ? `search-opt-${this.activeIndex()}` : null));

  pathOf(entry: SearchEntry): string {
    return entry.path.length === 3 ? `${entry.path[0]} › ${entry.path[1]}` : 'Shortcut';
  }

  /** Only real pointer movement picks a row, so rows sliding under a still cursor never steal the keyboard's choice. */
  onOptionMouseMove(index: number): void {
    if (this.activeIndex() !== index) this.activeIndex.set(index);
  }

  onInput(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  onDocumentKey(event: KeyboardEvent): void {
    const isShortcutK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (isShortcutK) {
      event.preventDefault();
      this.focus();
      return;
    }
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditable(document.activeElement)) {
      event.preventDefault();
      this.focus();
    }
  }

  onInputKey(event: KeyboardEvent): void {
    const count = this.options().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (count) this.activeIndex.set((this.activeIndex() + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.activeIndex.set((this.activeIndex() - 1 + count) % count);
        break;
      case 'Enter': {
        const entry = this.options()[this.activeIndex()];
        if (this.open() && entry) {
          event.preventDefault();
          this.choose(entry, event.ctrlKey || event.metaKey);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        if (this.query()) {
          this.clear();
        } else {
          this.input().nativeElement.blur();
        }
        break;
    }
  }

  choose(entry: SearchEntry, background = false): void {
    void this.opener.open({ id: entry.linkId, url: entry.url }, { background });
  }

  onOptionClick(event: MouseEvent, entry: SearchEntry): void {
    this.choose(entry, event.ctrlKey || event.metaKey || event.button === 1);
  }

  private clear(): void {
    this.query.set('');
    this.activeIndex.set(0);
    this.input().nativeElement.value = '';
  }

  private focus(): void {
    const el = this.input().nativeElement;
    el.focus();
    el.select();
  }
}
