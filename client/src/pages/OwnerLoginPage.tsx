import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import {
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface OwnerLoginPageProps {
  navigate: (path: string) => void;
}

export const OwnerLoginPage: React.FC<OwnerLoginPageProps> = ({
  navigate,
}) => {
  const { login, logout } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Please enter your owner email/mobile and password.');
      return;
    }

    setIsSubmitting(true);
    const res = await login(identifier, password);
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Invalid owner credentials.');
      return;
    }

    if (res.data?.user?.role !== 'admin') {
      logout();
      setError('This account does not have Owner access.');
      return;
    }

    navigate('/owner/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-8 sm:py-12 px-3 sm:px-4 bg-[#071426] relative overflow-hidden">
      {/* Subtle ambient orange glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FF8A00]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-md w-full bg-[#10243D] p-5 sm:p-10 rounded-2xl sm:rounded-3xl shadow-2xl border border-[#1A3353]">

        {/* Logo & Portal Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <Logo size="md" theme="light" />
          </div>

          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#071426] text-[#FF8A00] flex items-center justify-center mb-4 border border-[#1A3353] shadow-glow-orange">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            Clik2Go Owner Portal
          </h1>

          <p className="text-xs text-[#A9B7C9] mt-1.5">
            Private management console for Clik2Go platform administration
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5 mb-5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-[#A9B7C9] uppercase mb-1">
              Owner Email or Mobile *
            </label>

            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />

              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Owner email or mobile"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#1A3353] bg-[#071426] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A00]"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-[#A9B7C9] uppercase mb-1">
              Password *
            </label>

            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Owner password"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#1A3353] bg-[#071426] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A00]"
                required
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#FF8A00] hover:bg-[#FF9D2E] text-[#071426] font-black text-sm rounded-xl shadow-glow-orange transition-all hover:scale-102 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Enter Owner Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-xs font-semibold text-[#A9B7C9] hover:text-white transition-colors"
          >
            ← Back to Clik2Go Home
          </button>
        </div>
      </div>
    </div>
  );
};