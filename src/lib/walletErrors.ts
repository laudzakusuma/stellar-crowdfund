export type WalletError =
  | "WALLET_NOT_FOUND"      // Extension missing / not installed
  | "USER_REJECTED"         // User clicked reject in wallet popup
  | "INSUFFICIENT_BALANCE"  // Not enough XLM for tx + fees
  | "NETWORK_ERROR"         // RPC / connectivity issue
  | "UNKNOWN";              // Anything else

export const WALLET_ERROR_MESSAGES: Record<WalletError, string> = {
  WALLET_NOT_FOUND:
    "Wallet extension not found. Please install Freighter, Albedo, or xBull.",
  USER_REJECTED:
    "Transaction was rejected or cancelled by the user.",
  INSUFFICIENT_BALANCE:
    "Insufficient XLM balance to complete this transaction.",
  NETWORK_ERROR:
    "Network error. Please check your connection and try again.",
  UNKNOWN:
    "An unexpected error occurred. Please try again.",
};

//  Classify any thrown value into one of our typed WalletError codes.
//  Rules (checked in order):
//  1. WALLET_NOT_FOUND  — "not found", "not installed", code=-1, TypeError on undefined
//  2. USER_REJECTED     — "reject", "denied", "cancel", "declined", code=4001
//  3. INSUFFICIENT_BALANCE — "insufficient", "op_underfunded", "not enough"
//  4. NETWORK_ERROR     — "network", "fetch", "timeout", "connection"
//  5. UNKNOWN           — everything else

export function classifyWalletError(err: unknown): WalletError {
  if (!err) return "UNKNOWN";

  // Normalise to lowercase string for matching
  let msg = "";
  if (err instanceof Error) {
    msg = err.message.toLowerCase();
  } else if (typeof err === "string") {
    msg = err.toLowerCase();
  } else if (typeof err === "object") {
    msg = String((err as any).message ?? "").toLowerCase();
  }

  const code = (err as any)?.code;

  if (
    msg.includes("not found") ||
    msg.includes("not installed") ||
    msg.includes("no wallet") ||
    msg.includes("cannot read properties of undefined") ||
    msg.includes("cannot read") ||
    code === -1 ||
    code === -32603
  ) {
    return "WALLET_NOT_FOUND";
  }

  if (
    msg.includes("reject") ||
    msg.includes("denied") ||
    msg.includes("declined") ||
    msg.includes("cancel") ||
    msg.includes("user abort") ||
    code === 4001
  ) {
    return "USER_REJECTED";
  }

  if (
    msg.includes("insufficient") ||
    msg.includes("op_underfunded") ||
    msg.includes("not enough") ||
    msg.includes("tx_insufficient_balance") ||
    msg.includes("balance")
  ) {
    return "INSUFFICIENT_BALANCE";
  }

  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("connection")
  ) {
    return "NETWORK_ERROR";
  }

  return "UNKNOWN";
}