import { useEffect } from 'react';

export function useDebugShortcut(onToggle: () => void, disabled = false) {
  useEffect(() => {
    if (disabled) return;
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+D (Windows/Linux) or Cmd+. (Mac)
      if ((e.ctrlKey && e.shiftKey && e.key === 'D') || (e.metaKey && e.key === '.')) {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggle, disabled]);
}
