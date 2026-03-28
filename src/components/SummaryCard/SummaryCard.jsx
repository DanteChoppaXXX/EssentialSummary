// src/components/SummaryCard/SummaryCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable card for a single saved summary.
// Used in both DashboardPage (recent) and SavedSummariesPage (all).
//
// Props:
//   summary   (object)  — summary document from Firestore
//   onDelete  (fn)      — called with summaryId when delete is confirmed
//   onView    (fn)      — called with summary object to open detail modal
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { getSummaryTypeLabel, formatSummaryDate, truncateContent } from "../../utils/usageHelpers";
import "./SummaryCard.css";

export default function SummaryCard({ summary, onDelete, onView }) {
  const [copying,  setCopying]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleCopy() {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(summary.content);
      setTimeout(() => setCopying(false), 1500);
    } catch {
      setCopying(false);
      alert("Could not copy to clipboard.");
    }
  }

  function handleDelete() {
    if (!window.confirm("Delete this summary? This cannot be undone.")) return;
    setDeleting(true);
    onDelete(summary.id);
  }

  const typeLabel = getSummaryTypeLabel(summary.summaryType);
  const isChapter = summary.summaryType === "chapter";

  return (
    <div className={`summary-card ${isChapter ? "is-chapter" : "is-quick"}`}>
      {/* ── Type badge ── */}
      <div className="summary-card-badge">
        {isChapter ? "📚 Chapter" : "📄 Quick"}
      </div>

      {/* ── File name + meta ── */}
      <div className="summary-card-header">
        <h3 className="summary-card-filename" title={summary.fileName}>
          {summary.fileName ?? "Untitled PDF"}
        </h3>
        <div className="summary-card-meta">
          <span>{typeLabel}</span>
          {summary.pageNumber   && <span>· Page {summary.pageNumber}</span>}
          {summary.chapterRange && <span>· {summary.chapterRange}</span>}
          <span>· {formatSummaryDate(summary.createdAt)}</span>
        </div>
      </div>

      {/* ── Content preview ── */}
      <p className="summary-card-preview">
        {truncateContent(summary.content, 140)}
      </p>

      {/* ── Actions ── */}
      <div className="summary-card-actions">
        <button
          className="sc-btn sc-btn-view"
          onClick={() => onView(summary)}
        >
          View
        </button>
        <button
          className={`sc-btn sc-btn-copy ${copying ? "copying" : ""}`}
          onClick={handleCopy}
          disabled={copying}
        >
          {copying ? "Copied ✓" : "Copy"}
        </button>
        <button
          className="sc-btn sc-btn-delete"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
