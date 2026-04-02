"use client";

import { Campaign } from "@/hooks/useContract";
import {
  stroopsToXLM,
  formatDeadline,
  contractExplorerUrl,
} from "@/lib/stellar";
import { useEffect, useState } from "react";

const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";

interface CampaignCardProps {
  campaign: Campaign;
  myDonation: bigint;
}

export function CampaignCard({ campaign, myDonation }: CampaignCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [status, setStatus] = useState<"active" | "goal_reached" | "expired">("active");

  const progressPct = campaign.goal > 0n
    ? Math.min(100, Number((campaign.raised * 100n) / campaign.goal))
    : 0;

  const expired = Number(campaign.deadline) <= Math.floor(Date.now() / 1000);
  const goalReached = campaign.raised >= campaign.goal;

  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const deadline = Number(campaign.deadline);
      if (now >= deadline) {
        setTimeLeft("Expired");
        setStatus("expired");
        return;
      }
      const diff = deadline - now;
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [campaign.deadline]);

  useEffect(() => {
    if (goalReached) setStatus("goal_reached");
    else if (expired) setStatus("expired");
    else setStatus("active");
  }, [goalReached, expired]);

  const getBadgeClass = () => {
    switch (status) {
      case "goal_reached": return "badge-success";
      case "expired": return "badge-expired";
      default: return "badge-active";
    }
  };

  const getBadgeText = () => {
    switch (status) {
      case "goal_reached": return "Goal Reached!";
      case "expired": return "Ended";
      default: return "Active";
    }
  };

  return (
    <div className="campaign-card">
      <div className="campaign-status-row">
        <span className={`badge ${getBadgeClass()}`}>{getBadgeText()}</span>
        {CONTRACT_ID && CONTRACT_ID !== "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" && (
          <a
            href={contractExplorerUrl(CONTRACT_ID)}
            target="_blank"
            rel="noopener noreferrer"
            className="contract-link"
          >
            View Contract
          </a>
        )}
      </div>
      <h2 className="campaign-title">{campaign.title}</h2>
      {campaign.description && (
        <p className="campaign-description">{campaign.description}</p>
      )}
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

      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-value">
            {status === "expired" ? "Ended" : timeLeft}
          </span>
          <span className="stat-label">
            {status === "expired" ? formatDeadline(campaign.deadline) : "Time left"}
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
      {myDonation > 0n && (
        <div className="my-donation-banner">
          You donated <strong>{stroopsToXLM(myDonation)} XLM</strong> to this campaign
        </div>
      )}
    </div>
  );
}