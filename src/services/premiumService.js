// src/services/premiumService.js
// ─────────────────────────────────────────────────────────────────────────────
// All Firestore logic for premium plan activation, expiry checks, and
// downgrade. No payment logic lives here — this only touches Firestore.
// ─────────────────────────────────────────────────────────────────────────────
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

const USERS_COLLECTION = "users";
const PREMIUM_DURATION_DAYS = 30;

// ─────────────────────────────────────────────────────────────────────────────
// 1. activatePremiumPlan(userId)
//
// Called ONLY after a confirmed successful Paystack payment callback.
// Sets plan = "premium", records activation time, and sets a 30-day expiry.
// Uses updateDoc so it never overwrites unrelated fields.
// ─────────────────────────────────────────────────────────────────────────────
export async function activatePremiumPlan(userId) {
  const userRef = doc(db, USERS_COLLECTION, userId);

  const now = new Date();
  const premiumUntil = new Date(now);
  premiumUntil.setDate(premiumUntil.getDate() + PREMIUM_DURATION_DAYS);

  await updateDoc(userRef, {
    plan:                 "premium",
    subscriptionStatus:   "active",
    premiumActivatedAt:   now.toISOString(),
    premiumUntil:         premiumUntil.toISOString(),
    updatedAt:            serverTimestamp(),
  });

  return premiumUntil; // return so UI can show the expiry date
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. isPremiumActive(userProfile)
//
// Pure check — no Firestore writes.
// Returns true only if plan = "premium" AND premiumUntil is in the future.
// ─────────────────────────────────────────────────────────────────────────────
// FIXED — if plan is "premium" and no premiumUntil exists, trust the plan field
export function isPremiumActive(userProfile) {
  if (!userProfile) return false;
  if (userProfile.plan !== "premium") return false;

  // If premiumUntil exists, check it hasn't expired
  if (userProfile.premiumUntil) {
    return new Date() < new Date(userProfile.premiumUntil);
  }

  // No premiumUntil field — plan field alone is the source of truth
  // (covers users upgraded before premiumUntil tracking was added)
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. hasPremiumExpired(userProfile)
//
// Returns true if the user WAS premium but the period has now passed.
// ─────────────────────────────────────────────────────────────────────────────
export function hasPremiumExpired(userProfile) {
  if (!userProfile) return false;
  if (!userProfile.premiumUntil) return false;

  // Only meaningful if they were ever premium
  const wasOrIsPremium =
    userProfile.plan === "premium" ||
    userProfile.subscriptionStatus === "active" ||
    userProfile.subscriptionStatus === "expired";

  if (!wasOrIsPremium) return false;

  const expiry = new Date(userProfile.premiumUntil);
  return new Date() >= expiry;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. downgradeExpiredPremiumIfNeeded(userId, userProfile)
//
// Lazy expiry check — called on app load and before any protected action.
// If premium has expired, writes the downgrade to Firestore and returns
// the updated profile so the rest of the app can react immediately.
//
// Does NOT reset quickSummaryUsed — the user keeps their existing monthly
// count. Rationale: they were premium (no limit), so resetting would be
// confusing. They simply re-enter the free tier from wherever they are.
// ─────────────────────────────────────────────────────────────────────────────
export async function downgradeExpiredPremiumIfNeeded(userId, userProfile) {
  if (!hasPremiumExpired(userProfile)) {
    return userProfile; // nothing to do
  }

  const userRef = doc(db, USERS_COLLECTION, userId);

  await updateDoc(userRef, {
    plan:               "free",
    subscriptionStatus: "expired",
    updatedAt:          serverTimestamp(),
    // premiumUntil and premiumActivatedAt are kept for audit trail
  });

  // Return a patched copy so the caller has fresh state immediately
  // without needing a second Firestore read
  return {
    ...userProfile,
    plan:               "free",
    subscriptionStatus: "expired",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. getPremiumStatus(userProfile)
//
// Returns a plain object describing the user's premium state.
// Use this to drive UI decisions cleanly.
//
// Returns one of:
//   { status: "active",   premiumUntil: Date }
//   { status: "expired",  premiumUntil: Date }
//   { status: "none" }
// ─────────────────────────────────────────────────────────────────────────────
export function getPremiumStatus(userProfile) {
  if (!userProfile || !userProfile.premiumUntil) {
    return { status: "none" };
  }

  const premiumUntil = new Date(userProfile.premiumUntil);

  if (new Date() < premiumUntil && userProfile.plan === "premium") {
    return { status: "active", premiumUntil };
  }

  if (userProfile.subscriptionStatus === "expired" || new Date() >= premiumUntil) {
    return { status: "expired", premiumUntil };
  }

  return { status: "none" };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. fetchUserProfile(userId)
//
// Simple helper to fetch the full user document.
// Used by PricingPage and AuthContext to get a fresh profile.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchUserProfile(userId) {
  const userRef = doc(db, USERS_COLLECTION, userId);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) return null;
  return snapshot.data();
}

export { PREMIUM_DURATION_DAYS };
