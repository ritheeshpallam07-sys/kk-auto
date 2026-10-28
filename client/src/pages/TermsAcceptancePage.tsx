import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { ShieldCheck, FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Lock, ExternalLink } from 'lucide-react';

interface TermsAcceptancePageProps {
  navigate: (path: string) => void;
}

export const TermsAcceptancePage: React.FC<TermsAcceptancePageProps> = ({ navigate }) => {
  const { user, acceptTerms, isDriver, isAdmin } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'terms' | 'privacy' | null>(null);

  const handleAccept = async () => {
    if (!agreed) {
      setError('Please check the box to confirm you accept the terms and privacy policy.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const success = await acceptTerms('1.0');
    setIsSubmitting(false);

    if (success) {
      if (isDriver) {
        navigate('/driver');
      } else if (isAdmin) {
        navigate('/owner/dashboard');
      } else {
        navigate('/');
      }
    } else {
      setError('Failed to record your acceptance. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-white flex flex-col justify-center items-center py-8 px-4 sm:px-6 safe-top safe-bottom">
      <div className="w-full max-w-lg bg-[#171719] rounded-3xl border border-[#303034] shadow-card p-6 sm:p-8 space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <Logo size="md" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#202023] border border-[#303034] text-[11px] font-bold text-[#C6FF3D]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Policy Update • Version 1.0</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Terms & Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#A1A1AA] max-w-md mx-auto">
            Welcome to Clik2Go, {user?.name || 'Rider'}. Please review and agree to our Terms of Service and Privacy Policy before continuing.
          </p>
        </div>

        {/* Expandable Policies Box */}
        <div className="space-y-3">

          {/* 1. Terms of Service */}
          <div className="bg-[#202023] rounded-2xl border border-[#303034] overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setExpandedSection(expandedSection === 'terms' ? null : 'terms')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#26262A] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#171719] border border-[#303034] flex items-center justify-center text-[#C6FF3D]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Terms of Service (v1.0)</h3>
                  <p className="text-[11px] text-[#A1A1AA]">Rides, fixed fare policies, conduct and cancellations</p>
                </div>
              </div>
              {expandedSection === 'terms' ? (
                <ChevronUp className="w-4 h-4 text-[#A1A1AA]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#A1A1AA]" />
              )}
            </button>

            {expandedSection === 'terms' && (
              <div className="px-4 pb-4 pt-1 text-xs text-[#A1A1AA] border-t border-[#303034] space-y-2 max-h-48 overflow-y-auto">
                <p><strong className="text-white">1. Committee-Decided Fares:</strong> All ride fares strictly follow the rates decided by the local drivers&apos; committee with zero surge charges.</p>
                <p><strong className="text-white">2. Service Area:</strong> Operates strictly within our designated local operating town/city and authorized zone routes.</p>
                <p><strong className="text-white">3. Cancellations:</strong> Free customer cancellation before a driver is assigned. Driver cancellations after acceptance may incur a penalty determined by the Owner/Admin.</p>
                <p><strong className="text-white">4. Payment:</strong> Direct Cash or driver UPI QR payments upon ride completion. Duplicate payments are eligible for review at support@clik2go.in.</p>
                <p><strong className="text-white">5. Disputes & Misuse:</strong> Disputes are resolved by the Owner/Admin. Account misuse may result in restrictions or suspension.</p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/terms')}
                    className="text-[#C6FF3D] font-bold underline text-[11px] inline-flex items-center gap-1"
                  >
                    <span>Read Full Terms & Conditions</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Privacy Policy */}
          <div className="bg-[#202023] rounded-2xl border border-[#303034] overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setExpandedSection(expandedSection === 'privacy' ? null : 'privacy')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#26262A] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#171719] border border-[#303034] flex items-center justify-center text-[#C6FF3D]">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Privacy Policy (v1.0)</h3>
                  <p className="text-[11px] text-[#A1A1AA]">Location tracking, data encryption, and account security</p>
                </div>
              </div>
              {expandedSection === 'privacy' ? (
                <ChevronUp className="w-4 h-4 text-[#A1A1AA]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#A1A1AA]" />
              )}
            </button>

            {expandedSection === 'privacy' && (
              <div className="px-4 pb-4 pt-1 text-xs text-[#A1A1AA] border-t border-[#303034] space-y-2 max-h-48 overflow-y-auto">
                <p><strong className="text-white">1. Information Collected:</strong> Name, 10-digit mobile number, and email address. Passwords are securely hashed with bcrypt (never stored in plain text).</p>
                <p><strong className="text-white">2. Access Controls:</strong> Customer pickup/drop details are visible to the assigned driver only after that driver accepts the booking.</p>
                <p><strong className="text-white">3. Retention & Deletion:</strong> Ride history is retained while accounts are active. Deletion requests can be submitted via Profile settings or support@clik2go.in; financial and statutory records are archived as required by law.</p>
                <p><strong className="text-white">4. Notifications:</strong> Delivered via website alerts and transactional verification emails.</p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/privacy')}
                    className="text-[#C6FF3D] font-bold underline text-[11px] inline-flex items-center gap-1"
                  >
                    <span>Read Full Privacy Policy</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 p-3 rounded-2xl bg-[#202023]/60 border border-[#303034] cursor-pointer hover:border-[#C6FF3D]/50 transition-colors">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              if (error) setError(null);
            }}
            className="mt-0.5 w-4 h-4 rounded text-[#C6FF3D] bg-[#0B0B0D] border-[#303034] focus:ring-[#C6FF3D] focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-xs text-[#A1A1AA] leading-relaxed">
            I have read, understood, and agree to the{' '}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/terms');
              }}
              className="text-white font-bold underline hover:text-[#C6FF3D]"
            >
              Terms & Conditions
            </button>{' '}
            and acknowledge the{' '}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/privacy');
              }}
              className="text-white font-bold underline hover:text-[#C6FF3D]"
            >
              Privacy Policy
            </button>.
          </span>
        </label>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        <div>
          <button
            type="button"
            onClick={handleAccept}
            disabled={!agreed || isSubmitting}
            className="w-full py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-sm rounded-2xl transition-all shadow-glow-lime disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span>Saving Acceptance...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Accept and Continue</span>
              </>
            )}
          </button>

          <p className="text-[10px] text-center text-[#A1A1AA] mt-3">
            Stored securely on your Clik2Go account for future logins
          </p>
        </div>

      </div>
    </div>
  );
};
