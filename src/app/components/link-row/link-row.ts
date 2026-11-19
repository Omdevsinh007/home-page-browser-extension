import { ChangeDetectionStrategy, Component, computed, inject, input, output, viewChild } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { MatIcon } from '@angular/material/icon';
import { POPOVER_VIEWPORT_MARGIN, TILE_MENU_POSITIONS } from '../../core/popover';
import { LinkItem } from '../../core/model';
import { hostnameOf } from '../../core/url';
import { Favicon } from '../favicon/favicon';
import { LinkOpenerService } from '../../services/link-opener.service';

/** Compact link row inside a section column. Plain left click opens via the opener (counts the use). */
@Component({
  selector: 'app-link-row',
  imports: [OverlayModule, Menu, MenuContent, MenuItem, MenuTrigger, MatIcon, Favicon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-id]': 'link().id', class: 'block' },
  template: `
    <div class="group/row relative flex min-h-[38px] items-center rounded-[var(--radius-row)] bg-[var(--glass-fill-faint)] hover:bg-[var(--glass-fill-strong)] focus-within:bg-[var(--glass-fill-strong)] transition-colors">
      <a
        [href]="link().url"
        target="_blank"
        rel="noopener noreferrer"
        (click)="open($event)"
        class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-sm text-[color:var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] rounded-[var(--radius-row)]"
      >
        <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--glass-fill)]">
          <app-favicon [url]="link().url" [name]="link().name" />
        </span>
        <span class="truncate" [title]="link().name">{{ link().name }}</span>
        @if (host()) {
          <span class="ml-auto shrink-0 truncate pl-2 text-xs text-[color:var(--text-dim)] max-w-[40%]">{{ host() }}</span>
        }
      </a>
      <button
        type="button"
        class="mr-[5px] flex size-7 shrink-0 items-center justify-center rounded-full text-[color:var(--text-dim)] opacity-0 hover:bg-[color:var(--glass-fill)] hover:text-[color:var(--text)] group-hover/row:opacity-100 focus-visible:opacity-100"
        [attr.aria-label]="'Options for ' + link().name"
        data-menu-origin #origin ngMenuTrigger #trigger="ngMenuTrigger" [menu]="menu()"
      >
        <mat-icon class="!size-[18px]" svgIcon="more_horiz" />
      </button>
    </div>
    <ng-template [cdkConnectedOverlay]="{ origin, usePopover: 'inline' }" [cdkConnectedOverlayOpen]="trigger.expanded()"
      [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayViewportMargin]="margin" cdkAttachPopoverAsChild>
      <div ngMenu #rowMenu="ngMenu" class="popover-menu" (itemSelected)="onSelected($event)">
        <ng-template ngMenuContent>
          <div ngMenuItem class="popover-item" value="edit">Edit link</div>
          <div ngMenuItem class="popover-item danger" value="delete">Delete</div>
        </ng-template>
      </div>
    </ng-template>
  `,
})
export class LinkRow {
  private opener = inject(LinkOpenerService);
  readonly link = input.required<LinkItem>();
  readonly edit = output<void>();
  readonly remove = output<void>();

  readonly menu = viewChild<Menu<string>>('rowMenu');
  /** Menus drop from their button, right edges aligned (same as the tile menus). */
  readonly positions = TILE_MENU_POSITIONS;
  readonly margin = POPOVER_VIEWPORT_MARGIN;

  onSelected(value: string | undefined): void {
    if (value === 'edit') this.edit.emit();
    else if (value === 'delete') this.remove.emit();
  }

  readonly host = computed(() => hostnameOf(this.link().url).replace(/^www\./, ''));

  open(event: MouseEvent): void {
    // Keep native behaviour for middle/modified clicks (new tab / window).
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    void this.opener.open(this.link());
  }
}
