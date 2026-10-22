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
    <div className="min-h-screen flex items-center justify-center py-8 sm:py-16 px-4 bg-[#0B0B0D] text-white relative safe-top safe-bottom">
      <div className="max-w-md w-full bg-[#171719] p-6 sm:p-10 rounded-3xl shadow-card border border-[#303034]">

        {/* Logo & Portal Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <Logo size="md" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#202023] border border-[#303034] text-[#C6FF3D] text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Clik2Go Admin Console</span>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">
            Owner Sign In
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Access platform settlements, fare configuration, and driver approvals
          </p>
        </div>

        {/* Quick Demo Pill */}
        <div className="p-3 bg-[#202023] rounded-2xl border border-[#303034] mb-6 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#A1A1AA] block">Demo Credentials</span>
            <span className="text-xs font-mono text-white">admin@example.com</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIdentifier('admin@example.com');
              setPassword('password123');
            }}
            className="px-3 py-1 bg-[#171719] hover:bg-[#26262A] border border-[#303034] text-[11px] font-bold text-[#C6FF3D] rounded-lg"
          >
            Auto-fill
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
              Owner Email / Username
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@example.com"
                className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#303034] bg-[#202023] text-white text-sm font-medium focus:outline-none focus:border-[#C6FF3D]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#303034] bg-[#202023] text-white text-sm font-medium focus:outline-none focus:border-[#C6FF3D]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs uppercase tracking-wider rounded-xl shadow-glow-lime transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In to Console'}
            <ArrowRight className="w-4 h-4 text-[#0B0B0D]" />
          </button>
        </form>

        <div className="text-center pt-6 text-xs text-[#A1A1AA]">
          <button
            onClick={() => navigate('/')}
            className="font-bold text-[#C6FF3D] hover:underline"
          >
            ← Return to Customer Portal
          </button>
        </div>

      </div>
    </div>
  );
};
