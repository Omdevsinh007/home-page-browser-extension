import {
  AfterViewInit,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
  WritableSignal,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { VideoService, VideoItem } from './services/video.service';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';
import { map, Observable, ReplaySubject } from 'rxjs';
import { ColorDecoder } from "color-decoder";
import { Link } from './components/link/link';
import { ShortcutDialog } from './components/shortcut-dialog/shortcut-dialog';
import { GroupName } from './components/group-name/group-name';
import { GroupLink } from './components/group-link/group-link';
import { GroupDialog } from './components/group-dialog/group-dialog';
import { SaveLinks } from './services/save-links';
import { Shortcut } from './models/shortcut';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    FormsModule,
    Link,
    MatIcon,
    MatMenuModule,
    GroupLink,
    DragDropModule,
    ColorDecoder,
    OverlayModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  private storageService = inject(SaveLinks);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  public videoService = inject(VideoService);

  /** Tracks the currently open group dialog to allow seamless switching */
  private groupDialogRef: MatDialogRef<GroupDialog> | null = null;

  protected environment = environment;

  savedLinks$!: Observable<Shortcut[]>;
  activeVideo$ = this.videoService.activeVideo$;
  videos$ = this.videoService.videos$;
  isVideoMenuOpen = signal(false);
  iconColor = signal('#ffffff');

  videoPoster = computed(() => this.environment.poster);

  linksData: WritableSignal<Shortcut[]> = signal([]);

  @ViewChild('mainVideo') mainVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('mainImage') mainImage?: ElementRef<HTMLImageElement>;

  private animationFrameId?: number;
  private lastSampleTime = 0;
  private destroyed = false;
  private worker!: Worker;

  async ngOnInit(): Promise<void> {
    if (this.environment.isProd) {
      await this.storageService.retrieveSavedLinks();
      this.savedLinks$ = this.storageService.getSavedLinks();
    } else {
      this.savedLinks$ = new ReplaySubject<Shortcut[]>(1);
      this.loadDataForDev(this.savedLinks$);
    }
    this.savedLinks$
      .pipe(
        map((s) => s.sort((a, b) => a?.position - b?.position)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => {
          this.linksData.set(data);
        },
      });
  }

  loadDataForDev(data: any) {
    data.next(this.environment.dummyData);
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
    // Close any open group dialog
    this.groupDialogRef?.close();
    this.groupDialogRef = null;
  }

  private extractColorLoop = () => {
    // Stop loop if component has been destroyed (prevents race condition)
    if (this.destroyed) return;

    // Stop loop if no video exists
    if (!this.mainVideo?.nativeElement || !this.worker) {
      this.animationFrameId = requestAnimationFrame(this.extractColorLoop);
      return;
    }

    const video = this.mainVideo.nativeElement;

    // Only sample if the video is actually playing and has data
    if (video.readyState >= 2 && !video.paused && !video.ended) {
      const now = performance.now();

      // Throttle to roughly 2 times per second (every 500ms) for high performance
      if (now - this.lastSampleTime > 500) {
        this.lastSampleTime = now;
        this.extractColorFromSource(video);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.extractColorLoop);
  };

  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    // We do NOT want to cancel the frame loop entirely, otherwise
    // switching back to a video will leave the loop permanently stopped.
    this.extractColorFromSource(img);
  }

  private async extractColorFromSource(source: CanvasImageSource) {
    if (!this.worker) return;

    try {
      const imageBitmap = await createImageBitmap(source, {
        resizeWidth: 64,
        resizeHeight: 64,
        resizeQuality: 'low'
      });
      
      this.worker.postMessage({ imageBitmap }, [imageBitmap]);
    } catch (e) {
      // Ignore cross-origin errors or empty sources
    }
  }

  toggleVideoMenu() {
    this.isVideoMenuOpen.set(!this.isVideoMenuOpen());
  }

  async onVideoUploaded(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      try {
        await this.videoService.addVideo(file);
      } catch (err: any) {
        alert(err.message || 'Error uploading video');
      }
      input.value = ''; // Reset input
    }
  }

  async deleteVideo(id: string, event: Event) {
    event.stopPropagation();
    try {
      await this.videoService.removeVideo(id);
    } catch (err: any) {
      alert(err.message || 'Error deleting video');
    }
  }

  async selectVideo(id: string) {
    await this.videoService.setActiveVideo(id);
  }

  addShortcut() {
    this.dialog.open(ShortcutDialog, {
      hasBackdrop: true,
      maxWidth: '600px',
      width: '100%',
    });
  }

  editShortcut(value: Shortcut) {
    this.dialog.open(ShortcutDialog, {
      hasBackdrop: true,
      maxWidth: '600px',
      width: '100%',
      data: value,
    });
  }

  async removeShortcut(id: string) {
    await this.storageService.removeSavedLink(id);
  }

  addGroup() {
    this.dialog.open(GroupName, {
      hasBackdrop: true,
      maxWidth: '600px',
      width: '100%',
    });
  }

  openShortcutGroup(shortcut: Shortcut) {
    this.groupDialogRef = this.dialog.open(GroupDialog, {
      maxWidth: '70dvw',
      maxHeight: '70dvh',
      height: '100%',
      width: '100%',
      id: 'dialog-group-overlay',
      data: {
        shortcut: shortcut,
        allGroups: this.linksData().filter(l => l.type === 'Group')
      },
      hasBackdrop: true,
      panelClass: 'group-dialog-panel'
    });

    // Clean up the ref when dialog is closed
    this.groupDialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.groupDialogRef = null;
      });
  }

  async drop(event: CdkDragDrop<Shortcut[]>) {
    moveItemInArray(this.linksData(), event.previousIndex, event.currentIndex);
    this.linksData.update((value) =>
      value.map((data, index) => ({ ...data, position: index })),
    );
    await this.storageService.setShortcuts(this.linksData());
  }

  updateSettings(settings: Partial<VideoItem>) {
    this.videoService.updateActiveBackgroundSettings(settings);
  }

  onBrightnessChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.updateSettings({ brightness: parseInt(input.value, 10) });
  }

  onBlurChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.updateSettings({ blur: parseInt(input.value, 10) });
  }

  exportData() {
    const data = this.linksData();
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shortcuts-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private isValidShortcutData(data: any): boolean {
    if (!Array.isArray(data)) return false;

    for (const item of data) {
      if (!item || typeof item !== 'object') return false;
      if (typeof item.id !== 'string') return false;
      if (item.type !== 'Shortcut' && item.type !== 'Group') return false;
      if (typeof item.position !== 'number') return false;

      if (item.name !== null && typeof item.name !== 'string') return false;
      if (item.url !== null && typeof item.url !== 'string') return false;

      if (item.group !== null) {
        if (!Array.isArray(item.group)) return false;
        for (const g of item.group) {
          if (!g || typeof g !== 'object') return false;
          if (typeof g.id !== 'string') return false;
          if (typeof g.name !== 'string') return false;
          if (typeof g.url !== 'string') return false;
          if (typeof g.position !== 'number') return false;
        }
      }
    }
    return true;
  }

  async onImportData(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      if (file.type !== 'application/json' && !file.name.toLowerCase().endsWith('.json')) {
        alert('Invalid file type. Please upload a JSON file.');
        input.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const parsedData = JSON.parse(content);

          if (!this.isValidShortcutData(parsedData)) {
            throw new Error('Invalid data format. JSON does not match the required schema.');
          }

          await this.storageService.setShortcuts(parsedData as Shortcut[]);
          this.linksData.set(parsedData as Shortcut[]);
        } catch (error) {
          alert('Error importing data. Please ensure the file is a valid shortcuts export.');
          console.error('Import error:', error);
        } finally {
          input.value = ''; // Reset input
        }
      };
      reader.readAsText(file);
    }
  }
}
