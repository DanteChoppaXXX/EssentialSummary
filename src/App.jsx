// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import HomePage from "./pages/HomePage";
import PricingPage from "./pages/PricingPage";
import DashboardPage from "./pages/DashboardPage";
import SavedSummariesPage from "./pages/SavedSummariesPage";
import ProfilePage from "./pages/ProfilePage";
import Navbar from "./components/Navbar/Navbar";
import ScrollToTop from "./components/ScrollToTop";
import ContactPage from "./pages/ContactPage";

export default function App() {
  return (
    // 1. Wrap everything in BrowserRouter (handles URL routing)
    <BrowserRouter>
      {/* 2. Wrap everything in AuthProvider (makes auth state available everywhere) */}
      <AuthProvider>
        <ScrollToTop />
        <Navbar />
        <Routes>
          {/* Public routes — accessible without login */}
          <Route path="/signup" element={<SignUp />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/" element={<HomePage />} />

          <Route path="/contact" element={<ContactPage />} />

          {/* Protected route — only accessible when logged in */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/summaries"
            element={
              <ProtectedRoute>
                <SavedSummariesPage />
              </ProtectedRoute>
            } 
          /> ← NEW
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
        {/* ── NEW: QuickSummary is public — anonymous users can access it ── */}
              {/* No ProtectedRoute wrapper — the page handles its own access logic */}
          {/* Default: redirect root to sign in */}
          <Route path="/" element={<Navigate to="/homepage" replace />} />

          {/* Catch-all: redirect unknown paths to sign in */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
