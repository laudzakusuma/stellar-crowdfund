import { describe, it, expect } from "vitest";
import { classifyWalletError, WALLET_ERROR_MESSAGES, WalletError } from "@/lib/walletErrors";

describe("classifyWalletError — Error Type 1: WALLET_NOT_FOUND", () => {
  it("classifies 'not found' message", () => {
    expect(classifyWalletError(new Error("Extension not found"))).toBe(
      "WALLET_NOT_FOUND"
    );
  });

  it("classifies 'not installed' message", () => {
    expect(classifyWalletError(new Error("Freighter not installed"))).toBe(
      "WALLET_NOT_FOUND"
    );
  });

  it("classifies error code -1 (Stellar WalletsKit convention)", () => {
    const err = { code: -1, message: "Unknown" };
    expect(classifyWalletError(err)).toBe("WALLET_NOT_FOUND");
  });

  it("classifies 'cannot read properties' (accessing undefined wallet obj)", () => {
    expect(
      classifyWalletError(
        new TypeError("Cannot read properties of undefined")
      )
    ).toBe("WALLET_NOT_FOUND");
  });
});

describe("classifyWalletError — Error Type 2: USER_REJECTED", () => {
  it("classifies 'rejected' message", () => {
    expect(classifyWalletError(new Error("User rejected the request"))).toBe(
      "USER_REJECTED"
    );
  });

  it("classifies 'denied' message", () => {
    expect(classifyWalletError(new Error("Transaction denied"))).toBe(
      "USER_REJECTED"
    );
  });

  it("classifies 'cancel' message", () => {
    expect(classifyWalletError(new Error("User cancelled"))).toBe(
      "USER_REJECTED"
    );
  });

  it("classifies EIP-style error code 4001", () => {
    const err = { code: 4001, message: "User denied" };
    expect(classifyWalletError(err)).toBe("USER_REJECTED");
  });

  it("classifies 'declined' message", () => {
    expect(classifyWalletError(new Error("Transaction declined by user"))).toBe(
      "USER_REJECTED"
    );
  });
});

describe("classifyWalletError — Error Type 3: INSUFFICIENT_BALANCE", () => {
  it("classifies 'insufficient' message", () => {
    expect(classifyWalletError(new Error("Insufficient balance"))).toBe(
      "INSUFFICIENT_BALANCE"
    );
  });

  it("classifies Stellar opcode 'op_underfunded'", () => {
    expect(classifyWalletError(new Error("op_underfunded"))).toBe(
      "INSUFFICIENT_BALANCE"
    );
  });

  it("classifies 'not enough' message", () => {
    expect(classifyWalletError(new Error("Not enough XLM to complete"))).toBe(
      "INSUFFICIENT_BALANCE"
    );
  });

  it("classifies 'tx_insufficient_balance'", () => {
    expect(
      classifyWalletError(new Error("tx_insufficient_balance"))
    ).toBe("INSUFFICIENT_BALANCE");
  });
});

describe("classifyWalletError — fallbacks", () => {
  it("classifies network errors as NETWORK_ERROR", () => {
    expect(classifyWalletError(new Error("Network timeout"))).toBe(
      "NETWORK_ERROR"
    );
  });

  it("classifies fetch failures as NETWORK_ERROR", () => {
    expect(classifyWalletError(new Error("Failed to fetch"))).toBe(
      "NETWORK_ERROR"
    );
  });

  it("returns UNKNOWN for unrecognized errors", () => {
    expect(classifyWalletError(new Error("Something weird happened"))).toBe(
      "UNKNOWN"
    );
  });

  it("handles null gracefully", () => {
    expect(classifyWalletError(null)).toBe("UNKNOWN");
  });

  it("handles undefined gracefully", () => {
    expect(classifyWalletError(undefined)).toBe("UNKNOWN");
  });

  it("handles plain string errors", () => {
    const result = classifyWalletError("user rejected");
    expect(result).toBe("USER_REJECTED");
  });
});

describe("WALLET_ERROR_MESSAGES", () => {
  const errorTypes: WalletError[] = [
    "WALLET_NOT_FOUND",
    "USER_REJECTED",
    "INSUFFICIENT_BALANCE",
    "NETWORK_ERROR",
    "UNKNOWN",
  ];

  errorTypes.forEach((type) => {
    it(`has a non-empty message for ${type}`, () => {
      expect(WALLET_ERROR_MESSAGES[type]).toBeTruthy();
      expect(typeof WALLET_ERROR_MESSAGES[type]).toBe("string");
      expect(WALLET_ERROR_MESSAGES[type].length).toBeGreaterThan(5);
    });
  });

  it("WALLET_NOT_FOUND message mentions wallet or install", () => {
    const msg = WALLET_ERROR_MESSAGES.WALLET_NOT_FOUND.toLowerCase();
    expect(msg.includes("wallet") || msg.includes("install")).toBe(true);
  });

  it("USER_REJECTED message mentions rejection or cancel", () => {
    const msg = WALLET_ERROR_MESSAGES.USER_REJECTED.toLowerCase();
    expect(
      msg.includes("reject") || msg.includes("cancel") || msg.includes("denied")
    ).toBe(true);
  });

  it("INSUFFICIENT_BALANCE message mentions balance or XLM", () => {
    const msg = WALLET_ERROR_MESSAGES.INSUFFICIENT_BALANCE.toLowerCase();
    expect(msg.includes("balance") || msg.includes("xlm")).toBe(true);
  });
});