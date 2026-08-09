export type AreaReferenceStoreResult = "stored" | "capacity_exceeded" | "rate_limited";

export interface AreaReferenceStore {
  /** Returns null for missing or TTL-expired values. */
  get(key: string): Promise<string | null>;
  /**
   * Atomically enforces reference capacity and the anonymous-key rate limit,
   * then stores the serialized reference with the supplied TTL.
   */
  reserveAndSet(input: {
    key: string;
    value: string;
    ttlMs: number;
    expiresAt: number;
    capacity: number;
    anonymousKeyHash: string;
    rateLimit: { limit: number; windowMs: number };
  }): Promise<AreaReferenceStoreResult>;
}

type StoredValue = { readonly value: string; readonly expiresAt: number };
type RateWindow = { readonly count: number; readonly expiresAt: number };

/** Local/test adapter only. Production must inject a shared implementation. */
export class InMemoryAreaReferenceStore implements AreaReferenceStore {
  private readonly values = new Map<string, StoredValue>();
  private readonly rateWindows = new Map<string, RateWindow>();

  constructor(private readonly options: { now?: () => number } = {}) {}

  async get(key: string): Promise<string | null> {
    const value = this.values.get(key);
    if (!value) return null;
    if (value.expiresAt <= this.now()) {
      this.values.delete(key);
      return null;
    }
    return value.value;
  }

  async reserveAndSet(input: {
    key: string;
    value: string;
    ttlMs: number;
    expiresAt: number;
    capacity: number;
    anonymousKeyHash: string;
    rateLimit: { limit: number; windowMs: number };
  }): Promise<AreaReferenceStoreResult> {
    const now = this.now();
    this.prune(now);
    if (this.values.size >= input.capacity) return "capacity_exceeded";

    const rateKey = input.anonymousKeyHash;
    const current = this.rateWindows.get(rateKey);
    if (current && current.count >= input.rateLimit.limit) return "rate_limited";

    this.values.set(input.key, { value: input.value, expiresAt: input.expiresAt });
    this.rateWindows.set(rateKey, {
      count: (current?.count ?? 0) + 1,
      expiresAt: current?.expiresAt ?? now + input.rateLimit.windowMs,
    });
    return "stored";
  }

  private now(): number { return (this.options.now ?? Date.now)(); }

  private prune(now: number): void {
    for (const [key, value] of this.values) if (value.expiresAt <= now) this.values.delete(key);
    for (const [key, value] of this.rateWindows) if (value.expiresAt <= now) this.rateWindows.delete(key);
  }
}
