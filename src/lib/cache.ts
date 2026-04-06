//  MemoryCache — a lightweight in-memory TTL cache for Soroban contract reads.
//  Why cache? Stellar RPC calls are fast but repeated simulations add latency.
//  We cache campaign reads for a few seconds so the UI stays snappy while
//  still staying reasonably fresh.

export class MemoryCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();
  private ttl: number;

// @param ttl - Time-to-live in milliseconds (default: 5000)
  constructor(ttl = 5000) {
    this.ttl = ttl;
  }

// Retrieve a cached value, or null if missing/expired 
  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlOverride?: number): void {
    const ttl = ttlOverride ?? this.ttl;
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }

// Number of entries currently in cache
  size(): number {
    return this.store.size;
  }
}

// Create a deterministic cache key from path segments.
// Example: createCacheKey("campaign", "CXXX") → "campaign:CXXX"
export function createCacheKey(...segments: string[]): string {
  return segments.join(":");
}

// Default TTL values for each data type.
// Campaign data changes frequently, so shorter TTL.
// Donor data changes less, so longer TTL.
export const CACHE_TTL = {
  CAMPAIGN: 5_000,
  DONATION: 10_000,
  EVENTS: 8_000,
} as const;

export const campaignCache = new MemoryCache<unknown>(CACHE_TTL.CAMPAIGN);
export const donationCache = new MemoryCache<bigint>(CACHE_TTL.DONATION);
export const eventsCache = new MemoryCache<unknown[]>(CACHE_TTL.EVENTS);