import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WalletConnect } from "@/components/WalletConnect";
import { TxStatusBanner } from "@/components/TxStatus";
import { CampaignCard } from "@/components/CampaignCard";
import { EventFeed } from "@/components/EventFeed";
import { ProgressBar } from "@/components/ProgressBar";

describe("WalletConnect", () => {
  const defaultProps = {
    address: null,
    isConnecting: false,
    error: null,
    errorMessage: null,
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onClearError: vi.fn(),
  };

  it("renders Connect Wallet button when not connected", () => {
    render(<WalletConnect {...defaultProps} />);
    expect(screen.getByText(/connect wallet/i)).toBeInTheDocument();
  });

  it("calls onConnect when button is clicked", () => {
    const onConnect = vi.fn();
    render(<WalletConnect {...defaultProps} onConnect={onConnect} />);
    fireEvent.click(screen.getByText(/connect wallet/i));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it("shows connecting spinner when isConnecting is true", () => {
    render(<WalletConnect {...defaultProps} isConnecting={true} />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it("disables button while connecting", () => {
    render(<WalletConnect {...defaultProps} isConnecting={true} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("shows truncated address when connected", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
    render(<WalletConnect {...defaultProps} address={address} />);
    expect(screen.getByText(/GAAZI4/)).toBeInTheDocument();
  });

  it("shows disconnect button when connected", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
    render(<WalletConnect {...defaultProps} address={address} />);
    expect(screen.getByTitle(/disconnect/i)).toBeInTheDocument();
  });

  it("calls onDisconnect when disconnect is clicked", () => {
    const onDisconnect = vi.fn();
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
    render(
      <WalletConnect
        {...defaultProps}
        address={address}
        onDisconnect={onDisconnect}
      />
    );
    fireEvent.click(screen.getByTitle(/disconnect/i));
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it("shows WALLET_NOT_FOUND error message", () => {
    render(
      <WalletConnect
        {...defaultProps}
        error="WALLET_NOT_FOUND"
        errorMessage="🔌 Wallet extension not found. Please install Freighter or Albedo."
      />
    );
    expect(screen.getByText(/wallet extension not found/i)).toBeInTheDocument();
  });

  it("shows INSUFFICIENT_BALANCE error message", () => {
    render(
      <WalletConnect
        {...defaultProps}
        error="INSUFFICIENT_BALANCE"
        errorMessage="Insufficient XLM balance."
      />
    );
    expect(screen.getByText(/insufficient xlm balance/i)).toBeInTheDocument();
  });

  it("calls onClearError when error X button is clicked", () => {
    const onClearError = vi.fn();
    render(
      <WalletConnect
        {...defaultProps}
        error="USER_REJECTED"
        errorMessage="Transaction was rejected."
        onClearError={onClearError}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(onClearError).toHaveBeenCalledOnce();
  });
});

describe("TxStatusBanner", () => {
  it("renders nothing when status is idle", () => {
    const { container } = render(
      <TxStatusBanner
        status="idle"
        txHash={null}
        errorMessage={null}
        onDismiss={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows pending message", () => {
    render(
      <TxStatusBanner
        status="pending"
        txHash={null}
        errorMessage={null}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText(/transaction pending/i)).toBeInTheDocument();
  });

  it("shows success message with explorer link", () => {
    render(
      <TxStatusBanner
        status="success"
        txHash="ABCDEF1234567890"
        errorMessage={null}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText(/transaction confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      expect.stringContaining("ABCDEF1234567890")
    );
  });

  it("shows error message", () => {
    render(
      <TxStatusBanner
        status="error"
        txHash={null}
        errorMessage="Insufficient balance."
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText(/transaction failed/i)).toBeInTheDocument();
    expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked on success", () => {
    const onDismiss = vi.fn();
    render(
      <TxStatusBanner
        status="success"
        txHash="HASH123"
        errorMessage={null}
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("ProgressBar", () => {
  it("renders with 0%", () => {
    const { container } = render(
      <ProgressBar raised={0n} goal={100_000_000n} />
    );
    const fill = container.querySelector(".progress-fill");
    expect(fill).toHaveStyle({ width: "0%" });
  });

  it("renders with 50%", () => {
    const { container } = render(
      <ProgressBar raised={50_000_000n} goal={100_000_000n} />
    );
    const fill = container.querySelector(".progress-fill");
    expect(fill).toHaveStyle({ width: "50%" });
  });

  it("caps at 100% even when raised > goal", () => {
    const { container } = render(
      <ProgressBar raised={200_000_000n} goal={100_000_000n} />
    );
    const fill = container.querySelector(".progress-fill");
    expect(fill).toHaveStyle({ width: "100%" });
  });

  it("shows raised and goal amounts in XLM", () => {
    render(<ProgressBar raised={50_000_000n} goal={100_000_000n} />);
    expect(screen.getByText(/5\.00/)).toBeInTheDocument(); // 50M stroops = 5 XLM
    expect(screen.getByText(/10\.00/)).toBeInTheDocument(); // 100M stroops = 10 XLM
  });
});

describe("CampaignCard", () => {
  const mockCampaign = {
    title: "Save the Ocean",
    description: "Fund ocean cleanup on Stellar",
    goal: 100_000_000n,
    raised: 50_000_000n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30), // 30 days
    owner: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    withdrawn: false,
    donor_count: 12,
  };

  it("renders campaign title", () => {
    render(<CampaignCard campaign={mockCampaign} myDonation={0n} />);
    expect(screen.getByText("Save the Ocean")).toBeInTheDocument();
  });

  it("renders campaign description", () => {
    render(<CampaignCard campaign={mockCampaign} myDonation={0n} />);
    expect(screen.getByText(/fund ocean cleanup/i)).toBeInTheDocument();
  });

  it("shows donor count", () => {
    render(<CampaignCard campaign={mockCampaign} myDonation={0n} />);
    // donor_count=12 appears in both the progress footer and stats row
    const matches = screen.getAllByText(/12/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Active badge for active campaign", () => {
    render(<CampaignCard campaign={mockCampaign} myDonation={0n} />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("shows Ended badge for expired campaign", () => {
    const expired = {
      ...mockCampaign,
      deadline: BigInt(Math.floor(Date.now() / 1000) - 86400),
    };
    render(<CampaignCard campaign={expired} myDonation={0n} />);
    // "Ended" appears in both badge and stats — check the badge specifically
    const matches = screen.getAllByText(/ended/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // The badge should have the correct class
    const badge = document.querySelector(".badge-expired");
    expect(badge).toBeInTheDocument();
  });

  it("shows Goal Reached badge when raised >= goal", () => {
    const goalReached = {
      ...mockCampaign,
      raised: 100_000_000n,
      goal: 100_000_000n,
    };
    render(<CampaignCard campaign={goalReached} myDonation={0n} />);
    expect(screen.getByText(/goal reached/i)).toBeInTheDocument();
  });

  it("shows 'my donation' banner when user has donated", () => {
    render(<CampaignCard campaign={mockCampaign} myDonation={10_000_000n} />);
    expect(screen.getByText(/you donated/i)).toBeInTheDocument();
  });

  it("does NOT show my donation banner when myDonation is 0", () => {
    render(<CampaignCard campaign={mockCampaign} myDonation={0n} />);
    expect(screen.queryByText(/you donated/i)).not.toBeInTheDocument();
  });
});

describe("EventFeed", () => {
  it("shows empty state when no events", () => {
    render(<EventFeed events={[]} />);
    expect(screen.getByText(/no donations yet/i)).toBeInTheDocument();
  });

  it("renders event items for each donation", () => {
    const events = [
      {
        id: "1",
        donor: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
        amount: 10_000_000n,
        total_raised: 10_000_000n,
        ledger: 1000,
        timestamp: Date.now(),
      },
      {
        id: "2",
        donor: "GBQXTS6YBZR3VNXMZBBQJV5XCPHQCZF2WIXFJKOPWXEVKKNNCNKVFKQ",
        amount: 20_000_000n,
        total_raised: 30_000_000n,
        ledger: 1001,
        timestamp: Date.now(),
      },
    ];
    render(<EventFeed events={events} />);
    // Should show 2 event items
    const items = screen.getAllByText(/donated/i);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("shows LIVE indicator when there are events", () => {
    const events = [
      {
        id: "1",
        donor: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
        amount: 5_000_000n,
        total_raised: 5_000_000n,
        ledger: 999,
        timestamp: Date.now(),
      },
    ];
    render(<EventFeed events={events} />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("shows event count", () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      donor: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      amount: BigInt((i + 1) * 10_000_000),
      total_raised: BigInt((i + 1) * 10_000_000),
      ledger: 1000 + i,
      timestamp: Date.now(),
    }));
    render(<EventFeed events={events} />);
    expect(screen.getByText(/5 events/i)).toBeInTheDocument();
  });
});