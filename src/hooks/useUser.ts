import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorageString } from './useLocalStorage';
import { createUser } from '../services/userService';

export interface UseUserReturn {
  userId: string | null;
  isLoading: boolean;
  error: string | null;
  initializeUser: () => Promise<void>;
  switchUser: (newUserId: string) => void;
}

/**
 * Hook for managing anonymous user ID
 */
export function useUser(storagePrefix: string = '', baseURL?: string): UseUserReturn {
  const key = `${storagePrefix}user_id`;
  const [storedUserId, setStoredUserId] = useLocalStorageString(key, null);
  const [isLoading, setIsLoading] = useState(!storedUserId);
  const [error, setError] = useState<string | null>(null);
  // Guards against React StrictMode's dev-mode mount->cleanup->mount double
  // effect invoke firing two concurrent createUser() calls: both would read
  // storedUserId as still-null (neither has resolved yet) and each write its
  // own anon id, leaving localStorage pointing at whichever resolved last -
  // not necessarily the one any in-flight request under it actually used.
  const creating = useRef(false);

  const initializeUser = useCallback(async () => {
    if (storedUserId || creating.current) {
      setIsLoading(false);
      return;
    }

    creating.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await createUser(baseURL);
      setStoredUserId(response.userId);
      console.log('✅ User ID created:', response.userId);
    } catch (err) {
      console.error('❌ Error creating user ID:', err);
      setError(err instanceof Error ? err.message : 'Failed to create user');
      creating.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [storedUserId, setStoredUserId, baseURL]);

  const switchUser = useCallback((newUserId: string) => {
    setStoredUserId(newUserId);
    console.log('🔄 Switched to user:', newUserId);
  }, [setStoredUserId]);

  // Initialize user on mount if needed
  useEffect(() => {
    if (!storedUserId) {
      initializeUser();
    }
  }, [storedUserId, initializeUser]);

  return {
    userId: storedUserId,
    isLoading,
    error,
    initializeUser,
    switchUser,
  };
}
