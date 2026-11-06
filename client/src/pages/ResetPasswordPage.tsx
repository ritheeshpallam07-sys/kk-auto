import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Logo } from '../components/Logo';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

interface ResetPasswordPageProps {
  navigate: (path: string) => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ navigate }) => {
  // Read token from URL query string on initial mount, then scrub it from address bar & browser history
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  });

  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Security: Immediately sanitize the visible URL to prevent token leakage via browser history,
  // copy-paste, shoulder surfing, or Referer headers.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('token=')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Pre-validate token on mount
  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token || !/^[a-fA-F0-9]{64}$/.test(token.trim())) {
        if (isMounted) {
          setIsVerifying(false);
          setTokenValid(false);
          setTokenError('The password recovery link is missing, malformed, or invalid.');
        }
        return;
      }

      try {
        const res = await api.auth.verifyResetToken(token.trim());
        if (isMounted) {
          setIsVerifying(false);
          if (res.success && res.data?.valid) {
            setTokenValid(true);
            setTokenError(null);
          } else {
            setTokenValid(false);
            setTokenError(res.error || 'This recovery link has expired or has already been used.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setIsVerifying(false);
          setTokenValid(false);
          setTokenError('Unable to verify recovery link. Please try again.');
        }
      }
    }

    checkToken();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const isMinLength = newPassword.length >= 12;
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = isMinLength && isMatching && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!token) {
      setSubmitError('Recovery token is missing. Please request a new recovery link.');
      return;
    }

    if (!isMinLength) {
      setSubmitError('New password must be at least 12 characters long.');
      return;
    }

    if (!isMatching) {
      setSubmitError('New password and confirmation do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.auth.resetPassword({
        token: token.trim(),
        newPassword,
        confirmPassword
      });

      if (res.success) {
        setResetSuccess(true);
        // Clear token from memory
        setToken(null);
      } else {
        setSubmitError(res.error || 'Failed to reset password.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Network error occurred. Please try again.');
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
            Create New Password
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Choose a strong, 12+ character password to secure your account
          </p>
        </div>

        {/* Verifying Link State */}
        {isVerifying && (
          <div className="py-12 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-[#C6FF3D] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#A1A1AA] font-medium">Validating recovery link...</p>
          </div>
        )}

        {/* Invalid or Expired Token State */}
        {!isVerifying && !tokenValid && !resetSuccess && (
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white">Recovery Link Expired or Invalid</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                {tokenError || 'This password reset link is invalid, has already been used, or has expired after 15 minutes.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="w-full py-3 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs uppercase tracking-wider rounded-xl shadow-glow-lime transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Request New Recovery Link</span>
            </button>

            <div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs text-[#A1A1AA] hover:text-white transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}

        {/* Password Reset Success State */}
        {resetSuccess && (
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#C6FF3D]/10 border border-[#C6FF3D]/30 text-[#C6FF3D] mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white">Password Reset Complete</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Your password has been securely updated. All existing sessions across other devices have been invalidated.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs uppercase tracking-wider rounded-xl shadow-glow-lime transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <span>Sign In with New Password</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Valid Token Reset Form */}
        {!isVerifying && tokenValid && !resetSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{submitError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
                New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#303034] text-sm font-medium focus:outline-none focus:border-[#C6FF3D] bg-[#202023] text-white placeholder-[#71717A]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-3 text-[#A1A1AA] hover:text-white"
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1.5">
                Confirm New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#A1A1AA]" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#303034] text-sm font-medium focus:outline-none focus:border-[#C6FF3D] bg-[#202023] text-white placeholder-[#71717A]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-3 text-[#A1A1AA] hover:text-white"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Policy Indicators */}
            <div className="p-3 bg-[#202023] rounded-xl border border-[#303034] space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                  isMinLength ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black' : 'bg-[#303034] text-[#A1A1AA]'
                }`}>
                  {isMinLength ? '✓' : '•'}
                </div>
                <span className={isMinLength ? 'text-[#C6FF3D] font-semibold' : 'text-[#A1A1AA]'}>
                  Minimum 12 characters ({newPassword.length}/12)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                  isMatching ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black' : 'bg-[#303034] text-[#A1A1AA]'
                }`}>
                  {isMatching ? '✓' : '•'}
                </div>
                <span className={isMatching ? 'text-[#C6FF3D] font-semibold' : 'text-[#A1A1AA]'}>
                  Passwords match
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-sm rounded-xl shadow-glow-lime transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span>Resetting Password...</span>
              ) : (
                <>
                  <span>Set New Password</span>
                  <ShieldCheck className="w-4 h-4 text-[#0B0B0D]" />
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
