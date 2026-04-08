import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface VideoItem {
  id: string;
  name: string;
  dataUrl: string;
  type: 'video' | 'image';
  isActive: boolean;
  objectFit?: 'cover' | 'contain' | 'fill';
  brightness?: number; // 0 to 200, 100 being normal
  blur?: number; // 0 to 20, 0 being no blur
}

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private videosSubject = new BehaviorSubject<VideoItem[]>([]);
  videos$ = this.videosSubject.asObservable();

  private activeVideoSubject = new BehaviorSubject<VideoItem | null>(null);
  activeVideo$ = this.activeVideoSubject.asObservable();

  private defaultVideoUrl = 'assets/default-video.mp4'; // Fallback if no video exists

  constructor() {
    this.initVideos();
  }

  private async initVideos() {
    let storedVideos: VideoItem[] = [];
    if (environment.isProd) {
      storedVideos = await this.getFromChromeStorage();
    } else {
      storedVideos = this.getFromLocalStorage();
    }

    if (storedVideos.length > 0) {
      const active = storedVideos.find(v => v.isActive) || storedVideos[0];
      if (active && !active.isActive) {
        this.updateActiveStatus(storedVideos, active.id);
      }
      this.activeVideoSubject.next(active || null);
    }

    this.videosSubject.next(storedVideos);
  }

  async addVideo(file: File): Promise<void> {
    const currentVideos = this.videosSubject.value;
    if (currentVideos.length >= 3) {
      throw new Error('Maximum limit of 3 backgrounds reached. Please delete one first.');
    }

    const dataUrl = await this.fileToDataUrl(file);
    const mediaType = file.type.startsWith('image/') ? 'image' : 'video';

    const newVideo: VideoItem = {
      id: Date.now().toString(),
      name: file.name,
      dataUrl,
      type: mediaType,
      isActive: currentVideos.length === 0,
      objectFit: 'cover',
      brightness: 100,
      blur: 0
    };

    const updatedVideos = [...currentVideos, newVideo];
    await this.saveVideos(updatedVideos);
  }

  async removeVideo(id: string): Promise<void> {
    const currentVideos = this.videosSubject.value;
    if (currentVideos.length <= 1) {
      throw new Error('At least one video must remain.');
    }

    const updatedVideos = currentVideos.filter(v => v.id !== id);

    // If we deleted the active video, set another one as active
    const deletedVideo = currentVideos.find(v => v.id === id);
    if (deletedVideo?.isActive && updatedVideos.length > 0) {
      this.updateActiveStatus(updatedVideos, updatedVideos[0].id);
    }

    await this.saveVideos(updatedVideos);
  }

  async setActiveVideo(id: string): Promise<void> {
    const currentVideos = [...this.videosSubject.value];
    this.updateActiveStatus(currentVideos, id);
    await this.saveVideos(currentVideos);
  }

  async updateActiveBackgroundSettings(settings: Partial<VideoItem>): Promise<void> {
    const currentVideos = [...this.videosSubject.value];
    const activeVideoIndex = currentVideos.findIndex(v => v.isActive);

    if (activeVideoIndex !== -1) {
      currentVideos[activeVideoIndex] = {
        ...currentVideos[activeVideoIndex],
        ...settings
      };
      // Propagate the change to the active video subject
      this.activeVideoSubject.next(currentVideos[activeVideoIndex]);
      await this.saveVideos(currentVideos);
    }
  }

  private updateActiveStatus(videos: VideoItem[], activeId: string) {
    videos.forEach(v => v.isActive = (v.id === activeId));
    const activeInfo = videos.find(v => v.id === activeId);
    if (activeInfo) {
      this.activeVideoSubject.next(activeInfo);
    }
  }

  private async saveVideos(videos: VideoItem[]): Promise<void> {
    if (environment.isProd) {
      await this.saveToChromeStorage(videos);
    } else {
      this.saveToLocalStorage(videos);
    }
    this.videosSubject.next(videos);
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // --- Storage Wrappers ---

  private getFromLocalStorage(): VideoItem[] {
    const data = localStorage.getItem('backgroundVideos');
    return data ? JSON.parse(data) : [];
  }

  private saveToLocalStorage(videos: VideoItem[]): void {
    try {
        localStorage.setItem('backgroundVideos', JSON.stringify(videos));
    } catch (e) {
        console.error('Failed to save to localStorage. The file might be too large.', e);
        throw new Error('Failed to save video: File too large for local dev storage.');
    }
  }

  private getFromChromeStorage(): Promise<VideoItem[]> {
    return new Promise((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.get(['backgroundVideos'], (result) => {
          resolve(result['backgroundVideos'] || []);
        });
      } else {
        resolve([]);
      }
    });
  }

  private saveToChromeStorage(videos: VideoItem[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ backgroundVideos: videos }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error saving to chrome storage', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('Chrome storage not available'));
      }
    });
  }
}
