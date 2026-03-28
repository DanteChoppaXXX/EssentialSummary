// src/components/AuthModal/ModalSignInForm.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sign-in form that lives inside the modal.
//
// INTEGRATION NOTE:
// Calls your existing signInWithEmail() and getAuthErrorMessage() from
// authService.js. Update the import path if yours differs.
//
// Props:
//   onSuccess (fn) — called after successful sign in, with no arguments.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";

// ── ADAPT THIS IMPORT to match your existing authService path ──
import { signInWithEmail, getAuthErrorMessage } from "../../services/authService";

export default function ModalSignInForm({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email, password);
      // Success — tell the parent modal to close
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
        <label htmlFor="modal-signin-email">Email</label>
        <input
          id="modal-signin-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete="email"
        />
      </div>

      <div className="modal-form-group">
        <label htmlFor="modal-signin-password">Password</label>
        <input
          id="modal-signin-password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="current-password"
        />
      </div>

      <button type="submit" className="modal-submit-btn" disabled={loading}>
        {loading ? (
          <span className="modal-btn-loading">
            <span className="modal-spinner" /> Signing in…
          </span>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
