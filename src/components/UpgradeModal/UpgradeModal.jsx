// src/components/UpgradeModal/UpgradeModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Updated: "Upgrade Now" navigates to /pricing instead of a placeholder alert.
//
// Props:
//   isOpen        (bool)
//   onClose       (fn)
//   onUpgrade     (fn)     — called when user clicks Upgrade Now
//                           In HomePage, pass: () => { closeUpgradeModal(); navigate('/pricing'); }
//   userProfile   (object) — from getUserUsageStatus()
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import "./UpgradeModal.css";

export default function UpgradeModal({ isOpen, onClose, onUpgrade, userProfile }) {
  const overlayRef = useRef(null);
  const limit = userProfile?.quickSummaryLimit ?? 10;

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="upgrade-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade your plan"
    >
      <div className="upgrade-card">
        <button className="upgrade-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="upgrade-icon-wrap">
          <div className="upgrade-icon-ring">
            <span className="upgrade-icon">⚡</span>
          </div>
        </div>

        <h2 className="upgrade-title">You've hit your free limit</h2>
        <p className="upgrade-subtitle">
          You've used all <strong>{limit} free Quick Summaries</strong> for this month.
          Upgrade to keep summarizing without limits.
        </p>

        <ul className="upgrade-features">
          <li><span className="upgrade-check">✓</span> Unlimited Quick Summaries</li>
          <li><span className="upgrade-check">✓</span> Multi-Page Summaries</li>
          <li><span className="upgrade-check">✓</span> Priority AI processing</li>
          <li><span className="upgrade-check">✓</span> Access resets every month</li>
        </ul>

        <p className="upgrade-reset-note">
          🗓 Your free limit resets at the start of next month.
        </p>

        <div className="upgrade-actions">
          {/* onUpgrade should be: () => { closeUpgradeModal(); navigate('/pricing'); } */}
          <button className="upgrade-btn-primary" onClick={onUpgrade}>
            See Pricing & Upgrade
          </button>
          <button className="upgrade-btn-secondary" onClick={onClose}>
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
