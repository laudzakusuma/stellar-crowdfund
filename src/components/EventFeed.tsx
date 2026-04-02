"use client";

import { DonationEvent } from "@/hooks/useContract";
import { stroopsToXLM, shortAddress } from "@/lib/stellar";

interface EventFeedProps {
  events: DonationEvent[];
}

export function EventFeed({ events }: EventFeedProps) {
  if (events.length === 0) {
    return (
      <div className="event-feed">
        <div className="event-feed-header">
          <span className="feed-dot" />
          <h3 className="feed-title">Live Donation Feed</h3>
        </div>
        <div className="feed-empty">
          <p>No donations yet. Be the first!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="event-feed">
      <div className="event-feed-header">
        <div className="live-indicator">
          <span className="live-dot" />
          <span className="live-text">LIVE</span>
        </div>
        <h3 className="feed-title">Donation Feed</h3>
        <span className="event-count">{events.length} events</span>
      </div>

      <div className="events-list">
        {events.map((ev, i) => (
          <div key={ev.id} className={`event-item ${i === 0 ? "event-item-new" : ""}`}>
            <div className="event-avatar">
              {ev.donor.slice(0, 2)}
            </div>
            <div className="event-details">
              <span className="event-donor">{shortAddress(ev.donor, 5)}</span>
              <span className="event-donated">donated</span>
              <span className="event-amount">{stroopsToXLM(ev.amount)} XLM</span>
            </div>
            <div className="event-meta">
              <span className="event-ledger">Ledger #{ev.ledger}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}