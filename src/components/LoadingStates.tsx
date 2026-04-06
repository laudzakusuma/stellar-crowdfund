"use client";

export function CampaignSkeleton() {
  return (
    <div className="campaign-card" aria-label="Loading campaign...">
      <div className="campaign-status-row">
        <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 14, width: 110 }} />
      </div>

      <div className="skeleton" style={{ height: 36, width: "65%", marginTop: 4 }} />
      <div className="skeleton" style={{ height: 14, width: "90%", marginTop: 4 }} />
      <div className="skeleton" style={{ height: 14, width: "75%" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="skeleton" style={{ height: 16, width: 120 }} />
          <div className="skeleton" style={{ height: 14, width: 90 }} />
        </div>
        <div className="skeleton" style={{ height: 10, borderRadius: 999 }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="skeleton" style={{ height: 12, width: 40 }} />
          <div className="skeleton" style={{ height: 12, width: 80 }} />
        </div>
      </div>

      <div className="stats-row" style={{ opacity: 0.4 }}>
        <div className="stat-item">
          <div className="skeleton" style={{ height: 18, width: 60 }} />
          <div className="skeleton" style={{ height: 10, width: 50, marginTop: 4 }} />
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <div className="skeleton" style={{ height: 18, width: 50 }} />
          <div className="skeleton" style={{ height: 10, width: 60, marginTop: 4 }} />
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <div className="skeleton" style={{ height: 18, width: 30 }} />
          <div className="skeleton" style={{ height: 10, width: 55, marginTop: 4 }} />
        </div>
      </div>
    </div>
  );
}

export function EventFeedSkeleton() {
  return (
    <div className="event-feed" aria-label="Loading events...">
      <div className="event-feed-header">
        <div className="skeleton" style={{ height: 20, width: 50, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 16, width: 100, marginLeft: 8 }} />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0" }}
        >
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="skeleton" style={{ height: 12, width: "60%" }} />
            <div className="skeleton" style={{ height: 10, width: "40%" }} />
          </div>
          <div className="skeleton" style={{ height: 10, width: 70 }} />
        </div>
      ))}
    </div>
  );
}

export function Spinner({
  size = 16,
  label,
  dark = false,
}: {
  size?: number;
  label?: string;
  dark?: boolean;
}) {
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
      role="status"
      aria-label={label || "Loading"}
    >
      <span
        className={dark ? "spinner spinner-dark" : "spinner"}
        style={{ width: size, height: size }}
      />
      {label && (
        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          {label}
        </span>
      )}
    </span>
  );
}

export function PageLoader({ message = "Loading…" }: { message?: string }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "var(--void)",
        zIndex: 999,
      }}
    >
      <span style={{ fontSize: "2rem", animation: "float 3s ease-in-out infinite" }}>
        ✦
      </span>
      <Spinner size={24} label={message} />
    </div>
  );
}