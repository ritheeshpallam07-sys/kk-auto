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
  const { login } = useAuth();

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
      if (res.data?.user?.role === 'driver') {
        navigate('/driver');
      } else if (res.data?.user?.role === 'admin') {
        navigate('/owner/dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(res.error || 'Invalid credentials.');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-6 sm:py-12 px-3 sm:px-6 lg:px-8 bg-[#F8FAFC]">
      <div className="max-w-md w-full space-y-6 sm:space-y-7 bg-white p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200/80">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <Logo size="md" />
          </div>
          <h2 className="text-2xl font-black text-[#071426] tracking-tight">
            Welcome back
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Log in with your email or mobile number to manage your rides
          </p>
        </div>

        {/* Demo Fast-Login Pills for easy testing */}
        <div className="p-3.5 bg-orange-50/80 rounded-2xl border border-orange-200/80 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#071426] mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#FF8A00]" />
            <span className="text-[11px] uppercase tracking-wide">Quick Role Access</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setIdentifier('customer@example.com');
                setPassword('password123');
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-orange-100/70 rounded-xl border border-orange-200 font-bold text-[11px] text-slate-800 text-center shadow-2xs transition-colors"
            >
              👤 Customer
            </button>
            <button
              type="button"
              onClick={() => {
                setIdentifier('driver@example.com');
                setPassword('password123');
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-orange-100/70 rounded-xl border border-orange-200 font-bold text-[11px] text-slate-800 text-center shadow-2xs transition-colors"
            >
              🛺 Driver
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
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A00] bg-slate-50/50 focus:bg-white"
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
                className="text-xs font-semibold text-[#FF8A00] hover:text-[#E67600] hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A00] bg-slate-50/50 focus:bg-white"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600"
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
            className="w-full py-3.5 bg-[#FF8A00] hover:bg-[#FF9D2E] text-[#071426] font-black text-sm rounded-xl shadow-glow-orange transition-all hover:scale-102 flex items-center justify-center gap-2 disabled:opacity-50"
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
            className="font-bold text-[#FF8A00] hover:text-[#E67600] underline"
          >
            Create Account
          </button>
        </div>
      </div>

      {/* Forgot password simulated modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#071426]/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#FF8A00] mx-auto flex items-center justify-center mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-[#071426] mb-1">Reset Password</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Use your registered mobile number or email address with the verification code to reset your account credentials.
            </p>
            <button
              onClick={() => setForgotModalOpen(false)}
              className="w-full py-2.5 bg-[#071426] hover:bg-[#10243D] text-white font-bold text-xs rounded-xl"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
