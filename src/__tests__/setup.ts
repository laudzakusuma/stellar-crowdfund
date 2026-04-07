import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next/font/google", () => ({
  Space_Grotesk: () => ({ variable: "--font-body", className: "mock-font" }),
  Space_Mono: () => ({ variable: "--font-mono", className: "mock-font" }),
  Playfair_Display: () => ({ variable: "--font-display", className: "mock-font" }),
}));

vi.stubEnv("NEXT_PUBLIC_CONTRACT_ID", "CTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCD");
vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", "TESTNET");
vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC", "https://soroban-testnet.stellar.org");
vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  StellarWalletsKit: vi.fn().mockImplementation(() => ({
    openModal: vi.fn(),
    setWallet: vi.fn(),
    getAddress: vi.fn().mockResolvedValue({ address: "GTEST123...MOCK" }),
    signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: "MOCK_XDR" }),
  })),
  WalletNetwork: { TESTNET: "TESTNET", PUBLIC: "PUBLIC" },
  WalletType: { ALBEDO: "albedo", FREIGHTER: "freighter" },
  allowAllModules: vi.fn(() => []),
}));

vi.mock("@stellar/stellar-sdk", async () => {
  const actual = await vi.importActual<typeof import("@stellar/stellar-sdk")>(
    "@stellar/stellar-sdk"
  );
  return {
    ...actual,
    rpc: {
      ...((actual as any).rpc || {}),
      Server: vi.fn().mockImplementation(() => ({
        getAccount: vi.fn().mockResolvedValue({
          accountId: () => "GTEST",
          sequence: "100",
          incrementSequenceNumber: vi.fn(),
        }),
        simulateTransaction: vi.fn().mockResolvedValue({
          result: { retval: { _arm: "map", _value: [] } },
          minResourceFee: "100",
        }),
        sendTransaction: vi.fn().mockResolvedValue({
          status: "PENDING",
          hash: "MOCK_TX_HASH_ABCDEF",
        }),
        getTransaction: vi.fn().mockResolvedValue({ status: "SUCCESS" }),
        getLatestLedger: vi.fn().mockResolvedValue({ sequence: 5000 }),
        getEvents: vi.fn().mockResolvedValue({ events: [] }),
      })),
      Api: {
        isSimulationSuccess: vi.fn().mockReturnValue(true),
      },
      assembleTransaction: vi.fn().mockReturnValue({
        build: vi.fn().mockReturnValue({ toXDR: () => "MOCK_XDR" }),
      }),
    },
  };
});

global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
};