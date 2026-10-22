import React from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomerDashboard } from './CustomerDashboard';
import { Logo } from '../components/Logo';
import { Car, Compass, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface LandingPageProps {
  navigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ navigate }) => {
  const { user, isDriver, isAdmin } = useAuth();

  /*
   * DRIVER / ADMIN HOME
   */
  if (isDriver || isAdmin) {
    return (
      <div className="flex flex-col min-h-[calc(100dvh-4rem)] bg-[#0B0B0D] text-white justify-center items-center p-4">
        <div className="max-w-md w-full bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#202023] border border-[#303034] text-[#C6FF3D] flex items-center justify-center text-3xl">
            {isDriver ? '🛺' : '🛡️'}
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              {isDriver ? `Driver Partner: ${user?.name}` : 'Clik2Go Admin Console'}
            </h1>
            <p className="text-xs text-[#A1A1AA] mt-1">
              {isDriver
                ? 'Manage active ride dispatches, route navigation, and daily earnings.'
                : 'Manage operational drivers, fixed route fares, and financial settlements.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(isDriver ? '/driver' : '/owner/dashboard')}
            className="w-full py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black rounded-2xl transition-all shadow-glow-lime text-xs uppercase tracking-wider"
          >
            {isDriver ? 'Open Driver Dashboard' : 'Open Owner Console'}
          </button>
        </div>
      </div>
    );
  }

  /*
   * CUSTOMER HOME (ZERO CLUTTER)
   */
  return <CustomerDashboard navigate={navigate} />;
};
