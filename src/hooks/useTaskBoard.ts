import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage task board modal state and keyboard shortcut (Ctrl+Shift+Space)
 */
export function useTaskBoard() {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);
  const toggleModal = useCallback(() => setIsOpen(prev => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+Space (or Cmd+Shift+Space on Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === ' ') {
        e.preventDefault();
        toggleModal();
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggleModal, closeModal]);

  return {
    isOpen,
    openModal,
    closeModal,
    toggleModal,
  };
}
