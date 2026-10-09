import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
login: (identifier: string, pass: string) => Promise<{
  success: boolean;
  error?: string;
  data?: {
    user: User;
    token: string;
  };
}>;  register: (data: any) => Promise<{
  success: boolean;
  error?: string;
  requiresVerification?: boolean;
  email?: string;
}>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isCustomer: boolean;
  isDriver: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('kk_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('kk_token');
      if (storedToken) {
        const res = await api.auth.me();
        if (res.success && res.data) {
          setUser(res.data);
        } else {
          // Token invalid or expired
          localStorage.removeItem('kk_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, []);

  const login = async (identifier: string, pass: string) => {
    setIsLoading(true);
    const res = await api.auth.login(identifier, pass);
    setIsLoading(false);

    if (res.success && res.data) {
      setUser(res.data.user);
      setToken(res.data.token);
      localStorage.setItem('kk_token', res.data.token);
      return { success: true, data: res.data };
    }
    return { success: false, error: res.error || 'Login failed' };
  };

  const register = async (data: any) => {
  setIsLoading(true);

  try {
    const res = await api.auth.register(data);

    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Registration failed'
      };
    }

    // Customer: OTP verification required
    if (
      'requiresVerification' in res.data &&
      res.data.requiresVerification === true
      ) {
        return {
          success: true,
          requiresVerification: true,
          email: res.data.email
        };
      }


    // Driver: keep existing registration flow
    if ('user' in res.data && 'token' in res.data) {
      setUser(res.data.user);
      setToken(res.data.token);
      localStorage.setItem('kk_token', res.data.token);

      return { success: true };
    }

    return {
      success: false,
      error: 'Unexpected registration response.'
    };
  } catch {
    return {
      success: false,
      error: 'Registration failed. Please try again.'
    };
  } finally {
    setIsLoading(false);
  }
};
  const logout = () => {
    localStorage.removeItem('kk_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await api.auth.me();

    if (res.success && res.data) {
      setUser(res.data);
    } else {
      logout();
    }
  };

  const isCustomer = user?.role === 'customer';
  const isDriver = user?.role === 'driver';
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        isCustomer,
        isDriver,
        isAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
