// src/pages/DashboardPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRecentSummaries, deleteSummary } from "../services/summaryService";
import SummaryCard from "../components/SummaryCard/SummaryCard";
import SummaryViewModal from "../components/SummaryCard/SummaryViewModal";
import {
  getPlanLabel,
  isPremiumActive,
  getUsageDisplay,
  getPremiumExpiryLabel,
} from "../utils/usageHelpers";
import "./DashboardPage.css";

export default function DashboardPage() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [recentSummaries, setRecentSummaries]   = useState([]);
  const [loadingSummaries, setLoadingSummaries] = useState(true);
  const [viewingSummary,   setViewingSummary]   = useState(null);

  // ── Redirect if not logged in ──
  useEffect(() => {
    if (!currentUser) { navigate("/signin"); }
  }, [currentUser, navigate]);

  // ── Load recent summaries ──
  useEffect(() => {
    if (!currentUser) return;
    setLoadingSummaries(true);
    getRecentSummaries(currentUser.uid, 3)
      .then(setRecentSummaries)
      .catch((err) => console.error("Failed to load summaries:", err))
      .finally(() => setLoadingSummaries(false));
  }, [currentUser]);

  async function handleDelete(summaryId) {
    try {
      await deleteSummary(currentUser.uid, summaryId);
      setRecentSummaries((prev) => prev.filter((s) => s.id !== summaryId));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Could not delete summary. Please try again.");
    }
  }

  const planLabel   = getPlanLabel(userProfile);
  const isPremium   = isPremiumActive(userProfile);
  const usageText   = getUsageDisplay(userProfile);
  const expiryLabel = getPremiumExpiryLabel(userProfile);
  const displayName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "there";

  return (
    <div className="dash-page">
      <div className="dash-container">

        {/* ── Welcome ── */}
        <div className="dash-welcome">
          <h1 className="dash-welcome-title">
            Welcome back, <span className="dash-name">{displayName}</span> 👋
          </h1>
          <p className="dash-welcome-sub">Here's your study overview.</p>
        </div>

        {/* ── Stats row ── */}
        <div className="dash-stats-row">

          {/* Plan card */}
          <div className={`dash-stat-card ${isPremium ? "is-premium" : ""}`}>
            <div className="dash-stat-label">Current Plan</div>
            <div className="dash-stat-value">
              {isPremium ? "⚡ Premium" : "Free"}
            </div>
            {expiryLabel && (
              <div className="dash-stat-sub">Active until {expiryLabel}</div>
            )}
          </div>

          {/* Usage card */}
          <div className="dash-stat-card">
            <div className="dash-stat-label">Quick Summary Usage</div>
            <div className="dash-stat-value dash-usage-value">{usageText}</div>
            {!isPremium && (
              <div className="dash-stat-sub">Resets monthly</div>
            )}
          </div>

          {/* Chapter access card */}
          <div className="dash-stat-card">
            <div className="dash-stat-label">Chapter Summary</div>
            <div className={`dash-stat-value ${isPremium ? "dash-feature-on" : "dash-feature-off"}`}>
              {isPremium ? "✓ Included" : "Premium only"}
            </div>
            {!isPremium && (
              <div className="dash-stat-sub">Upgrade to unlock</div>
            )}
          </div>

        </div>

        {/* ── Upgrade CTA (free users only) ── */}
        {!isPremium && (
          <div className="dash-upgrade-banner">
            <div className="dash-upgrade-text">
              <strong>Unlock Premium</strong>
              <span>Get unlimited summaries + chapter analysis for just ₦1,500/month.</span>
            </div>
            <button
              className="dash-upgrade-btn"
              onClick={() => navigate("/pricing")}
            >
              Upgrade to Premium →
            </button>
          </div>
        )}

        {/* ── Recent summaries ── */}
        <div className="dash-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">Recent Summaries</h2>
            {recentSummaries.length > 0 && (
              <button
                className="dash-section-link"
                onClick={() => navigate("/summaries")}
              >
                View all →
              </button>
            )}
          </div>

          {loadingSummaries ? (
            <div className="dash-loading">
              <div className="dash-spinner" />
              <span>Loading summaries…</span>
            </div>
          ) : recentSummaries.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty-icon">📭</div>
              <p className="dash-empty-title">No summaries yet</p>
              <p className="dash-empty-sub">
                Upload a PDF and use the ⚡ button to generate your first summary.
              </p>
            </div>
          ) : (
            <div className="dash-summary-list">
              {recentSummaries.map((summary) => (
                <SummaryCard
                  key={summary.id}
                  summary={summary}
                  onDelete={handleDelete}
                  onView={setViewingSummary}
                />
              ))}
            </div>
          )}

          {/* Go summarize — always visible below summaries or empty state */}
          {!loadingSummaries && (
            <button
              className="dash-empty-cta"
              onClick={() => navigate("/")}
            >
              ⚡ Go summarize →
            </button>
          )}
        </div>

      </div>

      {/* ── View modal ── */}
      <SummaryViewModal
        summary={viewingSummary}
        onClose={() => setViewingSummary(null)}
      />
    </div>
  );
}
