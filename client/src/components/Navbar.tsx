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
  Shield,
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
   *
   * Customer:
   * - Customer Dashboard
   * - My Rides
   * - Profile
   * - Book an Auto
   *
   * Driver:
   * - Driver Dashboard
   * - Driver Profile
   *
   * Admin / Owner:
   * - Admin Console
   *
   * Driver and Admin users must NOT see customer navigation.
   */

  const isCustomer = !!user && !isDriver && !isAdmin;
  const isOwner = !!user && isAdmin;

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* Logo */}
          <div
            onClick={() => handleNav('/')}
            className="cursor-pointer"
          >
            <Logo size="md" showTagline={true} />
          </div>

          {/* =========================
              DESKTOP NAVIGATION
          ========================== */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2">

            {/* Home */}
            <button
              onClick={() => handleNav('/')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentPath === '/'
                  ? 'text-amber-600 bg-amber-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
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
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
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
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    currentPath === '/dashboard'
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Dashboard
                </button>

                <button
                  onClick={() => handleNav('/my-rides')}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    currentPath === '/my-rides'
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  currentPath === '/driver'
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>Driver Dashboard</span>
              </button>
            )}

            {/* =========================
                OWNER / ADMIN NAVIGATION
            ========================== */}
            {isOwner && (
              <button
                onClick={() => handleNav('/admin')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  currentPath === '/admin'
                    ? 'text-indigo-700 bg-indigo-50'
                    : 'text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin</span>
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
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-800 leading-tight">
                      {user.name.split(' ')[0]}
                    </div>

                    <div className="text-[10px] text-slate-500 capitalize">
                      {user.role}
                    </div>
                  </div>

                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {/* Profile Dropdown */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">

                    {/* User Information */}
                    <div className="px-4 py-2 border-b border-slate-100">
                      <div className="text-xs font-bold text-slate-900">
                        {user.name}
                      </div>

                      <div className="text-xs text-slate-500 truncate">
                        {user.email}
                      </div>
                    </div>

                    {/* =========================
                        CUSTOMER DROPDOWN
                    ========================== */}
                    {isCustomer && (
                      <>
                        <button
                          onClick={() => handleNav('/dashboard')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5"
                        >
                          <Compass className="w-4 h-4 text-slate-400" />
                          <span>Customer Dashboard</span>
                        </button>

                        <button
                          onClick={() => handleNav('/my-rides')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5"
                        >
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>My Rides</span>
                        </button>

                        <button
                          onClick={() => handleNav('/profile')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5"
                        >
                          <User className="w-4 h-4 text-slate-400" />
                          <span>My Profile</span>
                        </button>
                      </>
                    )}

                    {/* =========================
                        DRIVER DROPDOWN
                    ========================== */}
                    {isDriver && (
                      <>
                        <button
                          onClick={() => handleNav('/driver')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2.5"
                        >
                          <Car className="w-4 h-4 text-emerald-500" />
                          <span>Driver Dashboard</span>
                        </button>

                        <button
                          onClick={() => handleNav('/profile')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2.5"
                        >
                          <User className="w-4 h-4 text-emerald-500" />
                          <span>Driver Profile</span>
                        </button>
                      </>
                    )}

                    {/* =========================
                        OWNER / ADMIN DROPDOWN
                    ========================== */}
                    {isOwner && (
                      <button
                        onClick={() => handleNav('/admin')}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2.5"
                      >
                        <Shield className="w-4 h-4 text-indigo-500" />
                        <span>Admin Console</span>
                      </button>
                    )}

                    {/* Logout */}
                    <div className="border-t border-slate-100 my-1" />

                    <button
                      onClick={() => {
                        logout();
                        handleNav('/login');
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
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
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Login
                </button>

                {/* Register */}
                <button
                  onClick={() => handleNav('/register')}
                  className="px-4 py-2 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition-all hover:scale-102"
                >
                  Register
                </button>
              </>
            )}

            {/* Book Auto - CUSTOMER ONLY */}
            {isCustomer && (
              <button
                onClick={() => handleNav('/book')}
                className="px-4 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all hover:scale-102 flex items-center gap-2"
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
                className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 rounded-lg shadow-xs"
              >
                Book Auto
              </button>
            )}

            <button
              onClick={() =>
                setIsMobileMenuOpen(!isMobileMenuOpen)
              }
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-2 animate-in slide-in-from-top-4 duration-200">

          {/* Home */}
          <button
            onClick={() => handleNav('/')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-amber-50"
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
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-amber-50"
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
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-amber-50"
          >
            About
          </button>

          {/* =========================
              MOBILE LOGGED-IN MENU
          ========================== */}
          {user ? (
            <div className="pt-2 border-t border-slate-100 space-y-1">

              {/* Account */}
              <div className="px-3 py-2 text-xs font-bold text-amber-600 uppercase">
                Account: {user.name} ({user.role})
              </div>

              {/* CUSTOMER */}
              {isCustomer && (
                <>
                  <button
                    onClick={() => handleNav('/dashboard')}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Customer Dashboard
                  </button>

                  <button
                    onClick={() => handleNav('/my-rides')}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    My Rides
                  </button>

                  <button
                    onClick={() => handleNav('/profile')}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    My Profile
                  </button>

                  <button
                    onClick={() => handleNav('/book')}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-white bg-slate-900 hover:bg-slate-800"
                  >
                    Book an Auto
                  </button>
                </>
              )}

              {/* DRIVER */}
              {isDriver && (
                <>
                  <button
                    onClick={() => handleNav('/driver')}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50"
                  >
                    Driver Dashboard
                  </button>

                  <button
                    onClick={() => handleNav('/profile')}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    Driver Profile
                  </button>
                </>
              )}

              {/* OWNER / ADMIN */}
              {isOwner && (
                <button
                  onClick={() => handleNav('/admin')}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-indigo-700 bg-indigo-50"
                >
                  Admin Console
                </button>
              )}

              {/* Logout */}
              <button
                onClick={() => {
                  logout();
                  handleNav('/login');
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                Log Out
              </button>
            </div>
          ) : (
            /* =========================
               MOBILE LOGGED-OUT MENU
            ========================== */
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">

              <button
                onClick={() => handleNav('/login')}
                className="w-full py-2.5 text-center text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl"
              >
                Login
              </button>

              <button
                onClick={() => handleNav('/register')}
                className="w-full py-2.5 text-center text-sm font-bold text-slate-950 bg-amber-400 rounded-xl shadow-xs"
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