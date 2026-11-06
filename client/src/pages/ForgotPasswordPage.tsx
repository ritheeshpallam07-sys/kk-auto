import React, { useState } from 'react';
import { api } from '../api/client';
import { Logo } from '../components/Logo';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface ForgotPasswordPageProps {
  navigate: (path: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ navigate }) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.auth.forgotPassword(cleanEmail);
      if (res.success) {
        setSubmitted(true);
      } else {
        setError(res.error || 'Failed to submit password recovery request.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8 sm:py-16 px-4 sm:px-6 lg:px-8 bg-[#0B0B0D] text-white safe-top safe-bottom">
      <div className="max-w-md w-full space-y-6 bg-[#171719] p-6 sm:p-10 rounded-3xl shadow-card border border-[#303034]">
        
        {/* Brand Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Account Recovery
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Reset your password using your verified email address
          </p>
        </div>

        {submitted ? (
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#C6FF3D]/10 border border-[#C6FF3D]/30 text-[#C6FF3D] mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white">Check Your Inbox</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                If an active account is associated with <span className="text-white font-mono">{email}</span>, we have sent a secure password reset link.
              </p>
              <p className="text-[11px] text-[#71717A]">
                The link will expire in <strong>15 minutes</strong>. If you do not see it within a few moments, please check your spam folder.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-3 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs uppercase tracking-wider rounded-xl shadow-glow-lime transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Login</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
                Registered Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#303034] text-sm font-medium focus:outline-none focus:border-[#C6FF3D] bg-[#202023] text-white placeholder-[#71717A]"
                  required
                />
              </div>
              <p className="text-[11px] text-[#71717A] mt-1.5">
                We'll send a single-use 15-minute recovery link.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-sm rounded-xl shadow-glow-lime transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Sending Recovery Link...</span>
              ) : (
                <>
                  <span>Send Recovery Link</span>
                  <ArrowRight className="w-4 h-4 text-[#0B0B0D]" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs text-[#A1A1AA] hover:text-[#C6FF3D] font-bold transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Login</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
