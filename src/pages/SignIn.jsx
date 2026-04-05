// src/pages/SignIn.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmail, getAuthErrorMessage, sendPasswordReset } from "../services/authService";
import "./Auth.css";

export default function SignIn() {
  const navigate = useNavigate();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // Forgot password state
  const [showReset,    setShowReset]    = useState(false);
  const [resetEmail,   setResetEmail]   = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError,   setResetError]   = useState("");

  // ── Sign in ──
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
      navigate("/dashboard");
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  }

  // ── Password reset ──
  async function handlePasswordReset(e) {
    e.preventDefault();
    setResetError("");
    setResetSuccess(false);

    if (!resetEmail.trim()) {
      setResetError("Please enter your email address.");
      return;
    }

    setResetSending(true);
    try {
      await sendPasswordReset(resetEmail.trim());
      setResetSuccess(true);
    } catch (err) {
      // Show a friendly message regardless of whether the email exists
      // (avoids user enumeration — Firebase may throw user-not-found)
      if (err.code === "auth/invalid-email") {
        setResetError("Please enter a valid email address.");
      } else {
        // For any other error including user-not-found, show success anyway
        // so we don't reveal whether an account exists
        setResetSuccess(true);
      }
    } finally {
      setResetSending(false);
    }
  }

  function openReset() {
    // Pre-fill reset email with whatever the user typed in the sign-in form
    setResetEmail(email);
    setResetError("");
    setResetSuccess(false);
    setShowReset(true);
  }

  function closeReset() {
    setShowReset(false);
    setResetEmail("");
    setResetError("");
    setResetSuccess(false);
  }

  // ── Forgot password panel ──
  if (showReset) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-subtitle">
            Enter your email and we'll send you a link to reset your password.
          </p>

          {resetSuccess ? (
            // Success state
            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
              <div className="auth-reset-success">
                <span>✓</span>
                <p>
                  If an account exists for <strong>{resetEmail}</strong>, a
                  password reset link has been sent. Check your inbox
                  (and spam folder).
                </p>
              </div>
              <button className="auth-btn" onClick={closeReset}>
                Back to sign in
              </button>
            </div>
          ) : (
            // Reset form
            <form onSubmit={handlePasswordReset} className="auth-form">
              {resetError && (
                <div className="auth-error" role="alert">
                  <span className="auth-error-icon">⚠</span>
                  {resetError}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="reset-email">Email address</label>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={resetSending}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button type="submit" className="auth-btn" disabled={resetSending}>
                {resetSending ? (
                  <span className="btn-loading">
                    <span className="spinner" /> Sending…
                  </span>
                ) : (
                  "Send reset link"
                )}
              </button>

              <button
                type="button"
                className="auth-back-btn"
                onClick={closeReset}
                disabled={resetSending}
              >
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Normal sign in view ──
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        {error && (
          <div className="auth-error" role="alert">
            <span className="auth-error-icon">⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            {/* Label row — password label + forgot link side by side */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
              <label htmlFor="password" style={{ margin:0 }}>Password</label>
              <button
                type="button"
                className="auth-forgot-btn"
                onClick={openReset}
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" /> Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account?{" "}
          <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  );
}
