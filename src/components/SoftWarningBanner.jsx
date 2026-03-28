// src/components/SoftWarningBanner.jsx
// Shown to anonymous users after their 3rd free use.
// Auto-dismisses after 5 seconds so it doesn't persist while reading.
// Re-appears after each subsequent use (parent resets anonWarningMessage).
//
// Props:
//   message   (string) — from getSoftWarningMessage()
//   onSignUp  (fn)     — opens AuthModal in signup mode
//   onClose   (fn)     — called when the timer fires (parent hides the banner)
import { useEffect } from "react";
import "./SoftWarningBanner.css";

const AUTO_DISMISS_MS = 5000;

export default function SoftWarningBanner({ message, onSignUp, onClose }) {
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      onClose();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="soft-warning-banner" role="status">
      <span className="soft-warning-icon">💡</span>
      <span className="soft-warning-text">{message}</span>
      <button className="soft-warning-cta" onClick={onSignUp}>
        Sign up free →
      </button>
    </div>
  );
}
