// src/services/authService.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
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
    "auth/too-many-requests":
      "Too many failed attempts. Please try again later.",
    "auth/network-request-failed":
      "Network error. Please check your connection.",
  };
  return messages[errorCode] || "Something went wrong. Please try again.";
}

// ---------------------
// Sign Up
// ---------------------
export async function signUpWithEmail(email, password) {
  // 1. Create the Firebase Auth user
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  const user = userCredential.user;

  // 2. Create a Firestore document in the "users" collection
  await createUserDocument(user);

  return user;
}

// ---------------------
// Sign In
// ---------------------
export async function signInWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
  return userCredential.user;
}

// ---------------------
// Sign Out
// ---------------------
export async function logOut() {
  await signOut(auth);
}

// ---------------------
// Create Firestore user document
// Called on sign up only
// ---------------------
export async function createUserDocument(user) {
  const userRef = doc(db, "users", user.uid);

  // Check if the document already exists (safety check)
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
// Useful for loading user data on login
// ---------------------
export async function getUserProfile(uid) {
  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) {
    return snapshot.data();
  }
  return null;
}
