
import { useState } from "react";
import {
  getSummaryTypeLabel,
  formatSummaryDate,
  truncateContent,
} from "../../utils/usageHelpers";
import "./SummaryCard.css";

export default function SummaryCard({ summary, onDelete, onView }) {
  const [copying, setCopying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isChapter = summary.summaryType === "chapter";
  const typeLabel = getSummaryTypeLabel(summary.summaryType);

  async function handleCopy() {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(summary.content);
    } catch {
      alert("Could not copy to clipboard.");
    } finally {
      setCopying(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this summary? This cannot be undone.")) {
      return;
    }

    try {
      setDeleting(true);
      await onDelete(summary.id);
    } catch (error) {
      console.error("Failed to delete summary:", error);
      alert("Could not delete this summary. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article
      className={`summary-card ${isChapter ? "is-chapter" : "is-quick"}`}
    >
      {/* Top accent and summary type */}
      <div className="summary-card-top">
        <div className="summary-card-badge">
          <span className="summary-card-badge-icon" aria-hidden="true">
            {isChapter ? "▤" : "▧"}
          </span>
          <span>{isChapter ? "Chapter Summary" : "Quick Summary"}</span>
        </div>

        <span className="summary-card-status">
          <span className="summary-card-status-dot" />
          Saved
        </span>
      </div>

      {/* File information */}
      <div className="summary-card-header">
        <div className="summary-card-file-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M8 13h8M8 17h8" />
          </svg>
        </div>

        <div className="summary-card-file-info">
          <h3
            className="summary-card-filename"
            title={summary.fileName || "Untitled PDF"}
          >
            {summary.fileName || "Untitled PDF"}
          </h3>

          <div className="summary-card-meta">
            <span className="summary-card-meta-type">{typeLabel}</span>

            {summary.pageNumber && (
              <span className="summary-card-meta-item">
                Page {summary.pageNumber}
              </span>
            )}

            {summary.chapterRange && (
              <span className="summary-card-meta-item">
                {summary.chapterRange}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary preview */}
      <div className="summary-card-preview-section">
        <div className="summary-card-preview-label">
          <span className="summary-card-preview-indicator" />
          CONTENT PREVIEW
        </div>

        <p className="summary-card-preview">
          {truncateContent(summary.content || "", 140)}
        </p>
      </div>

      {/* Footer */}
      <div className="summary-card-footer">
        <span className="summary-card-date">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {formatSummaryDate(summary.createdAt)}
        </span>

        <div className="summary-card-actions">
          <button
            type="button"
            className="sc-btn sc-btn-view"
            onClick={() => onView(summary)}
            disabled={deleting}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View
          </button>

          <button
            type="button"
            className={`sc-btn sc-btn-copy ${copying ? "copying" : ""}`}
            onClick={handleCopy}
            disabled={copying || deleting}
          >
            {copying ? (
              <>
                <span className="sc-btn-check" aria-hidden="true">
                  ✓
                </span>
                Copied
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="8" y="8" width="12" height="12" rx="2" />
                  <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                </svg>
                Copy
              </>
            )}
          </button>

          <button
            type="button"
            className="sc-btn sc-btn-delete"
            onClick={handleDelete}
            disabled={deleting || copying}
          >
            {deleting ? (
              <>
                <span className="sc-btn-spinner" aria-hidden="true" />
                Deleting
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
                </svg>
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

