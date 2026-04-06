"use client";

import { stroopsToXLM } from "@/lib/stellar";

interface ProgressBarProps {
  raised: bigint;
  goal: bigint;
  animated?: boolean;
}

export function ProgressBar({ raised, goal, animated = true }: ProgressBarProps) {
  const pct = goal > 0n
    ? Math.min(100, Number((raised * 100n) / goal))
    : 0;

  return (
    <div className="progress-section">
      <div className="progress-labels">
        <span className="raised-label">
          <span className="raised-amount">{stroopsToXLM(raised)}</span>
          <span className="raised-unit"> XLM raised</span>
        </span>
        <span className="goal-label">
          Goal: <strong>{stroopsToXLM(goal)} XLM</strong>
        </span>
      </div>

      <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="progress-fill"
          style={{ width: `${pct}%`, transition: animated ? "width 1s cubic-bezier(0.4,0,0.2,1)" : "none" }}
        />
        <div
          className="progress-glow"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="progress-footer">
        <span className="pct-label">{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}