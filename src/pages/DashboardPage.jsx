
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getRecentSummaries,
  deleteSummary,
} from "../services/summaryService";
import SummaryCard from "../components/SummaryCard/SummaryCard";
import SummaryViewModal from "../components/SummaryCard/SummaryViewModal";
import {
  getPlanLabel,
  isPremiumActive,
  getUsageDisplay,
  getPremiumExpiryLabel,
} from "../utils/usageHelpers";
import "./DashboardPage.css";

function DashboardIcon({ name, size = 22 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    book: (
      <>
        <path d="M12 7v14" />
        <path d="M3 18V5a2 2 0 0 1 2-2h3a4 4 0 0 1 4 4 4 4 0 0 1 4-4h3a2 2 0 0 1 2 2v13" />
        <path d="M3 18a3 3 0 0 1 3-3h2a4 4 0 0 1 4 4 4 4 0 0 1 4-4h2a3 3 0 0 1 3 3" />
      </>
    ),
    zap: (
      <path d="m13 2-3 9h7l-6 11 2-9H6l7-11Z" />
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-5 5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    ),
    document: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </>
    ),
    crown: (
      <>
        <path d="m2 8 5 4 5-8 5 8 5-4-2 12H4L2 8Z" />
        <path d="M4 16h16" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.document}</svg>;
}

