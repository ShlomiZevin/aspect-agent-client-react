import { useEffect } from 'react';

export function useDebugShortcut(onToggle: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+D (Windows/Linux) or Cmd+. (Mac)
      if ((e.ctrlKey && e.shiftKey && e.key === 'D') || (e.metaKey && e.key === '.')) {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggle]);
}
