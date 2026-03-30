// src/pages/ContactPage.jsx
import { useState, useRef } from "react";
import emailjs from "@emailjs/browser";
import "./ContactPage.css";

// ── EmailJS config ──────────────────────────────────────────────────────────
const EMAILJS_SERVICE_ID  = "service_buggbos";
const EMAILJS_TEMPLATE_ID = "template_qtlidgr";
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export default function ContactPage() {
  const formRef = useRef(null);

  const [form, setForm] = useState({ from_name: "", from_email: "", message: "" });
  const [sending,  setSending]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState("");

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
    setSuccess(false);
  }

  function validate() {
    if (!form.from_name.trim())  return "Please enter your name.";
    if (!form.from_email.trim()) return "Please enter your email.";
    if (!/\S+@\S+\.\S+/.test(form.from_email)) return "Please enter a valid email address.";
    if (!form.message.trim())    return "Please enter a message.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSending(true);
    setError("");

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_name:  form.from_name,
          from_email: form.from_email,
          message:    form.message,
          to_name:    "SummarizeAI",   // appears in your email template as {{to_name}}
          reply_to:   form.from_email,
        },
        EMAILJS_PUBLIC_KEY
      );

      setSuccess(true);
      setForm({ from_name: "", from_email: "", message: "" });
    } catch (err) {
      console.error("EmailJS error:", err);
      setError("Something went wrong. Please try again or email us directly.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="contact-page">
      <div className="contact-container">

        {/* ── Header ── */}
        <div className="contact-header">
          <div className="contact-badge">
            <span className="contact-badge-dot" />
            Get in touch
          </div>
          <h1 className="contact-title">We'd love to hear from you</h1>
          <div className="contact-title-bar" />
          <p className="contact-subtitle">
            Have a question, feedback, or just want to say hello?
            Send us a message and we'll get back to you.
          </p>
        </div>

        {/* ── Card ── */}
        <div className="contact-card">

          {/* Success state */}
          {success && (
            <div className="contact-success">
              <span className="contact-success-icon">✓</span>
              <div>
                <strong>Message sent!</strong>
                <p>Thanks for reaching out. We'll get back to you as soon as possible.</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="contact-error">
              <span>⚠</span> {error}
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className="contact-form" noValidate>

            <div className="contact-form-row">
              <div className="contact-field">
                <label htmlFor="from_name">Your name</label>
                <input
                  id="from_name"
                  name="from_name"
                  type="text"
                  placeholder="Jane Smith"
                  value={form.from_name}
                  onChange={handleChange}
                  disabled={sending}
                  autoComplete="name"
                />
              </div>

              <div className="contact-field">
                <label htmlFor="from_email">Email address</label>
                <input
                  id="from_email"
                  name="from_email"
                  type="email"
                  placeholder="jane@example.com"
                  value={form.from_email}
                  onChange={handleChange}
                  disabled={sending}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="contact-field">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                rows={6}
                placeholder="Tell us what's on your mind..."
                value={form.message}
                onChange={handleChange}
                disabled={sending}
              />
            </div>

            <button type="submit" className="contact-submit" disabled={sending}>
              {sending ? (
                <span className="contact-btn-loading">
                  <span className="contact-spinner" />
                  Sending…
                </span>
              ) : (
                "Send message →"
              )}
            </button>

          </form>

          {/* ── Info row ── */}
          <div className="contact-info-row">
            <div className="contact-info-item">
              <span className="contact-info-icon">📧</span>
          </div>
            <div className="contact-info-item">
              <span className="contact-info-icon">⚡</span>
              <div>
                <span className="contact-info-label">Response time</span>
                <span className="contact-info-value">Within 24 hours</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
