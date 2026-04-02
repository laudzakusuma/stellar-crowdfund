"use client";

import { useState } from "react";

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDonate: (amount: number) => Promise<void>;
  isPending: boolean;
  maxBalance?: number;
}

const QUICK_AMOUNTS = [10, 25, 50, 100];

export function DonateModal({
  isOpen,
  onClose,
  onDonate,
  isPending,
  maxBalance = 1000,
}: DonateModalProps) {
  const [amount, setAmount] = useState("");
  const [inputError, setInputError] = useState("");

  if (!isOpen) return null;

  const handleQuickSelect = (val: number) => {
    setAmount(String(val));
    setInputError("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
      setInputError("");
    }
  };

  const handleSubmit = async () => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      setInputError("Please enter a valid amount.");
      return;
    }
    if (num > maxBalance) {
      setInputError("Amount exceeds your available balance.");
      return;
    }
    if (num < 1) {
      setInputError("Minimum donation is 1 XLM.");
      return;
    }
    setInputError("");
    await onDonate(num);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isPending) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="modal-title">💫 Make a Donation</h3>
          {!isPending && (
            <button className="modal-close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        <p className="modal-subtitle">
          Support this campaign on the Stellar testnet
        </p>

        {/* Quick amounts */}
        <div className="quick-amounts">
          {QUICK_AMOUNTS.map((val) => (
            <button
              key={val}
              className={`quick-amount-btn ${amount === String(val) ? "selected" : ""}`}
              onClick={() => handleQuickSelect(val)}
              disabled={isPending}
            >
              {val} XLM
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div className="amount-input-wrapper">
          <input
            type="text"
            value={amount}
            onChange={handleChange}
            placeholder="Enter custom amount"
            disabled={isPending}
            className={`amount-input ${inputError ? "input-error" : ""}`}
            autoFocus
          />
          <span className="input-currency">XLM</span>
        </div>

        {inputError && <p className="field-error">{inputError}</p>}

        <div className="modal-info">
          <span>🔒 Secured by Soroban smart contract</span>
          <span>⚡ Stellar Testnet</span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isPending || !amount}
          className="donate-submit-btn"
        >
          {isPending ? (
            <>
              <span className="spinner spinner-dark" />
              Sending Transaction…
            </>
          ) : (
            `Donate ${amount ? `${amount} XLM` : ""} →`
          )}
        </button>
      </div>
    </div>
  );
}
