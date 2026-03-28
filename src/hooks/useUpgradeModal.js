// src/hooks/useUpgradeModal.js
// ─────────────────────────────────────────────────────────────────────────────
// Tiny hook — keeps UpgradeModal open/close state out of your page component.
// Mirror of useAuthModal.js, kept separate so each modal has its own state.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback } from "react";

export function useUpgradeModal() {
  const [isOpen, setIsOpen] = useState(false);

  const openUpgradeModal  = useCallback(() => setIsOpen(true),  []);
  const closeUpgradeModal = useCallback(() => setIsOpen(false), []);

  return { isOpen, openUpgradeModal, closeUpgradeModal };
}
