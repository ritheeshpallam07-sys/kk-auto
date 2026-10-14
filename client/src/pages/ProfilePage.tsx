import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Shield, Calendar, LogOut, ArrowLeft } from 'lucide-react';

interface ProfilePageProps {
  navigate: (path: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ navigate }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
      <button
        onClick={() => navigate('/dashboard')}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 min-h-[36px]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-200/80 space-y-5 sm:space-y-6">
        <div className="flex items-center gap-4 sm:gap-5 pb-5 sm:pb-6 border-b border-slate-100">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#FF8A00] to-[#E67600] text-slate-950 font-black text-xl sm:text-2xl flex items-center justify-center shadow-lg shadow-[#FF8A00]/25 flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 break-words">{user.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FF8A00]/15 text-[#FF8A00] border border-[#FF8A00]/25 text-[10px] font-bold uppercase tracking-wider">
                {user.role}
              </span>
              <span className="text-xs text-slate-400">• Verified Account</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-xl sm:rounded-2xl">
            <Mail className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Email Address</div>
              <div className="text-xs font-bold text-slate-800 break-all">{user.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-xl sm:rounded-2xl">
            <Phone className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Mobile Number</div>
              <div className="text-xs font-bold text-slate-800 break-all">{user.mobile}</div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-xl sm:rounded-2xl">
            <Shield className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Role & Permissions</div>
              <div className="text-xs font-bold text-slate-800 capitalize">{user.role} Access</div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={() => navigate('/my-rides')}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#071426] hover:bg-[#10243D] text-[#FF8A00] font-bold text-xs rounded-xl transition-colors border border-[#1A3353] text-center justify-center min-h-[44px]"
          >
            View Ride History
          </button>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
