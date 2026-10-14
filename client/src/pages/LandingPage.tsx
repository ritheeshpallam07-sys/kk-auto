import React from 'react';
import {
  ArrowRight,
  IndianRupee,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Car,
  MapPin,
  Sparkles,
  Users
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

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
      <div className="flex flex-col min-h-screen bg-[#071426]">
        <section className="flex-1 py-16 flex items-center justify-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="bg-[#10243D] rounded-3xl p-8 sm:p-12 shadow-2xl border border-[#1A3353] text-center">

              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#FF8A00] to-[#E67600] text-[#071426] flex items-center justify-center text-3xl mb-6 shadow-glow-orange">
                {isDriver ? '🛺' : '🛡️'}
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">
                {isDriver
                  ? `Welcome, ${user?.name}`
                  : 'Welcome, Admin'}
              </h1>

              <p className="text-[#A9B7C9] text-sm sm:text-base mb-8 max-w-xl mx-auto leading-relaxed">
                {isDriver
                  ? 'Manage your availability, accept incoming passenger requests, and track your daily earnings in Clik2Go.'
                  : 'Manage driver verifications, fixed routes, platform settlements, and operational bookings from your Clik2Go console.'}
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate(isDriver ? '/driver' : '/owner/dashboard')
                }
                className="px-8 py-3.5 bg-[#FF8A00] hover:bg-[#FF9D2E] text-[#071426] font-black rounded-xl shadow-glow-orange transition-all hover:scale-102"
              >
                {isDriver
                  ? 'Open Driver Dashboard'
                  : 'Open Owner Console'}
              </button>

            </div>
          </div>
        </section>
      </div>
    );
  }

  /*
   * CUSTOMER / PUBLIC HOME
   */
  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">

      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#071426] via-[#0B1B32] to-[#10243D] text-white border-b border-[#1A3353]">
        {/* Subtle orange ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#FF8A00]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 right-0 w-80 h-80 bg-[#FF8A00]/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid lg:grid-cols-12 gap-12 items-center">

            {/* Left Hero Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#10243D] border border-[#1A3353] text-[#FF8A00] text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Safe • Fast • Affordable</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight">
                Your Ride, Just a <br className="hidden sm:inline" />
                <span className="text-[#FF8A00]">Tap Away</span>
              </h1>

              <p className="text-[#A9B7C9] text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Reliable, safe, and transparent point-to-point auto rides. No meter tampering, no surge pricing, and no long street waits.
              </p>

              {/* Call to action buttons */}
              <div className="pt-2 flex flex-wrap justify-center lg:justify-start gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/book')}
                  className="inline-flex items-center gap-2.5 px-7 py-4 bg-[#FF8A00] hover:bg-[#FF9D2E] text-[#071426] font-black text-base rounded-2xl shadow-glow-orange transition-all hover:scale-103"
                >
                  <Car className="w-5 h-5" />
                  <span>Book an Auto</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {!user ? (
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="px-6 py-4 bg-[#10243D] hover:bg-[#1A3353] text-white font-bold text-base rounded-2xl border border-[#28476E] transition-all hover:scale-102"
                  >
                    Create Account
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="px-6 py-4 bg-[#10243D] hover:bg-[#1A3353] text-white font-bold text-base rounded-2xl border border-[#28476E] transition-all hover:scale-102"
                  >
                    Go to Dashboard
                  </button>
                )}
              </div>

              {/* Trust Badges matching Showcase */}
              <div className="pt-6 border-t border-[#10243D] flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs text-[#A9B7C9]">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FF8A00]" />
                  <span>Quick Booking</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FF8A00]" />
                  <span>Trusted Drivers</span>
                </div>
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-[#FF8A00]" />
                  <span>Best Prices</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#FF8A00]" />
                  <span>Live Tracking</span>
                </div>
              </div>
            </div>

            {/* Right Hero Card / Visual Preview */}
            <div className="lg:col-span-5">
              <div className="bg-[#10243D]/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-[#1A3353] shadow-2xl space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#1A3353]">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-[#FF8A00] tracking-wider">Official Fare Schedule</span>
                    <h3 className="text-lg font-black text-white">Popular Fixed Routes</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#071426] flex items-center justify-center text-xl">
                    🛺
                  </div>
                </div>

                {/* Popular routes sample */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#071426] border border-[#1A3353]">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-white">
                      <MapPin className="w-4 h-4 text-[#FF8A00]" />
                      <span>JNTUA ↔ Cross</span>
                    </div>
                    <span className="text-sm font-black text-[#FF8A00]">₹20</span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#071426] border border-[#1A3353]">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-white">
                      <MapPin className="w-4 h-4 text-[#FF8A00]" />
                      <span>JNTUA ↔ Bus Stand</span>
                    </div>
                    <span className="text-sm font-black text-[#FF8A00]">₹25</span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#071426] border border-[#1A3353]">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-white">
                      <MapPin className="w-4 h-4 text-[#FF8A00]" />
                      <span>JNTUA ↔ Marava</span>
                    </div>
                    <span className="text-sm font-black text-[#FF8A00]">₹30</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/book')}
                  className="w-full py-3.5 bg-gradient-to-r from-[#FF8A00] to-[#E67600] hover:from-[#FF9D2E] hover:to-[#FF8A00] text-[#071426] font-black text-sm rounded-xl shadow-glow-orange transition-all flex items-center justify-center gap-2"
                >
                  <span>Select Route & Book Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF8A00]">Simple 3-Step Flow</span>
            <h2 className="text-3xl md:text-4xl font-black text-[#071426] mt-1">
              How Clik2Go Works
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              Get an auto at your doorstep with straightforward steps and zero hidden charges.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">

            <div className="bg-[#F8FAFC] rounded-3xl p-8 border border-slate-200/80 hover:border-[#FF8A00]/40 transition-all text-center relative group">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[#071426] text-[#FF8A00] flex items-center justify-center font-black text-xl shadow-md group-hover:scale-105 transition-transform">
                1
              </div>
              <h3 className="font-black text-base text-[#071426] mb-2">
                Choose Your Route
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Select your pickup place and destination from verified local points.
              </p>
            </div>

            <div className="bg-[#F8FAFC] rounded-3xl p-8 border border-slate-200/80 hover:border-[#FF8A00]/40 transition-all text-center relative group">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[#FF8A00] text-[#071426] flex items-center justify-center font-black text-xl shadow-glow-orange group-hover:scale-105 transition-transform">
                2
              </div>
              <h3 className="font-black text-base text-[#071426] mb-2">
                See Instant Fare
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Check exact guaranteed route fare upfront. No haggling or unexpected surge multipliers.
              </p>
            </div>

            <div className="bg-[#F8FAFC] rounded-3xl p-8 border border-slate-200/80 hover:border-[#FF8A00]/40 transition-all text-center relative group">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[#071426] text-[#FF8A00] flex items-center justify-center font-black text-xl shadow-md group-hover:scale-105 transition-transform">
                3
              </div>
              <h3 className="font-black text-base text-[#071426] mb-2">
                Tap & Ride
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Confirm your ride. A verified auto driver arrives at your pickup spot for immediate boarding.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* WHY CLIK2GO / BENEFITS SECTION */}
      <section id="benefits" className="py-16 md:py-24 bg-[#F8FAFC] border-t border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF8A00]">Why Choose Us</span>
            <h2 className="text-3xl md:text-4xl font-black text-[#071426] mt-1">
              Why Ride with Clik2Go?
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              Modern local transit built around transparency, reliability, and passenger comfort.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* Quick Booking */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF8A00] flex items-center justify-center mb-5">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-[#071426] mb-2">
                Quick Booking
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Get an auto-rickshaw assigned in seconds without waiting on crowded street corners.
              </p>
            </div>

            {/* Trusted Drivers */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-[#071426] mb-2">
                Trusted Drivers
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                All auto drivers are locally verified with background checks and licensed vehicles.
              </p>
            </div>

            {/* Affordable Fares */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5">
                <IndianRupee className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-[#071426] mb-2">
                Affordable Fares
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Fixed and transparent pricing starting from ₹20. Pay in cash or seamless online UPI.
              </p>
            </div>

            {/* Reliable Service */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-[#071426] mb-2">
                Reliable Service
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Live status tracking, 24/7 customer support, and comfortable rides for up to 4 passengers.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="bg-gradient-to-r from-[#071426] via-[#0B1B32] to-[#10243D] py-16 md:py-20 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,138,0,0.15),transparent_60%)]" />

        <div className="relative max-w-4xl mx-auto px-4 text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10243D] text-[#FF8A00] text-xs font-bold uppercase">
            <span>Fast · Transparent · Safe</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Ready to ride? Tap Clik2Go now.
          </h2>

          <p className="text-sm md:text-base text-[#A9B7C9] max-w-xl mx-auto leading-relaxed">
            Experience modern local transit with fixed fares and verified drivers right in your city.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/book')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#FF8A00] hover:bg-[#FF9D2E] text-[#071426] font-black text-base rounded-2xl shadow-glow-orange transition-all hover:scale-103"
            >
              <span>Book an Auto</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};