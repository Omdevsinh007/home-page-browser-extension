import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, viewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { OverlayModule } from '@angular/cdk/overlay';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { POPOVER_VIEWPORT_MARGIN, SUBMENU_POSITIONS, TILE_MENU_POSITIONS } from '../../core/popover';
import { firstValueFrom } from 'rxjs';
import { GroupTile, LinkItem, Section, SortMode } from '../../core/model';
import { renumber } from '../../core/positions';
import {
  addLink,
  deleteSection,
  moveLink,
  patchSection,
  removeLink,
  renameSection,
  replaceGroup,
  updateLink,
} from '../../core/section-ops';
import { sortLinks } from '../../core/sort';
import { ConfirmService } from '../../services/confirm.service';
import { LinkOpenerService } from '../../services/link-opener.service';
import { LinkStatsService } from '../../services/link-stats.service';
import { LinksStore } from '../../services/links-store';
import { NotifyService } from '../../services/notify.service';
import { LinkDialog, LinkDialogData, LinkDialogResult } from '../link-dialog/link-dialog';
import { LinkRow } from '../link-row/link-row';
import { NameDialog, NameDialogData } from '../name-dialog/name-dialog';

export const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Manual',
  az: 'A–Z',
  recent: 'Recently added',
  'most-used': 'Most used',
};

export const ACCENTS = ['accent-1', 'accent-2', 'accent-3', 'accent-4', 'accent-5', 'accent-6', 'accent-7', 'accent-8'];

const DIALOG = { maxWidth: '520px', width: '100%' };

@Component({
  selector: 'app-section-column',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, OverlayModule, Menu, MenuContent, MenuItem, MenuTrigger, MatIcon, LinkRow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-id]': 'section().id', class: 'block' },
  styleUrl: './section-column.css',
  templateUrl: './section-column.html',
})
export class SectionColumn {
  private store = inject(LinksStore);
  private stats = inject(LinkStatsService);
  private opener = inject(LinkOpenerService);
  private confirm = inject(ConfirmService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  readonly group = input.required<GroupTile>();
  readonly section = input.required<Section>();

  readonly sortLabels = SORT_LABELS;
  readonly sortModes = Object.keys(SORT_LABELS) as SortMode[];
  readonly accents = ACCENTS;
  readonly displayed = computed(() => sortLinks(this.section().links, this.section().sort, this.stats.stats()));
  readonly isManual = computed(() => this.section().sort === 'manual');
  readonly canDelete = computed(() => this.group().sections.length > 1);

  /** Menus drop from their button, right edges aligned (same as the tile menus). */
  readonly positions = TILE_MENU_POSITIONS;
  readonly submenuPositions = SUBMENU_POSITIONS;
  readonly margin = POPOVER_VIEWPORT_MARGIN;
  readonly sortMenu = viewChild<Menu<string>>('sortMenu');
  readonly optionsMenu = viewChild<Menu<string>>('optionsMenu');
  readonly colourMenu = viewChild<Menu<string>>('colourMenu');

  onSortSelected(mode: string | undefined): void {
    if (mode && mode in SORT_LABELS) void this.setSort(mode as SortMode);
  }

  /** Options menu, including its Colour submenu: @angular/aria reports submenu picks on the root menu. */
  onOptionSelected(value: string | undefined): void {
    if (value === 'rename') void this.rename();
    else if (value === 'collapse') void this.toggleCollapsed();
    else if (value === 'delete') void this.remove();
    else if (value === 'colour:none') void this.setColor(undefined);
    else if (value?.startsWith('colour:') && ACCENTS.includes(value.slice(7))) void this.setColor(value.slice(7));
  }

  async addLink(): Promise<void> {
    const result = await this.ask<LinkDialogResult>(LinkDialog, { title: 'Add link' } satisfies LinkDialogData);
    if (result) await this.change((g) => addLink(g, this.section().id, result.name, result.url, Date.now()));
  }

  async editLink(link: LinkItem): Promise<void> {
    const data: LinkDialogData = { title: 'Edit link', initial: { name: link.name, url: link.url } };
    const result = await this.ask<LinkDialogResult>(LinkDialog, data);
    if (result) await this.change((g) => updateLink(g, link.id, result));
  }

  async removeLink(link: LinkItem): Promise<void> {
    await this.change((g) => removeLink(g, link.id));
  }

  async rename(): Promise<void> {
    const data: NameDialogData = { title: 'Rename section', label: 'Section name', initial: this.section().name, confirmText: 'Save' };
    const name = await this.ask<string>(NameDialog, data);
    if (name) await this.change((g) => renameSection(g, this.section().id, name));
  }

  async remove(): Promise<void> {
    if (!this.canDelete()) return;
    const count = this.section().links.length;
    if (count > 0) {
      const first = renumber(this.group().sections).find((s) => s.id !== this.section().id)!;
      const ok = await this.confirm.ask({
        title: `Delete section “${this.section().name}”?`,
        message: `Its ${count} link${count === 1 ? '' : 's'} will move to “${first.name}”.`,
        confirmText: 'Delete section',
        danger: true,
      });
      if (!ok) return;
    }
    await this.change((g) => deleteSection(g, this.section().id));
  }

  setSort(sort: SortMode): Promise<void> {
    return this.change((g) => patchSection(g, this.section().id, { sort }));
  }

  setColor(color: string | undefined): Promise<void> {
    return this.change((g) => patchSection(g, this.section().id, { color }));
  }

  toggleCollapsed(): Promise<void> {
    return this.change((g) => patchSection(g, this.section().id, { collapsed: !this.section().collapsed }));
  }

  async openAll(): Promise<void> {
    await this.opener.openAll(this.displayed());
  }

  /** Converts view indexes into manual-order indexes before moving. */
  async drop(event: CdkDragDrop<string, string, string>): Promise<void> {
    const fromId = event.previousContainer.data;
    const toId = event.container.data;
    const g = this.currentGroup();
    const from = g.sections.find((s) => s.id === fromId);
    const to = g.sections.find((s) => s.id === toId);
    if (!from || !to) return;
    const fromIndex = renumber(from.links).findIndex((l) => l.id === event.item.data);
    if (fromIndex < 0) return;
    if (fromId === toId && from.sort !== 'manual') return; // sorted column: in-column drag disabled
    await this.change((grp) => moveLink(grp, fromId, toId, fromIndex, event.currentIndex));
  }

  private currentGroup(): GroupTile {
    return this.store.groups().find((g) => g.id === this.group().id) ?? this.group();
  }

  private async change(fn: (g: GroupTile) => GroupTile): Promise<void> {
    try {
      await this.store.update((items) => replaceGroup(items, fn(this.currentGroup())));
    } catch (error) {
      this.notify.error(error instanceof Error ? error.message : 'Could not save changes');
    }
  }

  private ask<R>(component: unknown, data: unknown): Promise<R | undefined> {
    const ref = this.dialog.open(component as never, { ...DIALOG, data });
    return firstValueFrom(ref.afterClosed()) as Promise<R | undefined>;
  }
}
