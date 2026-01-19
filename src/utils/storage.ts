/**
 * Get item from localStorage with prefix
 */
export function getStorageItem<T>(prefix: string, key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(`${prefix}${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Set item in localStorage with prefix
 */
export function setStorageItem<T>(prefix: string, key: string, value: T): void {
  try {
    localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

/**
 * Remove item from localStorage with prefix
 */
export function removeStorageItem(prefix: string, key: string): void {
  try {
    localStorage.removeItem(`${prefix}${key}`);
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
}

/**
 * Get raw string from localStorage (not JSON parsed)
 */
export function getStorageString(prefix: string, key: string): string | null {
  try {
    return localStorage.getItem(`${prefix}${key}`);
  } catch {
    return null;
  }
}

/**
 * Set raw string in localStorage
 */
export function setStorageString(prefix: string, key: string, value: string): void {
  try {
    localStorage.setItem(`${prefix}${key}`, value);
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}
