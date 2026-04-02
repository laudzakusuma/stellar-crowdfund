"use client";

import { shortAddress, accountExplorerUrl } from "@/lib/stellar";

interface WalletConnectProps {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  errorMessage: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onClearError: () => void;
}

export function WalletConnect({
  address,
  isConnecting,
  error,
  errorMessage,
  onConnect,
  onDisconnect,
  onClearError,
}: WalletConnectProps) {
  return (
    <div className="wallet-section">
      {address ? (
        <div className="connected-state">
          <div className="connection-indicator">
            <span className="pulse-dot" />
            <span className="connected-label">Connected</span>
          </div>
          <div className="address-row">
            <a
              href={accountExplorerUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="address-link"
              title={address}
            >
              {shortAddress(address, 8)}
            </a>
            <button
              onClick={onDisconnect}
              className="disconnect-btn"
              title="Disconnect wallet"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="connect-btn"
        >
          {isConnecting ? (
            <>
              <span className="spinner" />
              Connecting…
            </>
          ) : (
            <>
              <span className="wallet-icon">◈</span>
              Connect Wallet
            </>
          )}
        </button>
      )}
      {error && errorMessage && (
        <div className={`error-banner error-${error.toLowerCase()}`}>
          <div className="error-content">
            <span className="error-text">{errorMessage}</span>
            {error === "WALLET_NOT_FOUND" && (
              <div className="wallet-links">
                <a
                  href="https://freighter.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="install-link"
                >
                  Install Freighter
                </a>
                <a
                  href="https://albedo.link"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="install-link"
                >
                  Install Albedo
                </a>
              </div>
            )}
          </div>
          <button onClick={onClearError} className="error-close">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}