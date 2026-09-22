import React, { useState, useEffect } from 'react';
import { api, Booking } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { 
  Car, 
  MapPin, 
  Navigation, 
  Clock, 
  Calendar, 
  IndianRupee, 
  ArrowRight, 
  XCircle, 
  Search, 
  Filter 
} from 'lucide-react';

interface MyRidesPageProps {
  navigate: (path: string) => void;
}

export const MyRidesPage: React.FC<MyRidesPageProps> = ({ navigate }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cancellation modal state
  const [selectedBookingToCancel, setSelectedBookingToCancel] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setIsLoading(true);
    const res = await api.bookings.getMyBookings();
    if (res.success && res.data) {
      setBookings(res.data);
    }
    setIsLoading(false);
  };

  const handleConfirmCancel = async () => {
    if (!selectedBookingToCancel) return;
    setIsCancelling(true);
    const res = await api.bookings.cancel(selectedBookingToCancel.id);
    setIsCancelling(false);
    setSelectedBookingToCancel(null);

    if (res.success) {
      loadBookings();
    }
  };

  const filteredBookings = bookings.filter((b) => {
    // Tab filter
    if (filterTab === 'active') {
      if (!['Searching for Auto', 'Driver Assigned', 'Driver Arriving', 'Ride Started'].includes(b.status)) {
        return false;
      }
    } else if (filterTab === 'completed') {
      if (b.status !== 'Ride Completed') return false;
    } else if (filterTab === 'cancelled') {
      if (b.status !== 'Cancelled') return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        b.booking_reference.toLowerCase().includes(q) ||
        b.pickup_address.toLowerCase().includes(q) ||
        b.destination_address.toLowerCase().includes(q)
      );
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase mb-2">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Booking History</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            My Rides
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review all your past, active, and scheduled auto-rickshaw journeys
          </p>
        </div>

        <button
          onClick={() => navigate('/book')}
          className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-transform hover:scale-105 flex items-center gap-2 self-start sm:self-auto"
        >
          <Car className="w-4 h-4" />
          <span>Book a New Ride</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold w-full md:w-auto">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All ({bookings.length})
          </button>
          <button
            onClick={() => setFilterTab('active')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterTab === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterTab === 'completed' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilterTab('cancelled')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterTab === 'cancelled' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Cancelled
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID or location..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
          />
        </div>
      </div>

      {/* Bookings List / Cards */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading your bookings...</div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
          <div className="text-4xl">🛺</div>
          <h3 className="text-base font-bold text-slate-900">No rides found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery ? 'No bookings match your search query.' : 'You have not booked any auto rides in this category yet.'}
          </p>
          <button
            onClick={() => navigate('/book')}
            className="mt-2 px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl"
          >
            Book an Auto Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBookings.map((ride) => {
            const isEligibleForCancel = !['Ride Completed', 'Cancelled'].includes(ride.status);

            return (
              <div
                key={ride.id}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900">
                        {ride.booking_reference}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        • {new Date(ride.pickup_datetime).toLocaleDateString()}
                      </span>
                    </div>
                    <StatusBadge status={ride.status} size="sm" />
                  </div>

                  {/* Route points */}
                  <div className="mt-4 space-y-2.5 text-xs text-slate-700">
                    <div className="flex items-start gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 truncate">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Pickup</div>
                        <div className="font-semibold text-slate-800 truncate">{ride.pickup_address}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 truncate">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Destination</div>
                        <div className="font-semibold text-slate-800 truncate">{ride.destination_address}</div>
                      </div>
                    </div>
                  </div>

                  {/* Route Fare and passengers */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400">Route Type:</span>{' '}
                      <span className="font-semibold text-slate-800">Fixed Rate</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Passengers:</span>{' '}
                      <span className="font-bold text-slate-800">{ride.passengers}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Fare:</span>{' '}
                      <span className="font-black text-amber-600 text-sm">₹{ride.estimated_fare}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-50">
                  {isEligibleForCancel ? (
                    <button
                      onClick={() => setSelectedBookingToCancel(ride)}
                      className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Cancel Ride
                    </button>
                  ) : (
                    <div />
                  )}

                  <button
                    onClick={() => navigate(`/booking/${ride.id}`)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-transform hover:scale-102 flex items-center gap-1.5"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={!!selectedBookingToCancel}
        onClose={() => setSelectedBookingToCancel(null)}
        onConfirm={handleConfirmCancel}
        title="Cancel Auto Booking"
        message={`Are you sure you want to cancel booking ${selectedBookingToCancel?.booking_reference}? This action cannot be undone.`}
        confirmText="Confirm Cancellation"
        cancelText="No, Keep Booking"
        confirmVariant="danger"
        isLoading={isCancelling}
      />
    </div>
  );
};
