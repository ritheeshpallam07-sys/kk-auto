import React, { useState } from 'react';
import { api } from '../api/client';
import { Logo } from '../components/Logo';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';

interface VerifyEmailPageProps {
  navigate: (path: string) => void;
}

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ navigate }) => {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!/^\d{6}$/.test(otp)) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.auth.verifyEmailOtp(email, otp);

      if (res.success && res.data) {
        setMessage('Email verified successfully! Redirecting to login...');
        localStorage.setItem('kk_token', res.data.token);

        setTimeout(() => {
          navigate('/login');
        }, 1200);
      } else {
        setError(res.error || 'OTP verification failed.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-[#F8FAFC] px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 sm:p-10 shadow-xl border border-slate-200/80">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>

          <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 text-[#FF8A00] flex items-center justify-center mb-3">
            <Mail className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-black text-[#071426] tracking-tight">
            Verify Your Email
          </h1>

          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Enter the 6-digit verification code sent to <br />
            <strong className="text-slate-800 font-bold">{email || 'your email'}</strong>
          </p>
        </div>

        {!email && (
          <div className="p-3.5 mb-4 rounded-xl bg-[#FF8A00]/10 border border-[#FF8A00]/25 text-[#FF8A00] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#FF8A00]" />
            <span>Email address parameter missing. Please register again.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 text-center">
              6-Digit One-Time Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-center text-xl tracking-[0.4em] font-mono font-black outline-none focus:ring-2 focus:ring-[#FF8A00] bg-slate-50 focus:bg-white"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !email}
            className="w-full rounded-xl bg-[#FF8A00] hover:bg-[#FF9D2E] px-4 py-3.5 font-black text-sm text-[#071426] shadow-glow-orange transition-all hover:scale-102 disabled:opacity-50"
          >
            {isSubmitting ? 'Verifying Code...' : 'Verify & Continue'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};