import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { ShieldCheck, FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Lock } from 'lucide-react';

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
                <p><strong className="text-white">1. Fixed Fare Promise:</strong> All auto fares displayed at the time of booking are fixed based on verified route parameters. No hidden meter charges or surge multipliers.</p>
                <p><strong className="text-white">2. Passenger Safety:</strong> Riders must follow local safety guidelines. Clik2Go reserves the right to suspend accounts engaged in abusive behavior towards drivers or customers.</p>
                <p><strong className="text-white">3. Cancellations:</strong> Free cancellation is available before a driver arrives at pickup. Frequent cancellations after arrival may incur temporary restrictions.</p>
                <p><strong className="text-white">4. Payment:</strong> Fares can be paid directly to drivers via Cash or UPI, or online via Cashfree where supported.</p>
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
                <p><strong className="text-white">1. Location Data:</strong> We collect GPS coordinates only during active booking and ride progression to calculate accurate route fares and enable driver pickup navigation.</p>
                <p><strong className="text-white">2. Contact Protection:</strong> Your phone number is masked or used strictly between assigned driver and rider for pickup coordination.</p>
                <p><strong className="text-white">3. Data Security:</strong> Industry-standard TLS encryption is used for all transactions and sensitive account credentials.</p>
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
            I have read, understood, and agree to the <span className="text-white font-bold">Terms of Service</span> and <span className="text-white font-bold">Privacy Policy</span> (v1.0).
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
