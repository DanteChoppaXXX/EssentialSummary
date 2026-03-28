// src/hooks/useAuthModal.js
// ─────────────────────────────────────────────────────────────────────────────
// A simple hook that manages AuthModal open state and which mode
// (sign in vs sign up) is active. Import this wherever you need to
// trigger the modal — typically in your Quick Summary component.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback } from "react";

export function useAuthModal() {
  const [isOpen, setIsOpen] = useState(false);
  // "signin" | "signup"
  const [modalMode, setModalMode] = useState("signup");

  const openModal = useCallback((mode = "signup") => {
    setModalMode(mode);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const switchMode = useCallback((mode) => {
    setModalMode(mode);
  }, []);

  return {
    isOpen,
    modalMode,
    openModal,
    closeModal,
    switchMode,
  };
}
