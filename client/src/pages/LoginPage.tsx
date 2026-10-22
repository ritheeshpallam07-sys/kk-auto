import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { 
  User, 
  Lock, 
  Eye,
  EyeOff,
  ArrowRight, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck 
} from 'lucide-react';

interface LoginPageProps {
  navigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ navigate }) => {
  const { login, hasAcceptedTerms } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const user = res.data?.user;
      // Check if user has accepted terms version 1.0
      const termsAccepted = user?.terms_version === '1.0' || localStorage.getItem(`kk_terms_accepted_${user?.id}`) === '1.0';

      if (!termsAccepted) {
        navigate('/accept-terms');
      } else if (user?.role === 'driver') {
        navigate('/driver');
      } else if (user?.role === 'admin') {
        navigate('/owner/dashboard');
      } else {
        navigate('/');
      }
    } else {
      setError(res.error || 'Invalid credentials.');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8 sm:py-16 px-4 sm:px-6 lg:px-8 bg-[#0B0B0D] text-white safe-top safe-bottom">
      <div className="max-w-md w-full space-y-6 sm:space-y-7 bg-[#171719] p-6 sm:p-10 rounded-3xl shadow-card border border-[#303034]">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Welcome back
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Log in to book rides, view trips, or manage driver console
          </p>
        </div>

        {/* Demo Fast-Login Pills for easy testing */}
        <div className="p-4 bg-[#202023] rounded-2xl border border-[#303034] text-xs">
          <div className="flex items-center gap-1.5 font-bold text-white mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#C6FF3D]" />
            <span className="text-[11px] uppercase tracking-wide">Quick Role Access</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setIdentifier('customer@example.com');
                setPassword('password123');
              }}
              className="px-3 py-2 bg-[#171719] hover:bg-[#26262A] rounded-xl border border-[#303034] hover:border-[#C6FF3D]/50 font-bold text-xs text-white text-center transition-colors"
            >
              👤 Customer
            </button>
            <button
              type="button"
              onClick={() => {
                setIdentifier('driver@example.com');
                setPassword('password123');
              }}
              className="px-3 py-2 bg-[#171719] hover:bg-[#26262A] rounded-xl border border-[#303034] hover:border-[#C6FF3D]/50 font-bold text-xs text-white text-center transition-colors"
            >
              🛺 Driver
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
              Email or Mobile Number *
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@email.com or 9876543210"
                className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#303034] text-sm font-medium focus:outline-none focus:border-[#C6FF3D] bg-[#202023] text-white placeholder-[#71717A]"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[#A1A1AA] uppercase">
                Password *
              </label>
              <button
                type="button"
                onClick={() => setForgotModalOpen(true)}
                className="text-xs font-semibold text-[#C6FF3D] hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#303034] text-sm font-medium focus:outline-none focus:border-[#C6FF3D] bg-[#202023] text-white placeholder-[#71717A]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-[#A1A1AA] hover:text-white"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-sm rounded-xl shadow-glow-lime transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Logging in...</span>
            ) : (
              <>
                <span>Login</span>
                <ArrowRight className="w-4 h-4 text-[#0B0B0D]" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-[#A1A1AA]">
          Don't have an account yet?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="font-bold text-[#C6FF3D] hover:underline"
          >
            Create Account
          </button>
        </div>
      </div>

      {/* Forgot password modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#171719] rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-[#303034] text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#202023] text-[#C6FF3D] border border-[#303034] mx-auto flex items-center justify-center mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white mb-1">Reset Password</h3>
            <p className="text-xs text-[#A1A1AA] mb-5 leading-relaxed">
              Use your registered mobile number or email address with the verification code to reset your account credentials.
            </p>
            <button
              onClick={() => setForgotModalOpen(false)}
              className="w-full py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-bold text-xs rounded-xl shadow-subtle"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
