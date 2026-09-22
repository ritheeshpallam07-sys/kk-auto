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
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <button
        onClick={() => navigate('/dashboard')}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex items-center gap-5 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-md">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">{user.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wider">
                {user.role}
              </span>
              <span className="text-xs text-slate-400">• Verified Account</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-2xl">
            <Mail className="w-5 h-5 text-slate-400" />
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Email Address</div>
              <div className="text-xs font-bold text-slate-800">{user.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-2xl">
            <Phone className="w-5 h-5 text-slate-400" />
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Mobile Number</div>
              <div className="text-xs font-bold text-slate-800">{user.mobile}</div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-2xl">
            <Shield className="w-5 h-5 text-slate-400" />
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Role & Permissions</div>
              <div className="text-xs font-bold text-slate-800 capitalize">{user.role} Access</div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => navigate('/my-rides')}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl"
          >
            View Ride History
          </button>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
