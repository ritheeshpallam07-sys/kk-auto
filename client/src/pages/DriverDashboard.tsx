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
  AlertTriangle,
  Star
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
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
  typeof Notification !== 'undefined' ? Notification.permission : 'default'
);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);

  useEffect(() => {
    loadDriverData();
    const interval = setInterval(loadDriverData, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
  const checkNotificationSubscription = async () => {
    try {
      if (
        !('Notification' in window) ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window)
      ) {
        return;
      }

      if (Notification.permission !== 'granted') {
        setIsNotificationEnabled(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      setIsNotificationEnabled(!!subscription);
    } catch (error) {
      console.error('Failed to check notification subscription:', error);
      setIsNotificationEnabled(false);
    }
  };

  checkNotificationSubscription();
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

  const handleEnableNotifications = async () => {
  if (!('Notification' in window)) {
    setActionError('Notifications are not supported on this device/browser.');
    return;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    setActionError('Push notifications are not supported on this device/browser.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission !== 'granted') {
      if (permission === 'denied') {
        setActionError(
          'Notifications are blocked. Please allow notifications for Clik2Go in your browser settings.'
        );
      }
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    const vapidRes = await api.driver.getPushPublicKey();

    if (!vapidRes.success || !vapidRes.data?.publicKey) {
      throw new Error(vapidRes.error || 'Unable to get push notification key.');
    }

    const base64ToUint8Array = (base64String: string) => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const rawData = window.atob(base64);
      return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
    };

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(vapidRes.data.publicKey)
    });

    const subscriptionJson = subscription.toJSON();

    const saveRes = await api.driver.savePushSubscription({
      endpoint: subscriptionJson.endpoint || '',
      expirationTime: subscriptionJson.expirationTime ?? null,
      keys: {
        p256dh: subscriptionJson.keys?.p256dh || '',
        auth: subscriptionJson.keys?.auth || ''
      }
    });

    if (!saveRes.success) {
      throw new Error(saveRes.error || 'Unable to save push subscription.');
    }

    setIsNotificationEnabled(true);

    new Notification('Clik2Go Notifications Enabled', {
      body: 'You will now receive new customer ride requests.',
      icon: '/pwa-192x192.png'
    });
  } catch (error: any) {
    console.error('Push notification setup error:', error);
    setActionError(error.message || 'Unable to enable push notifications.');
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
  
  


const handleOpenNavigation = () => {
  if (!activeRide) return;

  const isGoingToPickup = activeRide.status === 'Driver Assigned';

  const pickupLat = activeRide.pickup_latitude;
  const pickupLng = activeRide.pickup_longitude;
  const destinationLat = activeRide.destination_latitude;
  const destinationLng = activeRide.destination_longitude;

  let origin: string | undefined;
  let destination: string;

  if (isGoingToPickup) {
    // Stage 1: Driver current location -> Customer pickup
    if (pickupLat == null || pickupLng == null) {
      setActionError('Customer pickup GPS location is missing.');
      return;
    }

    destination = `${pickupLat},${pickupLng}`;
  } else {
    // Stage 2: Customer pickup -> Customer destination
    if (
      pickupLat == null ||
      pickupLng == null ||
      destinationLat == null ||
      destinationLng == null
    ) {
      setActionError('Pickup or destination GPS location is missing.');
      return;
    }

    origin = `${pickupLat},${pickupLng}`;
    destination = `${destinationLat},${destinationLng}`;
  }

  const mapsUrl =
    'https://www.google.com/maps/dir/?api=1' +
    (origin ? `&origin=${encodeURIComponent(origin)}` : '') +
    `&destination=${encodeURIComponent(destination)}` +
    '&travelmode=driving';

  console.log('NAVIGATION STATUS:', activeRide.status);
  console.log('NAVIGATION ORIGIN:', origin ?? 'Driver current location');
  console.log('NAVIGATION DESTINATION:', destination);
  console.log('FINAL GOOGLE MAPS URL:', mapsUrl);

  window.open(mapsUrl, '_blank', 'noopener,noreferrer');
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
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };
  const driverFirstName = profile?.name ? profile.name.split(' ')[0] : 'Driver';
  const mostRecentRide = activeRide || (completedRides.length > 0 ? completedRides[0] : null);
  const todayRidesCount = earnings?.completedRidesCount ?? completedRides.length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-8">
      {/* Top Driver Console Header matching Reference Screen 3 */}
      <div className="bg-gradient-to-r from-[#071426] via-[#0B1B32] to-[#10243D] text-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl border border-[#1A3353] relative overflow-hidden">
        {/* Ambient orange glow */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#FF8A00]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 relative">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#FF8A00] to-[#E67600] text-[#071426] flex items-center justify-center font-black text-xl sm:text-2xl shadow-glow-orange flex-shrink-0">
              🛺
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#FF8A00]">Clik2Go Driver</span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-[#A9B7C9] font-mono uppercase">{profile?.auto_number}</span>
              </div>
              <h1 className="text-xl sm:text-3xl font-black text-white">
                {getGreeting()}, {driverFirstName}
              </h1>
            </div>
          </div>

          {/* Online Toggle & Notifications */}
          <div className="w-full sm:w-auto flex items-center gap-2.5 sm:gap-3 flex-wrap">
            {!isNotificationEnabled && (
              <button
                onClick={handleEnableNotifications}
                className="flex-1 sm:flex-none px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-black text-xs bg-[#FF8A00] hover:bg-[#FF9D2E] text-[#071426] shadow-glow-orange transition-all flex items-center justify-center gap-2"
              >
                <span>🔔</span>
                <span>Enable Alerts</span>
              </button>
            )}

            {isApproved ? (
              <button
                onClick={handleToggleAvailability}
                disabled={isUpdatingStatus || profile?.availability_status === 'on_ride'}
                className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 sm:gap-2.5 border ${
                  isAvailable
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 shadow-emerald-500/20'
                    : 'bg-[#10243D] hover:bg-[#1A3353] text-[#A9B7C9] border-[#28476E]'
                } disabled:opacity-50`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <Power className="w-3.5 h-3.5" />
                <span>{isAvailable ? 'Online' : 'Offline'}</span>
              </button>
            ) : (
              <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-orange-500/10 border border-orange-400/30 text-orange-300 text-xs font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FF8A00]" />
                <span>Status: {approvalStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3 Metric Cards matching Reference Screen 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 sm:mt-8 relative">
          {/* Today's Rides */}
          <div className="bg-[#10243D]/90 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-[#1A3353] shadow-md flex items-center justify-between">
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Today's Rides</span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1">{todayRidesCount}</div>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-500/15 text-[#FF8A00] flex items-center justify-center">
              <Car className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>

          {/* Earnings */}
          <div className="bg-[#10243D]/90 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-[#1A3353] shadow-md flex items-center justify-between">
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Earnings</span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1">₹{earnings?.todayEarnings ?? 0}</div>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>

          {/* Rating */}
          <div className="bg-[#10243D]/90 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-[#1A3353] shadow-md flex items-center justify-between">
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Rating</span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1 flex items-baseline gap-1">
                <span>4.9</span>
                <span className="text-amber-400 text-base">★</span>
              </div>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 fill-amber-400" />
            </div>
          </div>
        </div>

        {/* View Bookings Button & Recent Ride Quick Preview matching Screen 3 */}
        <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-[#1A3353] grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center">
          <div className="md:col-span-5">
            <button
              onClick={() => {
                document.getElementById('incoming-requests-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full py-3.5 sm:py-4 bg-[#FF8A00] hover:bg-[#FF9D2E] text-[#071426] font-black text-sm rounded-xl sm:rounded-2xl shadow-glow-orange transition-all hover:scale-102 flex items-center justify-center gap-2"
            >
              <span>View Bookings</span>
              {requests.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#071426] text-[#FF8A00] text-xs font-black">
                  {requests.length} New
                </span>
              )}
            </button>
          </div>

          {/* Recent Ride Card */}
          <div className="md:col-span-7 bg-[#071426] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-[#1A3353] flex items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF8A00] block mb-1">
                Recent Ride
              </span>
              {mostRecentRide ? (
                <div className="text-xs text-white truncate font-medium">
                  <span>{mostRecentRide.pickup_address}</span>
                  <span className="text-slate-400 mx-1.5">→</span>
                  <span>{mostRecentRide.destination_address}</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400">No rides yet today. Go online to accept rides.</div>
              )}
            </div>

            {mostRecentRide && (
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-black text-emerald-400">₹{mostRecentRide.estimated_fare}</div>
                <div className="text-[10px] text-slate-400">{mostRecentRide.status}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* APPROVAL STATUS BANNER */}
      {!isApproved && (
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-orange-50 border-2 border-orange-300 text-orange-950 shadow-sm flex items-start gap-3 sm:gap-4">
          <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF8A00] flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide">
              {approvalStatus === 'PENDING' ? 'Account Pending Verification' : `Account Status: ${approvalStatus}`}
            </h3>
            <p className="text-xs text-orange-900 leading-relaxed">
              {approvalStatus === 'PENDING'
                ? 'Your driver partner application has been submitted to the Clik2Go Admin. Vehicle registration and license documents are currently under review. You will be enabled to accept passenger rides once verified.'
                : 'Your driver account cannot accept passenger rides in its current state. Please contact the Clik2Go support team.'}
            </p>
          </div>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* DRIVER FINANCIALS & EARNINGS CARD */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-200/80 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <span>Driver Earnings & Payout Settlements</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Your split earnings from completed point-to-point auto rides (after platform commission)
            </p>
          </div>

          {profile?.payout_upi && (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 break-all">
              <CreditCard className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Payout UPI: {profile.payout_upi}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="p-3.5 sm:p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl sm:rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-emerald-800">Today's Earnings</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">₹{earnings?.todayEarnings ?? 0}</div>
          </div>

          <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-slate-500">Lifetime Earnings</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">₹{earnings?.totalEarnings ?? 0}</div>
          </div>

          <div className="p-3.5 sm:p-4 bg-orange-50/70 border border-orange-200 rounded-xl sm:rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-orange-900">Pending Settlement</span>
            <div className="text-xl sm:text-2xl font-black text-[#FF8A00] mt-1">₹{earnings?.pendingSettlement ?? 0}</div>
          </div>

          <div className="p-3.5 sm:p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl sm:rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-indigo-800">Settled Payouts</span>
            <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-1">₹{earnings?.settledAmount ?? 0}</div>
          </div>
        </div>
      </div>

      {/* ACTIVE ONGOING RIDE CONTROLLER */}
      {activeRide && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-md border-2 border-[#FF8A00] space-y-4 sm:space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase text-[#FF8A00]">
                Active Ride Assignment
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 font-mono break-all">
                {activeRide.booking_reference}
              </h2>
            </div>
            <StatusBadge status={activeRide.status} size="lg" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-3 text-xs">

              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Pickup
                  </span>
                  <div className="font-black text-slate-900 text-sm">
                    {activeRide.pickup_area_name || 'Pickup'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 break-words">
                    {activeRide.pickup_address}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Navigation className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Destination
                  </span>
                  <div className="font-black text-slate-900 text-sm">
                    {activeRide.destination_area_name || 'Destination'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 break-words">
                    {activeRide.destination_address}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-600">
                <div>
                  Passenger(s):{' '}
                  <span className="font-bold text-slate-800">
                    {activeRide.passengers}
                  </span>
                </div>
                <div>
                  Customer Fare:{' '}
                  <span className="font-black text-[#FF8A00] text-sm">
                    ₹{activeRide.estimated_fare}
                  </span>
                </div>
              </div>
            </div>

            {/* Status advancement buttons */}
            <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200/70 space-y-2.5 sm:space-y-3 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Update Ride Progression
              </span>
              
              <button
                onClick={handleOpenNavigation}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Navigation className="w-4 h-4" />
                {activeRide.status === 'Driver Assigned'
                  ? 'Navigate to Pickup'
                  : 'Navigate to Destination'}
              </button>

              {activeRide.status === 'Driver Assigned' && (
                <button
                  onClick={() => handleProgressRide('Driver Arriving')}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-sm transition-transform hover:scale-102 min-h-[44px]"
                >
                  Mark as "Driver Arriving at Pickup"
                </button>
              )}

              {activeRide.status === 'Driver Arriving' && (
                <button
                  onClick={() => handleProgressRide('Ride Started')}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-transform hover:scale-102 min-h-[44px]"
                >
                  Start Ride (Passenger Onboard)
                </button>
              )}

              {activeRide.status === 'Ride Started' && (
                <button
                  onClick={() => handleProgressRide('Ride Completed')}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition-transform hover:scale-102 min-h-[44px]"
                >
                  Complete Ride (Fare: ₹{activeRide.estimated_fare})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INCOMING RIDE REQUESTS QUEUE */}
      <div id="incoming-requests-section" className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-200/80 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Incoming Ride Requests</h2>
            <p className="text-[11px] sm:text-xs text-slate-500">Available customer ride requests across authorized routes</p>
          </div>
          <span className="px-2.5 sm:px-3 py-1 bg-[#FF8A00]/15 text-[#FF8A00] border border-[#FF8A00]/25 font-bold text-xs rounded-full whitespace-nowrap">
            {requests.length} Available
          </span>
        </div>

        {!isApproved ? (
          <div className="py-8 text-center bg-orange-50/50 rounded-2xl border border-orange-200 p-6 space-y-2">
            <div className="text-3xl">🔒</div>
            <h3 className="text-sm font-bold text-slate-800">Trip Acceptance Locked</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You must be approved by the Clik2Go Admin before accepting customer ride requests. Once approved, active requests will be actionable here.
            </p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="text-3xl">📡</div>
            <h3 className="text-sm font-bold text-slate-800">No pending ride requests</h3>
            <p className="text-xs text-slate-400">Keep your status "Online" to receive new customer bookings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 border-slate-200 hover:border-[#FF8A00] transition-all space-y-3 bg-slate-50/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-800 break-all">{req.booking_reference}</span>
                  <span className="font-black text-[#FF8A00] text-sm">₹{req.estimated_fare}</span>
                </div>

                <div className="space-y-2 text-xs text-slate-700">
                  <div>
                    <div className="font-bold text-slate-800">
                      {req.pickup_area_name || 'Pickup'} → {req.destination_area_name || 'Destination'}
                    </div>
                    <div className="mt-1 break-words">
                      <span className="text-slate-400">Pickup:</span> {req.pickup_address}
                    </div>
                  </div>

                  <div>
                    <div className="break-words">
                      <span className="text-slate-400">Drop:</span> {req.destination_address}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Passengers: {req.passengers}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70">
                  <button
                    onClick={() => handleAcceptRide(req.id)}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Accept Ride</span>
                  </button>
                  <button
                    onClick={() => handleRejectRide(req.id)}
                    className="px-3.5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors min-h-[44px] flex items-center justify-center"
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
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-200/80 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Completed Ride History</h3>
        {completedRides.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">No completed rides recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {completedRides.map((ride) => (
              <div key={ride.id} className="py-3 flex items-start sm:items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="font-mono font-bold text-slate-900">{ride.booking_reference}</span>
                  <div className="text-slate-500 text-[11px] break-words">
                    {ride.pickup_address} → {ride.destination_address}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
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
