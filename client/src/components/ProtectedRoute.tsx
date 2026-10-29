import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { TermsAcceptancePage } from '../pages/TermsAcceptancePage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'customer' | 'driver' | 'admin'>;
  navigate: (path: string) => void;
  skipTermsCheck?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  navigate,
  skipTermsCheck = false,
}) => {
  const { user, isLoading, hasAcceptedTerms, sessionError, retrySession, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-[#0B0B0D] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#C6FF3D]" />
        <p className="text-sm font-medium text-[#A1A1AA]">
          Checking session...
        </p>
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

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center bg-[#0B0B0D] text-white">
        <div className="w-16 h-16 bg-[#171719] text-[#C6FF3D] border border-[#303034] rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          Login Required
        </h2>

        <p className="text-sm text-[#A1A1AA] max-w-md mb-6">
          You need to be logged in to access this section of Clik2Go.
        </p>

        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black rounded-xl shadow-glow-lime transition-all active:scale-95 text-xs uppercase tracking-wider"
        >
          Go to Login
        </button>
      </div>
    );
  }

  // If terms not accepted, enforce Terms Acceptance before proceeding
  if (!skipTermsCheck && !hasAcceptedTerms) {
    return <TermsAcceptancePage navigate={navigate} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const returnPath =
      user.role === 'admin'
        ? '/owner/dashboard'
        : user.role === 'driver'
          ? '/driver'
          : '/';

    const returnLabel =
      user.role === 'admin'
        ? 'Go to Owner Dashboard'
        : user.role === 'driver'
          ? 'Go to Driver Dashboard'
          : 'Go to Customer Home';

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center bg-[#0B0B0D] text-white">
        <div className="w-16 h-16 bg-[#171719] text-rose-400 border border-rose-900/50 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          Access Restricted
        </h2>

        <p className="text-sm text-[#A1A1AA] max-w-md mb-6">
          Your account role (<span className="font-semibold text-white">{user.role}</span>) does not have permission to view this section.
        </p>

        <button
          onClick={() => navigate(returnPath)}
          className="px-6 py-2.5 bg-[#202023] hover:bg-[#26262A] text-white border border-[#303034] font-bold rounded-xl transition-all active:scale-95 text-xs"
        >
          {returnLabel}
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
