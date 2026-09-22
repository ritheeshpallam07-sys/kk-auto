import React, { useState, useEffect } from 'react';
import { api, DriverProfile, Booking, DriverEarningsSummary } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { 
  Car, 
  Power, 
  MapPin, 
  Navigation, 
  Phone, 
  CheckCircle, 
  X, 
  Users, 
  IndianRupee, 
  Clock, 
  ShieldCheck, 
  AlertCircle,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface DriverDashboardProps {
  navigate: (path: string) => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({ navigate }) => {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [earnings, setEarnings] = useState<DriverEarningsSummary | null>(null);
  const [requests, setRequests] = useState<Booking[]>([]);
  const [activeRide, setActiveRide] = useState<Booking | null>(null);
  const [completedRides, setCompletedRides] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadDriverData();
    const interval = setInterval(loadDriverData, 6000);
    return () => clearInterval(interval);
  }, []);

  const loadDriverData = async () => {
    try {
      const [profRes, reqRes, myRidesRes, earnRes] = await Promise.all([
        api.driver.getProfile(),
        api.driver.getRequests(),
        api.bookings.getMyBookings(),
        api.driver.getEarnings()
      ]);

      if (profRes.success && profRes.data) {
        setProfile(profRes.data);
      }

      if (earnRes.success && earnRes.data) {
        setEarnings(earnRes.data);
      }

      if (reqRes.success && reqRes.data) {
        setRequests(reqRes.data);
      }

      if (myRidesRes.success && myRidesRes.data) {
        const ongoing = myRidesRes.data.find(b => 
          ['Driver Assigned', 'Driver Arriving', 'Ride Started'].includes(b.status)
        );
        setActiveRide(ongoing || null);

        const finished = myRidesRes.data.filter(b => b.status === 'Ride Completed');
        setCompletedRides(finished);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!profile) return;
    const newStatus = profile.availability_status === 'available' ? 'offline' : 'available';
    setIsUpdatingStatus(true);
    const res = await api.driver.updateStatus(newStatus);
    setIsUpdatingStatus(false);

    if (res.success) {
      setProfile({ ...profile, availability_status: newStatus as any });
    }
  };

  const handleAcceptRide = async (bookingId: number) => {
    setActionError(null);
    const res = await api.driver.acceptRide(bookingId);
    if (res.success && res.data) {
      setActiveRide(res.data);
      loadDriverData();
    } else {
      setActionError(res.error || 'Failed to accept ride.');
    }
  };

  const handleRejectRide = (bookingId: number) => {
    setRequests(prev => prev.filter(r => r.id !== bookingId));
  };

  const handleProgressRide = async (nextStatus: string) => {
    if (!activeRide) return;
    setActionError(null);
    const res = await api.driver.updateRideStatus(activeRide.id, nextStatus);
    if (res.success && res.data) {
      if (nextStatus === 'Ride Completed' || nextStatus === 'Cancelled') {
        setActiveRide(null);
      } else {
        setActiveRide(res.data);
      }
      loadDriverData();
    } else {
      setActionError(res.error || 'Failed to update ride status.');
    }
  };

  if (isLoading) {
    return <div className="py-20 text-center text-xs text-slate-400">Loading driver terminal...</div>;
  }

  const isAvailable = profile?.availability_status === 'available';
  const approvalStatus = (profile?.approval_status || 'PENDING').toUpperCase();
  const isApproved = approvalStatus === 'APPROVED' || approvalStatus === 'ACTIVE';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Driver Console Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl">
            🛺
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Driver Console</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                isApproved 
                  ? (isAvailable ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400')
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
                {isApproved ? profile?.availability_status : approvalStatus}
              </span>
            </div>
            <h1 className="text-2xl font-black">{profile?.name}</h1>
            <p className="text-xs text-slate-400">
              Auto: <span className="text-slate-200 font-mono font-bold uppercase">{profile?.auto_number}</span> ({profile?.auto_model})
            </p>
          </div>
        </div>

        {/* On-Duty Toggle */}
        <div className="flex items-center gap-3">
          {isApproved ? (
            <button
              onClick={handleToggleAvailability}
              disabled={isUpdatingStatus || profile?.availability_status === 'on_ride'}
              className={`px-6 py-3.5 rounded-2xl font-bold text-xs shadow-lg transition-all flex items-center gap-2.5 ${
                isAvailable
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              } disabled:opacity-50`}
            >
              <Power className="w-4 h-4" />
              <span>{isAvailable ? 'ONLINE & ACCEPTING' : 'GO ONLINE'}</span>
            </button>
          ) : (
            <div className="px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Approval Status: {approvalStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* APPROVAL STATUS BANNER */}
      {!isApproved && (
        <div className="p-5 rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-900 shadow-sm flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-wide">
              {approvalStatus === 'PENDING' ? 'Account Pending Owner Verification' : `Account Status: ${approvalStatus}`}
            </h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              {approvalStatus === 'PENDING'
                ? 'Your driver partner application has been submitted to the Kk_Auto Owner/Admin. Vehicle registration and license documents are currently under review. You will be enabled to accept passenger rides once verified.'
                : 'Your driver account cannot accept passenger rides in its current state. Please contact the Kk_Auto operations team.'}
            </p>
          </div>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* DRIVER FINANCIALS & EARNINGS CARD */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-emerald-600" />
              <span>Driver Earnings & Payout Settlements</span>
            </h2>
            <p className="text-xs text-slate-500">
              Your split earnings from completed point-to-point auto rides (after platform commission)
            </p>
          </div>

          {profile?.payout_upi && (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Payout UPI: {profile.payout_upi}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-emerald-800">Today's Earnings</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">₹{earnings?.todayEarnings ?? 0}</div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-slate-500">Lifetime Earnings</span>
            <div className="text-2xl font-black text-slate-900 mt-1">₹{earnings?.totalEarnings ?? 0}</div>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-amber-800">Pending Settlement</span>
            <div className="text-2xl font-black text-amber-600 mt-1">₹{earnings?.pendingSettlement ?? 0}</div>
          </div>

          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-indigo-800">Settled Payouts</span>
            <div className="text-2xl font-black text-indigo-700 mt-1">₹{earnings?.settledAmount ?? 0}</div>
          </div>
        </div>
      </div>

      {/* ACTIVE ONGOING RIDE CONTROLLER */}
      {activeRide && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border-2 border-amber-400 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase text-amber-600">Active Ride Assignment</span>
              <h2 className="text-xl font-black text-slate-900 font-mono">
                {activeRide.booking_reference}
              </h2>
            </div>
            <StatusBadge status={activeRide.status} size="lg" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Pickup</span>
                  <div className="font-bold text-slate-800 text-sm">{activeRide.pickup_address}</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Navigation className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Destination</span>
                  <div className="font-bold text-slate-800 text-sm">{activeRide.destination_address}</div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-6 text-xs text-slate-600">
                <div>Passenger(s): <span className="font-bold text-slate-800">{activeRide.passengers}</span></div>
                <div>Customer Fare: <span className="font-black text-amber-600 text-sm">₹{activeRide.estimated_fare}</span></div>
              </div>
            </div>

            {/* Status advancement buttons */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/70 space-y-3 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase text-slate-500">Update Ride Progression</span>
              
              {activeRide.status === 'Driver Assigned' && (
                <button
                  onClick={() => handleProgressRide('Driver Arriving')}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-sm transition-transform hover:scale-102"
                >
                  Mark as "Driver Arriving at Pickup"
                </button>
              )}

              {activeRide.status === 'Driver Arriving' && (
                <button
                  onClick={() => handleProgressRide('Ride Started')}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-transform hover:scale-102"
                >
                  Start Ride (Passenger Onboard)
                </button>
              )}

              {activeRide.status === 'Ride Started' && (
                <button
                  onClick={() => handleProgressRide('Ride Completed')}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition-transform hover:scale-102"
                >
                  Complete Ride (Fare: ₹{activeRide.estimated_fare})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INCOMING RIDE REQUESTS QUEUE */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Incoming Ride Requests</h2>
            <p className="text-xs text-slate-500">Available customer ride requests across authorized routes</p>
          </div>
          <span className="px-3 py-1 bg-amber-100 text-amber-900 font-bold text-xs rounded-full">
            {requests.length} Available
          </span>
        </div>

        {!isApproved ? (
          <div className="py-8 text-center bg-amber-50/50 rounded-2xl border border-amber-200 p-6 space-y-2">
            <div className="text-3xl">🔒</div>
            <h3 className="text-sm font-bold text-slate-800">Trip Acceptance Locked</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You must be approved by the Kk_Auto Admin before accepting customer ride requests. Once approved, active requests will be actionable here.
            </p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="text-3xl">📡</div>
            <h3 className="text-sm font-bold text-slate-800">No pending ride requests</h3>
            <p className="text-xs text-slate-400">Keep your status "Online" to receive new customer bookings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-5 rounded-2xl border-2 border-slate-200 hover:border-amber-400 transition-all space-y-3 bg-slate-50/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-800">{req.booking_reference}</span>
                  <span className="font-black text-amber-600 text-sm">₹{req.estimated_fare}</span>
                </div>

                <div className="space-y-1 text-xs text-slate-700">
                  <div className="truncate"><span className="text-slate-400">From:</span> {req.pickup_address}</div>
                  <div className="truncate"><span className="text-slate-400">To:</span> {req.destination_address}</div>
                  <div className="text-[11px] text-slate-500">
                    Passengers: {req.passengers} • Fixed Route
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70">
                  <button
                    onClick={() => handleAcceptRide(req.id)}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Accept Ride</span>
                  </button>
                  <button
                    onClick={() => handleRejectRide(req.id)}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COMPLETED RIDE HISTORY */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Completed Ride History</h3>
        {completedRides.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">No completed rides recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {completedRides.map((ride) => (
              <div key={ride.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-bold text-slate-900">{ride.booking_reference}</span>
                  <div className="text-slate-500 text-[11px]">
                    {ride.pickup_address} → {ride.destination_address}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-slate-900">₹{ride.estimated_fare}</div>
                  <span className="text-[10px] text-emerald-600 font-bold">Completed</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
