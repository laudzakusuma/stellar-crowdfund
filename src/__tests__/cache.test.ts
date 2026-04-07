import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryCache, createCacheKey, CACHE_TTL } from "@/lib/cache";

describe("MemoryCache", () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    cache = new MemoryCache<string>(5000); // 5s TTL
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves a value", () => {
    cache.set("key1", "hello");
    expect(cache.get("key1")).toBe("hello");
  });

  it("returns null for missing keys", () => {
    expect(cache.get("missing")).toBeNull();
  });

  it("returns null after TTL expires", () => {
    cache.set("key2", "world");
    expect(cache.get("key2")).toBe("world");

    vi.advanceTimersByTime(6000);
    expect(cache.get("key2")).toBeNull();
  });

  it("does NOT expire before TTL", () => {
    cache.set("key3", "fresh");
    vi.advanceTimersByTime(4000);
    expect(cache.get("key3")).toBe("fresh");
  });

  it("overwrites existing key with new value", () => {
    cache.set("key4", "old");
    cache.set("key4", "new");
    expect(cache.get("key4")).toBe("new");
  });

  it("deletes a specific key", () => {
    cache.set("key5", "deleteme");
    cache.delete("key5");
    expect(cache.get("key5")).toBeNull();
  });

  it("clears all keys", () => {
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.clear();
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
    expect(cache.get("c")).toBeNull();
  });

  it("reports correct size", () => {
    expect(cache.size()).toBe(0);
    cache.set("x", "1");
    cache.set("y", "2");
    expect(cache.size()).toBe(2);
  });

  it("has() returns true for existing non-expired key", () => {
    cache.set("exists", "yes");
    expect(cache.has("exists")).toBe(true);
  });

  it("has() returns false for expired key", () => {
    cache.set("expiring", "soon");
    vi.advanceTimersByTime(6000);
    expect(cache.has("expiring")).toBe(false);
  });

  it("has() returns false for missing key", () => {
    expect(cache.has("nope")).toBe(false);
  });

  it("resets TTL on update", () => {
    cache.set("ttl-reset", "initial");
    vi.advanceTimersByTime(4000);
    cache.set("ttl-reset", "updated");
    vi.advanceTimersByTime(3000);
    expect(cache.get("ttl-reset")).toBe("updated");
  });
});

describe("createCacheKey", () => {
  it("creates a key from a single segment", () => {
    expect(createCacheKey("campaign")).toBe("campaign");
  });

  it("creates a key from multiple segments", () => {
    expect(createCacheKey("campaign", "CONTRACT123")).toBe(
      "campaign:CONTRACT123"
    );
  });

  it("creates a key from three segments", () => {
    expect(createCacheKey("donor", "CONTRACT123", "GADDR456")).toBe(
      "donor:CONTRACT123:GADDR456"
    );
  });

  it("produces different keys for different inputs", () => {
    const k1 = createCacheKey("campaign", "C1");
    const k2 = createCacheKey("campaign", "C2");
    expect(k1).not.toBe(k2);
  });

  it("is case-sensitive", () => {
    expect(createCacheKey("CAMPAIGN")).not.toBe(createCacheKey("campaign"));
  });
});

describe("CACHE_TTL", () => {
  it("CAMPAIGN is at least 3 seconds", () => {
    expect(CACHE_TTL.CAMPAIGN).toBeGreaterThanOrEqual(3000);
  });

  it("DONATION is at least 5 seconds", () => {
    expect(CACHE_TTL.DONATION).toBeGreaterThanOrEqual(5000);
  });

  it("EVENTS is at least 5 seconds", () => {
    expect(CACHE_TTL.EVENTS).toBeGreaterThanOrEqual(5000);
  });

  it("CAMPAIGN TTL is shorter than DONATION TTL (campaign updates faster)", () => {
    expect(CACHE_TTL.CAMPAIGN).toBeLessThanOrEqual(CACHE_TTL.DONATION);
  });
});