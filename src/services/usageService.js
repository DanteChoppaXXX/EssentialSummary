// src/services/usageService.js
// ─────────────────────────────────────────────────────────────────────────────
// Firestore-based usage tracking for logged-in users.
// Anonymous usage (localStorage) is handled separately in anonymousUsage.js.
//
// All functions are async and safe to call multiple times — they never
// overwrite existing data unless explicitly resetting.
// ─────────────────────────────────────────────────────────────────────────────
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

// ── Constants ─────────────────────────────────────────────────────────────
const FREE_MONTHLY_LIMIT = 10;
const USERS_COLLECTION = "users";

// ─────────────────────────────────────────────────────────────────────────────
// 1. initializeFreeTierUsageIfMissing(userId)
//
// Called when a free user is about to use Quick Summary.
// ONLY writes fields that are missing — never overwrites existing data.
// Safe to call on every login or first action.
// ─────────────────────────────────────────────────────────────────────────────
export async function initializeFreeTierUsageIfMissing(userId) {
  const userRef = doc(db, USERS_COLLECTION, userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    console.warn("usageService: user document does not exist for", userId);
    return;
  }

  const data = snapshot.data();

  // If all usage fields are already present, do nothing
  if (
    data.quickSummaryUsed !== undefined &&
    data.quickSummaryLimit !== undefined &&
    data.usagePeriodStart !== undefined &&
    data.usagePeriodEnd !== undefined
  ) {
    return; // already initialized
  }

  // Build only the missing fields so we never overwrite existing ones
  const now = new Date();
  const oneMonthLater = new Date(now);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

  const missingFields = {};

  if (data.quickSummaryUsed === undefined) missingFields.quickSummaryUsed = 0;
  if (data.quickSummaryLimit === undefined) missingFields.quickSummaryLimit = FREE_MONTHLY_LIMIT;
  if (data.usagePeriodStart === undefined) missingFields.usagePeriodStart = now.toISOString();
  if (data.usagePeriodEnd === undefined)   missingFields.usagePeriodEnd = oneMonthLater.toISOString();
  if (data.lastUsageAt === undefined)      missingFields.lastUsageAt = null;

  // merge: true ensures we never overwrite unrelated fields
  await setDoc(userRef, missingFields, { merge: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. getUserUsageStatus(userId)
//
// Fetches the user document and returns a plain object with the usage fields.
// Returns null if the document doesn't exist.
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserUsageStatus(userId) {
  const userRef = doc(db, USERS_COLLECTION, userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    plan:              data.plan ?? "free",
    quickSummaryUsed:  data.quickSummaryUsed ?? 0,
    quickSummaryLimit: data.quickSummaryLimit ?? FREE_MONTHLY_LIMIT,
    usagePeriodStart:  data.usagePeriodStart ?? null,
    usagePeriodEnd:    data.usagePeriodEnd ?? null,
    lastUsageAt:       data.lastUsageAt ?? null,
    updatedAt:         data.updatedAt ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. shouldResetUsagePeriod(userProfile)
//
// Takes the plain profile object (from getUserUsageStatus).
// Returns true if the current date is past usagePeriodEnd.
// ─────────────────────────────────────────────────────────────────────────────
export function shouldResetUsagePeriod(userProfile) {
  if (!userProfile?.usagePeriodEnd) return false;

  const periodEnd = new Date(userProfile.usagePeriodEnd);
  const now = new Date();
  return now > periodEnd;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. resetMonthlyQuickSummaryUsage(userId)
//
// Resets the monthly counter and moves the period window forward by one month.
// Called lazily when shouldResetUsagePeriod() returns true.
// ─────────────────────────────────────────────────────────────────────────────
export async function resetMonthlyQuickSummaryUsage(userId) {
  const userRef = doc(db, USERS_COLLECTION, userId);

  const now = new Date();
  const oneMonthLater = new Date(now);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

  await updateDoc(userRef, {
    quickSummaryUsed:  0,
    usagePeriodStart:  now.toISOString(),
    usagePeriodEnd:    oneMonthLater.toISOString(),
    updatedAt:         serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. canUserUseQuickSummary(userProfile)
//
// Pure check — no Firestore writes.
// Returns { allowed: bool, reason: string }
// Call this AFTER any needed reset has already been applied.
// ─────────────────────────────────────────────────────────────────────────────
export function canUserUseQuickSummary(userProfile) {
  if (!userProfile) {
    return { allowed: false, reason: "no_profile" };
  }

  // Premium users are never blocked
  if (userProfile.plan === "premium") {
    return { allowed: true, reason: "premium" };
  }

  // Free user — check count against limit
  const used  = userProfile.quickSummaryUsed  ?? 0;
  const limit = userProfile.quickSummaryLimit ?? FREE_MONTHLY_LIMIT;

  if (used >= limit) {
    return { allowed: false, reason: "limit_reached" };
  }

  return { allowed: true, reason: "free_tier_ok" };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. incrementQuickSummaryUsage(userId)
//
// Call this ONLY after a confirmed successful Quick Summary action.
// Increments quickSummaryUsed by 1 and updates lastUsageAt + updatedAt.
// ─────────────────────────────────────────────────────────────────────────────
export async function incrementQuickSummaryUsage(userId) {
  const userRef = doc(db, USERS_COLLECTION, userId);

  // Read current count first (avoids Firestore increment import complexity)
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    console.warn("usageService: cannot increment — user doc not found");
    return;
  }

  const current = snapshot.data().quickSummaryUsed ?? 0;

  await updateDoc(userRef, {
    quickSummaryUsed: current + 1,
    lastUsageAt:      new Date().toISOString(),
    updatedAt:        serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. getQuickSummaryRemaining(userProfile)
//
// Returns how many uses are left. Returns Infinity for premium.
// ─────────────────────────────────────────────────────────────────────────────
export function getQuickSummaryRemaining(userProfile) {
  if (!userProfile) return 0;
  if (userProfile.plan === "premium") return Infinity;

  const used  = userProfile.quickSummaryUsed  ?? 0;
  const limit = userProfile.quickSummaryLimit ?? FREE_MONTHLY_LIMIT;
  return Math.max(0, limit - used);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. getUsageBannerMessage(userProfile)
//
// Returns a human-readable string for the usage indicator UI.
// Returns null if the user is premium (no message needed).
// ─────────────────────────────────────────────────────────────────────────────
export function getUsageBannerMessage(userProfile) {
  if (!userProfile || userProfile.plan === "premium") return null;

  const used      = userProfile.quickSummaryUsed  ?? 0;
  const limit     = userProfile.quickSummaryLimit ?? FREE_MONTHLY_LIMIT;
  const remaining = Math.max(0, limit - used);

  if (remaining === 0) {
    return `You've used all ${limit} free summaries this month.`;
  }

  return `${used} of ${limit} free summaries used this month · ${remaining} remaining`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. checkAndResetIfNeeded(userId)
//
// Convenience function that:
//   1. Ensures usage fields exist
//   2. Resets if the monthly period has expired
//   3. Returns the fresh userProfile
//
// Call this at the start of the Quick Summary flow for logged-in users.
// ─────────────────────────────────────────────────────────────────────────────
export async function checkAndResetIfNeeded(userId) {
  // Step 1: ensure fields exist
  await initializeFreeTierUsageIfMissing(userId);

  // Step 2: fetch fresh profile
  const profile = await getUserUsageStatus(userId);

  // Step 3: reset if period has expired
  if (shouldResetUsagePeriod(profile)) {
    await resetMonthlyQuickSummaryUsage(userId);
    // Fetch again after reset so caller gets the fresh zeroed state
    return await getUserUsageStatus(userId);
  }

  return profile;
}

export { FREE_MONTHLY_LIMIT };
