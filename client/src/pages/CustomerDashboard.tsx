import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, Booking } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { 
  Car, 
  Clock, 
  MapPin, 
  ArrowRight, 
  Navigation, 
  Users, 
  Sparkles, 
  ShieldCheck 
} from 'lucide-react';

interface CustomerDashboardProps {
  navigate: (path: string) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ navigate }) => {
  const { user } = useAuth();
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quick booking state directly on dashboard
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [passengers, setPassengers] = useState(1);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [bookingsRes, locsRes] = await Promise.all([
        api.bookings.getMyBookings(),
        api.bookings.getLocations()
      ]);

      if (bookingsRes.success && bookingsRes.data) {
        setRecentBookings(bookingsRes.data);
      }
      if (locsRes.success && locsRes.data) {
        setLocations(locsRes.data);
      }
      setIsLoading(false);
    }
    loadData();
  }, []);

  const activeBooking = recentBookings.find(b => 
    ['Searching for Auto', 'Driver Assigned', 'Driver Arriving', 'Ride Started'].includes(b.status)
  );

  const handleQuickBook = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/book?pickup=${encodeURIComponent(pickup)}&dest=${encodeURIComponent(destination)}&passengers=${passengers}`);
  };

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

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/book')}
            className="px-6 py-3.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-2xl shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
          >
            <Car className="w-4 h-4" />
            <span>Book an Auto</span>
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

      {/* Active Ride Banner (if any) */}
      {activeBooking && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center flex-shrink-0 text-xl font-black">
              🛺
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black uppercase text-amber-900 tracking-wider">Ride In Progress</span>
                <StatusBadge status={activeBooking.status} size="sm" />
              </div>
              <div className="text-sm font-bold text-slate-900">
                Booking Reference: {activeBooking.booking_reference}
              </div>
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

      {/* Main Grid: Prominent Booking Form + Recent History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Prominent Booking Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
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
                <span>To (Destination) *</span>
              </label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
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
                  <span>Get Fare & Book Auto</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>

          {/* Fare Guarantee Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>JNTUA ↔ Cross (₹20) • JNTUA ↔ Bus Stand (₹25) • JNTUA ↔ Marava (₹30)</span>
            </div>
            <span className="font-semibold text-amber-600">Fixed Rate</span>
          </div>
        </div>

        {/* Right: Recent Bookings & Quick History */}
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
                    <span className="text-xs font-bold text-slate-800 group-hover:text-amber-700">
                      {ride.booking_reference}
                    </span>
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
    </div>
  );
};
