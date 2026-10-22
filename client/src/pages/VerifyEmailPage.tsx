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
        setMessage('Email verified successfully! Proceeding to Terms...');
        localStorage.setItem('kk_token', res.data.token);

        setTimeout(() => {
          navigate('/accept-terms');
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
    <div className="min-h-[85vh] flex items-center justify-center bg-[#0B0B0D] px-4 py-8 sm:py-16 text-white safe-top safe-bottom">
      <div className="w-full max-w-md rounded-3xl bg-[#171719] p-6 sm:p-10 shadow-card border border-[#303034]">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>

          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#202023] border border-[#303034] text-[#C6FF3D] flex items-center justify-center mb-3">
            <Mail className="w-7 h-7" />
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">
            Verify Your Email
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-1.5 leading-relaxed">
            Enter the 6-digit verification code sent to
          </p>
          <p className="text-xs font-bold text-white mt-0.5 break-all">
            {email || 'your email'}
          </p>
        </div>

        {message && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
              6-Digit OTP Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full text-center tracking-[0.4em] text-2xl font-bold py-3.5 rounded-xl border border-[#303034] focus:outline-none focus:border-[#C6FF3D] bg-[#202023] text-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {isSubmitting ? 'Verifying...' : 'Verify OTP & Continue'}
          </button>
        </form>

        <div className="text-center pt-4 text-xs text-[#A1A1AA]">
          Entered the wrong email?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="font-bold text-[#C6FF3D] hover:underline"
          >
            Back to registration
          </button>
        </div>
      </div>
    </div>
  );
};
