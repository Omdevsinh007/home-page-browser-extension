import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';
import { MatIcon } from '@angular/material/icon';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { ColorDecoder } from 'color-decoder';
import { firstValueFrom } from 'rxjs';
import { VideoService, VideoItem } from './services/video.service';
import { Link } from './components/link/link';
import { GroupLink } from './components/group-link/group-link';
import { GroupDialog, GroupDialogData } from './components/group-dialog/group-dialog';
import { LinkDialog, LinkDialogData, LinkDialogResult } from './components/link-dialog/link-dialog';
import { NameDialog, NameDialogData } from './components/name-dialog/name-dialog';
import { GroupTile, ShortcutTile, TopItem } from './core/model';
import { migrateV1toV2, detectShape, unwrap, normalizeV2Items } from './core/migrate';
import { addGroup, addShortcut, moveTile, removeTile, updateTile } from './core/section-ops';
import { LinksStore } from './services/links-store';
import { LinkStatsService } from './services/link-stats.service';
import { ConfirmService } from './services/confirm.service';
import { NotifyService } from './services/notify.service';

const SMALL_DIALOG = { hasBackdrop: true, maxWidth: '600px', width: '100%' };

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, Link, MatIcon, MatMenuModule, GroupLink, DragDropModule, ColorDecoder, OverlayModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  private dialog = inject(MatDialog);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private stats = inject(LinkStatsService);
  readonly store = inject(LinksStore);
  public videoService = inject(VideoService);

  /** Tracks the currently open group dialog to allow seamless switching */
  private groupDialogRef: MatDialogRef<GroupDialog> | null = null;

  activeVideo$ = this.videoService.activeVideo$;
  videos$ = this.videoService.videos$;
  isVideoMenuOpen = signal(false);
  iconColor = signal('#ffffff');

  @ViewChild('mainVideo') mainVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('mainImage') mainImage?: ElementRef<HTMLImageElement>;

  private animationFrameId?: number;
  private lastSampleTime = 0;
  private destroyed = false;
  private worker!: Worker;

  async ngOnInit(): Promise<void> {
    await Promise.all([this.store.load(), this.stats.load()]);
  }

  ngAfterViewInit(): void {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./workers/color-extraction.worker', import.meta.url), { type: 'module' });

      this.worker.onmessage = ({ data }) => {
        const { r, g, b } = data;
        document.documentElement.style.setProperty('--theme-rgb', `${r}, ${g}, ${b}`);
      };

      this.extractColorLoop();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
    if (this.worker) {
      this.worker.terminate();
    }
    this.groupDialogRef?.close();
    this.groupDialogRef = null;
  }

  private extractColorLoop = () => {
    if (this.destroyed) return;
    if (!this.mainVideo?.nativeElement || !this.worker) {
      this.animationFrameId = requestAnimationFrame(this.extractColorLoop);
      return;
    }
    const video = this.mainVideo.nativeElement;
    if (video.readyState >= 2 && !video.paused && !video.ended) {
      const now = performance.now();
      if (now - this.lastSampleTime > 500) {
        this.lastSampleTime = now;
        this.extractColorFromSource(video);
      }
    }
    this.animationFrameId = requestAnimationFrame(this.extractColorLoop);
  };

  onImageLoad(event: Event) {
    this.extractColorFromSource(event.target as HTMLImageElement);
  }

  private async extractColorFromSource(source: CanvasImageSource) {
    if (!this.worker) return;
    try {
      const imageBitmap = await createImageBitmap(source, { resizeWidth: 64, resizeHeight: 64, resizeQuality: 'low' });
      this.worker.postMessage({ imageBitmap }, [imageBitmap]);
    } catch {
      // Ignore cross-origin errors or empty sources
    }
  }

  toggleVideoMenu() {
    this.isVideoMenuOpen.set(!this.isVideoMenuOpen());
  }

  async onVideoUploaded(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      try {
        await this.videoService.addVideo(input.files[0]);
      } catch (err: any) {
        this.notify.error(err.message || 'Error uploading video');
      }
      input.value = '';
    }
  }

  async deleteVideo(id: string, event: Event) {
    event.stopPropagation();
    try {
      await this.videoService.removeVideo(id);
    } catch (err: any) {
      this.notify.error(err.message || 'Error deleting video');
    }
  }

  async selectVideo(id: string) {
    await this.videoService.setActiveVideo(id);
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

  updateSettings(settings: Partial<VideoItem>) {
    this.videoService.updateActiveBackgroundSettings(settings);
  }

  onBrightnessChange(event: Event) {
    this.updateSettings({ brightness: parseInt((event.target as HTMLInputElement).value, 10) });
  }

  onBlurChange(event: Event) {
    this.updateSettings({ blur: parseInt((event.target as HTMLInputElement).value, 10) });
  }

  // Interim export/import on the v2 store; replaced by core/import-export in Task 12.
  exportData() {
    const blob = new Blob([JSON.stringify(this.store.items(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shortcuts-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async onImportData(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const shape = detectShape(parsed);
      const data = unwrap(parsed).data as unknown[];
      const items = shape === 'v1' ? migrateV1toV2(data).items : shape === 'v2' ? normalizeV2Items(data) : null;
      if (!items) throw new Error('Invalid file');
      await this.store.save(items);
    } catch (error) {
      console.error('Import error:', error);
      this.notify.error('Error importing data. Please ensure the file is a valid shortcuts export.');
    }
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
