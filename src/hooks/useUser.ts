import { useState, useEffect, useCallback } from 'react';
import { useLocalStorageString } from './useLocalStorage';
import { createUser } from '../services/userService';

export interface UseUserReturn {
  userId: string | null;
  isLoading: boolean;
  error: string | null;
  initializeUser: () => Promise<void>;
}

/**
 * Hook for managing anonymous user ID
 */
export function useUser(storagePrefix: string = '', baseURL?: string): UseUserReturn {
  const key = `${storagePrefix}user_id`;
  const [storedUserId, setStoredUserId] = useLocalStorageString(key, null);
  const [isLoading, setIsLoading] = useState(!storedUserId);
  const [error, setError] = useState<string | null>(null);

  const initializeUser = useCallback(async () => {
    if (storedUserId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await createUser(baseURL);
      setStoredUserId(response.userId);
      console.log('✅ User ID created:', response.userId);
    } catch (err) {
      console.error('❌ Error creating user ID:', err);
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  }, [storedUserId, setStoredUserId, baseURL]);

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
  };
}
