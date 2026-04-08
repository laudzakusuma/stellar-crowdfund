"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useContract } from "@/hooks/useContract";
import { WalletConnect } from "@/components/WalletConnect";
import { CampaignCard } from "@/components/CampaignCard";
import { DonateModal } from "@/components/DonateModal";
import { TxStatusBanner } from "@/components/TxStatus";
import { EventFeed } from "@/components/EventFeed";
import { CampaignSkeleton, EventFeedSkeleton, Spinner } from "@/components/LoadingStates";
import { contractExplorerUrl, txExplorerUrl, shortAddress } from "@/lib/stellar";

const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "CBCYFVAVRA3PSMY7TIAXQAWWYZX5MGM5OKGPJB33EHXY3POQ5K4674R4";

function Starfield() {
  return (
    <div className="starfield" aria-hidden="true">
      <div className="nebula" style={{ width: 600, height: 600, top: "-10%", left: "60%", background: "radial-gradient(#f59e0b, transparent 70%)" }} />
      <div className="nebula" style={{ width: 500, height: 500, top: "50%", left: "-10%", background: "radial-gradient(#6366f1, transparent 70%)" }} />
      <div className="nebula" style={{ width: 400, height: 400, top: "80%", left: "70%", background: "radial-gradient(#0ea5e9, transparent 70%)" }} />
      {Array.from({ length: 80 }).map((_, i) => {
        const size = Math.random() * 2.5 + 0.5;
        return (
          <div key={i} className="star" style={{ width: size, height: size, top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, "--duration": `${Math.random() * 4 + 2}s`, "--delay": `${Math.random() * 4}s` } as React.CSSProperties} />
        );
      })}
    </div>
  );
}

