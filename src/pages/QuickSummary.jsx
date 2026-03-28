// src/pages/QuickSummary.jsx
// ─────────────────────────────────────────────────────────────────────────────
// FULL INTEGRATION EXAMPLE
// This page shows exactly how to wire together:
//   • Anonymous usage tracking
//   • Soft warning banner
//   • AuthModal popup
//   • The Quick Summary action itself
//
// ADAPT THIS TO YOUR APP:
// - Replace `useAuth` import with your own auth context hook
// - Replace `runQuickSummary()` with your real summary API call
// - You can extract just the logic and paste it into your existing page
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";

// ── Your existing auth hook (adapt import path as needed) ──
import { useAuth } from "../context/AuthContext";

// ── Auth modal ──
import AuthModal from "../components/AuthModal/AuthModal";
import { useAuthModal } from "../hooks/useAuthModal";

// ── Soft warning banner ──
import SoftWarningBanner from "../components/SoftWarningBanner";

// ── Anonymous usage helpers ──
import {
  hasReachedAnonymousQuickSummaryLimit,
  incrementAnonymousQuickSummaryCount,
  getSoftWarningMessage,
} from "../utils/anonymousUsage";

import "./QuickSummary.css";

export default function QuickSummary() {
  // ── Auth state from your existing context ──
  const { currentUser } = useAuth();

  // ── Modal state ──
  const { isOpen, modalMode, openModal, closeModal } = useAuthModal();

  // ── Soft warning message (null = no warning to show) ──
  const [warningMessage, setWarningMessage] = useState(null);

  // ── UI states ──
  const [summaryResult, setSummaryResult] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  // ── Refresh the soft warning on mount and when user logs in ──
  useEffect(() => {
    if (!currentUser) {
      setWarningMessage(getSoftWarningMessage());
    } else {
      // Logged-in user — hide the warning
      setWarningMessage(null);
    }
  }, [currentUser]);

  // ─────────────────────────────────────────────────────────────────────────
  // THE CORE FLOW: called when user clicks "Quick Summary"
  // ─────────────────────────────────────────────────────────────────────────
  async function handleQuickSummary() {
    setSummaryError("");

    // ── STEP 1: If logged in, skip all anonymous logic → run the action ──
    if (currentUser) {
      await runSummaryAction();
      return;
    }

    // ── STEP 2: Anonymous user — check the hard limit ──
    if (hasReachedAnonymousQuickSummaryLimit()) {
      // Hard limit hit → open modal instead of running the summary
      openModal("signup");
      return;
    }

    // ── STEP 3: Under limit → run the action ──
    const success = await runSummaryAction();

    // ── STEP 4: Only increment AFTER a successful action ──
    if (success) {
      incrementAnonymousQuickSummaryCount();
      // Refresh the soft warning (may appear or update after this use)
      setWarningMessage(getSoftWarningMessage());
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Your actual summary logic lives here.
  // Replace this stub with your real API call.
  // Returns true on success, false on failure.
  // ─────────────────────────────────────────────────────────────────────────
  async function runSummaryAction() {
    setIsSummarizing(true);
    setSummaryResult("");
    try {
      // TODO: Replace with your real summarization API call
      // e.g. const result = await summarizePDF(selectedFile);
      await new Promise((resolve) => setTimeout(resolve, 1500)); // fake delay
      setSummaryResult(
        "✅ Summary complete! This PDF covers three main topics: introduction to neural networks, transformer architecture, and practical fine-tuning strategies. The authors conclude that..."
      );
      return true; // signal success
    } catch (err) {
      setSummaryError("Something went wrong. Please try again.");
      return false; // signal failure — do NOT increment
    } finally {
      setIsSummarizing(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Called by AuthModal after successful sign in OR sign up.
  // Closes the modal and returns the user to this page.
  // They can now click "Quick Summary" again — this time as a logged-in user.
  // ─────────────────────────────────────────────────────────────────────────
  function handleAuthSuccess() {
    closeModal();
    // Optional: automatically retry the action here if you want seamless UX:
    // runSummaryAction();
    // We leave it manual for simplicity — user clicks the button again.
  }

  return (
    <div className="qs-page">
      <div className="qs-container">
        <h1 className="qs-title">Quick Summary</h1>
        <p className="qs-subtitle">
          Upload a PDF and get a concise summary in seconds.
        </p>

        {/* ── Soft warning banner (shown after 3rd anonymous use) ── */}
        {!currentUser && warningMessage && (
          <SoftWarningBanner
            message={warningMessage}
            onSignUp={() => openModal("signup")}
          />
        )}

        {/* ── Main action area ── */}
        <div className="qs-action-card">
          {/* File upload area — connect to your real file input */}
          <div className="qs-upload-area">
            <span className="qs-upload-icon">📎</span>
            <p>Drop your PDF here, or <button className="qs-upload-link">browse</button></p>
            <p className="qs-upload-hint">PDF files only, max 20MB</p>
          </div>

          {/* Summary result */}
          {summaryResult && (
            <div className="qs-result">
              <h3>Summary</h3>
              <p>{summaryResult}</p>
            </div>
          )}

          {/* Error */}
          {summaryError && (
            <div className="qs-error" role="alert">
              ⚠ {summaryError}
            </div>
          )}

          {/* ── Quick Summary button ── */}
          <button
            className="qs-btn"
            onClick={handleQuickSummary}
            disabled={isSummarizing}
          >
            {isSummarizing ? (
              <span className="qs-btn-loading">
                <span className="qs-spinner" /> Summarizing…
              </span>
            ) : (
              "⚡ Quick Summary"
            )}
          </button>

          {/* Usage counter hint for anonymous users */}
          {!currentUser && (
            <p className="qs-usage-hint">
              Free for anonymous users · No account needed for first 5 summaries
            </p>
          )}
        </div>
      </div>

      {/* ── AuthModal ── */}
      <AuthModal
        isOpen={isOpen}
        onClose={closeModal}
        onSuccess={handleAuthSuccess}
        initialMode={modalMode}
      />
    </div>
  );
}
