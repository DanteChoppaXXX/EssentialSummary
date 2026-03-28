// src/context/AuthContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Updated to include:
//   1. Firestore user profile loading on login
//   2. Lazy premium expiry check on app load
//   3. refreshUserProfile() helper so any page can force a profile reload
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { logOut } from "../services/authService";
import {
  fetchUserProfile,
  downgradeExpiredPremiumIfNeeded,
} from "../services/premiumService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser,  setCurrentUser]  = useState(null);
  const [userProfile,  setUserProfile]  = useState(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);

        try {
          // Load Firestore profile
          let profile = await fetchUserProfile(firebaseUser.uid);

          // Lazy premium expiry check — downgrade silently if expired
          if (profile) {
            profile = await downgradeExpiredPremiumIfNeeded(firebaseUser.uid, profile);
          }

          setUserProfile(profile);
        } catch (err) {
          console.error("AuthContext: failed to load user profile", err);
          setUserProfile(null);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Call this after any action that mutates the user profile in Firestore
  // (e.g. after premium activation) so the rest of the app gets fresh data
  async function refreshUserProfile() {
    if (!currentUser) return;
    try {
      let profile = await fetchUserProfile(currentUser.uid);
      if (profile) {
        profile = await downgradeExpiredPremiumIfNeeded(currentUser.uid, profile);
      }
      setUserProfile(profile);
    } catch (err) {
      console.error("AuthContext: failed to refresh profile", err);
    }
  }

  async function handleLogOut() {
    await logOut();
  }

  const value = {
    currentUser,
    userProfile,        // Firestore user document (includes plan, premiumUntil, etc.)
    loading,
    handleLogOut,
    refreshUserProfile, // call after premium activation to update app-wide state
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}
