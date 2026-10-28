
import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { currentUser, handleLogOut } = useAuth();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [navbarHidden, setNavbarHidden] = useState(false);

  const menuRef = useRef(null);
  const burgerRef = useRef(null);

  // Hide the navbar while scrolling up; reveal it while scrolling down.
  useEffect(() => {
    let previousScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;

      ticking = true;

      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const scrollDifference = currentScrollY - previousScrollY;

        // Always show the navbar near the top of the page.
        
        if (currentScrollY <= 80) {
          // Keep the navbar visible near the top of the page.
          setNavbarHidden(false);
        } else if (Math.abs(scrollDifference) > 5) {
          if (scrollDifference > 0) {
            // Scrolling down: fade out the navbar.
            setNavbarHidden(true);
            setMenuOpen(false);
          } else {
            // Scrolling up: fade in the navbar.
            setNavbarHidden(false);
          }

          previousScrollY = currentScrollY;
        }


        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Close the dropdown when clicking or tapping outside it.
  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        burgerRef.current &&
        !burgerRef.current.contains(e.target)
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

  function handleNavClick() {
    setMenuOpen(false);
  }

  async function handleSignOut() {
    setMenuOpen(false);

    try {
      await handleLogOut();
      navigate("/signin");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  }

  return (
    <nav
      className={`navbar ${navbarHidden ? "navbar-hidden" : ""}`}
      aria-label="Main navigation"
    >
      <div className="navbar-inner">
        {currentUser && (
          <button
            ref={burgerRef}
            type="button"
            className={`navbar-burger ${menuOpen ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="navbar-dropdown"
          >
            <span className="burger-bar" />
            <span className="burger-bar" />
            <span className="burger-bar" />
          </button>
        )}

        <NavLink
          to="/"
          className="navbar-logo"
          onClick={handleNavClick}
          aria-label="Essential Summary home"
        >
          <img src="/es.png" alt="" className="navbar-logo-img" />
          <span className="navbar-logo-text">Essential Summary</span>
        </NavLink>

        <div className="navbar-right">
          {currentUser ? (
            <button
              type="button"
              className="navbar-signout"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          ) : (
            <NavLink to="/signin" className="navbar-signin-link">
              Sign in
            </NavLink>
          )}
        </div>
      </div>

      {currentUser && menuOpen && (
        <div
          className="navbar-dropdown"
          id="navbar-dropdown"
          ref={menuRef}
        >
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `dropdown-link ${isActive ? "active" : ""}`
            }
            onClick={handleNavClick}
          >
            <span className="dropdown-icon">📊</span>
            Dashboard
          </NavLink>

          <NavLink
            to="/summaries"
            className={({ isActive }) =>
              `dropdown-link ${isActive ? "active" : ""}`
            }
            onClick={handleNavClick}
          >
            <span className="dropdown-icon">📄</span>
            Summaries
          </NavLink>

          <NavLink
            to="/account"
            className={({ isActive }) =>
              `dropdown-link ${isActive ? "active" : ""}`
            }
            onClick={handleNavClick}
          >
            <span className="dropdown-icon">👤</span>
            Account
          </NavLink>

          <NavLink
            to="/pricing"
            className={({ isActive }) =>
              `dropdown-link ${isActive ? "active" : ""}`
            }
            onClick={handleNavClick}
          >
            <span className="dropdown-icon">⚡</span>
            Pricing
          </NavLink>

          <NavLink
            to="/contact"
            className={({ isActive }) =>
              `dropdown-link ${isActive ? "active" : ""}`
            }
            onClick={handleNavClick}
          >
            <span className="dropdown-icon">✉️</span>
            Contact
          </NavLink>

          <NavLink
            to="/image-summary"
            className={({ isActive }) =>
              `dropdown-link ${isActive ? "active" : ""}`
            }
            onClick={handleNavClick}
          >
            <span className="dropdown-icon">📸</span>
            Image Summary
          </NavLink>

          <div className="dropdown-divider" />

          <button
            type="button"
            className="dropdown-signout"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}

