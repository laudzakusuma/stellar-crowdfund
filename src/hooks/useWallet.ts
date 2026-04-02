"use client";

import { useState, useCallback, useRef } from "react";

export type TxStatus = "idle" | "pending" | "success" | "error";

export type WalletError =
  | "WALLET_NOT_FOUND"
  | "USER_REJECTED"
  | "INSUFFICIENT_BALANCE"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface WalletState {
  address: string | null;
  isConnecting: boolean;
  error: WalletError | null;
  errorMessage: string | null;
  txStatus: TxStatus;
  txHash: string | null;
}

const WALLET_ERROR_MESSAGES: Record<WalletError, string> = {
  WALLET_NOT_FOUND:
    "🔌 Wallet extension not found. Please install Freighter, Albedo, or xBull.",
  USER_REJECTED: "Transaction was rejected by the user.",
  INSUFFICIENT_BALANCE: "Insufficient XLM balance to complete this transaction.",
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
  UNKNOWN: "An unexpected error occurred. Please try again.",
};

// Classifies raw errors into our 3 primary error types:
// 1. WALLET_NOT_FOUND — extension missing or not installed
// 2. USER_REJECTED    — user clicked reject/cancel in wallet popup
// 3. INSUFFICIENT_BALANCE — not enough XLM for tx + fees

