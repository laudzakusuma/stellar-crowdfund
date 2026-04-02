"use client";

import { Campaign } from "@/hooks/useContract";
import {
  stroopsToXLM,
  formatDeadline,
  daysRemaining,
  isExpired,
  contractExplorerUrl,
} from "@/lib/stellar";

const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";

interface CampaignCardProps {
  campaign: Campaign;
  myDonation: bigint;
}

export function CampaignCard({ campaign, myDonation }: CampaignCardProps) {
  const progressPct = campaign.goal > 0n
    ? Math.min(100, Number((campaign.raised * 100n) / campaign.goal))
    : 0;

  const expired = isExpired(campaign.deadline);
  const days = daysRemaining(campaign.deadline);
  const goalReached = campaign.raised >= campaign.goal;

  return (
    <div className="campaign-card">
      {/* Status Badge */}
      <div className="campaign-status-row">
        {goalReached ? (
          <span className="badge badge-success">🎯 Goal Reached!</span>
        ) : expired ? (
          <span className="badge badge-expired">⌛ Ended</span>
        ) : (
          <span className="badge badge-active">🟢 Active</span>
        )}
        {CONTRACT_ID && CONTRACT_ID !== "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" && (
          <a
            href={contractExplorerUrl(CONTRACT_ID)}
            target="_blank"
            rel="noopener noreferrer"
            className="contract-link"
          >
            View Contract ↗
          </a>
        )}
      </div>

      {/* Title */}
      <h2 className="campaign-title">{campaign.title}</h2>
      {campaign.description && (
        <p className="campaign-description">{campaign.description}</p>
      )}

      {/* Progress */}
      <div className="progress-section">
        <div className="progress-labels">
          <span className="raised-label">
            <span className="raised-amount">{stroopsToXLM(campaign.raised)}</span>
            <span className="raised-unit"> XLM raised</span>
          </span>
          <span className="goal-label">
            Goal: <strong>{stroopsToXLM(campaign.goal)} XLM</strong>
          </span>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progressPct}%` }}
            data-pct={progressPct}
          />
          <div
            className="progress-glow"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="progress-footer">
          <span className="pct-label">{progressPct.toFixed(1)}%</span>
          <span className="donors-label">
            👥 {campaign.donor_count} donors
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-value">
            {expired ? "Ended" : `${days}d left`}
          </span>
          <span className="stat-label">
            {expired ? formatDeadline(campaign.deadline) : "Deadline"}
          </span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{stroopsToXLM(campaign.raised)}</span>
          <span className="stat-label">XLM Raised</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{campaign.donor_count}</span>
          <span className="stat-label">Backers</span>
        </div>
      </div>

      {/* My Donation */}
      {myDonation > 0n && (
        <div className="my-donation-banner">
          ⭐ You donated <strong>{stroopsToXLM(myDonation)} XLM</strong> to this campaign
        </div>
      )}
    </div>
  );
}
