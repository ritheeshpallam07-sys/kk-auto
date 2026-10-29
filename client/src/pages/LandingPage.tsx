import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomerDashboard } from './CustomerDashboard';
import { LoginPage } from './LoginPage';
import { Loader2, ShieldAlert } from 'lucide-react';

interface LandingPageProps {
  navigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ navigate }) => {
  const { user, isDriver, isAdmin, isLoading, sessionError, retrySession, logout } = useAuth();

  useEffect(() => {
    if (user && isDriver) {
      navigate('/driver');
    } else if (user && isAdmin) {
      navigate('/owner/dashboard');
    }
  }, [user, isDriver, isAdmin, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-[#0B0B0D] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#C6FF3D]" />
        <p className="text-sm font-medium text-[#A1A1AA]">Checking session...</p>
      </div>
    );
  }

  // Handle temporary network error during session restore without discarding token
  if (!user && sessionError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center bg-[#0B0B0D] text-white">
        <div className="w-16 h-16 bg-[#171719] text-amber-400 border border-amber-800/60 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          Unable to Verify Session
        </h2>

        <p className="text-sm text-[#A1A1AA] max-w-md mb-6 leading-relaxed">
          {sessionError}. Your login token is saved, but we could not reach the Clik2Go servers.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => retrySession()}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black rounded-xl shadow-glow-lime transition-all active:scale-95 text-xs uppercase tracking-wider cursor-pointer"
          >
            Retry Connection
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#202023] hover:bg-[#26262A] text-[#A1A1AA] hover:text-white border border-[#303034] font-bold rounded-xl transition-all active:scale-95 text-xs cursor-pointer"
          >
            Sign In with Another Account
          </button>
        </div>
      </div>
    );
  }

  // When a user opens Clik2Go without a valid login session, show Login / Sign Up page first
  if (!user) {
    return <LoginPage navigate={navigate} />;
  }

  if (isDriver) {
    return null; // Redirecting to /driver via useEffect
  }

  if (isAdmin) {
    return null; // Redirecting to /owner/dashboard via useEffect
  }

  /*
   * CUSTOMER LANDING INTERFACE (Authenticated Customer)
   * Heading: "Where to, Rider?"
   * Two primary buttons: "Book Auto" and "Plan a Trip"
   */
  return <CustomerDashboard navigate={navigate} />;
};
