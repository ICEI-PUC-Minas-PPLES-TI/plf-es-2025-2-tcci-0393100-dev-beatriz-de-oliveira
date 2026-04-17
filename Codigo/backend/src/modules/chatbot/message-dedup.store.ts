interface DedupEntry {
  status: "processing" | "done";
  updatedAt: number;
}

export class MessageDedupStore {
  private readonly entries = new Map<string, DedupEntry>();

  constructor(
    private readonly config: {
      maxSize?: number;
      ttlMs?: number;
    } = {},
  ) {}

  private get maxSize() {
    return this.config.maxSize ?? 10_000;
  }

  private get ttlMs() {
    return this.config.ttlMs ?? 30 * 60 * 1000;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (now - entry.updatedAt > this.ttlMs) {
        this.entries.delete(key);
      }
    }

    if (this.entries.size <= this.maxSize) {
      return;
    }

    const ordered = Array.from(this.entries.entries()).sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    const removeCount = this.entries.size - this.maxSize;
    for (let index = 0; index < removeCount; index += 1) {
      const key = ordered[index]?.[0];
      if (key) {
        this.entries.delete(key);
      }
    }
  }

  tryBegin(messageId: string): boolean {
    this.cleanup();
    const current = this.entries.get(messageId);
    if (current) {
      return false;
    }
    this.entries.set(messageId, { status: "processing", updatedAt: Date.now() });
    return true;
  }

  markDone(messageId: string): void {
    if (!this.entries.has(messageId)) {
      return;
    }
    this.entries.set(messageId, { status: "done", updatedAt: Date.now() });
  }

  markFailed(messageId: string): void {
    this.entries.delete(messageId);
  }
}

