// src/pages/PricingPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Single premium plan pricing page with Paystack inline payment.
//
// Paystack setup:
//   1. npm install @paystack/inline-js   (or use the CDN script — see below)
//   2. Add VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxx to your .env file
//   3. Get your public key from: https://dashboard.paystack.com/#/settings/developer
//
// This file uses the @paystack/inline-js package (recommended for Vite/React).
// If you prefer the CDN script approach, see the comment in initializePaystack().
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  activatePremiumPlan,
  isPremiumActive,
  getPremiumStatus,
  fetchUserProfile,
  downgradeExpiredPremiumIfNeeded,
} from "../services/premiumService";
import "./PricingPage.css";

// ── Pricing config — change these in one place ───────────────────────────
const PLAN = {
  name:         "Premium Monthly",
  price:        150000,        // in kobo (Paystack uses smallest currency unit)
                             // 150000 kobo = ₦1500.00 — change to your actual price
  currency:     "NGN",       // change to your currency: "GHS", "USD", "KES" etc.
  displayPrice: "₦1,500",   // what users see — update to match price above
  period:       "/ month",
  features: [
    "Unlimited Quick Summaries",
    "Summarize full chapters",
    "Priority AI processing",
    "Access to all future features",
    "Cancel anytime",
  ],
};

export default function PricingPage() {
  const navigate   = useNavigate();
  const { currentUser } = useAuth();

  const [userProfile,   setUserProfile]   = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [paying,         setPaying]         = useState(false);
  const [activating,     setActivating]     = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage,   setErrorMessage]   = useState("");

  // ── Load user profile on mount ──
  useEffect(() => {
    if (!currentUser) {
      setLoadingProfile(false);
      return;
    }

    async function loadProfile() {
      try {
        let profile = await fetchUserProfile(currentUser.uid);
        // Lazy expiry check — downgrade if needed before rendering
        profile = await downgradeExpiredPremiumIfNeeded(currentUser.uid, profile);
        setUserProfile(profile);
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
  }, [currentUser]);

  const premiumStatus = getPremiumStatus(userProfile);
  const alreadyPremium = premiumStatus.status === "active";

  // ── Format expiry date for display ──
  function formatExpiry(date) {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-GB", {
      day:   "numeric",
      month: "long",
      year:  "numeric",
    });
  }

  // ── Paystack payment handler ──────────────────────────────────────────────
  async function handleUpgrade() {
    setErrorMessage("");

    if (!currentUser) {
      navigate("/signin");
      return;
    }

    if (alreadyPremium) return;

    setPaying(true);

    try {
      // Dynamically import Paystack inline JS
      // Make sure you have run: npm install @paystack/inline-js
      const PaystackPop = (await import("@paystack/inline-js")).default;

      const handler = new PaystackPop();

      handler.newTransaction({
        key:       import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email:     currentUser.email,
        amount:    PLAN.price,         // in kobo/cents (smallest unit)
        currency:  PLAN.currency,
        ref:       `ps_${currentUser.uid}_${Date.now()}`, // unique ref per payment
        metadata: {
          userId:    currentUser.uid,
          plan:      "premium_monthly",
          // Custom fields shown in Paystack dashboard
          custom_fields: [
            { display_name: "User ID",   variable_name: "user_id",   value: currentUser.uid },
            { display_name: "Plan",      variable_name: "plan",      value: "premium_monthly" },
          ],
        },

        // ── Called when payment is successful ──
        onSuccess: async (transaction) => {
          console.log("Paystack payment success:", transaction.reference);
          setPaying(false);
          setActivating(true);

          try {
            // Activate premium in Firestore
            const premiumUntil = await activatePremiumPlan(currentUser.uid);

            // Refresh local profile so the UI updates
            const updatedProfile = await fetchUserProfile(currentUser.uid);
            setUserProfile(updatedProfile);

            setSuccessMessage(
              `🎉 You're now Premium! Access expires on ${formatExpiry(premiumUntil)}.`
            );
          } catch (err) {
            console.error("Failed to activate premium:", err);
            setErrorMessage(
              "Payment was received but we couldn't activate premium. " +
              "Please contact support with your payment reference: " +
              transaction.reference
            );
          } finally {
            setActivating(false);
          }
        },

        // ── Called when user closes the Paystack popup without paying ──
        onCancel: () => {
          console.log("Paystack popup closed by user");
          setPaying(false);
          // No error — user just closed the popup
        },
      });

    } catch (err) {
      console.error("Paystack init error:", err);
      setPaying(false);
      setErrorMessage("Could not load payment. Please try again.");
    }
  }

  // ── Determine button state ────────────────────────────────────────────────
  function getButtonLabel() {
    if (activating)     return "Activating your plan…";
    if (paying)         return "Opening payment…";
    if (alreadyPremium) return "You're already Premium ✓";
    if (!currentUser)   return "Sign in to Upgrade";
    return `Upgrade to Premium — ${PLAN.displayPrice}${PLAN.period}`;
  }

  function isButtonDisabled() {
    return paying || activating || alreadyPremium || loadingProfile;
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="pricing-page">

      {/* ── Back link ── */}
      <button className="pricing-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="pricing-container">

        {/* ── Header ── */}
        <div className="pricing-header">
          <div className="pricing-badge">
            <span className="pricing-badge-dot" />
            Essential Summary
          </div>
          <h1 className="pricing-title">Unlock your full study potential</h1>
          <div className="pricing-title-bar" />
          <p className="pricing-subtitle">
            Everything you need to read smarter and study less.
          </p>
        </div>

        {/* ── Plan card ── */}
        <div className={`pricing-card ${alreadyPremium ? "is-active" : ""}`}>

          {alreadyPremium && (
            <div className="pricing-current-badge">Your current plan</div>
          )}

          <div className="pricing-plan-header">
            <div>
              <h2 className="pricing-plan-name">{PLAN.name}</h2>
              <p className="pricing-plan-desc">Billed monthly · cancel anytime</p>
            </div>
            <div className="pricing-plan-price">
              <span className="pricing-price-amount">{PLAN.displayPrice}</span>
              <span className="pricing-price-period">{PLAN.period}</span>
            </div>
          </div>

          {/* Features */}
          <ul className="pricing-features">
            {PLAN.features.map((f, i) => (
              <li key={i} className="pricing-feature-item">
                <span className="pricing-check">✓</span>
                {f}
              </li>
            ))}
          </ul>

          {/* Premium expiry notice */}
          {alreadyPremium && premiumStatus.premiumUntil && (
            <div className="pricing-expiry-notice">
              🗓 Your premium access is active until{" "}
              <strong>{formatExpiry(premiumStatus.premiumUntil)}</strong>
            </div>
          )}

          {/* Not logged in notice */}
          {!currentUser && !loadingProfile && (
            <div className="pricing-login-notice">
              👤 Please{" "}
              <button
                className="pricing-login-link"
                onClick={() => navigate("/signin")}
              >
                sign in
              </button>{" "}
              to upgrade your account.
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="pricing-success">{successMessage}</div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="pricing-error">⚠ {errorMessage}</div>
          )}

          {/* CTA button */}
          <button
            className={`pricing-cta ${alreadyPremium ? "is-premium" : ""}`}
            onClick={handleUpgrade}
            disabled={isButtonDisabled()}
          >
            {(paying || activating) && (
              <span className="pricing-spinner" />
            )}
            {getButtonLabel()}
          </button>

          <p className="pricing-guarantee">
            🔒 Secure payment via Paystack · 30-day access guaranteed
          </p>
        </div>

        {/* ── FAQ / reassurance ── */}
        <div className="pricing-faq">
          <div className="pricing-faq-item">
            <strong>What happens after 30 days?</strong>
            <p>Your account reverts to the free tier automatically. You won't be charged again unless you upgrade again.</p>
          </div>
          <div className="pricing-faq-item">
            <strong>Can I still use the app after premium expires?</strong>
            <p>Yes — you keep your free tier access (10 Quick Summaries per month).</p>
          </div>
          <div className="pricing-faq-item">
            <strong>Is my payment secure?</strong>
            <p>Payments are processed by Paystack, a PCI-DSS compliant payment processor.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
