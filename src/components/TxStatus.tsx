"use client";

import { TxStatus } from "@/hooks/useWallet";
import { txExplorerUrl } from "@/lib/stellar";

interface TxStatusProps {
  status: TxStatus;
  txHash: string | null;
  errorMessage: string | null;
  onDismiss: () => void;
}

export function TxStatusBanner({
  status,
  txHash,
  errorMessage,
  onDismiss,
}: TxStatusProps) {
  if (status === "idle") return null;

  return (
    <div className={`tx-status tx-status-${status}`}>
      <div className="tx-status-content">
        {status === "pending" && (
          <>
            <span className="spinner" />
            <div className="tx-text">
              <strong>Transaction Pending</strong>
              <span>Waiting for confirmation on Stellar testnet…</span>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <span className="tx-icon">✅</span>
            <div className="tx-text">
              <strong>Transaction Confirmed!</strong>
              {txHash && (
                <a
                  href={txExplorerUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-hash-link"
                >
                  View on Stellar Expert ↗
                </a>
              )}
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <span className="tx-icon">❌</span>
            <div className="tx-text">
              <strong>Transaction Failed</strong>
              <span>{errorMessage || "Please try again."}</span>
            </div>
          </>
        )}
      </div>

      {(status === "success" || status === "error") && (
        <button onClick={onDismiss} className="tx-dismiss">
          ✕
        </button>
      )}
    </div>
  );
}
