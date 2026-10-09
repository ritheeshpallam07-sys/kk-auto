import React, { useState } from 'react';
import { api } from '../api/client';

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
      setError('Please enter the 6-digit OTP.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.auth.verifyEmailOtp(email, otp);

      if (res.success && res.data) {
        setMessage('Email verified successfully! Redirecting...');
        localStorage.setItem('kk_token', res.data.token);

        // Reload app authentication state through login instead of storing user locally.
        navigate('/login');
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Verify your email
        </h1>

        <p className="mb-6 text-sm text-gray-600">
          Enter the 6-digit OTP sent to <strong>{email}</strong>.
        </p>

        {!email && (
          <p className="mb-4 text-sm text-red-600">
            Email address missing. Please register again.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 6-digit OTP"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 tracking-widest outline-none focus:border-blue-500"
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !email}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
      </div>
    </div>
  );
};