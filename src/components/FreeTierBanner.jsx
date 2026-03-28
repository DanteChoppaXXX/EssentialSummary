// src/components/FreeTierBanner.jsx
// Auto-dismisses after 5 seconds so it never fights with click events.
// Re-appears fresh after every successful summary (isBannerVisible reset in HomePage).
// When at the hard limit, stays visible permanently so the Upgrade button stays reachable.
//
// Props:
//   userProfile  (object)  — from getUserUsageStatus()
//   onUpgrade    (fn)      — opens UpgradeModal
//   onClose      (fn)      — called when auto-dismiss timer fires
import { useEffect } from "react";
import { getUsageBannerMessage } from "../services/usageService";
import "./FreeTierBanner.css";

const AUTO_DISMISS_MS = 5000; // visible for 5 seconds, then fades out

export default function FreeTierBanner({ userProfile, onUpgrade, onClose }) {
  const message = getUsageBannerMessage(userProfile);

  const isAtLimit =
    (userProfile?.quickSummaryUsed ?? 0) >= (userProfile?.quickSummaryLimit ?? 10);

  // Auto-dismiss after AUTO_DISMISS_MS.
  // Skipped when at limit — user needs the Upgrade button to stay visible.
  useEffect(() => {
    if (!message || isAtLimit) return;

    const timer = setTimeout(() => {
      onClose();
    }, AUTO_DISMISS_MS);

    // If message or isAtLimit changes before timer fires, clear it
    return () => clearTimeout(timer);
  }, [message, isAtLimit, onClose]);

  if (!message) return null;

  return (
    <div
      className={`free-tier-banner ${isAtLimit ? "at-limit" : ""}`}
      role="status"
    >
      <span className="free-tier-icon">{isAtLimit ? "🔒" : "📊"}</span>
      <span className="free-tier-text">{message}</span>
      {isAtLimit && (
        <button className="free-tier-upgrade-btn" onClick={onUpgrade}>
          Upgrade →
        </button>
      )}
    </div>
  );
}
