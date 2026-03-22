import { Injectable } from '@angular/core';
import { Shortcut } from '../models/shortcut';
import { firstValueFrom, ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SaveLinks {
  // Should be an array to store multiple links
  private savedLinks$ = new ReplaySubject<Shortcut[]>(1);
  private storage = 'savedLinks';

  private get<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome?.storage?.local) {
          console.warn('Chrome storage not available');
          resolve(undefined);
          return;
        }
        chrome.storage.local.get([key], result => {
          if (chrome.runtime.lastError) {
            console.error('Error getting storage:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(result[key]);
          }
        });
      } catch (error) {
        console.error('Exception in storage get:', error);
        resolve(undefined);
      }
    });
  }

  private set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome?.storage?.local) {
          console.error('Chrome storage not available');
          reject(new Error('Chrome storage not available'));
          return;
        }
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error setting storage:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.error('Exception in storage set:', error);
        reject(error);
      }
    });
  }

  async retrieveSavedLinks() {
    // Get array of links, default to empty array if none exist
    const links = await this.get<Shortcut[]>(this.storage) || [];
    this.savedLinks$.next(links);
  }

  async addSavedLink(value: Shortcut) {
    // Get current links and add the new one
    const currentLinks = await firstValueFrom(this.savedLinks$);
    const index = currentLinks.findIndex(shortcut => shortcut.id === value.id);
    let updatedLinks: Shortcut[] = index === -1 ? [...currentLinks, value] : currentLinks.map((link, i) => (i === index ? value : link));

    // Save updated array to storage
    await this.set(this.storage, updatedLinks);

    // Update the signal
    this.savedLinks$.next(updatedLinks);
  }

  getSavedLinks() {
    // Return the actual array, not wrapped in another array
    return this.savedLinks$.asObservable();
  }

  // Additional helpful methods you might want:

  async removeSavedLink(id: string) {
    const currentLinks = await firstValueFrom(this.savedLinks$);
    const updatedLinks = currentLinks.filter(link =>
      // Assuming Shortcut has an id property for comparison
      link.id !== id
    );

    await this.set(this.storage, updatedLinks);
    this.savedLinks$.next(updatedLinks);
  }

  async clearAllLinks() {
    await this.set(this.storage, []);
    this.savedLinks$.next([]);
  }

  async setShortcuts(data:Shortcut[]) {
    this.savedLinks$.next(data);
    await this.set(this.storage, data);
  }
}
