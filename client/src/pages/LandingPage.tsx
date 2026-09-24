import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  MapPin, 
  Navigation, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  Calendar, 
  Users, 
  IndianRupee, 
  Zap, 
  Star,
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, FareEstimate } from '../api/client';
interface LandingPageProps {
  navigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ navigate }) => {
  const { user, isDriver, isAdmin } = useAuth();
  const [locations, setLocations] = useState<string[]>([]);
  const [quickPickup, setQuickPickup] = useState('');
  const [quickDest, setQuickDest] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [isEstimating, setIsEstimating] = useState(false);
  const [quickEstimate, setQuickEstimate] = useState<FareEstimate | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLocs() {
      const res = await api.bookings.getLocations();
      if (res.success && res.data) {
        setLocations(res.data);
      }
    }
    loadLocs();
  }, []);

  const handleQuickEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickError(null);
    setQuickEstimate(null);

    if (!quickPickup || !quickDest) {
      setQuickError('Please select both pickup and destination locations.');
      return;
    }

    if (quickPickup === quickDest) {
      setQuickError('Pickup and destination cannot be the same location.');
      return;
    }

    setIsEstimating(true);
    const res = await api.bookings.getFareEstimate({
      fromLocation: quickPickup,
      toLocation: quickDest,
      passengers
    });
    setIsEstimating(false);

    if (res.success && res.data && res.data.available) {
      setQuickEstimate(res.data);
    } else {
      setQuickError(res.error || 'Sorry, this route is currently unavailable.');
    }
  };

  if (isDriver || isAdmin) {
    return (
      <div className="flex flex-col min-h-screen">
        <section className="flex-1 bg-gradient-to-b from-amber-50/70 via-white to-slate-50 py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-slate-100 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400 flex items-center justify-center text-3xl mb-6">
                {isDriver ? '🛺' : '🛡️'}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
                {isDriver ? `Welcome, ${user?.name}` : 'Welcome, Admin'}
              </h1>

              <p className="text-slate-600 mb-8">
                {isDriver
                  ? 'Manage your availability, customer ride requests, and active rides from your driver dashboard.'
                  : 'Manage drivers, routes, fares, bookings, and Kk_Auto operations from your admin dashboard.'}
              </p>

              <button
                onClick={() => navigate(isDriver ? '/driver' : '/admin')}
                className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105"
              >
                {isDriver ? 'Open Driver Dashboard' : 'Open Admin Dashboard'}
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }    
  return (
  <div className="flex flex-col min-h-screen">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-50/70 via-white to-slate-50 pt-8 pb-20 lg:pt-16 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Heading & CTAs */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100/80 border border-amber-300 text-amber-900 text-xs font-bold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Fixed-Route Auto-Rickshaw Hailing</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                Book your auto in <span className="text-amber-500 underline decoration-amber-300 decoration-wavy decoration-2">a few clicks</span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 font-normal leading-relaxed max-w-2xl">
                Experience hassle-free auto-rickshaw rides with verified drivers, fixed schedule pricing, instant ride requests, and advance scheduling.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => navigate('/book')}
                  className="px-8 py-4 text-base font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-2xl shadow-lg shadow-amber-400/30 transition-all hover:scale-105 flex items-center gap-2.5"
                >
                  <span>Book an Auto</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  onClick={() => navigate('/register')}
                  className="px-8 py-4 text-base font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-2xl shadow-sm transition-all hover:scale-105"
                >
                  Get Started
                </button>
              </div>

              {/* Quick Trust Badges */}
              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-slate-600 font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Fixed Route Pricing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>No Haggling Required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Verified Drivers</span>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Quick Fare Calculator */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
                <div className="absolute -top-3.5 right-6 bg-amber-500 text-slate-950 text-[11px] font-extrabold uppercase px-3 py-1 rounded-full shadow-sm">
                  Instant Fare Check
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center font-black">
                    🛺
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Check Your Fare</h3>
                    <p className="text-xs text-slate-500">Official fixed route fares directly from database</p>
                  </div>
                </div>

                <form onSubmit={handleQuickEstimate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>From (Pickup Location)</span>
                    </label>
                    <select
                      value={quickPickup}
                      onChange={(e) => {
                        setQuickPickup(e.target.value);
                        setQuickEstimate(null);
                        setQuickError(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                      required
                    >
                      <option value="">Select pickup location</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-rose-500" />
                      <span>To (Destination)</span>
                    </label>
                    <select
                      value={quickDest}
                      onChange={(e) => {
                        setQuickDest(e.target.value);
                        setQuickEstimate(null);
                        setQuickError(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                      required
                    >
                      <option value="">Select destination</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-600" />
                        <span>Passengers</span>
                      </label>
                      <select
                        value={passengers}
                        onChange={(e) => setPassengers(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                      >
                        <option value={1}>1 Passenger</option>
                        <option value={2}>2 Passengers</option>
                        <option value={3}>3 Passengers</option>
                        <option value={4}>4 Passengers (Max)</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={isEstimating}
                        className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isEstimating ? (
                          <span>Checking...</span>
                        ) : (
                          <>
                            <IndianRupee className="w-3.5 h-3.5" />
                            <span>Check Fare</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Route Error if not in database */}
                {quickError && (
                  <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                    <span>{quickError}</span>
                  </div>
                )}

                {/* Estimate Result */}
                {quickEstimate && quickEstimate.available && (
                  <div className="mt-5 p-4 rounded-2xl bg-amber-50/90 border border-amber-200 animate-in fade-in duration-200">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-xs font-bold text-amber-900 uppercase">Route Fare:</span>
                      <span className="text-2xl font-black text-slate-900">₹{quickEstimate.estimatedFare}</span>
                    </div>

                    <div className="text-xs text-slate-700 font-semibold mb-3">
                      {quickPickup} → {quickDest} ({passengers} Passenger{passengers > 1 ? 's' : ''})
                    </div>

                    <button
                      onClick={() => navigate(`/book?pickup=${encodeURIComponent(quickPickup)}&dest=${encodeURIComponent(quickDest)}&passengers=${passengers}`)}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-sm transition-transform hover:scale-102 flex items-center justify-center gap-2"
                    >
                      <span>Proceed to Book This Auto</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: HOW KK_AUTO WORKS */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-amber-600 mb-3">
              Simple 4-Step Process
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              How Kk_Auto Works
            </p>
            <p className="text-base text-slate-600 mt-3 leading-relaxed">
              We made booking an auto-rickshaw fast, transparent, and completely haggling-free.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="relative bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-amber-300 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Select your locations</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Choose your pickup point and destination from our verified city hub list (JNTUA, Cross, Bus Stand, Marava).
              </p>
            </div>

            <div className="relative bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-amber-300 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Check your fare</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Receive the instant official fixed rate. No surge pricing, no guessing, and no meter tampering.
              </p>
            </div>

            <div className="relative bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-amber-300 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Book your auto</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Choose "Ride Now" or schedule your pickup time. A verified nearby auto-rickshaw is assigned.
              </p>
            </div>

            <div className="relative bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-amber-300 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                4
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Enjoy your ride</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hop in at your pickup point and travel comfortably to your destination with reliable local auto drivers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: BENEFITS */}
      <section id="benefits" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-amber-600 mb-3">
              Why Commuters Choose Us
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Benefits of Riding with Kk_Auto
            </p>
            <p className="text-base text-slate-600 mt-3">
              Built for transparent and predictable daily auto-rickshaw commuting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Simple Booking</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct location selection allowing you to book an auto in less than 15 seconds.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                <IndianRupee className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Transparent Fares</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Fixed schedule pricing stored in the database. Exact fares guaranteed for every authorized route.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Scheduled Rides</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pre-book your morning or evening auto ride in advance with exact date and time selection.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Reliable Service</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Verified drivers with valid vehicle permits and registration numbers on every booking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold uppercase">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>Ready for your next journey?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Hop into a Kk_Auto today
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            Join daily commuters enjoying quick, affordable, and safe auto-rickshaw rides on all authorized city routes.
          </p>
          <div className="pt-2 flex justify-center gap-4">
            <button
              onClick={() => navigate('/book')}
              className="px-8 py-3.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl shadow-lg transition-transform hover:scale-105"
            >
              Book Auto Now
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-transform hover:scale-105"
            >
              Create Account
            </button>
          </div>
        </div>
      </section>
        </div>
  );
};