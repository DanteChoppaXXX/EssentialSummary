// src/components/Navbar/Navbar.jsx
import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { currentUser, handleLogOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef   = useRef(null);
  const burgerRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (
        menuRef.current   && !menuRef.current.contains(e.target) &&
        burgerRef.current && !burgerRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [menuOpen]);

  // Close menu on route change
  function handleNavClick() {
    setMenuOpen(false);
  }

  async function handleSignOut() {
    setMenuOpen(false);
    await handleLogOut();
    navigate("/signin");
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">

        {/* ── Hamburger — left of logo, only when logged in ── */}
        {currentUser && (
          <button
            ref={burgerRef}
            className={`navbar-burger ${menuOpen ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span className="burger-bar" />
            <span className="burger-bar" />
            <span className="burger-bar" />
          </button>
        )}

        {/* ── Logo — image + app name ── */}
        <NavLink to="/" className="navbar-logo" onClick={handleNavClick}>
          <img
            src="/es.webp"          /* ← replace with your actual logo path */
            alt="SummarizeAI logo"
            className="navbar-logo-img"
          />
          <span className="navbar-logo-text">Essential Summary</span>
        </NavLink>

        {/* ── Right side: sign in / sign out ── */}
        <div className="navbar-right">
          {currentUser ? (
            <button className="navbar-signout" onClick={handleSignOut}>
              Sign out
            </button>
          ) : (
            <NavLink to="/signin" className="navbar-signin-link">
              Sign in
            </NavLink>
          )}
        </div>
      </div>

      {/* ── Dropdown menu — opens downward from navbar ── */}
      {currentUser && menuOpen && (
        <div className="navbar-dropdown" ref={menuRef}>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `dropdown-link ${isActive ? "active" : ""}`}
            onClick={handleNavClick}
          >
            <span className="dropdown-icon">📊</span>
            Dashboard
          </NavLink>
          <NavLink
            to="/summaries"
            className={({ isActive }) => `dropdown-link ${isActive ? "active" : ""}`}
            onClick={handleNavClick}
          >
            <span className="dropdown-icon">📄</span>
            Summaries
          </NavLink>
          <NavLink
            to="/account"
            className={({ isActive }) => `dropdown-link ${isActive ? "active" : ""}`}
            onClick={handleNavClick}
          >
            <span className="dropdown-icon">👤</span>
            Account
          </NavLink>
          <NavLink
            to="/pricing"
            className={({ isActive }) => `dropdown-link ${isActive ? "active" : ""}`}
            onClick={handleNavClick}
          >
            <span className="dropdown-icon">⚡</span>
            Pricing
          </NavLink>

          <div className="dropdown-divider" />

          <button className="dropdown-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
