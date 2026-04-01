// src/pages/ImageSummaryPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// NEW ISOLATED FEATURE — Image OCR Summarizer.
//
// SAFE RULES FOLLOWED:
//   • Does NOT import anything from pdfUtils, PDFReader, or the PDF pipeline
//   • Reuses only: summarizeWithOpenRouter (text→summary helper)
//                  saveSummary (Firestore save helper)
//                  useAuth, useUpgradeModal (existing hooks)
//                  isPremiumActive (existing helper)
//   • Premium gate: reuses existing UpgradeModal — no new payment logic
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth }        from "../context/AuthContext";
import { useUpgradeModal } from "../hooks/useUpgradeModal";
import { isPremiumActive } from "../services/premiumService";
import UpgradeModal        from "../components/UpgradeModal/UpgradeModal";

// ── Reuse only the final text→summary OpenRouter helper ──
import { summarizeWithOpenRouter, getOpenRouterApiKey } from "../components/openRouterAPI";

// ── Reuse existing save helper (optional — isolated, safe) ──
import { saveSummary } from "../services/summaryService";

// ── NEW isolated OCR service ──
import {
  validateImageFile,
  extractTextFromImage,
  cleanOcrText,
  hasUsableText,
} from "../services/ocrService";

import "./ImageSummaryPage.css";