export default function Home() {
  const wallet = useWallet();
  const contract = useContract();
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (wallet.address) contract.fetchMyDonation(wallet.address);
  }, [wallet.address]);

  useEffect(() => {
    if (wallet.txStatus === "success") {
      setModalOpen(false);
      // Invalidate cache immediately so next fetch gets fresh data
      contract.invalidateCache(wallet.address || undefined);
      // Wait for ledger to close (~5s on testnet) then force refresh
      setTimeout(() => {
        contract.fetchCampaign(true);
        if (wallet.address) contract.fetchMyDonation(wallet.address);
        contract.fetchEvents();
        setLastRefresh(new Date());
      }, 5000);
    }
  }, [wallet.txStatus]);

  const handleDonate = useCallback(async (amountXLM: number) => {
    if (!wallet.address) return;
    try {
      const xdr = await contract.buildDonateXDR(wallet.address, amountXLM);
      await wallet.signAndSubmit(xdr);
    } catch {
      setModalOpen(false);
    }
  }, [wallet.address, wallet.signAndSubmit, contract.buildDonateXDR]);

  const isNotDefaultContract = CONTRACT_ID !== "CBCYFVAVRA3PSMY7TIAXQAWWYZX5MGM5OKGPJB33EHXY3POQ5K4674R4";
  const campaignExpired = contract.campaign && Number(contract.campaign.deadline) < Date.now() / 1000;

  return (
    <div className="page-wrapper">
      {mounted && <Starfield />}

      <header className="site-header">
        <div className="container">
          <div className="header-inner">
            <div className="logo">
              <span className="logo-star">✦</span>
              <span className="logo-text">Stellar Crowdfund</span>
              <span className="logo-badge">TESTNET</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {contract.isFetching && (
                <span title="Syncing with blockchain" style={{ opacity: 0.6 }}>
                  <Spinner size={12} />
                </span>
              )}
              <WalletConnect
                address={wallet.address}
                isConnecting={wallet.isConnecting}
                error={wallet.error}
                errorMessage={wallet.errorMessage}
                onConnect={wallet.connect}
                onDisconnect={wallet.disconnect}
                onClearError={wallet.clearError}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          <div className="content-stack">

            <section className="hero-banner">
              <p className="hero-eyebrow">Stellar Orange Belt · Level 3</p>
              <h1 className="hero-title">Fund What Matters</h1>
              <p className="hero-subtitle">
                Decentralized crowdfunding powered by Soroban smart contracts on the Stellar testnet. Transparent, trustless, on-chain.
              </p>
            </section>

            <TxStatusBanner
              status={wallet.txStatus}
              txHash={wallet.txHash}
              errorMessage={wallet.errorMessage}
              onDismiss={wallet.resetTxStatus}
            />

            {contract.loading ? (
              <CampaignSkeleton />
            ) : contract.error ? (
              <div className="card" style={{ borderColor: "rgba(248,113,113,0.2)" }}>
                <p style={{ color: "var(--error)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                  ⚠️ {contract.error}
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "0.5rem" }}>
                  Set <code style={{ color: "var(--gold)", fontFamily: "var(--font-mono)" }}>NEXT_PUBLIC_CONTRACT_ID</code> in your <code style={{ color: "var(--gold)", fontFamily: "var(--font-mono)" }}>.env.local</code> and run the deploy script.
                </p>
              </div>
            ) : contract.campaign ? (
              <CampaignCard campaign={contract.campaign} myDonation={contract.myDonation} />
            ) : null}

            <div className="card donate-section">
              {wallet.address ? (
                <button
                  className="donate-open-btn"
                  onClick={() => { wallet.resetTxStatus(); setModalOpen(true); }}
                  disabled={!contract.campaign || Boolean(campaignExpired) || Boolean(contract.campaign?.withdrawn) || wallet.txStatus === "pending"}
                >
                  {wallet.txStatus === "pending" ? (
                    <><span className="spinner spinner-dark" /> Processing…</>
                  ) : campaignExpired ? "Campaign Ended"
                    : contract.campaign?.withdrawn ? "Funds Withdrawn"
                    : "Donate Now"}
                </button>
              ) : (
                <>
                  <button className="donate-open-btn" onClick={wallet.connect}>
                    Connect Wallet to Donate
                  </button>
                  <p className="connect-prompt">Supports Freighter, Albedo, xBull, Lobstr, and more</p>
                </>
              )}
            </div>

            {contract.loading ? <EventFeedSkeleton /> : <EventFeed events={contract.events} />}

            <div className="info-section">
              <p className="info-title">Contract Details</p>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-key">Network</span>
                  <span className="info-val">Stellar Testnet</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Contract ID</span>
                  <span className="info-val">
                    {isNotDefaultContract ? (
                      <a href={contractExplorerUrl(CONTRACT_ID)} target="_blank" rel="noopener noreferrer">
                        {shortAddress(CONTRACT_ID, 8)}
                      </a>
                    ) : <span style={{ color: "var(--text-muted)" }}>Not configured</span>}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-key">Last Sync</span>
                  <span className="info-val">
                    {mounted ? lastRefresh.toLocaleTimeString() : "--:--:--"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-key">Cache TTL</span>
                  <span className="info-val">5s (campaign) / 8s (events)</span>
                </div>
                {wallet.txHash && (
                  <div className="info-row">
                    <span className="info-key">Last TX</span>
                    <span className="info-val">
                      <a href={txExplorerUrl(wallet.txHash)} target="_blank" rel="noopener noreferrer">
                        {shortAddress(wallet.txHash, 8)}
                      </a>
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-inner">
            <span className="footer-text">Stellar Crowdfund · Orange Belt · Built on Soroban</span>
            <div className="footer-links">
              <a href="https://developers.stellar.org" target="_blank" rel="noopener noreferrer">Stellar Docs</a>
              <a href="https://soroban.stellar.org" target="_blank" rel="noopener noreferrer">Soroban</a>
              <a href="https://github.com/your-username/stellar-crowdfund" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
          </div>
        </div>
      </footer>

      <DonateModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); wallet.resetTxStatus(); }}
        onDonate={handleDonate}
        isPending={wallet.txStatus === "pending"}
      />
    </div>
  );
}