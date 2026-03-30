// src/components/AuthModal/AuthModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable auth modal. Pops up over the current page without navigation.
// Accepts your existing sign-in / sign-up logic via onSuccess callback.
//
// Props:
//   isOpen      (bool)     — controls visibility
//   onClose     (fn)       — called when user closes modal
//   onSuccess   (fn)       — called after successful sign in OR sign up
//                            use this to close the modal and re-enable the action
//   initialMode (string)   — "signin" | "signup" (default: "signup")
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import ModalSignInForm from "./ModalSignInForm";
import ModalSignUpForm from "./ModalSignUpForm";
import "./AuthModal.css";

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "signup",
}) {
  const [mode, setMode] = useState(initialMode);
  const overlayRef = useRef(null);

  // Sync mode when modal re-opens with a different initialMode
  useEffect(() => {
    if (isOpen) setMode(initialMode);
  }, [isOpen, initialMode]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Close when clicking outside the card
  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="auth-modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "signup" ? "Create account" : "Sign in"}
    >
      <div className="auth-modal-card">
        {/* ── Header ── */}
        <div className="auth-modal-header">
          <div className="auth-modal-badge">📄 Essential Summary</div>
          <button
            className="auth-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Title block ── */}
        <div className="auth-modal-title-block">
          {mode === "signup" ? (
            <>
              <h2 className="auth-modal-title">You've used your free summaries</h2>
              <p className="auth-modal-subtitle">
                Create a free account to keep summarizing — no credit card needed.
              </p>
            </>
          ) : (
            <>
              <h2 className="auth-modal-title">Welcome back</h2>
              <p className="auth-modal-subtitle">
                Sign in to pick up where you left off.
              </p>
            </>
          )}
        </div>

        {/* ── Tab switcher ── */}
        <div className="auth-modal-tabs" role="tablist">
          <button
            className={`auth-modal-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => setMode("signup")}
            role="tab"
            aria-selected={mode === "signup"}
          >
            Create account
          </button>
          <button
            className={`auth-modal-tab ${mode === "signin" ? "active" : ""}`}
            onClick={() => setMode("signin")}
            role="tab"
            aria-selected={mode === "signin"}
          >
            Sign in
          </button>
        </div>

        {/* ── Form area ── */}
        <div className="auth-modal-form-area">
          {mode === "signup" ? (
            <ModalSignUpForm onSuccess={onSuccess} />
          ) : (
            <ModalSignInForm onSuccess={onSuccess} />
          )}
        </div>

        {/* ── Footer switch link ── */}
        <p className="auth-modal-switch">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button className="auth-modal-switch-btn" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <button className="auth-modal-switch-btn" onClick={() => setMode("signup")}>
                Create one free
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
