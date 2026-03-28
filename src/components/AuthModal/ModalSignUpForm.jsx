// src/components/AuthModal/ModalSignUpForm.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sign-up form that lives inside the modal.
//
// INTEGRATION NOTE:
// This component calls your existing signUpWithEmail() and getAuthErrorMessage()
// functions from authService.js. If your function names differ, update the
// import paths and function calls below — the rest stays the same.
//
// Props:
//   onSuccess (fn) — called after successful sign up, with no arguments.
//                    Use this to close the modal.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";

// ── ADAPT THIS IMPORT to match your existing authService path ──
import { signUpWithEmail, getAuthErrorMessage } from "../../services/authService";

export default function ModalSignUpForm({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(email, password);
      // Success — tell the parent modal to close and re-enable the action
      onSuccess();
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="modal-form">
      {error && (
        <div className="modal-form-error" role="alert">
          <span>⚠</span> {error}
        </div>
      )}

      <div className="modal-form-group">
        <label htmlFor="modal-signup-email">Email</label>
        <input
          id="modal-signup-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete="email"
        />
      </div>

      <div className="modal-form-group">
        <label htmlFor="modal-signup-password">Password</label>
        <input
          id="modal-signup-password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
        />
      </div>

      <div className="modal-form-group">
        <label htmlFor="modal-signup-confirm">Confirm password</label>
        <input
          id="modal-signup-confirm"
          type="password"
          placeholder="Re-enter password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
        />
      </div>

      <button type="submit" className="modal-submit-btn" disabled={loading}>
        {loading ? (
          <span className="modal-btn-loading">
            <span className="modal-spinner" /> Creating account…
          </span>
        ) : (
          "Create free account"
        )}
      </button>
    </form>
  );
}
