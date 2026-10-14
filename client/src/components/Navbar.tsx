import React, { useState } from 'react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import {
  Menu,
  X,
  User,
  LogOut,
  Compass,
  Clock,
  Car,
  ChevronDown,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const handleNav = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
    setIsProfileDropdownOpen(false);
  };

  /*
   * ROLE DEFINITIONS
   * Customer: Dashboard, My Rides, Profile, Book an Auto
   * Driver: Driver Dashboard, Driver Profile
   * Admin / Owner: Admin Console
   * Driver and Admin users must NOT see customer navigation.
   */
  const isCustomer = !!user && !isDriver && !isAdmin;

  return (
    <nav className="sticky top-0 z-40 bg-[#071426]/95 backdrop-blur-md border-b border-[#10243D] shadow-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* Logo */}
          <div
            onClick={() => handleNav('/')}
            className="cursor-pointer"
          >
            <Logo size="md" showTagline={true} theme="light" />
          </div>

          {/* =========================
              DESKTOP NAVIGATION
          ========================== */}
          <div className="hidden md:flex items-center gap-1.5 lg:gap-2">

            {/* Home */}
            <button
              onClick={() => handleNav('/')}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                currentPath === '/'
                  ? 'text-[#FF8A00] bg-[#10243D]/90 shadow-2xs'
                  : 'text-[#A9B7C9] hover:text-white hover:bg-[#10243D]/50'
              }`}
            >
              Home
            </button>

            {/* How It Works */}
            <button
              onClick={() => {
                if (currentPath !== '/') {
                  handleNav('/#how-it-works');
                } else {
                  document
                    .getElementById('how-it-works')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold text-[#A9B7C9] hover:text-white hover:bg-[#10243D]/50 transition-all"
            >
              How It Works
            </button>

            {/* About */}
            <button
              onClick={() => {
                if (currentPath !== '/') {
                  handleNav('/#benefits');
                } else {
                  document
                    .getElementById('benefits')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold text-[#A9B7C9] hover:text-white hover:bg-[#10243D]/50 transition-all"
            >
              About
            </button>

            {/* =========================
                CUSTOMER NAVIGATION
            ========================== */}
            {isCustomer && (
              <>
                <button
                  onClick={() => handleNav('/dashboard')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    currentPath === '/dashboard'
                      ? 'text-[#FF8A00] bg-[#10243D]/90 shadow-2xs'
                      : 'text-[#A9B7C9] hover:text-white hover:bg-[#10243D]/50'
                  }`}
                >
                  Dashboard
                </button>

                <button
                  onClick={() => handleNav('/my-rides')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    currentPath === '/my-rides'
                      ? 'text-[#FF8A00] bg-[#10243D]/90 shadow-2xs'
                      : 'text-[#A9B7C9] hover:text-white hover:bg-[#10243D]/50'
                  }`}
                >
                  My Rides
                </button>
              </>
            )}

            {/* =========================
                DRIVER NAVIGATION
            ========================== */}
            {isDriver && (
              <button
                onClick={() => handleNav('/driver')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  currentPath === '/driver'
                    ? 'text-[#FF8A00] bg-[#10243D]'
                    : 'text-emerald-400 hover:text-emerald-300 hover:bg-[#10243D]/50'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>Driver Dashboard</span>
              </button>
            )}
          </div>

          {/* =========================
              DESKTOP RIGHT SIDE
          ========================== */}
          <div className="hidden md:flex items-center gap-3">

            {user ? (
              <div className="relative">

                {/* User Button */}
                <button
                  onClick={() =>
                    setIsProfileDropdownOpen(!isProfileDropdownOpen)
                  }
                  className="flex items-center gap-2.5 px-3.5 py-2 rounded-full border border-[#10243D] hover:border-[#1A3353] bg-[#0B1B32] hover:bg-[#10243D] transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF8A00] to-[#E67600] text-[#071426] font-extrabold flex items-center justify-center text-xs shadow-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="text-left">
                    <div className="text-xs font-bold text-white leading-tight">
                      {user.name.split(' ')[0]}
                    </div>

                    <div className="text-[10px] text-[#A9B7C9] capitalize">
                      {user.role}
                    </div>
                  </div>

                  <ChevronDown className="w-3.5 h-3.5 text-[#A9B7C9]" />
                </button>

                {/* Profile Dropdown */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#0B1B32] rounded-2xl shadow-2xl border border-[#1A3353] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">

                    {/* User Information */}
                    <div className="px-4 py-2.5 border-b border-[#10243D]">
                      <div className="text-xs font-bold text-white">
                        {user.name}
                      </div>

                      <div className="text-xs text-[#A9B7C9] truncate">
                        {user.email}
                      </div>
                    </div>

                    {/* Customer dropdown */}
                    {isCustomer && (
                      <>
                        <button
                          onClick={() => handleNav('/dashboard')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-[#A9B7C9] hover:bg-[#10243D] hover:text-[#FF8A00] flex items-center gap-2.5 transition-colors"
                        >
                          <Compass className="w-4 h-4 text-[#FF8A00]" />
                          <span>Customer Dashboard</span>
                        </button>

                        <button
                          onClick={() => handleNav('/my-rides')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-[#A9B7C9] hover:bg-[#10243D] hover:text-[#FF8A00] flex items-center gap-2.5 transition-colors"
                        >
                          <Clock className="w-4 h-4 text-[#A9B7C9]" />
                          <span>My Rides</span>
                        </button>

                        <button
                          onClick={() => handleNav('/profile')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-[#A9B7C9] hover:bg-[#10243D] hover:text-[#FF8A00] flex items-center gap-2.5 transition-colors"
                        >
                          <User className="w-4 h-4 text-[#A9B7C9]" />
                          <span>My Profile</span>
                        </button>
                      </>
                    )}

                    {/* Driver dropdown */}
                    {isDriver && (
                      <>
                        <button
                          onClick={() => handleNav('/driver')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-[#10243D] flex items-center gap-2.5 transition-colors"
                        >
                          <Car className="w-4 h-4 text-emerald-400" />
                          <span>Driver Dashboard</span>
                        </button>

                        <button
                          onClick={() => handleNav('/profile')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-[#A9B7C9] hover:bg-[#10243D] hover:text-white flex items-center gap-2.5 transition-colors"
                        >
                          <User className="w-4 h-4 text-[#A9B7C9]" />
                          <span>Driver Profile</span>
                        </button>
                      </>
                    )}

                    {/* Logout */}
                    <div className="border-t border-[#10243D] my-1" />

                    <button
                      onClick={() => {
                        logout();
                        handleNav('/login');
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/30 flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Login */}
                <button
                  onClick={() => handleNav('/login')}
                  className="px-4 py-2 text-sm font-semibold text-[#A9B7C9] hover:text-white rounded-xl hover:bg-[#10243D] transition-colors"
                >
                  Login
                </button>

                {/* Register */}
                <button
                  onClick={() => handleNav('/register')}
                  className="px-4 py-2 text-sm font-bold text-[#071426] bg-[#FF8A00] hover:bg-[#FF9D2E] rounded-xl shadow-glow-orange transition-all hover:scale-102"
                >
                  Register
                </button>
              </>
            )}

            {/* Book Auto - CUSTOMER ONLY */}
            {isCustomer && (
              <button
                onClick={() => handleNav('/book')}
                className="px-4 py-2 text-sm font-bold text-[#071426] bg-[#FF8A00] hover:bg-[#FF9D2E] rounded-xl shadow-glow-orange transition-all hover:scale-102 flex items-center gap-2"
              >
                <span>Book an Auto</span>
              </button>
            )}
          </div>

          {/* =========================
              MOBILE HEADER
          ========================== */}
          <div className="md:hidden flex items-center gap-2">

            {/* Book Auto - CUSTOMER ONLY */}
            {isCustomer && (
              <button
                onClick={() => handleNav('/book')}
                className="px-3 py-1.5 text-xs font-bold text-[#071426] bg-[#FF8A00] hover:bg-[#FF9D2E] rounded-lg shadow-sm"
              >
                Book Auto
              </button>
            )}

            <button
              onClick={() =>
                setIsMobileMenuOpen(!isMobileMenuOpen)
              }
              className="p-2 rounded-lg text-[#A9B7C9] hover:text-white hover:bg-[#10243D] transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* =========================
          MOBILE DRAWER
      ========================== */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#071426] border-b border-[#10243D] px-4 pt-2 pb-6 space-y-2 animate-in slide-in-from-top-4 duration-200">

          {/* Home */}
          <button
            onClick={() => handleNav('/')}
            className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold text-white hover:bg-[#10243D] transition-colors"
          >
            Home
          </button>

          {/* How It Works */}
          <button
            onClick={() => {
              handleNav('/#how-it-works');
              document
                .getElementById('how-it-works')
                ?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold text-[#A9B7C9] hover:text-white hover:bg-[#10243D] transition-colors"
          >
            How It Works
          </button>

          {/* About */}
          <button
            onClick={() => {
              handleNav('/#benefits');
              document
                .getElementById('benefits')
                ?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold text-[#A9B7C9] hover:text-white hover:bg-[#10243D] transition-colors"
          >
            About
          </button>

          {/* Mobile Logged-in */}
          {user ? (
            <div className="pt-2 border-t border-[#10243D] space-y-1">

              <div className="px-3 py-2 text-xs font-bold text-[#FF8A00] uppercase">
                Account: {user.name} ({user.role})
              </div>

              {isCustomer && (
                <>
                  <button
                    onClick={() => handleNav('/dashboard')}
                    className="w-full text-left px-3.5 py-2 rounded-lg text-sm font-medium text-white hover:bg-[#10243D]"
                  >
                    Customer Dashboard
                  </button>

                  <button
                    onClick={() => handleNav('/my-rides')}
                    className="w-full text-left px-3.5 py-2 rounded-lg text-sm font-medium text-white hover:bg-[#10243D]"
                  >
                    My Rides
                  </button>

                  <button
                    onClick={() => handleNav('/profile')}
                    className="w-full text-left px-3.5 py-2 rounded-lg text-sm font-medium text-white hover:bg-[#10243D]"
                  >
                    My Profile
                  </button>

                  <button
                    onClick={() => handleNav('/book')}
                    className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-bold text-[#071426] bg-[#FF8A00] hover:bg-[#FF9D2E] shadow-sm"
                  >
                    Book an Auto
                  </button>
                </>
              )}

              {isDriver && (
                <>
                  <button
                    onClick={() => handleNav('/driver')}
                    className="w-full text-left px-3.5 py-2 rounded-lg text-sm font-medium text-emerald-400 bg-emerald-950/40"
                  >
                    Driver Dashboard
                  </button>

                  <button
                    onClick={() => handleNav('/profile')}
                    className="w-full text-left px-3.5 py-2 rounded-lg text-sm font-medium text-[#A9B7C9] hover:bg-[#10243D]"
                  >
                    Driver Profile
                  </button>
                </>
              )}

              {/* Logout */}
              <button
                onClick={() => {
                  logout();
                  handleNav('/login');
                }}
                className="w-full text-left px-3.5 py-2 rounded-lg text-sm font-semibold text-rose-400 hover:bg-rose-950/30"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-[#10243D] flex flex-col gap-2">
              <button
                onClick={() => handleNav('/login')}
                className="w-full py-2.5 text-center text-sm font-semibold text-white bg-[#10243D] rounded-xl hover:bg-[#1A3353]"
              >
                Login
              </button>

              <button
                onClick={() => handleNav('/register')}
                className="w-full py-2.5 text-center text-sm font-bold text-[#071426] bg-[#FF8A00] hover:bg-[#FF9D2E] rounded-xl shadow-glow-orange"
              >
                Register
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};