export default function DashboardPage() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [recentSummaries, setRecentSummaries] = useState([]);
  const [loadingSummaries, setLoadingSummaries] = useState(true);
  const [viewingSummary, setViewingSummary] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      navigate("/signin");
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    setLoadingSummaries(true);

    getRecentSummaries(currentUser.uid, 3)
      .then((summaries) => {
        if (!cancelled) {
          setRecentSummaries(summaries);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load summaries:", err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSummaries(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  async function handleDelete(summaryId) {
    if (!currentUser) return;

    try {
      await deleteSummary(currentUser.uid, summaryId);

      setRecentSummaries((prev) =>
        prev.filter((summary) => summary.id !== summaryId)
      );
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Could not delete summary. Please try again.");
    }
  }

  const isPremium = isPremiumActive(userProfile);
  const planLabel = getPlanLabel(userProfile);
  const usageText = getUsageDisplay(userProfile);
  const expiryLabel = getPremiumExpiryLabel(userProfile);

  const displayName =
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "there";

  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="dash-page">
      <main className="dash-container">
        {/* Welcome */}
        <section className="dash-welcome">
          <div className="dash-welcome-content">
            <div className="dash-eyebrow">
              <span className="dash-eyebrow-dot" />
              YOUR LEARNING SPACE
            </div>

            <h1 className="dash-welcome-title">
              Welcome back,{" "}
              <span className="dash-name">{displayName}</span>
              <span className="dash-wave" role="img" aria-label="waving hand">
                👋
              </span>
            </h1>

            <p className="dash-welcome-sub">
              Your next big learning moment starts here.
              Pick up where you left off or explore something new.
            </p>
          </div>

          <button
            className="dash-profile-avatar"
            type="button"
            title={displayName}
            aria-label={`Signed in as ${displayName}`}
          >
            {initials}
          </button>
        </section>

        {/* Main action */}
        <section className="dash-hero">
          <div className="dash-hero-decoration dash-hero-decoration-one" />
          <div className="dash-hero-decoration dash-hero-decoration-two" />

          <div className="dash-hero-content">
            <div className="dash-hero-badge">
              <DashboardIcon name="zap" size={15} />
              STUDY SMARTER
            </div>

            <h2 className="dash-hero-title">
              Turn pages into
              <br />
              <span>understanding.</span>
            </h2>

            <p className="dash-hero-description">
              Summarize your PDFs, uncover key ideas, and spend
              more time learning what matters.
            </p>

            <button
              className="dash-hero-button"
              type="button"
              onClick={() => navigate("/")}
            >
              <DashboardIcon name="zap" size={17} />
              Start summarizing
              <DashboardIcon name="arrow" size={17} />
            </button>
          </div>

          <div className="dash-hero-visual" aria-hidden="true">
            <div className="dash-hero-orbit dash-hero-orbit-one" />
            <div className="dash-hero-orbit dash-hero-orbit-two" />

            <div className="dash-hero-document">
              <div className="dash-hero-document-icon">
                <DashboardIcon name="document" size={30} />
              </div>
              <div className="dash-hero-document-line dash-line-long" />
              <div className="dash-hero-document-line dash-line-medium" />
              <div className="dash-hero-document-line dash-line-short" />

              <div className="dash-hero-summary-chip">
                <span className="dash-hero-chip-check">
                  <DashboardIcon name="check" size={13} />
                </span>
                Key ideas extracted
              </div>
            </div>
          </div>
        </section>

        {/* Overview */}
        <section className="dash-overview">
          <div className="dash-section-heading">
            <div>
              <h2 className="dash-section-title">Your overview</h2>
              <p className="dash-section-subtitle">
                A quick look at your learning tools.
              </p>
            </div>
          </div>

          <div className="dash-stats-row">
            {/* Plan */}
            <article
              className={`dash-stat-card dash-plan-card ${
                isPremium ? "is-premium" : ""
              }`}
            >
              <div className="dash-stat-top">
                <span className="dash-stat-icon dash-icon-blue">
                  <DashboardIcon name="crown" size={21} />
                </span>
                <span
                  className={`dash-status-pill ${
                    isPremium ? "dash-status-premium" : "dash-status-free"
                  }`}
                >
                  {isPremium ? "ACTIVE" : "BASIC"}
                </span>
              </div>

              <p className="dash-stat-label">Current plan</p>

              <h3 className="dash-stat-value">
                {isPremium ? "Premium" : planLabel || "Free"}
              </h3>

              <p className="dash-stat-sub">
                {isPremium && expiryLabel
                  ? `Active until ${expiryLabel}`
                  : isPremium
                  ? "Enjoy your premium benefits"
                  : "You're on the free plan"}
              </p>
            </article>

            {/* Usage */}
            <article className="dash-stat-card">
              <div className="dash-stat-top">
                <span className="dash-stat-icon dash-icon-violet">
                  <DashboardIcon name="chart" size={21} />
                </span>

                <span className="dash-stat-context">
                  {isPremium ? "Premium" : "Monthly"}
                </span>
              </div>

              <p className="dash-stat-label">Quick summaries</p>

              <h3 className="dash-stat-value dash-usage-value">
                {usageText}
              </h3>

              <p className="dash-stat-sub">
                {isPremium
                  ? "Your premium usage"
                  : "Your monthly usage allowance"}
              </p>
            </article>

            {/* Chapter access */}
            <article className="dash-stat-card">
              <div className="dash-stat-top">
                <span className="dash-stat-icon dash-icon-green">
                  <DashboardIcon name="book" size={21} />
                </span>

                <span
                  className={`dash-access-indicator ${
                    isPremium ? "is-enabled" : ""
                  }`}
                >
                  <DashboardIcon
                    name={isPremium ? "check" : "crown"}
                    size={13}
                  />
                  {isPremium ? "Unlocked" : "Locked"}
                </span>
              </div>

              <p className="dash-stat-label">Chapter summaries</p>

              <h3
                className={`dash-stat-value ${
                  isPremium ? "dash-feature-on" : ""
                }`}
              >
                {isPremium ? "Included" : "Premium feature"}
              </h3>

              <p className="dash-stat-sub">
                {isPremium
                  ? "Ready when you need it"
                  : "Unlock deeper chapter analysis"}
              </p>
            </article>
          </div>
        </section>

        {/* Upgrade */}
        {!isPremium && (
          <section className="dash-upgrade-banner">
            <div className="dash-upgrade-icon">
              <DashboardIcon name="crown" size={24} />
            </div>

            <div className="dash-upgrade-text">
              <span className="dash-upgrade-kicker">
                GET MORE OUT OF YOUR STUDY TIME
              </span>
              <h3>Ready to level up?</h3>
              <p>
                Unlock premium summaries and chapter analysis
                for just ₦1,500/month.
              </p>
            </div>

            <button
              className="dash-upgrade-btn"
              type="button"
              onClick={() => navigate("/pricing")}
            >
              Explore Premium
              <DashboardIcon name="arrow" size={16} />
            </button>
          </section>
        )}

        {/* Recent summaries */}
        <section className="dash-section">
          <div className="dash-section-header">
            <div>
              <h2 className="dash-section-title">Recent summaries</h2>
              <p className="dash-section-subtitle">
                Your knowledge, all in one place.
              </p>
            </div>

            {recentSummaries.length > 0 && (
              <button
                className="dash-section-link"
                type="button"
                onClick={() => navigate("/summaries")}
              >
                View all
                <DashboardIcon name="arrow" size={16} />
              </button>
            )}
          </div>

          {loadingSummaries ? (
            <div className="dash-loading">
              <div className="dash-spinner" />
              <div>
                <p className="dash-loading-title">Gathering your summaries</p>
                <span>Just a moment...</span>
              </div>
            </div>
          ) : recentSummaries.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty-art">
                <div className="dash-empty-art-back">
                  <DashboardIcon name="document" size={29} />
                </div>
                <div className="dash-empty-art-front">
                  <DashboardIcon name="book" size={33} />
                </div>
                <span className="dash-empty-spark dash-spark-one">✦</span>
                <span className="dash-empty-spark dash-spark-two">✧</span>
              </div>

              <h3 className="dash-empty-title">
                Your learning journey starts here
              </h3>

              <p className="dash-empty-sub">
                You haven't created any summaries yet. Upload a PDF
                and turn lengthy reading into clear, useful insights.
              </p>

              <button
                className="dash-empty-cta"
                type="button"
                onClick={() => navigate("/")}
              >
                <DashboardIcon name="zap" size={17} />
                Create your first summary
                <DashboardIcon name="arrow" size={17} />
              </button>
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

          {!loadingSummaries && recentSummaries.length > 0 && (
            <button
              className="dash-bottom-cta"
              type="button"
              onClick={() => navigate("/")}
            >
              <span className="dash-bottom-cta-icon">
                <DashboardIcon name="zap" size={18} />
              </span>
              <span>
                <strong>Ready for another one?</strong>
                <small>Turn your next document into a summary.</small>
              </span>
              <span className="dash-bottom-cta-arrow">
                <DashboardIcon name="arrow" size={18} />
              </span>
            </button>
          )}
        </section>

        <footer className="dash-footer">
          <span className="dash-footer-mark">
            <DashboardIcon name="book" size={15} />
          </span>
          <span>Small steps. Deeper understanding.</span>
        </footer>
      </main>

      <SummaryViewModal
        summary={viewingSummary}
        onClose={() => setViewingSummary(null)}
      />
    </div>
  );
}

