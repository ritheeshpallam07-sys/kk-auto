import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, AccountDeletionRequest } from '../api/client';
import {
  User,
  Mail,
  Phone,
  Shield,
  FileText,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  AlertCircle,
  X,
  Clock,
  ExternalLink
} from 'lucide-react';

interface ProfilePageProps {
  navigate: (path: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ navigate }) => {
  const { user, logout } = useAuth();

  // Deletion request state
  const [deletionRequest, setDeletionRequest] = useState<AccountDeletionRequest | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Modal & action state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [confirmedConsequences, setConfirmedConsequences] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [isCancellingDelete, setIsCancellingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchDeletionStatus() {
      try {
        const res = await api.auth.getDeletionRequest();
        if (isMounted && res.success && res.data) {
          setHasPendingRequest(res.data.hasPendingRequest);
          setDeletionRequest(res.data.request);
        }
      } catch {
        // Fallback silently if status lookup fails
      } finally {
        if (isMounted) setIsLoadingStatus(false);
      }
    }
    fetchDeletionStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!user) return null;

  const handleRequestDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedConsequences) {
      setDeleteError('Please acknowledge the consequences before submitting your deletion request.');
      return;
    }

    setDeleteError(null);
    setIsSubmittingDelete(true);

    try {
      const res = await api.auth.requestAccountDeletion(deleteReason);
      if (res.success && res.data) {
        setHasPendingRequest(true);
        setDeletionRequest(res.data);
        setIsDeleteModalOpen(false);
        setDeleteSuccessMessage(
          res.message || 'Account deletion request submitted successfully. Our team will review your request.'
        );
      } else {
        setDeleteError(res.error || 'Failed to submit account deletion request.');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const handleCancelDeletion = async () => {
    setDeleteError(null);
    setIsCancellingDelete(true);
    try {
      const res = await api.auth.cancelAccountDeletion();
      if (res.success) {
        setHasPendingRequest(false);
        setDeletionRequest(null);
        setDeleteSuccessMessage('Your account deletion request has been cancelled.');
        setTimeout(() => setDeleteSuccessMessage(null), 5000);
      } else {
        setDeleteError(res.error || 'Failed to cancel deletion request.');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to cancel request.');
    } finally {
      setIsCancellingDelete(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8 bg-[#0B0B0D] text-white safe-bottom">

      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-bold text-white hover:text-[#C6FF3D] transition-colors min-h-[36px] px-3 py-1.5 rounded-xl bg-[#171719] border border-[#303034]"
        >
          <ArrowLeft className="w-4 h-4 text-[#C6FF3D]" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => navigate('/terms')}
            className="text-[#A1A1AA] hover:text-[#C6FF3D] transition-colors"
          >
            Terms
          </button>
          <span className="text-[#303034]">•</span>
          <button
            type="button"
            onClick={() => navigate('/privacy')}
            className="text-[#A1A1AA] hover:text-[#C6FF3D] transition-colors"
          >
            Privacy
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {deleteSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{deleteSuccessMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteSuccessMessage(null)}
            className="text-emerald-400 hover:text-white p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pending Account Deletion Status Banner */}
      {hasPendingRequest && deletionRequest && (
        <div className="p-5 sm:p-6 rounded-3xl bg-amber-950/30 border border-amber-800/80 space-y-4 animate-fade-in shadow-card">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-900/40 border border-amber-700/60 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-600/40 text-[10px] font-black uppercase tracking-wider">
                  Deletion Pending Review
                </span>
                <span className="text-xs text-[#A1A1AA]">
                  Requested: {formatDate(deletionRequest.requested_at)}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Account Closure Request Under Review
              </h3>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                Your account closure request has been recorded. Platform access is scheduled for deactivation. In accordance with Indian accounting and commercial compliance laws, completed payment logs and ride transaction audit records are archived and retained.
              </p>
              {deletionRequest.reason && (
                <p className="text-[11px] text-[#A1A1AA] italic pt-1">
                  Reason submitted: &quot;{deletionRequest.reason}&quot;
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-amber-800/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <span className="text-[#A1A1AA]">
              Questions or changes? Contact <a href="mailto:support@clik2go.in" className="text-[#C6FF3D] underline">support@clik2go.in</a>
            </span>
            <button
              type="button"
              onClick={handleCancelDeletion}
              disabled={isCancellingDelete}
              className="px-4 py-2 rounded-xl bg-[#202023] hover:bg-[#26262A] text-white border border-[#303034] hover:border-[#C6FF3D]/50 text-xs font-bold transition-all disabled:opacity-50 text-center"
            >
              {isCancellingDelete ? 'Cancelling Request...' : 'Cancel Deletion Request'}
            </button>
          </div>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 shadow-card border border-[#303034] space-y-6">

        {/* User Avatar & Name */}
        <div className="flex items-center gap-4 sm:gap-5 pb-6 border-b border-[#303034]">
          <div className="w-16 h-16 rounded-2xl bg-[#202023] border border-[#303034] text-[#C6FF3D] font-black text-2xl flex items-center justify-center shadow-subtle flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-white break-words">{user.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30 text-[10px] font-black uppercase tracking-wider">
                {user.role}
              </span>
              <span className="text-xs text-[#A1A1AA]">• Verified Account</span>
            </div>
          </div>
        </div>

        {/* Profile Details List */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-3.5 p-4 bg-[#202023] rounded-2xl border border-[#303034]">
            <Mail className="w-5 h-5 text-[#C6FF3D] flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-[#A1A1AA]">Email Address</div>
              <div className="text-xs font-bold text-white break-all">{user.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 bg-[#202023] rounded-2xl border border-[#303034]">
            <Phone className="w-5 h-5 text-[#C6FF3D] flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-[#A1A1AA]">Mobile Number</div>
              <div className="text-xs font-bold text-white break-all">{user.mobile}</div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 bg-[#202023] rounded-2xl border border-[#303034]">
            <Shield className="w-5 h-5 text-[#C6FF3D] flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-[#A1A1AA]">Role & Permissions</div>
              <div className="text-xs font-bold text-white capitalize">{user.role} Access</div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3.5 p-4 bg-[#202023] rounded-2xl border border-[#303034]">
            <div className="flex items-center gap-3.5 min-w-0">
              <FileText className="w-5 h-5 text-[#C6FF3D] flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-[#A1A1AA]">Terms of Service & Privacy Policy</div>
                <div className="text-xs font-bold text-[#C6FF3D] flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Accepted Version {user.terms_version || '1.0'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => navigate('/terms')}
                className="px-2.5 py-1 rounded-lg bg-[#171719] hover:bg-[#303034] text-[11px] font-semibold text-white border border-[#303034] transition-colors"
              >
                Terms
              </button>
              <button
                type="button"
                onClick={() => navigate('/privacy')}
                className="px-2.5 py-1 rounded-lg bg-[#171719] hover:bg-[#303034] text-[11px] font-semibold text-white border border-[#303034] transition-colors"
              >
                Privacy
              </button>
            </div>
          </div>
        </div>

        {/* Primary Actions */}
        <div className="pt-4 border-t border-[#303034] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={() => navigate('/my-rides')}
            className="w-full sm:w-auto px-5 py-3 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime text-center justify-center min-h-[44px]"
          >
            View Ride History
          </button>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full sm:w-auto px-5 py-3 bg-[#202023] hover:bg-rose-950/40 text-rose-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors min-h-[44px] border border-[#303034] hover:border-rose-800"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Danger Zone: Account Deletion */}
      <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 shadow-card border border-rose-950/60 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Danger Zone</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Delete Account
            </h3>
            <p className="text-xs text-[#A1A1AA] max-w-xl leading-relaxed">
              Submit a formal request to permanently deactivate your Clik2Go account. Once processed, account access is permanently closed. In compliance with applicable Indian commercial and tax regulations, ride transaction audit logs and financial records will be retained.
            </p>
          </div>

          {!hasPendingRequest && (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setConfirmedConsequences(false);
                setDeleteReason('');
                setIsDeleteModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800 hover:border-rose-600 text-xs font-bold flex items-center gap-1.5 transition-all flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Request Deletion</span>
            </button>
          )}
        </div>

        {hasPendingRequest && (
          <div className="p-3.5 rounded-2xl bg-[#202023] border border-[#303034] text-xs text-[#A1A1AA] flex items-center justify-between gap-3">
            <span>A deletion request is currently pending review for this account.</span>
            <button
              type="button"
              onClick={handleCancelDeletion}
              disabled={isCancellingDelete}
              className="text-[#C6FF3D] hover:underline font-bold text-xs"
            >
              {isCancellingDelete ? 'Cancelling...' : 'Cancel Request'}
            </button>
          </div>
        )}
      </div>

      {/* Account Deletion Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-lg bg-[#171719] rounded-3xl shadow-card p-5 sm:p-7 border border-rose-900/80 max-h-[90vh] overflow-y-auto space-y-5 animate-scale-up">

            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#303034]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Request Account Deletion
                  </h3>
                  <p className="text-xs text-[#A1A1AA]">
                    Account: {user.email} ({user.role})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isSubmittingDelete}
                className="text-[#A1A1AA] hover:text-white p-1 rounded-xl hover:bg-[#202023] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner inside modal */}
            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Consequences Explanation */}
            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-2.5 text-xs text-[#D4D4D8] leading-relaxed">
              <h4 className="font-bold text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Please read the consequences carefully:</span>
              </h4>
              <ul className="list-disc list-inside space-y-1.5 pl-1 text-[11px] text-[#A1A1AA]">
                <li>
                  <strong className="text-white">Permanent Deactivation:</strong> You will not be able to log in, book auto rides, or accept bookings once processed.
                </li>
                <li>
                  <strong className="text-white">Active Rides Precondition:</strong> If you currently have an active ride in progress, you must complete or cancel it before deletion can be processed.
                </li>
                <li>
                  <strong className="text-white">Statutory Financial Retention:</strong> Under Indian tax, accounting, and transport regulatory laws, completed ride receipts, payment transactions, and UPI reference logs are legally archived and will not be erased.
                </li>
                {user.role === 'driver' && (
                  <li>
                    <strong className="text-white">Driver Partner Notice:</strong> Your driver profile will immediately be set to offline and removed from dispatch matching upon submitting this request.
                  </li>
                )}
                <li>
                  <strong className="text-white">Support Inquiries:</strong> You can reach our administration at <a href="mailto:support@clik2go.in" className="text-[#C6FF3D] underline">support@clik2go.in</a> for questions regarding your account status.
                </li>
              </ul>
            </div>

            <form onSubmit={handleRequestDeletion} className="space-y-4">

              {/* Optional reason */}
              <div className="space-y-1.5">
                <label htmlFor="delete-reason" className="text-xs font-semibold text-white block">
                  Reason for deleting account <span className="text-[#71717A]">(Optional)</span>
                </label>
                <textarea
                  id="delete-reason"
                  rows={2}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Tell us why you are requesting account deletion..."
                  maxLength={500}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#202023] border border-[#303034] text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-rose-500 transition-colors resize-none"
                />
              </div>

              {/* Mandatory confirmation checkbox */}
              <label className="flex items-start gap-3 p-3 rounded-2xl bg-[#202023] border border-[#303034] hover:border-[#3E3E44] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={confirmedConsequences}
                  onChange={(e) => {
                    setConfirmedConsequences(e.target.checked);
                    if (deleteError) setDeleteError(null);
                  }}
                  className="w-4 h-4 mt-0.5 rounded text-rose-500 bg-[#0B0B0D] border-[#303034] focus:ring-rose-500 focus:ring-offset-0 cursor-pointer flex-shrink-0"
                  required
                />
                <span className="text-xs text-[#D4D4D8] leading-relaxed select-none">
                  I understand the consequences of closing my Clik2Go account and confirm that this request cannot be undone once processed.
                </span>
              </label>

              {/* Action buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isSubmittingDelete}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-white bg-[#202023] hover:bg-[#26262A] border border-[#303034] rounded-xl transition-colors text-center disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDelete || !confirmedConsequences}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isSubmittingDelete && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Submit Deletion Request</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};