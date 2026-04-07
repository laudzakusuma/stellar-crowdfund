import { describe, it, expect } from "vitest";
import {
  stroopsToXLM,
  xlmToStroops,
  shortAddress,
  formatDeadline,
  daysRemaining,
  isExpired,
  txExplorerUrl,
  accountExplorerUrl,
  contractExplorerUrl,
} from "@/lib/stellar";

describe("stroopsToXLM", () => {
  it("converts 10_000_000 stroops to '1.00' XLM", () => {
    expect(stroopsToXLM(10_000_000n)).toBe("1.00");
  });

  it("converts 0 stroops to '0.00'", () => {
    expect(stroopsToXLM(0n)).toBe("0.00");
  });

  it("converts 1_000_000_000 stroops to '100.00' XLM", () => {
    expect(stroopsToXLM(1_000_000_000n)).toBe("100.00");
  });

  it("rounds to 2 decimal places", () => {
    expect(stroopsToXLM(10_000_001n)).toBe("1.00");
  });

  it("handles number input as well as bigint", () => {
    expect(stroopsToXLM(500_000_000)).toBe("50.00");
  });

  it("handles 500 XLM worth of stroops", () => {
    expect(stroopsToXLM(5_000_000_000n)).toBe("500.00");
  });
});

describe("xlmToStroops", () => {
  it("converts 1 XLM to 10_000_000 stroops", () => {
    expect(xlmToStroops(1)).toBe(10_000_000n);
  });

  it("converts 100 XLM to 1_000_000_000 stroops", () => {
    expect(xlmToStroops(100)).toBe(1_000_000_000n);
  });

  it("converts 0 XLM to 0 stroops", () => {
    expect(xlmToStroops(0)).toBe(0n);
  });

  it("handles fractional XLM amounts (0.5 XLM)", () => {
    expect(xlmToStroops(0.5)).toBe(5_000_000n);
  });

  it("round-trips correctly with stroopsToXLM", () => {
    const xlmAmount = 42;
    const stroops = xlmToStroops(xlmAmount);
    expect(stroopsToXLM(stroops)).toBe("42.00");
  });
});

describe("shortAddress", () => {
  const fullAddress = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

  it("truncates a full Stellar address with default chars=6", () => {
    const result = shortAddress(fullAddress);
    // default chars=6: first 6 + "..." + last 6
    expect(result).toBe("GAAZI4...KOCCWN");
    expect(result).toContain("...");
    expect(result.length).toBeLessThan(fullAddress.length);
  });

  it("shows first and last N chars", () => {
    const result = shortAddress(fullAddress, 4);
    expect(result.startsWith("GAAZ")).toBe(true);
    expect(result.endsWith("CCWN")).toBe(true);
  });

  it("returns the original if address is too short", () => {
    const short = "GAAZI4";
    expect(shortAddress(short, 6)).toBe(short);
  });

  it("handles empty string gracefully", () => {
    expect(shortAddress("")).toBe("");
  });
});

describe("isExpired", () => {
  it("returns true for a past timestamp", () => {
    const past = Math.floor(Date.now() / 1000) - 86400; // yesterday
    expect(isExpired(past)).toBe(true);
  });

  it("returns false for a future timestamp", () => {
    const future = Math.floor(Date.now() / 1000) + 86400; // tomorrow
    expect(isExpired(future)).toBe(false);
  });

  it("handles bigint timestamps", () => {
    const future = BigInt(Math.floor(Date.now() / 1000) + 3600);
    expect(isExpired(future)).toBe(false);
  });
});

describe("daysRemaining", () => {
  it("returns 0 for expired campaigns", () => {
    const past = Math.floor(Date.now() / 1000) - 86400;
    expect(daysRemaining(past)).toBe(0);
  });

  it("returns approximately 1 for deadline in 24 hours", () => {
    const tomorrow = Math.floor(Date.now() / 1000) + 86400;
    expect(daysRemaining(tomorrow)).toBe(1);
  });

  it("returns approximately 30 for deadline in 30 days", () => {
    const thirtyDays = Math.floor(Date.now() / 1000) + 30 * 86400;
    const days = daysRemaining(thirtyDays);
    expect(days).toBeGreaterThanOrEqual(29);
    expect(days).toBeLessThanOrEqual(31);
  });

  it("never returns negative values", () => {
    const longPast = Math.floor(Date.now() / 1000) - 365 * 86400;
    expect(daysRemaining(longPast)).toBe(0);
  });
});

describe("Explorer URL generators", () => {
  it("txExplorerUrl generates correct Stellar Expert URL", () => {
    const hash = "ABCDEF1234567890";
    const url = txExplorerUrl(hash);
    expect(url).toBe(
      `https://stellar.expert/explorer/testnet/tx/${hash}`
    );
  });

  it("accountExplorerUrl generates correct account URL", () => {
    const addr = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
    const url = accountExplorerUrl(addr);
    expect(url).toContain("/account/");
    expect(url).toContain(addr);
  });

  it("contractExplorerUrl generates correct contract URL", () => {
    const id = "CTEST1234567890";
    const url = contractExplorerUrl(id);
    expect(url).toContain("/contract/");
    expect(url).toContain(id);
  });
});

describe("formatDeadline", () => {
  it("returns a non-empty string for a valid timestamp", () => {
    const ts = Math.floor(Date.now() / 1000) + 86400;
    const result = formatDeadline(ts);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles bigint timestamps", () => {
    const ts = BigInt(Math.floor(Date.now() / 1000) + 86400);
    const result = formatDeadline(ts);
    expect(result).toBeTruthy();
  });
});