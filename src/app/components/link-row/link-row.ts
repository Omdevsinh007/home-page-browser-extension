import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { LinkItem } from '../../core/model';
import { hostnameOf } from '../../core/url';
import { Favicon } from '../favicon/favicon';
import { LinkOpenerService } from '../../services/link-opener.service';

/** Compact link row inside a section column. Plain left click opens via the opener (counts the use). */
@Component({
  selector: 'app-link-row',
  imports: [MatMenuModule, MatIcon, Favicon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-id]': 'link().id', class: 'block' },
  template: `
    <div class="group/row relative flex items-center rounded-lg bg-white/5 hover:bg-white/10 focus-within:bg-white/10 transition-colors">
      <a
        [href]="link().url"
        target="_blank"
        rel="noopener noreferrer"
        (click)="open($event)"
        class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-lg"
      >
        <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10">
          <app-favicon [url]="link().url" [name]="link().name" />
        </span>
        <span class="truncate" [title]="link().name">{{ link().name }}</span>
        @if (host()) {
          <span class="ml-auto shrink-0 truncate pl-2 text-[11px] text-white/50 max-w-[40%]">{{ host() }}</span>
        }
      </a>
      <button
        type="button"
        class="mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-white/60 opacity-0 hover:bg-white/10 hover:text-white group-hover/row:opacity-100 focus-visible:opacity-100"
        [attr.aria-label]="'Options for ' + link().name"
        [matMenuTriggerFor]="menu"
      >
        <mat-icon class="!text-lg !size-[18px]">more_vert</mat-icon>
      </button>
    </div>
    <mat-menu #menu="matMenu" class="!bg-black/60 !backdrop-blur-xl !border !border-white/10 !rounded-xl !p-1 !shadow-2xl">
      <button mat-menu-item class="!text-white" (click)="edit.emit()">Edit link</button>
      <button mat-menu-item class="!text-red-400" (click)="remove.emit()">Remove</button>
    </mat-menu>
  `,
})
export class LinkRow {
  private opener = inject(LinkOpenerService);
  readonly link = input.required<LinkItem>();
  readonly edit = output<void>();
  readonly remove = output<void>();

  readonly host = computed(() => hostnameOf(this.link().url).replace(/^www\./, ''));

  open(event: MouseEvent): void {
    // Keep native behaviour for middle/modified clicks (new tab / window).
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    void this.opener.open(this.link());
  }
}