function classifyError(err: unknown): { type: WalletError; message: string } {
  if (!err) return { type: "UNKNOWN", message: "Unknown error" };

  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : String(err).toLowerCase();

  if (
    msg.includes("not found") ||
    msg.includes("not installed") ||
    msg.includes("no wallet") ||
    msg.includes("undefined") ||
    msg.includes("cannot read") ||
    msg.includes("extension") ||
    (err as any)?.code === -1 ||
    (err as any)?.code === -32603
  ) {
    return {
      type: "WALLET_NOT_FOUND",
      message: WALLET_ERROR_MESSAGES.WALLET_NOT_FOUND,
    };
  }

  if (
    msg.includes("reject") ||
    msg.includes("denied") ||
    msg.includes("declined") ||
    msg.includes("cancel") ||
    msg.includes("user abort") ||
    (err as any)?.code === 4001
  ) {
    return {
      type: "USER_REJECTED",
      message: WALLET_ERROR_MESSAGES.USER_REJECTED,
    };
  }

  if (
    msg.includes("insufficient") ||
    msg.includes("balance") ||
    msg.includes("not enough") ||
    msg.includes("op_underfunded") ||
    msg.includes("tx_insufficient_balance")
  ) {
    return {
      type: "INSUFFICIENT_BALANCE",
      message: WALLET_ERROR_MESSAGES.INSUFFICIENT_BALANCE,
    };
  }

  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("connection")
  ) {
    return {
      type: "NETWORK_ERROR",
      message: WALLET_ERROR_MESSAGES.NETWORK_ERROR,
    };
  }

  return { type: "UNKNOWN", message: WALLET_ERROR_MESSAGES.UNKNOWN };
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnecting: false,
    error: null,
    errorMessage: null,
    txStatus: "idle",
    txHash: null,
  });

  const kitRef = useRef<any>(null);

  const getKit = useCallback(async () => {
    if (kitRef.current) return kitRef.current;

    const { StellarWalletsKit, WalletNetwork, allowAllModules } = await import(
      "@creit.tech/stellar-wallets-kit"
    );

    kitRef.current = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: "freighter",
      modules: allowAllModules(),
    });

    return kitRef.current;
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null, errorMessage: null }));
  }, []);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true, error: null, errorMessage: null }));

    try {
      const kit = await getKit();

      await kit.openModal({
        onWalletSelected: async (option: any) => {
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            setState((s) => ({
              ...s,
              address,
              isConnecting: false,
              error: null,
              errorMessage: null,
            }));
          } catch (err) {
            const { type, message } = classifyError(err);
            setState((s) => ({
              ...s,
              isConnecting: false,
              error: type,
              errorMessage: message,
            }));
          }
        },
        onClosed: () => {
          setState((s) => ({ ...s, isConnecting: false }));
        },
      });
    } catch (err) {
      const { type, message } = classifyError(err);
      setState((s) => ({
        ...s,
        isConnecting: false,
        error: type,
        errorMessage: message,
      }));
    }
  }, [getKit]);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      isConnecting: false,
      error: null,
      errorMessage: null,
      txStatus: "idle",
      txHash: null,
    });
    kitRef.current = null;
  }, []);

  const signAndSubmit = useCallback(
    async (xdr: string): Promise<string | null> => {
      if (!state.address) {
        setState((s) => ({
          ...s,
          error: "WALLET_NOT_FOUND",
          errorMessage: WALLET_ERROR_MESSAGES.WALLET_NOT_FOUND,
        }));
        return null;
      }

      setState((s) => ({
        ...s,
        txStatus: "pending",
        error: null,
        errorMessage: null,
        txHash: null,
      }));

      try {
        const kit = await getKit();
        const { WalletNetwork } = await import("@creit.tech/stellar-wallets-kit");

        let signedTxXdr: string;
        try {
          const result = await kit.signTransaction(xdr, {
            network: WalletNetwork.TESTNET,
            networkPassphrase: "Test SDF Network ; September 2015",
            address: state.address,
          });
          signedTxXdr = result.signedTxXdr;
        } catch (err) {
          const { type, message } = classifyError(err);
          setState((s) => ({
            ...s,
            txStatus: "error",
            error: type,
            errorMessage: message,
          }));
          return null;
        }

        const { rpc, TransactionBuilder, Networks } = await import(
          "@stellar/stellar-sdk"
        );

        const server = new rpc.Server(
          process.env.NEXT_PUBLIC_SOROBAN_RPC ||
            "https://soroban-testnet.stellar.org"
        );

        const tx = TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET);
        const result = await server.sendTransaction(tx);

        if (result.status === "ERROR") {
          const resultMeta = result.errorResult?.result()?.toXDR("base64") || "";
          const isBalanceErr =
            resultMeta.includes("op_underfunded") ||
            resultMeta.includes("insufficient");

          setState((s) => ({
            ...s,
            txStatus: "error",
            error: isBalanceErr ? "INSUFFICIENT_BALANCE" : "UNKNOWN",
            errorMessage: isBalanceErr
              ? WALLET_ERROR_MESSAGES.INSUFFICIENT_BALANCE
              : WALLET_ERROR_MESSAGES.UNKNOWN,
          }));
          return null;
        }

        const hash = result.hash;
        let attempts = 0;

        while (attempts < 15) {
          await new Promise((r) => setTimeout(r, 2000));
          const status = await server.getTransaction(hash);

          if (status.status === "SUCCESS") {
            setState((s) => ({
              ...s,
              txStatus: "success",
              txHash: hash,
            }));
            return hash;
          }

          if (status.status === "FAILED") {
            setState((s) => ({
              ...s,
              txStatus: "error",
              error: "UNKNOWN",
              errorMessage: "Transaction failed on-chain.",
            }));
            return null;
          }

          attempts++;
        }

        setState((s) => ({
          ...s,
          txStatus: "error",
          error: "NETWORK_ERROR",
          errorMessage: "Transaction confirmation timed out.",
        }));
        return null;
      } catch (err) {
        const { type, message } = classifyError(err);
        setState((s) => ({
          ...s,
          txStatus: "error",
          error: type,
          errorMessage: message,
        }));
        return null;
      }
    },
    [state.address, getKit]
  );

  const resetTxStatus = useCallback(() => {
    setState((s) => ({ ...s, txStatus: "idle", txHash: null }));
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    signAndSubmit,
    clearError,
    resetTxStatus,
    errorMessages: WALLET_ERROR_MESSAGES,
  };
}