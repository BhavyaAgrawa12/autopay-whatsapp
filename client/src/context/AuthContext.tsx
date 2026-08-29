import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { loginApi, logoutApi, fetchMeApi } from '../api/auth';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate existing HTTP-only cookie session on mount/refresh
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const data = await fetchMeApi();
        if (isMounted) {
          setUser(data.user);
          if (data.accessToken) {
            setAccessToken(data.accessToken);
          }
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const res = await loginApi(email, password);
    setUser(res.data.user);
    setAccessToken(res.data.accessToken);
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutApi();
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
