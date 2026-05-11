import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage quick bug modal state and keyboard shortcut (Ctrl+Shift+Q)
 */
export function useQuickBug(options: { disabled?: boolean } = {}) {
  const { disabled = false } = options;
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (disabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+Q (or Cmd+Shift+Q on Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        openModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openModal, disabled]);

  return {
    isOpen,
    openModal,
    closeModal,
  };
}
