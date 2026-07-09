import { Injectable, inject } from '@angular/core';
import { Shortcut } from '../models/shortcut';
import { firstValueFrom, ReplaySubject } from 'rxjs';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class SaveLinks {
  private savedLinks$ = new ReplaySubject<Shortcut[]>(1);
  private storageKey = 'savedLinks';
  private storage = inject(StorageService);

  async retrieveSavedLinks() {
    const links = await this.storage.get<Shortcut[]>(this.storageKey) || [];
    this.savedLinks$.next(links);
  }

  async addSavedLink(value: Shortcut) {
    const currentLinks = await firstValueFrom(this.savedLinks$);
    const index = currentLinks.findIndex(shortcut => shortcut.id === value.id);
    let updatedLinks: Shortcut[] = index === -1 ? [...currentLinks, value] : currentLinks.map((link, i) => (i === index ? value : link));

    await this.storage.set(this.storageKey, updatedLinks);
    this.savedLinks$.next(updatedLinks);
  }

  getSavedLinks() {
    return this.savedLinks$.asObservable();
  }

  async removeSavedLink(id: string) {
    const currentLinks = await firstValueFrom(this.savedLinks$);
    const updatedLinks = currentLinks.filter(link => link.id !== id);

    await this.storage.set(this.storageKey, updatedLinks);
    this.savedLinks$.next(updatedLinks);
  }

  async clearAllLinks() {
    await this.storage.set(this.storageKey, []);
    this.savedLinks$.next([]);
  }

  async setShortcuts(data: Shortcut[]) {
    this.savedLinks$.next(data);
    await this.storage.set(this.storageKey, data);
  }
}
