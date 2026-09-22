import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, FareEstimate } from '../api/client';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Calendar, 
  Users, 
  IndianRupee, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Car 
} from 'lucide-react';

interface BookingFormPageProps {
  navigate: (path: string) => void;
}

export const BookingFormPage: React.FC<BookingFormPageProps> = ({ navigate }) => {
  const { user } = useAuth();

  // Location choices loaded directly from database
  const [locations, setLocations] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  // Parse initial query params if present
  const params = new URLSearchParams(window.location.search);
  const initialPickup = params.get('pickup') || '';
  const initialDest = params.get('dest') || '';
  const initialPassengers = Number(params.get('passengers')) || 1;

  // Form states
  const [fromLocation, setFromLocation] = useState(initialPickup);
  const [toLocation, setToLocation] = useState(initialDest);

  // Time options: 'now' vs 'schedule'
  const [timeMode, setTimeMode] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return now.toTimeString().slice(0, 5);
  });

  const [passengers, setPassengers] = useState<number>(initialPassengers);

  // Estimates & Status
  const [isCalculating, setIsCalculating] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<any | null>(null);

  useEffect(() => {
    async function loadLocations() {
      setIsLoadingLocations(true);
      const res = await api.bookings.getLocations();
      if (res.success && res.data) {
        setLocations(res.data);
      }
      setIsLoadingLocations(false);
    }
    loadLocations();
  }, []);

  // Handle Get Fare button click
  const handleGetFare = async (e: React.FormEvent) => {
    e.preventDefault();
    setRouteError(null);
    setFareEstimate(null);

    if (!fromLocation) {
      setRouteError('Please select a pickup location.');
      return;
    }
    if (!toLocation) {
      setRouteError('Please select a destination.');
      return;
    }
    if (fromLocation === toLocation) {
      setRouteError('Pickup and destination cannot be the same location.');
      return;
    }

    if (timeMode === 'schedule') {
      const selectedDatetime = new Date(`${scheduledDate}T${scheduledTime}`);
      const now = new Date();
      if (selectedDatetime.getTime() < now.getTime()) {
        setRouteError('Scheduled pickup time cannot be in the past. Please choose a future time.');
        return;
      }
    }

    setIsCalculating(true);
    const res = await api.bookings.getFareEstimate({
      fromLocation,
      toLocation,
      passengers
    });
    setIsCalculating(false);

    if (res.success && res.data && res.data.available) {
      setFareEstimate(res.data);
    } else {
      setRouteError(res.error || 'Sorry, this route is currently unavailable.');
    }
  };

  // Handle Book Auto
  const handleBookAuto = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!fareEstimate || !fareEstimate.available) {
      setRouteError('Please check fare first before booking.');
      return;
    }

    setRouteError(null);
    setIsBooking(true);

    let pickupDatetimeISO: string;
    if (timeMode === 'now') {
      pickupDatetimeISO = new Date().toISOString();
    } else {
      const scheduledDt = new Date(`${scheduledDate}T${scheduledTime}`);
      if (scheduledDt.getTime() < Date.now()) {
        setRouteError('Cannot select a pickup time in the past.');
        setIsBooking(false);
        return;
      }
      pickupDatetimeISO = scheduledDt.toISOString();
    }

    const res = await api.bookings.create({
      pickupAddress: fromLocation,
      destinationAddress: toLocation,
      pickupDateTime: pickupDatetimeISO,
      passengers
    });

    setIsBooking(false);

    if (res.success && res.data) {
      setSuccessBooking(res.data);
    } else {
      setRouteError(res.error || 'Failed to book auto.');
    }
  };

  // Render Confirmation Screen when booking succeeds
  if (successBooking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl animate-bounce">
            🛺
          </div>

          <div>
            <span className="inline-block px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold uppercase mb-2">
              Confirmation
            </span>
            <h2 className="text-3xl font-black text-slate-900">
              Auto Booked Successfully!
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Your request has been broadcasted to nearby verified drivers.
            </p>
          </div>

          {/* Booking summary card */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 text-left space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="font-bold text-slate-500 uppercase">Booking ID:</span>
              <span className="font-black text-slate-900 text-sm tracking-wider font-mono">
                {successBooking.booking_reference}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Customer:</span>
              <span className="font-bold text-slate-800">{user?.name}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Pickup Location:</span>
              <span className="font-bold text-slate-800">{successBooking.pickup_address}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Destination:</span>
              <span className="font-bold text-slate-800">{successBooking.destination_address}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Pickup Date & Time:</span>
              <span className="font-bold text-slate-800">
                {new Date(successBooking.pickup_datetime).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Passenger Count:</span>
              <span className="font-bold text-slate-800">{successBooking.passengers} Passenger(s)</span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-sm">
              <span className="font-bold text-slate-700">Estimated Fare:</span>
              <span className="font-black text-amber-600 text-base">₹{successBooking.estimated_fare}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Booking Status:</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]">
                {successBooking.status}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => navigate(`/booking/${successBooking.id}`)}
              className="flex-1 py-3.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-xl shadow-md transition-transform hover:scale-102 flex items-center justify-center gap-2"
            >
              <span>View My Booking</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/my-rides')}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-xl transition-colors"
            >
              All Rides
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase mb-2">
          <Car className="w-3.5 h-3.5 text-amber-600" />
          <span>Fixed-Route Auto Booking</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Book an Auto-Rickshaw
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Select your fixed pickup and drop location to receive official fare
        </p>
      </div>

      {/* Main Booking Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/80 space-y-6">
        <form onSubmit={handleGetFare} className="space-y-6">
          
          {/* FROM Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>From (Pickup Location) *</span>
            </label>
            <select
              value={fromLocation}
              onChange={(e) => {
                setFromLocation(e.target.value);
                setFareEstimate(null);
                setRouteError(null);
              }}
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
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

          {/* TO Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-rose-500" />
              <span>To (Destination) *</span>
            </label>
            <select
              value={toLocation}
              onChange={(e) => {
                setToLocation(e.target.value);
                setFareEstimate(null);
                setRouteError(null);
              }}
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
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

          {/* PICKUP TIME (Ride Now vs Schedule Ride) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Pickup Option</span>
            </label>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                onClick={() => setTimeMode('now')}
                className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  timeMode === 'now'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ride Now</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeMode('schedule')}
                className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  timeMode === 'schedule'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule Ride</span>
              </button>
            </div>

            {/* Schedule Date/Time */}
            {timeMode === 'schedule' && (
              <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 grid grid-cols-2 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-semibold bg-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-semibold bg-white focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* NUMBER OF PASSENGERS */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Number of Passengers</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Max 4 for auto</span>
            </label>

            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPassengers(num)}
                  className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                    passengers === num
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {num} {num === 1 ? 'Person' : 'People'}
                </button>
              ))}
            </div>
          </div>

          {/* GET FARE BUTTON */}
          <button
            type="submit"
            disabled={isCalculating || isLoadingLocations}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isCalculating ? (
              <span>Checking Route Database...</span>
            ) : (
              <>
                <IndianRupee className="w-4 h-4 text-amber-400" />
                <span>GET FARE</span>
              </>
            )}
          </button>
        </form>

        {/* Unavailable Route Error Notice */}
        {routeError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-3 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span>{routeError}</span>
          </div>
        )}

        {/* Active Route Fare Result & Book Auto CTA */}
        {fareEstimate && fareEstimate.available && (
          <div className="p-6 bg-amber-50/90 rounded-2xl border-2 border-amber-400/80 space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-amber-200/80">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-800">Confirmed Route Fare</span>
                <div className="text-3xl font-black text-slate-900">
                  ₹{fareEstimate.estimatedFare}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-800">
                  {fromLocation} → {toLocation}
                </span>
                <div className="text-[11px] text-slate-500">
                  {passengers} Passenger(s) • Fixed Rate
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              This rate is verified directly against the official Kk_Auto route schedule.
            </p>

            <button
              type="button"
              onClick={handleBookAuto}
              disabled={isBooking}
              className="w-full py-4 bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-base rounded-2xl shadow-lg shadow-amber-400/30 transition-all hover:scale-102 flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              {isBooking ? (
                <span>Dispatching Auto Request...</span>
              ) : (
                <>
                  <span>Book Auto</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Authorized Routes Notice */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Database-Verified Routes: JNTUA ↔ Cross (₹20) • JNTUA ↔ Bus Stand (₹25) • JNTUA ↔ Marava (₹30)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
