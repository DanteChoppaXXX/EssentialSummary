// src/utils/usageHelpers.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure helper functions for displaying plan status and usage.
// No Firestore reads — these work on the profile object you already have.
// ─────────────────────────────────────────────────────────────────────────────

// ── Plan label ────────────────────────────────────────────────────────────
export function getPlanLabel(userProfile) {
  if (!userProfile) return "Free";
  if (userProfile.plan === "premium") return "Premium";
  return "Free";
}

// ── Premium active check ──────────────────────────────────────────────────
export function isPremiumActive(userProfile) {
  if (!userProfile) return false;
  if (userProfile.plan !== "premium") return false;
  // If premiumUntil exists, verify it hasn't expired
  if (userProfile.premiumUntil) {
    return new Date() < new Date(userProfile.premiumUntil);
  }
  // No premiumUntil — trust the plan field
  return true;
}

// ── Usage display string ──────────────────────────────────────────────────
// Returns a human-readable usage string for the dashboard.
export function getUsageDisplay(userProfile) {
  if (!userProfile) return "0 / 10 Quick Summaries used this month";

  if (isPremiumActive(userProfile)) {
    return "Unlimited Quick Summaries";
  }

  const used  = userProfile.quickSummaryUsed  ?? 0;
  const limit = userProfile.quickSummaryLimit ?? 10;
  return `${used} / ${limit} Quick Summaries used this month`;
}

// ── Premium expiry formatted ──────────────────────────────────────────────
export function getPremiumExpiryLabel(userProfile) {
  if (!userProfile?.premiumUntil) return null;
  if (!isPremiumActive(userProfile)) return null;

  const date = new Date(userProfile.premiumUntil);
  return date.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ── Member since formatted ────────────────────────────────────────────────
export function getMemberSinceLabel(userProfile) {
  // Try createdAt from Firestore doc first
  const raw = userProfile?.createdAt;
  if (!raw) return null;

  // Firestore Timestamp → Date, or ISO string → Date
  const date = raw?.toDate ? raw.toDate() : new Date(raw);
  if (isNaN(date)) return null;

  return date.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ── Summary type label ────────────────────────────────────────────────────
export function getSummaryTypeLabel(summaryType) {
  if (summaryType === "chapter") return "Chapter Summary";
  return "Quick Summary";
}

// ── Format summary date ───────────────────────────────────────────────────
export function formatSummaryDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── Truncate summary content for preview ─────────────────────────────────
export function truncateContent(content, maxLength = 120) {
  if (!content) return "";
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength).trimEnd() + "…";
}
