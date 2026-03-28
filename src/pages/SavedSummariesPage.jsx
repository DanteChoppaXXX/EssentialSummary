// src/pages/SavedSummariesPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserSummaries, deleteSummary } from "../services/summaryService";
import SummaryCard from "../components/SummaryCard/SummaryCard";
import SummaryViewModal from "../components/SummaryCard/SummaryViewModal";
import "./SavedSummariesPage.css";

export default function SavedSummariesPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [summaries, setSummaries] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [viewing,   setViewing]   = useState(null);

  // ── Auth guard ──
  useEffect(() => {
    if (!currentUser) { navigate("/signin"); }
  }, [currentUser, navigate]);

  // ── Load all summaries ──
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    getUserSummaries(currentUser.uid)
      .then(setSummaries)
      .catch((err) => console.error("Failed to load summaries:", err))
      .finally(() => setLoading(false));
  }, [currentUser]);

  async function handleDelete(summaryId) {
    try {
      await deleteSummary(currentUser.uid, summaryId);
      setSummaries((prev) => prev.filter((s) => s.id !== summaryId));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Could not delete summary. Please try again.");
    }
  }

  return (
    <div className="ss-page">
      <div className="ss-container">

        <div className="ss-header">
          <h1 className="ss-title">Saved Summaries</h1>
          <p className="ss-subtitle">
            {summaries.length > 0
              ? `${summaries.length} summary${summaries.length === 1 ? "" : "s"} saved`
              : "Your generated summaries appear here"}
          </p>
        </div>

        {loading ? (
          <div className="ss-loading">
            <div className="ss-spinner" />
            <span>Loading your summaries…</span>
          </div>
        ) : summaries.length === 0 ? (
          <div className="ss-empty">
            <div className="ss-empty-icon">📭</div>
            <h2 className="ss-empty-title">No summaries yet</h2>
            <p className="ss-empty-sub">
              Upload a PDF on the home page and click ⚡ to generate and save your first summary.
            </p>
            <button className="ss-empty-cta" onClick={() => navigate("/")}>
              Go summarize →
            </button>
          </div>
        ) : (
          <div className="ss-list">
            {summaries.map((summary) => (
              <SummaryCard
                key={summary.id}
                summary={summary}
                onDelete={handleDelete}
                onView={setViewing}
              />
            ))}
          </div>
        )}

      </div>

      <SummaryViewModal
        summary={viewing}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
