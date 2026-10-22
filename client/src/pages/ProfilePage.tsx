import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Shield, FileText, LogOut, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface ProfilePageProps {
  navigate: (path: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ navigate }) => {
  const { user, logout, hasAcceptedTerms } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8 bg-[#0B0B0D] text-white safe-bottom">
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 text-xs font-bold text-white hover:text-[#C6FF3D] transition-colors min-h-[36px] px-3 py-1.5 rounded-xl bg-[#171719] border border-[#303034]"
      >
        <ArrowLeft className="w-4 h-4 text-[#C6FF3D]" />
        <span>Back to Home</span>
      </button>

      <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 shadow-card border border-[#303034] space-y-6">
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

          <div className="flex items-center gap-3.5 p-4 bg-[#202023] rounded-2xl border border-[#303034]">
            <FileText className="w-5 h-5 text-[#C6FF3D] flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-[#A1A1AA]">Terms of Service & Privacy Policy</div>
              <div className="text-xs font-bold text-[#C6FF3D] flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Accepted Version {user.terms_version || '1.0'}</span>
              </div>
            </div>
          </div>
        </div>

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
    </div>
  );
};
