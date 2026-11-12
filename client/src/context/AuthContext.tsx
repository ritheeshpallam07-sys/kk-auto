import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, api, setStoredCsrfToken } from '../api/client';
import { safeGetLocal, safeRemoveLocal, safeSetLocal } from '../utils/storage';

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
    };
  }>;
  register: (data: any) => Promise<{
    success: boolean;
    error?: string;
    requiresVerification?: boolean;
    email?: string;
  }>;
  logout: () => void | Promise<void>;
  refreshUser: () => Promise<User | null>;
  sessionError: string | null;
  retrySession: () => Promise<void>;
  isCustomer: boolean;
  isDriver: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const isCheckingRef = React.useRef(false);

  const checkSession = async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsLoading(true);

    try {
      const res = await api.auth.me();
      if (res.success && res.data) {
        setUser(res.data);
        setSessionError(null);
      } else if (res.status === 401 || res.status === 403) {
        // No active session or deactivated - clean unauthenticated state
        setUser(null);
        setSessionError(null);
      } else {
        // Network failure, timeout, or 5xx server issue - show retryable state
        setSessionError(res.error || 'Server temporarily unreachable. Please check connection and retry.');
      }
    } catch (err: any) {
      setSessionError(err.message || 'Connection error');
    } finally {
      // Proactively scrub any legacy localStorage token during session check
      if (safeGetLocal('kk_token')) {
        safeRemoveLocal('kk_token');
      }
      isCheckingRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  /** Confirms the HttpOnly session cookie persisted immediately after login or direct registration. */
  const verifyPersistedSession = async (): Promise<
    { ok: true; user: User } | { ok: false; error: string }
  > => {
    const meRes = await api.auth.me();
    if (meRes.success && meRes.data) {
      setUser(meRes.data);
      setSessionError(null);
      return { ok: true, user: meRes.data };
    }

    setUser(null);
    if (meRes.status === 401 || meRes.status === 403) {
      setStoredCsrfToken(null);
      return {
        ok: false,
        error:
          'Your browser blocked the login session cookie. Enable cookies / allow cross-site cookies or open clik2go.in directly and try again.'
      };
    }

    return {
      ok: false,
      error: meRes.error || 'Could not confirm your login session with Clik2Go servers. Please try again.'
    };
  };

  const login = async (identifier: string, pass: string) => {
    setIsLoading(true);
    setSessionError(null);
    try {
      const res = await api.auth.login(identifier, pass);

      if (res.success && res.data) {
        const verified = await verifyPersistedSession();
        if (!verified.ok) {
          return { success: false, error: verified.error };
        }
        return { success: true, data: { user: verified.user } };
      }
      return { success: false, error: res.error || 'Login failed' };
    } finally {
      setIsLoading(false);
    }
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

      // Driver or direct registration:
      if ('user' in res.data) {
        const verified = await verifyPersistedSession();
        if (!verified.ok) {
          return {
            success: false,
            error: verified.error
          };
        }
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

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('[Auth] Server logout notification failed:', err);
    } finally {
      safeRemoveLocal('kk_token');
      setStoredCsrfToken(null);
      setUser(null);
      setSessionError(null);
    }
  };

  const refreshUser = async (): Promise<User | null> => {
    const res = await api.auth.me();

    if (res.success && res.data) {
      setUser(res.data);
      setSessionError(null);
      return res.data;
    }

    if (res.status === 401 || res.status === 403) {
      await logout();
    }
    return null;
  };

  const TERMS_CURRENT_VERSION = '1.0';

  const hasAcceptedTerms = Boolean(
    (user?.terms_version === TERMS_CURRENT_VERSION) ||
    (user?.id && safeGetLocal(`kk_terms_accepted_${user.id}`) === TERMS_CURRENT_VERSION)
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
        safeSetLocal(`kk_terms_accepted_${user.id}`, version);
      }
      return true;
    } catch {
      if (user) {
        setUser({
          ...user,
          terms_version: version,
          terms_accepted_at: new Date().toISOString()
        });
        safeSetLocal(`kk_terms_accepted_${user.id}`, version);
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
        token: null, // Tokens are now securely held in HttpOnly cookies; no JavaScript exposure (SEC-05)
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
