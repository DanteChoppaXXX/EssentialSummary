// src/components/ProtectedRoute.jsx
// Wraps any route that requires the user to be logged in.
// If not logged in, redirects to /signin.

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    // Not logged in — send to sign in page
    return <Navigate to="/signin" replace />;
  }

  // Logged in — render the protected page
  return children;
}
