import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  IndianRupee,
  Zap,
  CheckCircle2,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { api, FareEstimate } from '../api/client';

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
      <div className="flex flex-col min-h-screen">
        <section className="flex-1 bg-slate-50 py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-slate-200 text-center">

              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-3xl mb-6">
                {isDriver ? '🛺' : '🛡️'}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
                {isDriver
                  ? `Welcome, ${user?.name}`
                  : 'Welcome, Admin'}
              </h1>

              <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
                {isDriver
                  ? 'Manage your availability, ride requests, and active rides from your driver dashboard.'
                  : 'Manage drivers, routes, fares, bookings, and Kk_Auto operations from your admin dashboard.'}
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate(isDriver ? '/driver' : '/admin')
                }
                className="px-7 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors"
              >
                {isDriver
                  ? 'Open Driver Dashboard'
                  : 'Open Admin Dashboard'}
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
    <div className="flex flex-col min-h-screen">

      {/* HERO */}
      <section className="bg-amber-50 border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">

            {/* LEFT */}
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                Simple Auto Booking
              </span>

              <h1 className="mt-4 text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">
                Book your
                <span className="text-amber-500"> auto </span>
                easily.
              </h1>

              <p className="mt-4 text-slate-600 text-base md:text-lg max-w-xl leading-relaxed">
                Choose your pickup and destination, see your fare,
                and book your ride in just a few steps.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">

                <button
                  type="button"
                  onClick={() => navigate('/book')}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors"
                >
                  Book an Auto
                  <ArrowRight className="w-4 h-4" />
                </button>

                {!user && (
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl border border-slate-200 transition-colors"
                  >
                    Create Account
                  </button>
                )}

              </div>
            </div>
            </div>
        </div>
      </section>
      {/* HOW IT WORKS */}
      <section className="bg-white py-14 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
              How Kk_Auto Works
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Book your ride in three simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">

            <div className="text-center p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-extrabold text-lg">
                1
              </div>

              <h3 className="font-bold text-slate-900 mb-2">
  Choose Your Location
</h3>

<p className="text-sm text-slate-500 leading-relaxed">
  Select your pickup and destination on the map.
</p>
            </div>

            <div className="text-center p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-extrabold text-lg">
                2
              </div>

              <h3 className="font-bold text-slate-900 mb-2">
  See Your Fare
</h3>

<p className="text-sm text-slate-500 leading-relaxed">
  See the fare based on your selected locations before booking.
</p>
            </div>

            <div className="text-center p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-extrabold text-lg">
                3
              </div>

              <h3 className="font-bold text-slate-900 mb-2">
                Book Your Auto
              </h3>

              <p className="text-sm text-slate-500 leading-relaxed">
                Confirm your booking and get ready for your
                ride.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="bg-slate-50 py-14 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
              Why Ride with Kk_Auto?
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Simple booking, clear fares, reliable rides.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
                <IndianRupee className="w-5 h-5" />
              </div>

              <h3 className="font-bold text-slate-900 mb-2">
                Clear Fares
              </h3>

              <p className="text-sm text-slate-500 leading-relaxed">
                Check the fare for your selected route before
                booking.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5" />
              </div>

              <h3 className="font-bold text-slate-900 mb-2">
                Easy Booking
              </h3>

              <p className="text-sm text-slate-500 leading-relaxed">
                Select your route and book your auto in just a
                few steps.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5" />
              </div>

              <h3 className="font-bold text-slate-900 mb-2">
                Simple Experience
              </h3>

              <p className="text-sm text-slate-500 leading-relaxed">
                Manage your bookings easily from your account.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-12 md:py-14">
        <div className="max-w-4xl mx-auto px-4 text-center">

          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            Ready to ride?
          </h2>

          <p className="mt-3 text-sm md:text-base text-slate-400">
            Book your auto quickly and get on your way.
          </p>

          <button
            type="button"
            onClick={() => navigate('/book')}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors"
          >
            Book an Auto
            <ArrowRight className="w-4 h-4" />
          </button>

        </div>
      </section>

    </div>
  );
};