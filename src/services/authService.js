// src/services/authService.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

// ---------------------
// Error message mapper
// ---------------------
export function getAuthErrorMessage(errorCode) {
  const messages = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password. Please try again.",
    "auth/too-many-requests": "Too many failed attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Please check your connection.",
  };
  return messages[errorCode] || "Something went wrong. Please try again.";
}

// ---------------------
// Sign Up
// ---------------------
export async function signUpWithEmail(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  await createUserDocument(user);
  return user;
}

// ---------------------
// Sign In
// ---------------------
export async function signInWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

// ---------------------
// Sign Out
// ---------------------
export async function logOut() {
  await signOut(auth);
}

// ---------------------
// Password Reset
// Sends a reset email via Firebase Auth.
// ---------------------
export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

// ---------------------
// Create Firestore user document
// Called on sign up only
// ---------------------
export async function createUserDocument(user) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) return;
  await setDoc(userRef, {
    uid: user.uid,
    email: user.email,
    plan: "free",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ---------------------
// Fetch Firestore user profile
// ---------------------
export async function getUserProfile(uid) {
  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) {
    return snapshot.data();
  }
  return null;
}