export default function ImageSummaryPage() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const { isOpen: isUpgradeOpen, openUpgradeModal, closeUpgradeModal } = useUpgradeModal();

  // ── State ──
  const [selectedImage, setSelectedImage]   = useState(null);
  const [imagePreview,  setImagePreview]    = useState(null);
  const [status,        setStatus]          = useState("idle");
  // status: "idle" | "ocr" | "summarizing" | "done" | "error"
  const [statusMessage, setStatusMessage]   = useState("");
  const [ocrText,       setOcrText]         = useState("");
  const [summary,       setSummary]         = useState("");
  const [error,         setError]           = useState("");
  const [wordCount,     setWordCount]       = useState(0);

  const fileInputRef = useRef(null);

  // ── Premium gate ──────────────────────────────────────────────────────────
  function checkPremiumAccess() {
    if (!currentUser) {
      // Not logged in — send to sign in
      navigate("/signin");
      return false;
    }
    if (!isPremiumActive(userProfile)) {
      // Free user — open existing upgrade modal
      openUpgradeModal();
      return false;
    }
    return true;
  }

  // ── File selection ────────────────────────────────────────────────────────
  function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error);
      setStatus("error");
      return;
    }

    // Reset previous results
    setError("");
    setSummary("");
    setOcrText("");
    setStatus("idle");
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  // ── Main action: Extract + Summarize ─────────────────────────────────────
  async function handleExtractAndSummarize() {
    // 1. Premium gate first
    if (!checkPremiumAccess()) return;

    // 2. Need an image
    if (!selectedImage) {
      setError("Please select an image first.");
      setStatus("error");
      return;
    }

    // 3. Need an API key
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      setError("OpenRouter API key not found. Please configure it first.");
      setStatus("error");
      return;
    }

    setError("");
    setSummary("");
    setOcrText("");

    try {
      // ── Step 1: OCR ──
      setStatus("ocr");
      const rawText = await extractTextFromImage(selectedImage, (msg) => {
        setStatusMessage(msg);
      });

      const cleaned = cleanOcrText(rawText);
      setOcrText(cleaned);

      if (!hasUsableText(cleaned)) {
        setError(
          "Not enough readable text found in this image. " +
          "Try a clearer, well-lit photo with larger text."
        );
        setStatus("error");
        return;
      }

      const words = cleaned.trim().split(/\s+/).filter(Boolean).length;
      setWordCount(words);

      // ── Step 2: Summarize ──
      setStatus("summarizing");
      setStatusMessage("Generating summary…");

      // Reuse the existing OpenRouter helper — same function, separate call path
      const result = await summarizeWithOpenRouter(
        cleaned,
        "page",   // use "page" prompt style (concise bullet-point summary)
        apiKey,
        {}
      );

      if (!result || result.trim().length === 0) {
        setError("Summarization returned empty results. Please try again.");
        setStatus("error");
        return;
      }

      setSummary(result);
      setStatus("done");

      // ── Step 3: Save (fire-and-forget, won't break anything if it fails) ──
      if (currentUser) {
        saveSummary(currentUser.uid, {
          fileName:    selectedImage.name ?? "Image upload",
          summaryType: "quick",
          content:     result,
          sourceType:  "ocr",         // distinguishes from PDF summaries
          wordCount:   words,
        }).catch((err) => console.error("Failed to save OCR summary:", err));
      }

    } catch (err) {
      console.error("ImageSummary error:", err);
      setError(`Something went wrong: ${err.message || "Unknown error"}. Please try again.`);
      setStatus("error");
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function handleReset() {
    setSelectedImage(null);
    setImagePreview(null);
    setOcrText("");
    setSummary("");
    setError("");
    setStatus("idle");
    setStatusMessage("");
    setWordCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summary);
      alert("Summary copied to clipboard!");
    } catch {
      alert("Could not copy. Please select and copy manually.");
    }
  }

  const isProcessing = status === "ocr" || status === "summarizing";

  return (
    <div className="isp-page">
      <div className="isp-container">

        {/* ── Header ── */}
        <div className="isp-header">
          <div className="isp-badge">
            <span className="isp-badge-dot" />
            Premium Feature
          </div>
          <h1 className="isp-title">Image to Summary</h1>
          <div className="isp-title-bar" />
          <p className="isp-subtitle">
            Upload a clear photo or screenshot of a textbook page, handwritten note,
            or document — we'll extract the text and summarize it for you.
          </p>
          <div className="isp-tip">
            💡 <strong>Tip:</strong> For best results, use a clear, well-lit image with readable text.
          </div>
        </div>

        {/* ── Upload card ── */}
        <div className="isp-card">

          {/* Image preview or drop zone */}
          {imagePreview ? (
            <div className="isp-preview-wrap">
              <img src={imagePreview} alt="Selected" className="isp-preview-img" />
              <div className="isp-preview-meta">
                <span className="isp-preview-name">{selectedImage?.name}</span>
                <button className="isp-change-btn" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                  Change image
                </button>
              </div>
            </div>
          ) : (
            <label className="isp-dropzone" htmlFor="image-upload">
              <span className="isp-dropzone-icon">🖼️</span>
              <span className="isp-dropzone-primary">Click to upload an image</span>
              <span className="isp-dropzone-secondary">JPG or PNG · Max 10MB</span>
            </label>
          )}

          <input
            ref={fileInputRef}
            id="image-upload"
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={handleImageSelect}
            style={{ display: "none" }}
            disabled={isProcessing}
          />

          {/* Status message during processing */}
          {isProcessing && (
            <div className="isp-status">
              <div className="isp-spinner" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Error */}
          {status === "error" && error && (
            <div className="isp-error">
              <span>⚠</span> {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="isp-actions">
            {!imagePreview ? (
              <button
                className="isp-btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Image
              </button>
            ) : (
              <>
                <button
                  className="isp-btn-primary"
                  onClick={handleExtractAndSummarize}
                  disabled={isProcessing || status === "done"}
                >
                  {isProcessing ? "Processing…" : "Extract & Summarize"}
                </button>
                <button
                  className="isp-btn-secondary"
                  onClick={handleReset}
                  disabled={isProcessing}
                >
                  Start over
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Summary result ── */}
        {status === "done" && summary && (
          <div className="isp-result-card">
            <div className="isp-result-header">
              <div>
                <h2 className="isp-result-title">📸 Image Summary</h2>
                <p className="isp-result-meta">{wordCount} words extracted from image</p>
              </div>
              <div className="isp-result-actions">
                <button className="isp-copy-btn" onClick={handleCopy}>Copy</button>
                <button className="isp-reset-btn" onClick={handleReset}>New image</button>
              </div>
            </div>
            <div className="isp-result-body">
              {summary}
            </div>
          </div>
        )}

        {/* ── Not premium nudge (shown when not logged in or free) ── */}
        {!currentUser && (
          <div className="isp-gate-notice">
            <p>
              <strong>Image summarization is a Premium feature.</strong><br />
              <button className="isp-gate-link" onClick={() => navigate("/signin")}>Sign in</button>
              {" "}or{" "}
              <button className="isp-gate-link" onClick={() => navigate("/pricing")}>upgrade to Premium</button>
              {" "}to use this feature.
            </p>
          </div>
        )}

        {currentUser && !isPremiumActive(userProfile) && (
          <div className="isp-gate-notice">
            <p>
              <strong>Image summarization is a Premium feature.</strong><br />
              <button className="isp-gate-link" onClick={openUpgradeModal}>Upgrade to Premium</button>
              {" "}to unlock unlimited image summaries, chapter summaries, and more.
            </p>
          </div>
        )}

      </div>

      {/* ── Existing UpgradeModal — reused, not duplicated ── */}
      <UpgradeModal
        isOpen={isUpgradeOpen}
        onClose={closeUpgradeModal}
        onUpgrade={() => { closeUpgradeModal(); navigate("/pricing"); }}
        userProfile={userProfile}
      />
    </div>
  );
}
