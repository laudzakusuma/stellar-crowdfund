import * as StellarSdk from "@stellar/stellar-sdk";

export const NETWORK = StellarSdk.Networks.TESTNET;
export const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC || "https://soroban-testnet.stellar.org";
export const EXPLORER_URL = "https://stellar.expert/explorer/testnet";

export function getServer() {
  return new StellarSdk.rpc.Server(RPC_URL);
}

/** Format stroops to XLM string */
export function stroopsToXLM(stroops: bigint | number): string {
  const n = typeof stroops === "bigint" ? Number(stroops) : stroops;
  return (n / 10_000_000).toFixed(2);
}

/** Format XLM to stroops */
export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * 10_000_000));
}

/** Shorten a Stellar address */
export function shortAddress(address: string, chars = 6): string {
  if (!address || address.length < chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/** Get Stellar Explorer URL for a transaction */
export function txExplorerUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

/** Get Stellar Explorer URL for an account */
export function accountExplorerUrl(address: string): string {
  return `${EXPLORER_URL}/account/${address}`;
}

/** Get Stellar Explorer URL for a contract */
export function contractExplorerUrl(contractId: string): string {
  return `${EXPLORER_URL}/contract/${contractId}`;
}

/** Format deadline timestamp to readable date */
export function formatDeadline(timestamp: bigint | number): string {
  const ms = Number(timestamp) * 1000;
  const date = new Date(ms);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Days remaining from timestamp */
export function daysRemaining(deadline: bigint | number): number {
  const now = Date.now() / 1000;
  const remaining = Number(deadline) - now;
  return Math.max(0, Math.ceil(remaining / 86400));
}

/** Check if campaign is expired */
export function isExpired(deadline: bigint | number): boolean {
  return Number(deadline) < Date.now() / 1000;
}
