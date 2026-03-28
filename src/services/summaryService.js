// src/services/summaryService.js
// ─────────────────────────────────────────────────────────────────────────────
// All Firestore operations for saved summaries.
// Collection path: users/{userId}/summaries/{summaryId}
// ─────────────────────────────────────────────────────────────────────────────
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

// ─────────────────────────────────────────────────────────────────────────────
// 1. saveSummary(userId, summaryData)
//
// Call this AFTER a successful summary is generated, only for logged-in users.
//
// summaryData shape:
// {
//   fileName:    string  — name of the PDF file
//   summaryType: string  — "quick" | "chapter"
//   content:     string  — the full summary text
//   pageNumber:  number  — (optional) for quick summaries
//   chapterRange:string  — (optional) e.g. "Pages 4–12" for chapter summaries
//   wordCount:   number  — (optional) word count of original text
// }
// ─────────────────────────────────────────────────────────────────────────────
export async function saveSummary(userId, summaryData) {
  if (!userId) throw new Error("saveSummary: userId is required");
  if (!summaryData?.content) throw new Error("saveSummary: content is required");

  const summariesRef = collection(db, "users", userId, "summaries");

  const docRef = await addDoc(summariesRef, {
    fileName:     summaryData.fileName    ?? "Untitled PDF",
    summaryType:  summaryData.summaryType ?? "quick",
    content:      summaryData.content,
    pageNumber:   summaryData.pageNumber  ?? null,
    chapterRange: summaryData.chapterRange ?? null,
    wordCount:    summaryData.wordCount   ?? null,
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
  });

  return docRef.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. getUserSummaries(userId)
//
// Returns ALL summaries for a user, newest first.
// Each item has an `id` field added for easy reference.
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserSummaries(userId) {
  if (!userId) return [];

  const summariesRef = collection(db, "users", userId, "summaries");
  const q = query(summariesRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    // Convert Firestore Timestamp to JS Date for easy rendering
    createdAt: doc.data().createdAt?.toDate?.() ?? new Date(),
    updatedAt: doc.data().updatedAt?.toDate?.() ?? new Date(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. getRecentSummaries(userId, limitCount)
//
// Returns the N most recent summaries. Used by the Dashboard.
// ─────────────────────────────────────────────────────────────────────────────
export async function getRecentSummaries(userId, limitCount = 5) {
  if (!userId) return [];

  const summariesRef = collection(db, "users", userId, "summaries");
  const q = query(summariesRef, orderBy("createdAt", "desc"), limit(limitCount));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.() ?? new Date(),
    updatedAt: doc.data().updatedAt?.toDate?.() ?? new Date(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. deleteSummary(userId, summaryId)
//
// Permanently deletes a summary document.
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteSummary(userId, summaryId) {
  if (!userId || !summaryId) throw new Error("deleteSummary: userId and summaryId are required");

  const summaryRef = doc(db, "users", userId, "summaries", summaryId);
  await deleteDoc(summaryRef);
}
