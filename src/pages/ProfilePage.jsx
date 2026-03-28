// src/pages/ProfilePage.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getPlanLabel,
  isPremiumActive,
  getPremiumExpiryLabel,
  getMemberSinceLabel,
} from "../utils/usageHelpers";
import "./ProfilePage.css";

export default function ProfilePage() {
  const { currentUser, userProfile, handleLogOut } = useAuth();
  const navigate = useNavigate();

  if (!currentUser) {
    navigate("/signin");
    return null;
  }

  async function handleSignOut() {
    await handleLogOut();
    navigate("/signin");
  }

  const planLabel   = getPlanLabel(userProfile);
  const isPremium   = isPremiumActive(userProfile);
  const expiryLabel = getPremiumExpiryLabel(userProfile);
  const memberSince = getMemberSinceLabel(userProfile);
  const subStatus   = userProfile?.subscriptionStatus ?? "none";

  const displayName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "there";

  const email       = currentUser.email || "—";

  return (
    <div className="profile-page">
      <div className="profile-container">

        <div className="profile-header">
          <h1 className="profile-title">Account</h1>
          <p className="profile-subtitle">Your profile and plan details.</p>
        </div>

        {/* ── Profile info card ── */}
        <div className="profile-card">
          <h2 className="profile-card-title">Profile</h2>

          <div className="profile-row">
            <span className="profile-label">Display name</span>
            <span className="profile-value">{displayName}</span>
          </div>
          <div className="profile-row">
            <span className="profile-label">Email</span>
            <span className="profile-value">{email}</span>
          </div>
          {memberSince && (
            <div className="profile-row">
              <span className="profile-label">Member since</span>
              <span className="profile-value">{memberSince}</span>
            </div>
          )}
        </div>

        {/* ── Plan info card ── */}
        <div className={`profile-card ${isPremium ? "profile-card-premium" : ""}`}>
          <h2 className="profile-card-title">Plan & Subscription</h2>

          <div className="profile-row">
            <span className="profile-label">Current plan</span>
            <span className={`profile-value ${isPremium ? "text-premium" : ""}`}>
              {isPremium ? "⚡ Premium" : "Free"}
            </span>
          </div>

          <div className="profile-row">
            <span className="profile-label">Status</span>
            <span className={`profile-status-badge status-${subStatus}`}>
              {subStatus === "active"  ? "Active"  : null}
              {subStatus === "expired" ? "Expired" : null}
              {subStatus === "none"    ? "Free tier" : null}
              {!["active","expired","none"].includes(subStatus) ? subStatus : null}
            </span>
          </div>

          {expiryLabel && (
            <div className="profile-row">
              <span className="profile-label">Premium until</span>
              <span className="profile-value">{expiryLabel}</span>
            </div>
          )}

          {!isPremium && (
            <button
              className="profile-upgrade-btn"
              onClick={() => navigate("/pricing")}
            >
              Upgrade to Premium →
            </button>
          )}
        </div>

        {/* ── Password placeholder ── */}
        <div className="profile-card">
          <h2 className="profile-card-title">Security</h2>
          <p className="profile-note">
            To change your password, use the "Forgot password" link on the sign-in page.
            Full password management coming soon.
          </p>
        </div>

        {/* ── Sign out ── */}
        <button className="profile-signout-btn" onClick={handleSignOut}>
          Sign out
        </button>

      </div>
    </div>
  );
}
