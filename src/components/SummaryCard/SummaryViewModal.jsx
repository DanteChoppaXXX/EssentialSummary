// src/components/SummaryCard/SummaryViewModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Simple modal that shows the full content of a saved summary.
// Opened when user clicks "View" on a SummaryCard.
//
// Props:
//   summary  (object | null)  — summary to display, null = closed
//   onClose  (fn)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { getSummaryTypeLabel, formatSummaryDate } from "../../utils/usageHelpers";
import "./SummaryViewModal.css";

export default function SummaryViewModal({ summary, onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!summary) return;
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [summary, onClose]);

  if (!summary) return null;

  async function handleCopy() {
    await navigator.clipboard.writeText(summary.content);
    alert("Copied to clipboard!");
  }

  return (
    <div
      className="svm-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="svm-card">
        <button className="svm-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="svm-header">
          <span className="svm-badge">
            {summary.summaryType === "chapter" ? "📚 Chapter Summary" : "📄 Quick Summary"}
          </span>
          <h2 className="svm-title">{summary.fileName ?? "Untitled PDF"}</h2>
          <div className="svm-meta">
            {summary.pageNumber   && <span>Page {summary.pageNumber}</span>}
            {summary.chapterRange && <span>{summary.chapterRange}</span>}
            <span>{formatSummaryDate(summary.createdAt)}</span>
          </div>
        </div>

        <div className="svm-content">
          {summary.content}
        </div>

        <div className="svm-actions">
          <button className="svm-btn-copy" onClick={handleCopy}>Copy to Clipboard</button>
          <button className="svm-btn-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
