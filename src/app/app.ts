import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';
import { MatIcon } from '@angular/material/icon';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';
import { BackgroundStore } from './services/background.store';
import { BackgroundDialog } from './components/background-dialog/background-dialog';
import { Link } from './components/link/link';
import { GroupLink } from './components/group-link/group-link';
import { GroupDialog, GroupDialogData } from './components/group-dialog/group-dialog';
import { LinkDialog, LinkDialogData, LinkDialogResult } from './components/link-dialog/link-dialog';
import { NameDialog, NameDialogData } from './components/name-dialog/name-dialog';
import { SearchBox } from './components/search-box/search-box';
import { GroupTile, ShortcutTile, TopItem } from './core/model';
import { addGroup, addShortcut, moveTile, removeTile, updateTile } from './core/section-ops';
import { LinksStore } from './services/links-store';
import { LinkStatsService } from './services/link-stats.service';
import { ConfirmService } from './services/confirm.service';
import { NotifyService } from './services/notify.service';
import { DataTransferService } from './services/data-transfer.service';

const SMALL_DIALOG = { hasBackdrop: true, maxWidth: '600px', width: '100%' };

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, Link, SearchBox, MatIcon, MatMenuModule, GroupLink, DragDropModule, OverlayModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App implements OnInit, OnDestroy {
  private dialog = inject(MatDialog);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private stats = inject(LinkStatsService);
  readonly data = inject(DataTransferService);
  readonly store = inject(LinksStore);
  readonly bg = inject(BackgroundStore);

  /** Tracks the currently open group dialog to allow seamless switching */
  private groupDialogRef: MatDialogRef<GroupDialog> | null = null;

  async ngOnInit(): Promise<void> {
    await Promise.all([this.store.load(), this.stats.load(), this.bg.load().catch((e) => console.error('Backgrounds failed to load', e))]);
  }

  ngOnDestroy(): void {
    this.groupDialogRef?.close();
    this.groupDialogRef = null;
  }

  openBackgrounds(): void {
    this.dialog.open(BackgroundDialog, {
      maxWidth: '360px',
      width: '100%',
      position: { bottom: '88px', right: '24px' },
      ariaLabelledBy: 'background-dialog-title',
      autoFocus: 'first-tabbable',
    });
  }

  // ── links ──────────────────────────────────────────────────────

  async addShortcut(): Promise<void> {
    const result = await this.ask<LinkDialogResult>(LinkDialog, { title: 'Add shortcut' } satisfies LinkDialogData);
    if (result) await this.save((items) => addShortcut(items, result.name, result.url, Date.now()));
  }

  async editShortcut(tile: ShortcutTile): Promise<void> {
    const data: LinkDialogData = { title: 'Edit shortcut', initial: { name: tile.name, url: tile.url } };
    const result = await this.ask<LinkDialogResult>(LinkDialog, data);
    if (result) await this.save((items) => updateTile(items, tile.id, result));
  }

  async removeTile(tile: TopItem): Promise<void> {
    if (tile.type === 'Group') {
      const count = tile.sections.reduce((n, s) => n + s.links.length, 0);
      const ok = await this.confirm.ask({
        title: `Delete group “${tile.name}”?`,
        message: `This removes the group and its ${count} link${count === 1 ? '' : 's'}.`,
        confirmText: 'Delete group',
        danger: true,
      });
      if (!ok) return;
    }
    await this.save((items) => removeTile(items, tile.id));
  }

  async addGroup(): Promise<void> {
    const name = await this.ask<string>(NameDialog, { title: 'New group', label: 'Group name', confirmText: 'Create' } satisfies NameDialogData);
    if (!name) return;
    await this.save((items) => addGroup(items, name, Date.now()));
    const created = this.store.items().at(-1);
    if (created?.type === 'Group') this.openGroup(created);
  }

  async renameGroup(tile: GroupTile): Promise<void> {
    const data: NameDialogData = { title: 'Rename group', label: 'Group name', initial: tile.name, confirmText: 'Save' };
    const name = await this.ask<string>(NameDialog, data);
    if (name) await this.save((items) => updateTile(items, tile.id, { name }));
  }

  openGroup(tile: GroupTile): void {
    this.groupDialogRef?.close();
    this.groupDialogRef = this.dialog.open(GroupDialog, {
      maxWidth: '92dvw',
      maxHeight: '85dvh',
      height: '100%',
      width: '1200px',
      id: 'dialog-group-overlay',
      data: { groupId: tile.id } satisfies GroupDialogData,
      hasBackdrop: true,
      panelClass: 'group-dialog-panel',
      ariaLabelledBy: 'group-dialog-title',
    });
    this.groupDialogRef.afterClosed().subscribe(() => (this.groupDialogRef = null));
  }

  async drop(event: CdkDragDrop<TopItem[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    await this.save((items) => moveTile(items, event.previousIndex, event.currentIndex));
  }

  async onImportData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.data.importText(await file.text());
  }

  private async save(fn: (items: TopItem[]) => TopItem[]): Promise<void> {
    try {
      await this.store.update(fn);
    } catch (error) {
      this.notify.error(error instanceof Error ? error.message : 'Could not save changes');
    }
  }

  private ask<R>(component: unknown, data: unknown): Promise<R | undefined> {
    const ref = this.dialog.open(component as never, { ...SMALL_DIALOG, data });
    return firstValueFrom(ref.afterClosed()) as Promise<R | undefined>;
  }
}
