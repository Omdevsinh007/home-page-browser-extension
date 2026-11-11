import { KeyValueStorage } from '../services/storage.service';

/** In-memory KeyValueStorage for tests. */
export class FakeStorage extends KeyValueStorage {
  data: Record<string, unknown> = {};
  setCalls: Record<string, unknown>[] = [];
  failNextSet = false;
  private listeners: ((keys: string[]) => void)[] = [];

  /** When set, getMany waits for this promise before reading (to simulate slow reads). */
  getGate: Promise<void> | null = null;

  holdGets(): () => void {
    let release!: () => void;
    this.getGate = new Promise((r) => (release = r));
    return () => {
      this.getGate = null;
      release();
    };
  }

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    const snapshot = structuredClone(this.data);
    if (this.getGate) await this.getGate;
    const out: Record<string, unknown> = {};
    for (const k of keys) if (k in snapshot) out[k] = snapshot[k];
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
