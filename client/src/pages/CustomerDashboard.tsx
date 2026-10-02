import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, Booking, FareEstimate, TripBooking } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { load } from '@cashfreepayments/cashfree-js';
import {
  Car,
  Clock,
  MapPin,
  ArrowRight,
  Navigation,
  Users,
  Sparkles,
  ShieldCheck,
  Phone,
  MessageCircle,
  X,
  CalendarDays,
  CreditCard
} from 'lucide-react';

interface CustomerDashboardProps {
  navigate: (path: string) => void;
}

const TRIP_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NEW:       { label: 'New',       color: 'bg-slate-100 text-slate-700' },
  CONTACTED: { label: 'Contacted', color: 'bg-blue-100 text-blue-800' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-800' },
  COMPLETED: { label: 'Completed', color: 'bg-teal-100 text-teal-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-rose-100 text-rose-800' },
};

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ navigate }) => {
  const { user } = useAuth();

  // ── Auto booking state ──────────────────────────────────────────────────────
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<any | null>(null);

  // ── Trip booking state ──────────────────────────────────────────────────────
  const [showTripForm, setShowTripForm] = useState(false);
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

  const [myTripBookings, setMyTripBookings] = useState<TripBooking[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [ownerContact, setOwnerContact] = useState<{ phone: string; whatsapp: string } | null>(null);
  const [tripPayingId, setTripPayingId] = useState<number | null>(null);
  const [tripPayError, setTripPayError] = useState<string | null>(null);

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [bookingsRes, locsRes] = await Promise.all([
        api.bookings.getMyBookings(),
        api.bookings.getLocations()
      ]);
      if (bookingsRes.success && bookingsRes.data) setRecentBookings(bookingsRes.data);
      if (locsRes.success && locsRes.data) setLocations(locsRes.data);
      setIsLoading(false);
    }
    loadData();
    loadTripData();
  }, []);

  const loadTripData = async () => {
    setIsLoadingTrips(true);
    const [tripsRes, contactRes] = await Promise.all([
      api.tripBookings.getMy(),
      api.tripBookings.getOwnerContact()
    ]);
    if (tripsRes.success && tripsRes.data) setMyTripBookings(tripsRes.data);
    if (contactRes.success && contactRes.data) setOwnerContact(contactRes.data);
    setIsLoadingTrips(false);
  };

  // ── Auto booking helpers ────────────────────────────────────────────────────
  const activeBooking = recentBookings.find(b =>
    ['Searching for Auto', 'Driver Assigned', 'Driver Arriving', 'Ride Started'].includes(b.status)
  );

  const handleQuickBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    setFareEstimate(null);

    if (!pickup) { setBookingError('Please select a pickup location.'); return; }
    if (!destination) { setBookingError('Please select a destination.'); return; }
    if (pickup === destination) { setBookingError('Pickup and destination cannot be the same.'); return; }

    setIsCalculating(true);
    const res = await api.bookings.getFareEstimate({ fromLocation: pickup, toLocation: destination, passengers });
    setIsCalculating(false);

    if (res.success && res.data && res.data.available) {
      setFareEstimate(res.data);
    } else {
      setBookingError(res.error || 'Sorry, this route is currently unavailable.');
    }
  };

  const handleBookAuto = async () => {
    if (!user) { navigate('/login'); return; }
    if (!fareEstimate?.available) return;

    setBookingError(null);
    setIsBooking(true);
    const res = await api.bookings.create({
      pickupAddress: pickup,
      destinationAddress: destination,
      pickupDateTime: new Date().toISOString(),
      passengers
    });
    setIsBooking(false);

    if (res.success && res.data) {
      setSuccessBooking(res.data);
    } else {
      setBookingError(res.error || 'Failed to book auto.');
    }
  };

  // ── Trip booking helpers ────────────────────────────────────────────────────
  const handleTripFormChange = (field: string, value: string | number) => {
    setTripForm(prev => ({ ...prev, [field]: value }));
  };

  const handleTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTripSubmitError(null);
    setTripSubmitSuccess(null);

    if (!tripForm.tripPlace.trim()) { setTripSubmitError('Please enter a trip place.'); return; }
    if (!tripForm.tripDate) { setTripSubmitError('Please select a trip date.'); return; }
    if (!tripForm.pickupTime) { setTripSubmitError('Please select a pickup time.'); return; }

    setIsTripSubmitting(true);
    const res = await api.tripBookings.create({
      customerName: tripForm.customerName,
      phoneNumber: tripForm.phoneNumber,
      members: Number(tripForm.members),
      tripPlace: tripForm.tripPlace,
      days: Number(tripForm.days),
      tripDate: tripForm.tripDate,
      pickupTime: tripForm.pickupTime,
    });
    setIsTripSubmitting(false);

    if (res.success) {
      setTripSubmitSuccess('Trip request submitted! The owner will contact you after confirming.');
      setShowTripForm(false);
      setTripForm({ customerName: user?.name || '', phoneNumber: user?.mobile || '', members: 1, tripPlace: '', days: 1, tripDate: '', pickupTime: '' });
      loadTripData();
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
        const cashfree = await load({ mode: 'sandbox' });
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

  const buildWhatsAppLink = (trip: TripBooking) => {
    const num = ownerContact?.whatsapp || ownerContact?.phone || '';
    const msg = encodeURIComponent(
      `Hi, I want to discuss my car/trip booking ${trip.booking_reference} to ${trip.trip_place} on ${trip.trip_date}.`
    );
    return `https://wa.me/91${num}?text=${msg}`;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Kk_Auto Customer Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Namaste, {user?.name.split(' ')[0]}! 👋
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
            Where would you like to travel today? Transparent fixed route pricing, clean three-wheelers, and verified drivers are ready for your commute.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => document.getElementById('dashboard-booking-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-2xl shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
          >
            <Car className="w-4 h-4" />
            <span>Book an Auto</span>
          </button>
          <button
            onClick={() => setShowTripForm(true)}
            className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
          >
            <span>🚗</span>
            <span>Book a Car / Trip</span>
          </button>
          <button
            onClick={() => navigate('/my-rides')}
            className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-2xl border border-slate-700 transition-colors flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            <span>My Rides</span>
          </button>
        </div>
      </div>

      {/* Trip submit success toast */}
      {tripSubmitSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between">
          <span>✅ {tripSubmitSuccess}</span>
          <button onClick={() => setTripSubmitSuccess(null)} className="text-emerald-600 hover:text-emerald-800"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Trip pay error toast */}
      {tripPayError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-center justify-between">
          <span>⚠️ {tripPayError}</span>
          <button onClick={() => setTripPayError(null)} className="text-rose-600 hover:text-rose-800"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Active Ride Banner (if any) */}
      {activeBooking && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center flex-shrink-0 text-xl font-black">🛺</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black uppercase text-amber-900 tracking-wider">Ride In Progress</span>
                <StatusBadge status={activeBooking.status} size="sm" />
              </div>
              <div className="text-sm font-bold text-slate-900">Booking Reference: {activeBooking.booking_reference}</div>
              <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                <span>{activeBooking.pickup_address}</span>
                <span>→</span>
                <span>{activeBooking.destination_address}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate(`/booking/${activeBooking.id}`)}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-transform hover:scale-105 flex items-center gap-2 self-stretch sm:self-auto justify-center"
          >
            <span>Track Live Status</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Auto Booking Form + Recent History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left: Auto Booking Form */}
        <div id="dashboard-booking-form" className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Book an Auto</h2>
              <p className="text-xs text-slate-500">Fast doorstep pickup with official fixed-route fare schedule</p>
            </div>
            <span className="text-2xl">🛺</span>
          </div>

          <form onSubmit={handleQuickBook} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>From (Pickup Location) *</span>
              </label>
              <select
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                required
              >
                <option value="">Select pickup location</option>
                {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-rose-500" />
                <span>To (Destination) *</span>
              </label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                required
              >
                <option value="">Select destination</option>
                {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-600" />
                  <span>Number of Passengers</span>
                </label>
                <select
                  value={passengers}
                  onChange={(e) => setPassengers(Number(e.target.value))}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                  className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-xl shadow-md transition-all hover:scale-102 flex items-center justify-center gap-2"
                >
                  <span>{isCalculating ? 'Checking Fare...' : 'Get Fare'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>

          {bookingError && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {bookingError}
            </div>
          )}

          {fareEstimate && fareEstimate.available && (
            <div className="mt-5 p-5 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Estimated Fare</p>
                  <p className="text-3xl font-black text-slate-900">₹{fareEstimate.estimatedFare}</p>
                </div>
                <button
                  type="button"
                  onClick={handleBookAuto}
                  disabled={isBooking}
                  className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md disabled:opacity-50"
                >
                  {isBooking ? 'Booking...' : 'Book Auto'}
                </button>
              </div>
              <p className="text-xs text-slate-600">{pickup} → {destination}</p>
            </div>
          )}

          {successBooking && (
            <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
              ✅ Auto booked! Ref: <span className="font-mono font-black">{successBooking.booking_reference}</span>
            </div>
          )}

          {/* Fare Guarantee Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>JNTUA ↔ Cross (₹20) • JNTUA ↔ Bus Stand (₹25) • JNTUA ↔ Marava (₹30)</span>
            </div>
            <span className="font-semibold text-amber-600">Fixed Rate</span>
          </div>
        </div>

        {/* Right: Recent Rides */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Recent Rides</span>
            </h3>
            <button
              onClick={() => navigate('/my-rides')}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 underline"
            >
              View All
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading your rides...</div>
          ) : recentBookings.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="text-3xl">🛺</div>
              <p className="text-xs font-semibold text-slate-700">No rides booked yet</p>
              <p className="text-[11px] text-slate-400">Your upcoming and completed rides will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBookings.slice(0, 4).map((ride) => (
                <div
                  key={ride.id}
                  onClick={() => navigate(`/booking/${ride.id}`)}
                  className="p-3.5 rounded-2xl border border-slate-100 hover:border-amber-300 hover:bg-amber-50/30 transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-amber-700">{ride.booking_reference}</span>
                    <StatusBadge status={ride.status} size="sm" />
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="truncate">{ride.pickup_address}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                      <span className="truncate">{ride.destination_address}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-50">
                    <span>{new Date(ride.pickup_datetime).toLocaleDateString()}</span>
                    <span className="font-bold text-slate-800">₹{ride.estimated_fare}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── My Trip Bookings Section ─────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🚗</span>
              <span>My Car / Trip Bookings</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Track your car trip requests and pay once the owner confirms</p>
          </div>
          <button
            onClick={() => setShowTripForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-transform hover:scale-105 flex items-center gap-1.5"
          >
            <span>+ New Trip</span>
          </button>
        </div>

        {isLoadingTrips ? (
          <div className="py-10 text-center text-xs text-slate-400">Loading trip bookings...</div>
        ) : myTripBookings.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <div className="text-4xl">🚗</div>
            <p className="text-sm font-semibold text-slate-700">No trip bookings yet</p>
            <p className="text-xs text-slate-400">Click "Book a Car / Trip" to plan your next journey</p>
            <button
              onClick={() => setShowTripForm(true)}
              className="mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-transform hover:scale-105"
            >
              🚗 Book a Car / Plan a Trip
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {myTripBookings.map((trip) => {
              const statusMeta = TRIP_STATUS_LABELS[trip.status] || { label: trip.status, color: 'bg-slate-100 text-slate-700' };
              const canPay = trip.status === 'CONFIRMED' && trip.payment_status === 'PENDING' && trip.quoted_price;

              return (
                <div key={trip.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-black text-slate-700">{trip.booking_reference}</span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">{trip.trip_place}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${statusMeta.color}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{trip.trip_date} at {trip.pickup_time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{trip.members} member(s) · {trip.days} day(s)</span>
                    </div>
                    {trip.quoted_price && (
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Quoted Price: ₹{trip.quoted_price}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Payment:</span>
                      <span className={`font-bold ${trip.payment_status === 'PAID' ? 'text-emerald-700' : trip.payment_status === 'FAILED' ? 'text-rose-700' : 'text-amber-700'}`}>
                        {trip.payment_status || 'PENDING'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                    {canPay && (
                      <button
                        onClick={() => handleTripPay(trip.id)}
                        disabled={tripPayingId === trip.id}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-transform hover:scale-105 disabled:opacity-50 flex items-center gap-1"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>{tripPayingId === trip.id ? 'Processing...' : `Pay ₹${trip.quoted_price}`}</span>
                      </button>
                    )}
                    {ownerContact?.phone && (
                      <a
                        href={`tel:${ownerContact.phone}`}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>
                    )}
                    {ownerContact?.whatsapp && (
                      <a
                        href={buildWhatsAppLink(trip)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 font-bold text-xs rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Trip Booking Modal ───────────────────────────────────────────────── */}
      {showTripForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚗</span>
                <div>
                  <h3 className="text-white font-extrabold text-base">Book a Car / Plan a Trip</h3>
                  <p className="text-blue-200 text-xs">Owner will confirm and contact you</p>
                </div>
              </div>
              <button onClick={() => setShowTripForm(false)} className="text-blue-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleTripSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              {tripSubmitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{tripSubmitError}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Customer Name *</label>
                  <input
                    type="text"
                    value={tripForm.customerName}
                    onChange={(e) => handleTripFormChange('customerName', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={tripForm.phoneNumber}
                    onChange={(e) => handleTripFormChange('phoneNumber', e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Trip Place / Destination *</label>
                <input
                  type="text"
                  value={tripForm.tripPlace}
                  onChange={(e) => handleTripFormChange('tripPlace', e.target.value)}
                  placeholder="e.g. Tirupati, Bangalore, Hyderabad..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Number of Members *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={tripForm.members}
                    onChange={(e) => handleTripFormChange('members', Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Number of Days *</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={tripForm.days}
                    onChange={(e) => handleTripFormChange('days', Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Trip Date *</label>
                  <input
                    type="date"
                    value={tripForm.tripDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleTripFormChange('tripDate', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pickup Time *</label>
                  <input
                    type="time"
                    value={tripForm.pickupTime}
                    onChange={(e) => handleTripFormChange('pickupTime', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isTripSubmitting}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-transform hover:scale-102 disabled:opacity-50"
                >
                  {isTripSubmitting ? 'Submitting...' : '🚗 Book Trip'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTripForm(false)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
