import { createContext, useContext, type ReactNode } from 'react';
import { useUser, type UseUserReturn } from '../hooks';

const UserContext = createContext<UseUserReturn | null>(null);

interface UserProviderProps {
  children: ReactNode;
  storagePrefix?: string;
  baseURL?: string;
}

export function UserProvider({ children, storagePrefix = '', baseURL }: UserProviderProps) {
  const userState = useUser(storagePrefix, baseURL);

  return (
    <UserContext.Provider value={userState}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext(): UseUserReturn {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
}
