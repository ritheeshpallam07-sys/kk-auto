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
    if (filterTab === 'active') {
      if (!['Searching for Auto', 'Driver Assigned', 'Driver Arriving', 'Ride Started'].includes(b.status)) {
        return false;
      }
    } else if (filterTab === 'completed') {
      if (b.status !== 'Ride Completed') return false;
    } else if (filterTab === 'cancelled') {
      if (b.status !== 'Cancelled') return false;
    }

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 bg-[#0B0B0D] text-white safe-bottom">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#303034]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#171719] border border-[#303034] text-[#C6FF3D] text-xs font-bold uppercase mb-2">
            <span className="w-2 h-2 rounded-full bg-[#C6FF3D]" />
            <Clock className="w-3.5 h-3.5 text-[#C6FF3D]" />
            <span>Clik2Go Ride History</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            My Rides
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Review all your past, active, and scheduled auto-rickshaw journeys
          </p>
        </div>

        <button
          onClick={() => navigate('/book')}
          className="w-full sm:w-auto px-6 py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime transition-all active:scale-95 flex items-center justify-center gap-2 self-start sm:self-auto min-h-[44px]"
        >
          <Car className="w-4 h-4 text-[#0B0B0D]" />
          <span>Book a New Ride</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-[#171719] rounded-2xl p-3.5 sm:p-4 border border-[#303034] flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 shadow-subtle">
        <div className="flex overflow-x-auto scrollbar-none rounded-xl bg-[#202023] p-1 text-xs font-bold w-full md:w-auto border border-[#303034]">
          <button
            onClick={() => setFilterTab('all')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all whitespace-nowrap text-center ${
              filterTab === 'all' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            All ({bookings.length})
          </button>
          <button
            onClick={() => setFilterTab('active')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all whitespace-nowrap text-center ${
              filterTab === 'active' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all whitespace-nowrap text-center ${
              filterTab === 'completed' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilterTab('cancelled')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all whitespace-nowrap text-center ${
              filterTab === 'cancelled' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            Cancelled
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#A1A1AA]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID or location..."
            className="w-full pl-9 pr-4 py-2 bg-[#202023] border border-[#303034] rounded-xl text-xs focus:outline-none focus:border-[#C6FF3D] font-medium text-white placeholder-[#71717A]"
          />
        </div>
      </div>

      {/* Bookings List / Cards */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-[#A1A1AA]">Loading your bookings...</div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-[#171719] rounded-3xl p-8 sm:p-12 text-center border border-[#303034] shadow-card space-y-3">
          <div className="text-4xl">🛺</div>
          <h3 className="text-base font-bold text-white">No rides found</h3>
          <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
            {searchQuery ? 'No bookings match your search query.' : 'You have not booked any auto rides in this category yet.'}
          </p>
          <button
            onClick={() => navigate('/book')}
            className="mt-2 px-5 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime min-h-[40px]"
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
                className="bg-[#171719] rounded-3xl p-5 sm:p-6 shadow-card border border-[#303034] hover:border-[#C6FF3D]/50 transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#303034] gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-black text-xs sm:text-sm text-white break-all">
                        {ride.booking_reference}
                      </span>
                      <span className="text-[11px] text-[#A1A1AA] whitespace-nowrap">
                        • {new Date(ride.pickup_datetime).toLocaleDateString()}
                      </span>
                    </div>
                    <StatusBadge status={ride.status} size="sm" />
                  </div>

                  {/* Route points */}
                  <div className="mt-4 space-y-2.5 text-xs bg-[#202023] p-3.5 rounded-2xl border border-[#303034]">
                    <div className="flex items-start gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#C6FF3D] mt-1 flex-shrink-0 ring-4 ring-[#C6FF3D]/20" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-[#A1A1AA] uppercase font-semibold">Pickup</div>
                        <div className="font-semibold text-white break-words">{ride.pickup_address}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-2.5 h-2.5 bg-white mt-1 flex-shrink-0 ring-4 ring-white/20 rounded-xs" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-[#A1A1AA] uppercase font-semibold">Destination</div>
                        <div className="font-semibold text-white break-words">{ride.destination_address}</div>
                      </div>
                    </div>
                  </div>

                  {/* Route Fare and passengers */}
                  <div className="mt-4 pt-3 border-t border-[#303034] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[#A1A1AA]">Route:</span>{' '}
                      <span className="font-semibold text-white">Fixed Rate</span>
                    </div>
                    <div>
                      <span className="text-[#A1A1AA]">Passengers:</span>{' '}
                      <span className="font-bold text-white">{ride.passengers}</span>
                    </div>
                    <div>
                      <span className="text-[#A1A1AA]">Fare:</span>{' '}
                      <span className="font-black text-[#C6FF3D] text-sm">₹{ride.estimated_fare}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#303034]">
                  {isEligibleForCancel ? (
                    <button
                      onClick={() => setSelectedBookingToCancel(ride)}
                      className="px-3 py-1.5 text-rose-400 hover:bg-rose-950/40 text-xs font-semibold rounded-lg transition-colors min-h-[40px] flex items-center"
                    >
                      Cancel Ride
                    </button>
                  ) : (
                    <div />
                  )}

                  <button
                    onClick={() => navigate(`/booking/${ride.id}`)}
                    className="px-4 py-2 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime transition-transform active:scale-95 flex items-center gap-1.5 min-h-[40px]"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#0B0B0D]" />
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
