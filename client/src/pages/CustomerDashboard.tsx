import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, Booking, TripBooking, getCashfreeMode } from '../api/client';
import { load } from '@cashfreepayments/cashfree-js';
import {
  Car,
  Compass,
  Clock,
  ArrowRight,
  Sparkles,
  Phone,
  CalendarDays,
  CreditCard,
  X,
  CheckCircle2,
  AlertCircle,
  Users,
  MapPin,
  Loader2
} from 'lucide-react';

interface CustomerDashboardProps {
  navigate: (path: string) => void;
}

const TRIP_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NEW:       { label: 'New Request',   color: 'bg-[#202023] text-[#A1A1AA] border border-[#303034]' },
  CONTACTED: { label: 'Contacted',     color: 'bg-blue-950/40 text-blue-400 border border-blue-800' },
  CONFIRMED: { label: 'Confirmed',     color: 'bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30' },
  COMPLETED: { label: 'Completed',     color: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800' },
  CANCELLED: { label: 'Cancelled',     color: 'bg-rose-950/40 text-rose-400 border border-rose-800' },
};

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ navigate }) => {
  const { user } = useAuth();

  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [myTripBookings, setMyTripBookings] = useState<TripBooking[]>([]);
  const [ownerContact, setOwnerContact] = useState<{ phone: string; whatsapp: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Trip form modal state
  const [showTripModal, setShowTripModal] = useState(false);
  const [showTripListModal, setShowTripListModal] = useState(false);
  const [tripForm, setTripForm] = useState({
    customerName: user?.name || '',
    phoneNumber: user?.mobile || '',
    members: 1,
    tripPlace: '',
    days: 1,
    tripDate: '',
    pickupTime: '',
  });
  const [isTripSubmitting, setIsTripSubmitting] = useState(false);
  const [tripSubmitSuccess, setTripSubmitSuccess] = useState<string | null>(null);
  const [tripSubmitError, setTripSubmitError] = useState<string | null>(null);
  const [tripPayingId, setTripPayingId] = useState<number | null>(null);
  const [tripPayError, setTripPayError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [bookingsRes, tripsRes, contactRes] = await Promise.all([
        api.bookings.getMyBookings(),
        api.tripBookings.getMy(),
        api.tripBookings.getOwnerContact()
      ]);
      if (bookingsRes.success && bookingsRes.data) setRecentBookings(bookingsRes.data);
      if (tripsRes.success && tripsRes.data) setMyTripBookings(tripsRes.data);
      if (contactRes.success && contactRes.data) setOwnerContact(contactRes.data);
      setIsLoading(false);
    }
    loadData();

    // Check if URL has tab=trips
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'trips') {
      setShowTripModal(true);
    }
  }, []);

  const activeBooking = recentBookings.find(b =>
    ['Searching for Auto', 'Driver Assigned', 'Driver Arriving', 'Ride Started'].includes(b.status)
  );

  const handleTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTripSubmitError(null);
    setTripSubmitSuccess(null);

    if (!tripForm.tripPlace.trim()) { setTripSubmitError('Please enter a destination place.'); return; }
    if (!tripForm.tripDate) { setTripSubmitError('Please select a travel date.'); return; }
    if (!tripForm.pickupTime) { setTripSubmitError('Please select a pickup time.'); return; }

    setIsTripSubmitting(true);
    const res = await api.tripBookings.create({
      customerName: tripForm.customerName || user?.name || 'Customer',
      phoneNumber: tripForm.phoneNumber || user?.mobile || '',
      members: Number(tripForm.members),
      tripPlace: tripForm.tripPlace,
      days: Number(tripForm.days),
      tripDate: tripForm.tripDate,
      pickupTime: tripForm.pickupTime,
    });
    setIsTripSubmitting(false);

    if (res.success) {
      setTripSubmitSuccess('Trip request submitted! The owner will review and contact you with fixed quote.');
      setTripForm({
        customerName: user?.name || '',
        phoneNumber: user?.mobile || '',
        members: 1,
        tripPlace: '',
        days: 1,
        tripDate: '',
        pickupTime: ''
      });
      const updatedTrips = await api.tripBookings.getMy();
      if (updatedTrips.success && updatedTrips.data) setMyTripBookings(updatedTrips.data);
    } else {
      setTripSubmitError(res.error || 'Failed to submit trip request. Please try again.');
    }
  };

  const handleTripPay = async (tripId: number) => {
    setTripPayingId(tripId);
    setTripPayError(null);
    try {
      const res = await api.tripBookings.createOrder(tripId, 'UPI');
      if (res.success && (res.data as any)?.payment_session_id) {
        const cashfree = await load({ mode: getCashfreeMode((res.data as any)?.environment) });
        if (!cashfree) throw new Error('Unable to load Cashfree Checkout.');
        await cashfree.checkout({
          paymentSessionId: (res.data as any).payment_session_id,
          redirectTarget: '_self'
        });
        return;
      }
      throw new Error((res as any).error || 'Unable to create payment order.');
    } catch (err: any) {
      setTripPayError(err?.message || 'Payment failed. Please try again.');
    } finally {
      setTripPayingId(null);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#0B0B0D] text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 safe-bottom">
      <div className="max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">

        {/* Greeting Header (Zero Clutter) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#171719] border border-[#303034] text-[11px] font-bold text-[#C6FF3D] mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C6FF3D]" />
              <span>Clik2Go Commute</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Where to, {user?.name ? user.name.split(' ')[0] : 'Rider'}?
            </h1>
            <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1">
              Select an option below to get moving
            </p>
          </div>

          {/* Quick link to view past/pending outstation trips */}
          {myTripBookings.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTripListModal(true)}
              className="px-3.5 py-2 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] text-xs font-bold text-[#A1A1AA] hover:text-white flex items-center gap-2 self-start sm:self-auto transition-colors"
            >
              <CalendarDays className="w-4 h-4 text-[#C6FF3D]" />
              <span>My Outstation Trips ({myTripBookings.length})</span>
            </button>
          )}
        </div>

        {/* Active Ride Banner (Only visible if a ride is in progress) */}
        {activeBooking && (
          <div className="bg-[#171719] border border-[#C6FF3D]/40 rounded-3xl p-4 sm:p-5 shadow-glow-lime-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#C6FF3D] text-[#0B0B0D] flex items-center justify-center font-bold text-xl flex-shrink-0 animate-pulse">
                🛺
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#C6FF3D] uppercase tracking-wider">
                    {activeBooking.status}
                  </span>
                  <span className="text-[10px] text-[#A1A1AA]">
                    • Ref: {activeBooking.booking_reference}
                  </span>
                </div>
                <p className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                  {activeBooking.pickup_address} → {activeBooking.destination_address}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/booking/${activeBooking.id}`)}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-subtle"
            >
              <span>Track Live Ride</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Two Prominent Action Cards (The Core Focus) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

          {/* 1. Book Auto Card */}
          <div
            onClick={() => navigate('/book')}
            className="group relative bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/50 rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-card active:scale-[0.99]"
          >
            {/* Top Badge & Icon */}
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 rounded-2xl bg-[#202023] group-hover:bg-[#C6FF3D]/10 border border-[#303034] group-hover:border-[#C6FF3D]/40 flex items-center justify-center text-3xl transition-transform group-hover:scale-105">
                🛺
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#202023] border border-[#303034] text-[10px] font-black uppercase tracking-wider text-[#C6FF3D]">
                <span>1–6 Passengers</span>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2 mb-6">
              <h2 className="text-2xl font-black text-white group-hover:text-[#C6FF3D] transition-colors">
                Book Auto
              </h2>
              <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                Instant city auto rides with guaranteed upfront fixed fares. Pick location on map, ride in 3–7 mins.
              </p>
            </div>

            {/* Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/book');
              }}
              className="w-full py-4 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-transform shadow-glow-lime group-hover:scale-[1.02]"
            >
              <span>Book Auto Now</span>
              <ArrowRight className="w-4 h-4 text-[#0B0B0D]" />
            </button>
          </div>

          {/* 2. Plan a Trip Card */}
          <div
            onClick={() => {
              setTripSubmitSuccess(null);
              setTripSubmitError(null);
              setShowTripModal(true);
            }}
            className="group relative bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/50 rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-card active:scale-[0.99]"
          >
            {/* Top Badge & Icon */}
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 rounded-2xl bg-[#202023] group-hover:bg-[#C6FF3D]/10 border border-[#303034] group-hover:border-[#C6FF3D]/40 flex items-center justify-center text-3xl transition-transform group-hover:scale-105">
                🚗
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#202023] border border-[#303034] text-[10px] font-black uppercase tracking-wider text-[#A1A1AA]">
                <span>Outstation & Tours</span>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2 mb-6">
              <h2 className="text-2xl font-black text-white group-hover:text-[#C6FF3D] transition-colors">
                Plan a Trip
              </h2>
              <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                Rent cars for family trips, outstation travel, temple visits, and vacation packages with verified operators.
              </p>
            </div>

            {/* Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTripSubmitSuccess(null);
                setTripSubmitError(null);
                setShowTripModal(true);
              }}
              className="w-full py-4 bg-[#202023] hover:bg-[#26262A] text-white group-hover:text-[#C6FF3D] border border-[#303034] group-hover:border-[#C6FF3D]/50 font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-transform group-hover:scale-[1.02]"
            >
              <span>Plan a Trip</span>
              <Compass className="w-4 h-4 text-[#C6FF3D]" />
            </button>
          </div>

        </div>

        {/* Minimal Footer Note */}
        <div className="text-center pt-4">
          <p className="text-[11px] text-[#A1A1AA]">
            Need help, route details, or why to choose Clik2Go? Open the <span className="text-white font-bold">Hamburger Menu</span> in the top right.
          </p>
        </div>

      </div>

      {/* ── Plan a Trip Modal (Black and Lime) ───────────────────────────── */}
      {showTripModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto safe-top safe-bottom">
          <div className="w-full max-w-lg bg-[#171719] rounded-3xl border border-[#303034] shadow-2xl p-6 sm:p-8 space-y-5 my-auto">

            <div className="flex items-center justify-between pb-3 border-b border-[#303034]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#202023] border border-[#303034] flex items-center justify-center text-lg">
                  🚗
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Plan a Trip</h3>
                  <p className="text-[11px] text-[#A1A1AA]">Request outstation car quote</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTripModal(false)}
                className="w-8 h-8 rounded-xl bg-[#202023] border border-[#303034] text-[#A1A1AA] hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tripSubmitSuccess ? (
              <div className="space-y-4 py-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#C6FF3D]/10 text-[#C6FF3D] flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-white">{tripSubmitSuccess}</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowTripModal(false);
                    setShowTripListModal(true);
                  }}
                  className="px-6 py-2.5 bg-[#C6FF3D] text-[#0B0B0D] font-black text-xs rounded-xl"
                >
                  View My Trips
                </button>
              </div>
            ) : (
              <form onSubmit={handleTripSubmit} className="space-y-4">

                {/* Destination */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] block mb-1">
                    Destination / Place Name
                  </label>
                  <input
                    type="text"
                    required
                    value={tripForm.tripPlace}
                    onChange={(e) => setTripForm({ ...tripForm, tripPlace: e.target.value })}
                    placeholder="e.g. Tirupati, Bengaluru, Chennai..."
                    className="w-full bg-[#202023] border border-[#303034] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#C6FF3D]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Members */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] block mb-1">
                      Passengers
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      required
                      value={tripForm.members}
                      onChange={(e) => setTripForm({ ...tripForm, members: Number(e.target.value) })}
                      className="w-full bg-[#202023] border border-[#303034] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C6FF3D]"
                    />
                  </div>

                  {/* Days */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] block mb-1">
                      Trip Duration (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      required
                      value={tripForm.days}
                      onChange={(e) => setTripForm({ ...tripForm, days: Number(e.target.value) })}
                      className="w-full bg-[#202023] border border-[#303034] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C6FF3D]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Travel Date */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] block mb-1">
                      Travel Date
                    </label>
                    <input
                      type="date"
                      required
                      value={tripForm.tripDate}
                      onChange={(e) => setTripForm({ ...tripForm, tripDate: e.target.value })}
                      className="w-full bg-[#202023] border border-[#303034] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C6FF3D]"
                    />
                  </div>

                  {/* Pickup Time */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] block mb-1">
                      Pickup Time
                    </label>
                    <input
                      type="time"
                      required
                      value={tripForm.pickupTime}
                      onChange={(e) => setTripForm({ ...tripForm, pickupTime: e.target.value })}
                      className="w-full bg-[#202023] border border-[#303034] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C6FF3D]"
                    />
                  </div>
                </div>

                {/* Contact phone */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] block mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={tripForm.phoneNumber}
                    onChange={(e) => setTripForm({ ...tripForm, phoneNumber: e.target.value })}
                    placeholder="10-digit mobile number"
                    className="w-full bg-[#202023] border border-[#303034] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#C6FF3D]"
                  />
                </div>

                {tripSubmitError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{tripSubmitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isTripSubmitting}
                  className="w-full py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl transition-all shadow-glow-lime disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isTripSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <span>Submit Trip Request</span>
                  )}
                </button>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ── My Trips List Modal ────────────────────────────────────────── */}
      {showTripListModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto safe-top safe-bottom">
          <div className="w-full max-w-2xl bg-[#171719] rounded-3xl border border-[#303034] shadow-2xl p-6 sm:p-8 space-y-4 my-auto max-h-[85vh] flex flex-col">

            <div className="flex items-center justify-between pb-3 border-b border-[#303034]">
              <div className="flex items-center gap-2.5">
                <CalendarDays className="w-5 h-5 text-[#C6FF3D]" />
                <h3 className="text-base font-black text-white">My Outstation Trips</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTripListModal(false)}
                className="w-8 h-8 rounded-xl bg-[#202023] border border-[#303034] text-[#A1A1AA] hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tripPayError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{tripPayError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {myTripBookings.length === 0 ? (
                <p className="text-xs text-[#A1A1AA] text-center py-8">
                  No outstation trip requests yet.
                </p>
              ) : (
                myTripBookings.map((trip) => {
                  const statusInfo = TRIP_STATUS_LABELS[trip.status] || TRIP_STATUS_LABELS.NEW;
                  return (
                    <div
                      key={trip.id}
                      className="bg-[#202023] rounded-2xl border border-[#303034] p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-[#A1A1AA]">Ref: {trip.booking_reference}</p>
                          <h4 className="text-sm font-bold text-white">{trip.trip_place}</h4>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-[#A1A1AA]">
                        <div>Date: <strong className="text-white">{trip.trip_date}</strong></div>
                        <div>Duration: <strong className="text-white">{trip.days} Days</strong></div>
                        <div>Riders: <strong className="text-white">{trip.members}</strong></div>
                      </div>

                      {trip.quoted_price && (
                        <div className="flex items-center justify-between pt-2 border-t border-[#303034]">
                          <div>
                            <span className="text-[10px] text-[#A1A1AA]">Fixed Quote: </span>
                            <span className="text-sm font-black text-[#C6FF3D]">₹{trip.quoted_price}</span>
                          </div>

                          {/* Cashfree Payment Button if Confirmed & Unpaid */}
                          {trip.status === 'CONFIRMED' && trip.payment_status !== 'PAID' && (
                            <button
                              type="button"
                              onClick={() => handleTripPay(trip.id)}
                              disabled={tripPayingId === trip.id}
                              className="px-4 py-1.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl flex items-center gap-1.5 transition-all"
                            >
                              {tripPayingId === trip.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CreditCard className="w-3.5 h-3.5" />
                              )}
                              <span>Pay Online (Cashfree)</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
