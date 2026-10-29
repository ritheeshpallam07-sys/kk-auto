import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  hasAcceptedTerms: boolean;
  acceptTerms: (version?: string) => Promise<boolean>;
  login: (identifier: string, pass: string) => Promise<{
    success: boolean;
    error?: string;
    data?: {
      user: User;
      token: string;
    };
  }>;
  register: (data: any) => Promise<{
    success: boolean;
    error?: string;
    requiresVerification?: boolean;
    email?: string;
  }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  sessionError: string | null;
  retrySession: () => Promise<void>;
  isCustomer: boolean;
  isDriver: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('kk_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const isCheckingRef = React.useRef(false);

  const checkSession = async () => {
    const storedToken = localStorage.getItem('kk_token');
    if (!storedToken) {
      setUser(null);
      setToken(null);
      setSessionError(null);
      setIsLoading(false);
      return;
    }

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsLoading(true);

    try {
      const res = await api.auth.me();
      if (res.success && res.data) {
        setUser(res.data);
        setToken(storedToken);
        setSessionError(null);
      } else if (res.status === 401 || res.status === 403) {
        // Token invalid, expired, or deactivated by admin - clean logout
        localStorage.removeItem('kk_token');
        setToken(null);
        setUser(null);
        setSessionError(null);
      } else {
        // Network failure, timeout, or 5xx server issue - preserve token and show retryable state
        setSessionError(res.error || 'Server temporarily unreachable. Please check connection and retry.');
      }
    } catch (err: any) {
      setSessionError(err.message || 'Connection error');
    } finally {
      isCheckingRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (identifier: string, pass: string) => {
    setIsLoading(true);
    setSessionError(null);
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
    setSessionError(null);
  };

  const refreshUser = async () => {
    const res = await api.auth.me();

    if (res.success && res.data) {
      setUser(res.data);
      setSessionError(null);
    } else if (res.status === 401 || res.status === 403) {
      logout();
    }
  };

  const TERMS_CURRENT_VERSION = '1.0';

  const hasAcceptedTerms = Boolean(
    (user?.terms_version === TERMS_CURRENT_VERSION) ||
    (user?.id && localStorage.getItem(`kk_terms_accepted_${user.id}`) === TERMS_CURRENT_VERSION)
  );

  const acceptTerms = async (version: string = TERMS_CURRENT_VERSION): Promise<boolean> => {
    try {
      const res = await api.auth.acceptTerms(version);
      if (res.success && res.data) {
        setUser(res.data);
      } else if (user) {
        setUser({
          ...user,
          terms_version: version,
          terms_accepted_at: new Date().toISOString()
        });
      }
      if (user?.id) {
        localStorage.setItem(`kk_terms_accepted_${user.id}`, version);
      }
      return true;
    } catch {
      if (user) {
        setUser({
          ...user,
          terms_version: version,
          terms_accepted_at: new Date().toISOString()
        });
        localStorage.setItem(`kk_terms_accepted_${user.id}`, version);
        return true;
      }
      return false;
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
        hasAcceptedTerms,
        acceptTerms,
        login,
        register,
        logout,
        refreshUser,
        sessionError,
        retrySession: checkSession,
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
