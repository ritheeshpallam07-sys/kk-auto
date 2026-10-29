import React, { useState } from 'react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import {
  Menu,
  X,
  User,
  LogOut,
  Car,
  Compass,
  Clock,
  ShieldCheck,
  Phone,
  HelpCircle,
  Sparkles,
  Info,
  ChevronRight,
  ExternalLink,
  Settings,
  History,
} from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  navigate,
}) => {
  const { user, logout, isDriver, isAdmin } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'menu' | 'how' | 'why' | 'support'>('menu');

  const handleNav = (path: string) => {
    navigate(path);
    setIsDrawerOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsDrawerOpen(false);
    navigate('/login');
  };

  return (
    <>
      {/* Top Bar Header */}
      <nav className="sticky top-0 z-40 bg-[#0B0B0D]/95 backdrop-blur-md border-b border-[#303034] transition-all safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Left: Clik2Go Logo */}
            <div
              onClick={() => handleNav('/')}
              className="cursor-pointer"
            >
              <Logo size="md" showTagline={false} />
            </div>

            {/* Right: Quick actions + Hamburger Menu Button */}
            <div className="flex items-center gap-2">
              {/* Desktop quick shortcuts */}
              <div className="hidden sm:flex items-center gap-1.5 mr-2">
                {user?.role === 'driver' ? (
                  <button
                    type="button"
                    onClick={() => handleNav('/driver')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#202023] hover:bg-[#303034] text-xs font-bold text-white border border-[#303034] flex items-center gap-1.5 transition-colors"
                  >
                    <span>🛺</span>
                    <span>Driver Console</span>
                  </button>
                ) : user?.role === 'admin' ? (
                  <button
                    type="button"
                    onClick={() => handleNav('/owner/dashboard')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#202023] hover:bg-[#303034] text-xs font-bold text-white border border-[#303034] flex items-center gap-1.5 transition-colors"
                  >
                    <span>🛡️</span>
                    <span>Owner Console</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleNav('/book')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#202023] hover:bg-[#303034] text-xs font-bold text-white border border-[#303034] flex items-center gap-1.5 transition-colors"
                  >
                    <Car className="w-3.5 h-3.5 text-[#C6FF3D]" />
                    <span>Book Auto</span>
                  </button>
                )}
              </div>

              {/* Hamburger Menu Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  setActiveDrawerTab('menu');
                  setIsDrawerOpen(true);
                }}
                className="w-10 h-10 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/50 text-white flex items-center justify-center transition-all shadow-subtle active:scale-95"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5 text-[#C6FF3D]" />
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* Hamburger Slide-Over Drawer Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Slide-Over Drawer Container */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-[#0B0B0D] border-l border-[#303034] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out safe-top safe-bottom ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-[#303034] flex items-center justify-between bg-[#171719]">
          <div onClick={() => handleNav('/')} className="cursor-pointer">
            <Logo size="sm" showTagline={false} />
          </div>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="w-9 h-9 rounded-xl bg-[#202023] hover:bg-[#303034] border border-[#303034] text-[#A1A1AA] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Card if logged in */}
        {user ? (
          <div className="p-4 bg-[#171719] border-b border-[#303034] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#202023] border border-[#303034] flex items-center justify-center text-[#C6FF3D] font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{user.name}</p>
                <p className="text-[11px] text-[#A1A1AA] truncate">{user.mobile}</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30">
              {user.role}
            </span>
          </div>
        ) : (
          <div className="p-4 bg-[#171719] border-b border-[#303034] space-y-2">
            <p className="text-xs text-[#A1A1AA]">Sign in to book rides, track history, and access quick fares</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleNav('/login')}
                className="w-full py-2 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl transition-all text-center"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => handleNav('/register')}
                className="w-full py-2 bg-[#202023] hover:bg-[#303034] text-white border border-[#303034] font-bold text-xs rounded-xl transition-all text-center"
              >
                Sign Up
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Navigation Links by Role */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] px-2 mb-1">
              Menu
            </p>

            {/* DRIVER MENU */}
            {isDriver ? (
              <>
                <button
                  type="button"
                  onClick={() => handleNav('/driver')}
                  className="w-full p-3 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/40 text-left flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#202023] group-hover:bg-[#C6FF3D]/10 text-[#C6FF3D] flex items-center justify-center">
                      🛺
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Driver Dashboard</p>
                      <p className="text-[10px] text-[#A1A1AA]">Live dispatches & earnings</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:text-white" />
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('/driver?tab=history')}
                  className="w-full p-3 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/40 text-left flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#202023] group-hover:bg-[#C6FF3D]/10 text-[#C6FF3D] flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Complete Ride History</p>
                      <p className="text-[10px] text-[#A1A1AA]">Past fares & ride records</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:text-white" />
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('/driver?tab=settings')}
                  className="w-full p-3 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/40 text-left flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#202023] group-hover:bg-[#C6FF3D]/10 text-[#C6FF3D] flex items-center justify-center">
                      <Settings className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Account Settings</p>
                      <p className="text-[10px] text-[#A1A1AA]">Profile, UPI & vehicle details</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:text-white" />
                </button>
              </>
            ) : isAdmin ? (
              /* ADMIN MENU */
              <>
                <button
                  type="button"
                  onClick={() => handleNav('/owner/dashboard')}
                  className="w-full p-3 rounded-2xl bg-[#C6FF3D]/10 border border-[#C6FF3D]/40 text-left flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#C6FF3D] text-[#0B0B0D] flex items-center justify-center">
                      🛡️
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Owner Console</p>
                      <p className="text-[10px] text-[#C6FF3D]">Operations & routes</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#C6FF3D]" />
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('/profile')}
                  className="w-full p-3 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/40 text-left flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#202023] group-hover:bg-[#C6FF3D]/10 text-[#C6FF3D] flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">My Profile</p>
                      <p className="text-[10px] text-[#A1A1AA]">Admin account & settings</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:text-white" />
                </button>
              </>
            ) : (
              /* CUSTOMER / PUBLIC MENU */
              <>
                <button
                  type="button"
                  onClick={() => handleNav('/book')}
                  className="w-full p-3 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/40 text-left flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#202023] group-hover:bg-[#C6FF3D]/10 text-[#C6FF3D] flex items-center justify-center">
                      <Car className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Book Auto</p>
                      <p className="text-[10px] text-[#A1A1AA]">Point-to-point fixed pricing</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:text-white" />
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('/dashboard?tab=trips')}
                  className="w-full p-3 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/40 text-left flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#202023] group-hover:bg-[#C6FF3D]/10 text-[#C6FF3D] flex items-center justify-center">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Plan a Trip</p>
                      <p className="text-[10px] text-[#A1A1AA]">Outstation car bookings</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:text-white" />
                </button>

                {user && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleNav('/my-rides')}
                      className="w-full p-3 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/40 text-left flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#202023] group-hover:bg-[#C6FF3D]/10 text-[#C6FF3D] flex items-center justify-center">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">My Rides</p>
                          <p className="text-[10px] text-[#A1A1AA]">History & active rides</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:text-white" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNav('/profile')}
                      className="w-full p-3 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/40 text-left flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#202023] group-hover:bg-[#C6FF3D]/10 text-[#C6FF3D] flex items-center justify-center">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">My Profile</p>
                          <p className="text-[10px] text-[#A1A1AA]">Account & settings</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:text-white" />
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Informational Sections Relocated into Hamburger Drawer */}
          <div className="space-y-3 pt-2 border-t border-[#303034]">

            {/* How Clik2Go Works */}
            <div className="bg-[#171719] rounded-2xl border border-[#303034] p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Sparkles className="w-4 h-4 text-[#C6FF3D]" />
                <span>How Clik2Go Works</span>
              </div>
              <ol className="text-[11px] text-[#A1A1AA] space-y-1.5 list-decimal pl-4">
                <li><strong className="text-white">Choose route:</strong> Set pickup and destination on the map.</li>
                <li><strong className="text-white">Fixed fare:</strong> Instant upfront fare calculation with no surprises.</li>
                <li><strong className="text-white">Ride & Pay:</strong> Driver arrives in 3–7 mins. Pay via Cash or UPI.</li>
              </ol>
            </div>

            {/* Why Choose Us */}
            <div className="bg-[#171719] rounded-2xl border border-[#303034] p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-[#C6FF3D]" />
                <span>Why Choose Clik2Go</span>
              </div>
              <ul className="text-[11px] text-[#A1A1AA] space-y-1.5 list-disc pl-4">
                <li><strong className="text-white">Zero Haggling:</strong> Guaranteed fixed rates approved by admin.</li>
                <li><strong className="text-white">Verified Drivers:</strong> Local trusted drivers with valid licenses.</li>
                <li><strong className="text-white">Up to 6 Passengers:</strong> Book rides for your whole party.</li>
              </ul>
            </div>

            {/* Legal Links (Always Preserved) */}
            <div className="flex items-center justify-center gap-3 py-2 text-[11px] text-[#A1A1AA]">
              <button
                type="button"
                onClick={() => handleNav('/terms')}
                className="hover:text-[#C6FF3D] transition-colors"
              >
                Terms & Conditions
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => handleNav('/privacy')}
                className="hover:text-[#C6FF3D] transition-colors"
              >
                Privacy Policy
              </button>
            </div>

          </div>
        </div>

        {/* Drawer Footer with Sign Out */}
        {user && (
          <div className="p-4 border-t border-[#303034] bg-[#171719]">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-[#202023] hover:bg-rose-950/40 text-rose-400 border border-[#303034] hover:border-rose-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
