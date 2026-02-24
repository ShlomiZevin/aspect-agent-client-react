import { useState, useCallback } from 'react';

const STORAGE_KEY = 'aspect_commenter_identity';

export function useCommenterIdentity() {
  const [identity, setIdentityState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const setIdentity = useCallback((name: string) => {
    localStorage.setItem(STORAGE_KEY, name);
    setIdentityState(name);
  }, []);

  const clearIdentity = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIdentityState(null);
  }, []);

  return { identity, setIdentity, clearIdentity };
}
