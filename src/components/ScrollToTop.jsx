// src/components/ScrollToTop.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Scrolls the window to the top on every route change.
// Place this inside <BrowserRouter> but above <Routes> in App.jsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null; // renders nothing
}
