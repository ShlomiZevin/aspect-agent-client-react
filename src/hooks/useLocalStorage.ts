import { useState, useCallback } from 'react';

/**
 * Hook for managing localStorage with React state
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Get initial value from localStorage or use provided initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Setter that also updates localStorage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue(prevValue => {
        const newValue = value instanceof Function ? value(prevValue) : value;
        try {
          localStorage.setItem(key, JSON.stringify(newValue));
        } catch (error) {
          console.error('Error saving to localStorage:', error);
        }
        return newValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}

/**
 * Hook for managing raw string in localStorage
 */
export function useLocalStorageString(
  key: string,
  initialValue: string | null = null
): [string | null, (value: string | null) => void] {
  const [storedValue, setStoredValue] = useState<string | null>(() => {
    try {
      return localStorage.getItem(key) ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: string | null) => {
      setStoredValue(value);
      try {
        if (value === null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, value);
        }
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
    },
    [key]
  );

  return [storedValue, setValue];
}
