import { ChangeDetectionStrategy, Component, DestroyRef, DOCUMENT, effect, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { SettingsPanel } from './components/settings-panel/settings-panel';
import { MatIcon } from '@angular/material/icon';
import type { MatDialogRef } from '@angular/material/dialog';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { MatRippleModule } from '@angular/material/core';
import { BackgroundStore } from './services/background.store';
import { Link } from './components/link/link';
import { GroupLink } from './components/group-link/group-link';
import type { GroupDialog, GroupDialogData } from './components/group-dialog/group-dialog';
import type { LinkDialogData, LinkDialogResult } from './components/link-dialog/link-dialog';
import type { NameDialogData } from './components/name-dialog/name-dialog';
import { SearchBox } from './components/search-box/search-box';
import { GroupTile, ShortcutTile, TopItem } from './core/model';
import { POPOVER_POSITIONS, POPOVER_VIEWPORT_MARGIN } from './core/popover';
import { addGroup, addShortcut, moveTile, removeTile, updateTile } from './core/section-ops';
import { LinksStore } from './services/links-store';
import { LinkStatsService } from './services/link-stats.service';
import { ConfirmService } from './services/confirm.service';
import { NotifyService } from './services/notify.service';
import { DataTransferService } from './services/data-transfer.service';
import { UiPrefsService } from './services/ui-prefs.service';
import { ComponentLoader, DIALOGS, DialogLoader } from './services/dialog-loader.service';

const SMALL_DIALOG = { hasBackdrop: true, maxWidth: '600px', width: '100%' };

@Component({
  selector: 'app-root',
  imports: [Link, SearchBox, MatIcon, Menu, MenuContent, MenuItem, MenuTrigger, MatRippleModule, GroupLink, DragDropModule, OverlayModule, SettingsPanel],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, OnDestroy {
  private dialogs = inject(DialogLoader);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private stats = inject(LinkStatsService);
  readonly data = inject(DataTransferService);
  readonly store = inject(LinksStore);
  readonly bg = inject(BackgroundStore);
  readonly uiPrefs = inject(UiPrefsService);

  /** Background video does not autoplay when the user asks for reduced motion. */
  readonly reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private bgVideo = viewChild<ElementRef<HTMLVideoElement>>('bgVideo');
  private resumeVideo = false;

  constructor() {
    // Pause the background video while the tab is hidden; resume only if it was playing.
    const doc = inject(DOCUMENT);
    const onVisibility = () => {
      const video = this.bgVideo()?.nativeElement;
      if (!video) return;
      if (doc.visibilityState === 'hidden') {
        this.resumeVideo = !video.paused;
        if (this.resumeVideo) video.pause();
      } else if (this.resumeVideo) {
        this.resumeVideo = false;
        if (!this.reducedMotion) video.play().catch(() => undefined);
      }
    };
    doc.addEventListener('visibilitychange', onVisibility);

    // The wallpaper is the body background, chosen by html[data-wallpaper] (boot.js sets it before first paint).
    effect(() => {
      doc.documentElement.dataset['wallpaper'] = this.bg.shown();
      doc.documentElement.dataset['motion'] = this.bg.motion() ? 'on' : 'off';
    });
    inject(DestroyRef).onDestroy(() => doc.removeEventListener('visibilitychange', onVisibility));
  }

  readonly settingsOpen = signal(false);
  private settingsButton = viewChild.required<ElementRef<HTMLButtonElement>>('settingsButton');
  /** Above the Settings button, right edges aligned, 8px gap. */
  readonly settingsPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
  ];

  readonly popoverPositions = POPOVER_POSITIONS;
  readonly popoverMargin = POPOVER_VIEWPORT_MARGIN;
  readonly addMenu = viewChild<Menu<string>>('addMenu');

  onAddSelected(value: string | undefined): void {
    if (value === 'shortcut') void this.addShortcut();
    else if (value === 'group') void this.addGroup();
  }

  /** Tracks the currently open group dialog to allow seamless switching */
  private groupDialogRef: MatDialogRef<GroupDialog> | null = null;
  /** True while the group dialog chunk loads, so a double click opens it once. */
  private openingGroup = false;

  async ngOnInit(): Promise<void> {
    await Promise.all([this.store.load(), this.stats.load(), this.uiPrefs.load(), this.bg.load().catch((e) => console.error('Backgrounds failed to load', e))]);
    this.dialogs.prefetch([() => import('./components/settings-panel/settings-panel')]);
  }

  ngOnDestroy(): void {
    this.groupDialogRef?.close();
    this.groupDialogRef = null;
  }

  /** Backgrounds opens from Settings; its Back button returns to Settings. */
  async openBackgrounds(): Promise<void> {
    const result = await this.dialogs.open<'back'>(DIALOGS.background, {
      maxWidth: '360px',
      width: '100%',
      position: { bottom: '88px', right: '24px' },
      ariaLabelledBy: 'background-dialog-title',
      autoFocus: 'first-tabbable',
    });
    if (result === 'back') this.settingsOpen.set(true);
  }

  toggleSettings(): void {
    if (this.settingsOpen()) this.closeSettings();
    else this.settingsOpen.set(true);
  }

  /** Closes the popover and returns focus to its button. */
  closeSettings(): void {
    if (!this.settingsOpen()) return;
    this.settingsOpen.set(false);
    this.settingsButton().nativeElement.focus();
  }

  onSettingsKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSettings();
    }
  }

  // ── links ──────────────────────────────────────────────────────

  async addShortcut(): Promise<void> {
    const result = await this.ask<LinkDialogResult>(DIALOGS.link, { title: 'Add shortcut' } satisfies LinkDialogData);
    if (result) await this.save((items) => addShortcut(items, result.name, result.url, Date.now()));
  }

  async editShortcut(tile: ShortcutTile): Promise<void> {
    const data: LinkDialogData = { title: 'Edit shortcut', initial: { name: tile.name, url: tile.url } };
    const result = await this.ask<LinkDialogResult>(DIALOGS.link, data);
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
    const name = await this.ask<string>(DIALOGS.name, { title: 'New group', label: 'Group name', confirmText: 'Create' } satisfies NameDialogData);
    if (!name) return;
    await this.save((items) => addGroup(items, name, Date.now()));
    const created = this.store.items().at(-1);
    if (created?.type === 'Group') await this.openGroup(created);
  }

  async renameGroup(tile: GroupTile): Promise<void> {
    const data: NameDialogData = { title: 'Rename group', label: 'Group name', initial: tile.name, confirmText: 'Save' };
    const name = await this.ask<string>(DIALOGS.name, data);
    if (name) await this.save((items) => updateTile(items, tile.id, { name }));
  }

  async openGroup(tile: GroupTile): Promise<void> {
    if (this.openingGroup) return;
    this.openingGroup = true;
    this.groupDialogRef?.close();
    try {
      const ref = await this.dialogs.openRef<GroupDialog>(DIALOGS.group, {
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
      this.groupDialogRef = ref;
      ref.afterClosed().subscribe(() => {
        if (this.groupDialogRef === ref) this.groupDialogRef = null;
      });
    } finally {
      this.openingGroup = false;
    }
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

  private ask<R>(load: ComponentLoader, data: unknown): Promise<R | undefined> {
    return this.dialogs.open<R>(load, { ...SMALL_DIALOG, data });
  }
}
