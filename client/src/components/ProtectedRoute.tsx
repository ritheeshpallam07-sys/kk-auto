import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'customer' | 'driver' | 'admin'>;
  navigate: (path: string) => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  navigate
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium text-slate-500">Checking authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Login Required</h2>
        <p className="text-sm text-slate-600 max-w-md mb-6">
          You need to be logged in to access this page. Please log in or create an account.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md transition-transform hover:scale-105"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-600 max-w-md mb-6">
          Your account role (<span className="font-semibold text-slate-800">{user.role}</span>) does not have permission to view this section.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-md transition-transform hover:scale-105"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
