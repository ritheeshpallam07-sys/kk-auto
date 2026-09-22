import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { 
  User, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  Sparkles, 
  Car, 
  ShieldCheck 
} from 'lucide-react';

interface LoginPageProps {
  navigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ navigate }) => {
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Please enter both email/mobile and password.');
      return;
    }

    setIsSubmitting(true);
    const res = await login(identifier, password);
    setIsSubmitting(false);

    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.error || 'Invalid credentials.');
    }
  };

  // Quick autofill for demo & testing
  const autofill = (idVal: string, passVal: string) => {
    setIdentifier(idVal);
    setPassword(passVal);
    setError(null);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <Logo size="md" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Welcome back
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Log in with your email or mobile number to manage rides
          </p>
        </div>

        {/* Demo Fast-Login Pills for easy testing */}
        <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>1-Click Demo Login</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => autofill('rahul@gmail.com', 'customer123')}
              className="px-2 py-1.5 bg-white hover:bg-amber-100 rounded-lg border border-amber-300 font-semibold text-[11px] text-slate-800 text-center shadow-2xs transition-colors"
            >
              👤 Customer
            </button>
            <button
              type="button"
              onClick={() => autofill('ramesh@kkauto.com', 'driver123')}
              className="px-2 py-1.5 bg-white hover:bg-amber-100 rounded-lg border border-amber-300 font-semibold text-[11px] text-slate-800 text-center shadow-2xs transition-colors"
            >
              🛺 Driver
            </button>
            <button
              type="button"
              onClick={() => autofill('admin@kkauto.com', 'admin123')}
              className="px-2 py-1.5 bg-white hover:bg-amber-100 rounded-lg border border-amber-300 font-semibold text-[11px] text-slate-800 text-center shadow-2xs transition-colors"
            >
              🛡️ Admin
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Email or Mobile Number *
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@email.com or 9876543210"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Password *
              </label>
              <button
                type="button"
                onClick={() => setForgotModalOpen(true)}
                className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-xl shadow-md transition-all hover:scale-102 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Logging in...</span>
            ) : (
              <>
                <span>Login</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-slate-600">
          Don't have an account yet?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="font-bold text-amber-600 hover:text-amber-700 underline"
          >
            Create Account
          </button>
        </div>
      </div>

      {/* Forgot password simulated modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Reset Password</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              In this development environment, use the 1-click test credentials or create a new account with your phone number.
            </p>
            <button
              onClick={() => setForgotModalOpen(false)}
              className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
