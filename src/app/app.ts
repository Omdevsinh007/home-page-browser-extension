import {
  AfterViewInit,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoService, VideoItem } from './services/video.service';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
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
    ColorDecoder
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App implements OnInit, AfterViewInit {
  private storageService = inject(SaveLinks);
  private dialog = inject(MatDialog);
  public videoService = inject(VideoService);

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
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d', { willReadFrequently: true });

  async ngOnInit(): Promise<void> {
    if (this.environment.isProd) {
      await this.storageService.retrieveSavedLinks();
      this.savedLinks$ = this.storageService.getSavedLinks();
    } else {
      this.savedLinks$ = new ReplaySubject<Shortcut[]>(1);
      this.loadDataForDev(this.savedLinks$);
    }
    this.savedLinks$
      .pipe(map((s) => s.sort((a, b) => a?.position - b?.position)))
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
    // Start color extraction loop when view is initialized
    this.extractColorLoop();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private extractColorLoop = () => {
    // Stop loop if no video exists
    if (!this.mainVideo?.nativeElement || !this.ctx) {
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

  private extractColorFromSource(source: CanvasImageSource) {
    if (!this.ctx) return;

    // Downscale massively for maximum speed
    this.canvas.width = 64;
    this.canvas.height = 64;

    try {
      this.ctx.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
      const imageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      ).data;

      let r = 0,
        g = 0,
        b = 0;
      const step = 4 * 10; // Sample every 10th pixel for massive performance boost
      let samples = 0;

      for (let i = 0; i < imageData.length; i += step) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
        samples++;
      }

      if (samples > 0) {
        r = Math.floor(r / samples);
        g = Math.floor(g / samples);
        b = Math.floor(b / samples);

        document.documentElement.style.setProperty(
          '--theme-rgb',
          `${r}, ${g}, ${b}`,
        );
      }
    } catch (e) {
      // Ignore cross-origin canvas errors
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
    this.dialog.open(GroupDialog, {
      maxWidth: '70dvw',
      maxHeight: '70dvh',
      height: '100%',
      width: '100%',
      id: 'dialog-group-overlay',
      data: shortcut,
      disableClose: true,
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
}
