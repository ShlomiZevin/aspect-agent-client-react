import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage task board modal state and keyboard shortcuts
 * - Ctrl+Shift+Space: Toggle task board
 * - Ctrl+Shift+L: Open task board in drafts view
 */
export function useTaskBoard() {
  const [isOpen, setIsOpen] = useState(false);
  const [openInDraftsMode, setOpenInDraftsMode] = useState(false);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => {
    setIsOpen(false);
    setOpenInDraftsMode(false); // Reset drafts mode when closing
  }, []);
  const toggleModal = useCallback(() => setIsOpen(prev => !prev), []);

  // Open directly in drafts view
  const openDrafts = useCallback(() => {
    setOpenInDraftsMode(true);
    setIsOpen(true);
  }, []);

  // Called by modal to acknowledge it received the drafts mode flag
  const clearDraftsMode = useCallback(() => {
    setOpenInDraftsMode(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+Space (or Cmd+Shift+Space on Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === ' ') {
        e.preventDefault();
        toggleModal();
      }

      // Ctrl+Shift+L: Open in drafts view
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyL') {
        e.preventDefault();
        e.stopPropagation();
        openDrafts();
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, toggleModal, closeModal, openDrafts]);

  return {
    isOpen,
    openModal,
    closeModal,
    toggleModal,
    openDrafts,
    openInDraftsMode,
    clearDraftsMode,
  };
}
