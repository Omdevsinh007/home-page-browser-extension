import { Injectable } from '@angular/core';

export interface StorageData<T> {
  version: number;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly CURRENT_VERSION = 1;

  async get<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      try {
        if (chrome?.storage?.local) {
          chrome.storage.local.get([key], (result) => {
            if (chrome.runtime.lastError) {
              console.error('Error getting storage:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              resolve(this.processData<T>(result[key]));
            }
          });
        } else {
          const result = localStorage.getItem(key);
          resolve(result ? this.processData<T>(JSON.parse(result)) : undefined);
        }
      } catch (error) {
        console.error('Exception in storage get:', error);
        resolve(undefined);
      }
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    const storageObj: StorageData<T> = {
      version: this.CURRENT_VERSION,
      data: value
    };

    return new Promise((resolve, reject) => {
      try {
        if (chrome?.storage?.local) {
          chrome.storage.local.set({ [key]: storageObj }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error setting storage:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        } else {
          localStorage.setItem(key, JSON.stringify(storageObj));
          resolve();
        }
      } catch (error) {
        console.error('Exception in storage set:', error);
        reject(error);
      }
    });
  }

  private processData<T>(rawResult: any): T | undefined {
    if (!rawResult) return undefined;

    // Check if the data is already wrapped in our versioned object
    if (rawResult.version !== undefined && rawResult.data !== undefined) {
      const storageData = rawResult as StorageData<T>;
      return this.migrateData(storageData);
    }

    // Legacy data fallback (prior to versioning)
    return rawResult as T;
  }

  private migrateData<T>(storageData: StorageData<T>): T {
    let currentData = storageData.data;
    let currentVersion = storageData.version;

    // Run migrations iteratively
    while (currentVersion < this.CURRENT_VERSION) {
      switch (currentVersion) {
        // Handle future migrations here
        // case 1: 
        //   currentData = migrateV1ToV2(currentData);
        //   currentVersion++;
        //   break;
        default:
          console.warn(`No migration path for version ${currentVersion}`);
          currentVersion = this.CURRENT_VERSION; 
          break;
      }
    }
    
    return currentData;
  }
}
