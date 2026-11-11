import { KeyValueStorage } from '../services/storage.service';

/** In-memory KeyValueStorage for tests. */
export class FakeStorage extends KeyValueStorage {
  data: Record<string, unknown> = {};
  setCalls: Record<string, unknown>[] = [];
  failNextSet = false;
  private listeners: ((keys: string[]) => void)[] = [];

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (k in this.data) out[k] = structuredClone(this.data[k]);
    return out;
  }

  async setMany(values: Record<string, unknown>): Promise<void> {
    if (this.failNextSet) {
      this.failNextSet = false;
      throw new Error('QUOTA_BYTES quota exceeded');
    }
    this.setCalls.push(structuredClone(values));
    Object.assign(this.data, structuredClone(values));
  }

  onChange(cb: (keys: string[]) => void): () => void {
    this.listeners.push(cb);
    return () => (this.listeners = this.listeners.filter((l) => l !== cb));
  }

  emitChange(keys: string[]): void {
    this.listeners.forEach((l) => l(keys));
  }
}
