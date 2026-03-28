// src/utils/anonymousUsage.js
// ─────────────────────────────────────────────────────────────────────────────
// Anonymous usage tracking via localStorage.
// Only used for users who are NOT logged in.
// Logged-in users bypass all of this entirely.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "anon_quick_summary_count";
const FREE_LIMIT = 5;
const SOFT_WARN_THRESHOLD = 3; // Show soft warning after this many uses

// ── Get current count ──────────────────────────────────────────────────────
export function getAnonymousQuickSummaryCount() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const count = parseInt(raw, 10);
  // Return 0 if missing or invalid
  return isNaN(count) ? 0 : count;
}

// ── Increment count (call ONLY after a successful summary action) ──────────
export function incrementAnonymousQuickSummaryCount() {
  const current = getAnonymousQuickSummaryCount();
  const next = current + 1;
  localStorage.setItem(STORAGE_KEY, String(next));
  return next;
}

// ── Check if the user has hit the hard limit ───────────────────────────────
export function hasReachedAnonymousQuickSummaryLimit() {
  return getAnonymousQuickSummaryCount() >= FREE_LIMIT;
}

// ── How many free uses are left ────────────────────────────────────────────
export function getAnonymousQuickSummaryRemaining() {
  const used = getAnonymousQuickSummaryCount();
  return Math.max(0, FREE_LIMIT - used);
}

// ── Should we show a soft warning? ────────────────────────────────────────
// Returns true when the user has used some but hasn't hit the hard limit yet.
export function shouldShowSoftWarning() {
  const count = getAnonymousQuickSummaryCount();
  return count >= SOFT_WARN_THRESHOLD && count < FREE_LIMIT;
}

// ── Get soft warning message (returns null if no warning needed) ──────────
export function getSoftWarningMessage() {
  if (!shouldShowSoftWarning()) return null;
  const remaining = getAnonymousQuickSummaryRemaining();
  const word = remaining === 1 ? "summary" : "summaries";
  return `You have ${remaining} free ${word} left. Create a free account to keep going.`;
}

// ── Reset (useful for testing) ─────────────────────────────────────────────
export function resetAnonymousQuickSummaryCount() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Export constants for use in components ────────────────────────────────
export { FREE_LIMIT, SOFT_WARN_THRESHOLD };
