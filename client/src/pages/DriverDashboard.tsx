import React, { useState, useEffect } from 'react';
import { api, DriverProfile, Booking, DriverEarningsSummary } from '../api/client';
import { useAuth } from '../context/AuthContext';
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
  Star,
  User,
  Edit3,
  QrCode
} from 'lucide-react';
import QRCode from 'qrcode';

interface DriverRideQrProps {
  ride: Booking;
  payoutUpi: string;
  driverName: string;
}

const DriverPaymentQr: React.FC<DriverRideQrProps> = ({ ride, payoutUpi, driverName }) => {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    const rawUpi = (ride.driver_payout_upi || payoutUpi || '').trim();
    const fareNum = Number(ride.estimated_fare);

    if (!rawUpi || !rawUpi.includes('@')) {
      setQrError('Driver UPI ID is not configured. Please add your UPI ID in Profile Settings to generate payment QR.');
      setQrUrl(null);
      return;
    }

    if (!Number.isFinite(fareNum) || fareNum <= 0) {
      setQrError('Invalid ride fare amount.');
      setQrUrl(null);
      return;
    }

    const cleanUpi = rawUpi.replace(/\s+/g, '');
    const cleanName = (driverName || 'Driver').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50) || 'Driver';
    const encodedName = encodeURIComponent(cleanName);
    const fare = fareNum.toFixed(2);

    // Standard NPCI UPI URI with exact fare prefilled
    const upiUri = `upi://pay?pa=${cleanUpi}&pn=${encodedName}&am=${fare}&cu=INR`;

    let isMounted = true;
    QRCode.toDataURL(upiUri, {
      width: 280,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (isMounted) {
          setQrUrl(url);
          setQrError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to generate driver QR:', err);
          setQrError('Unable to generate payment QR.');
          setQrUrl(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [ride.id, ride.estimated_fare, ride.driver_payout_upi, payoutUpi, driverName]);

  if (qrError) {
    return (
      <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-300 text-xs text-center max-w-sm">
        {qrError}
      </div>
    );
  }

  if (!qrUrl) {
    return (
      <div className="w-52 h-52 flex flex-col items-center justify-center bg-[#202023] rounded-2xl border border-[#303034] text-xs text-[#A1A1AA]">
        <div className="w-8 h-8 border-3 border-[#C6FF3D] border-t-transparent rounded-full animate-spin mb-2" />
        Generating QR...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-3.5 bg-white rounded-2xl shadow-lg border border-gray-200">
      <img
        src={qrUrl}
        alt={`UPI Payment QR for ₹${ride.estimated_fare}`}
        className="w-52 h-52 sm:w-56 sm:h-56 object-contain rounded-lg"
      />
      <div className="mt-2 text-center text-[#0B0B0D]">
        <div className="text-xs font-black">Scan to Pay ₹{Number(ride.estimated_fare).toFixed(2)}</div>
        <div className="text-[10px] font-mono font-medium text-gray-600 truncate max-w-[220px]">
          {ride.driver_payout_upi || payoutUpi}
        </div>
      </div>
    </div>
  );
};

interface DriverDashboardProps {
  navigate: (path: string) => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({ navigate }) => {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [earnings, setEarnings] = useState<DriverEarningsSummary | null>(null);
  const [requests, setRequests] = useState<Booking[]>([]);
  const [activeRide, setActiveRide] = useState<Booking | null>(null);
  const [completedRides, setCompletedRides] = useState<Booking[]>([]);
  const [completedRideForPayment, setCompletedRideForPayment] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);

  // Driver profile & payment editing state
  const [profileName, setProfileName] = useState('');
  const [profileMobile, setProfileMobile] = useState('');
  const [profileUpi, setProfileUpi] = useState('');
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

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
        console.error('Error checking notification state:', error);
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
        if (!isFormInitialized) {
          setProfileName(profRes.data.name || '');
          setProfileMobile(profRes.data.mobile || '');
          setProfileUpi(profRes.data.payout_upi || '');
          setIsFormInitialized(true);
        }
      }
      if (earnRes.success && earnRes.data) setEarnings(earnRes.data);
      if (reqRes.success && reqRes.data) setRequests(reqRes.data);

      if (myRidesRes.success && myRidesRes.data) {
        const ongoing = myRidesRes.data.find(b =>
          ['Driver Assigned', 'Driver Arriving', 'Ride Started'].includes(b.status)
        );
        setActiveRide(ongoing || null);

        const finished = myRidesRes.data.filter(b => b.status === 'Ride Completed');
        setCompletedRides(finished);

        // Auto-select pending payment ride if not already set
        const pending = finished.find(b => b.payment_status === 'PENDING');
        if (pending) {
          setCompletedRideForPayment(curr => curr || pending);
        }
      }
    } catch (err: any) {
      console.error('Driver dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    const name = profileName.trim();
    const mobile = profileMobile.trim().replace(/[\s\-]/g, '');
    const upi = profileUpi.trim();

    if (!name || name.length < 2) {
      setProfileErrorMsg('Please provide a valid display name (at least 2 characters).');
      return;
    }

    if (!mobile || !/^\+?[0-9]{10,14}$/.test(mobile)) {
      setProfileErrorMsg('Please provide a valid 10-digit mobile number.');
      return;
    }

    if (!upi) {
      setProfileErrorMsg('Please enter your UPI ID for receiving ride payments.');
      return;
    }

    if (!upi.includes('@')) {
      setProfileErrorMsg('UPI ID must contain an "@" symbol followed by your bank/PSP handle (e.g. 9876543210@ybl or driver@oksbi). Do not enter only a phone number.');
      return;
    }

    const upiRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,64}$/;
    if (!upiRegex.test(upi)) {
      setProfileErrorMsg('Invalid UPI ID format. Please use a standard VPA address like username@bank or mobile@upi.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await api.driver.updateProfile({
        name,
        mobile,
        payout_upi: upi
      });

      if (res.success && res.data) {
        setProfile(res.data);
        setProfileName(res.data.name || '');
        setProfileMobile(res.data.mobile || '');
        setProfileUpi(res.data.payout_upi || '');
        setProfileSuccessMsg('Profile and UPI payment details updated successfully! Passengers will now pay directly to this UPI address.');
        await refreshUser();
      } else {
        setProfileErrorMsg(res.error || 'Failed to update profile.');
      }
    } catch (err: any) {
      setProfileErrorMsg(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetProfile = () => {
    if (!profile) return;
    setProfileName(profile.name || '');
    setProfileMobile(profile.mobile || '');
    setProfileUpi(profile.payout_upi || '');
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);
  };

  const isProfileModified = Boolean(
    profile && (
      profileName !== (profile.name || '') ||
      profileMobile !== (profile.mobile || '') ||
      profileUpi !== (profile.payout_upi || '')
    )
  );

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  };

  const handleEnableNotifications = async () => {
    try {
      setActionError(null);

      if (
        !('Notification' in window) ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window)
      ) {
        setActionError('Push notifications are not supported on this browser/device.');
        return;
      }

      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission !== 'granted') {
        setActionError('Notification permission was not granted.');
        return;
      }

      const vapidRes = await api.driver.getPushPublicKey();
      const vapidPublicKey = vapidRes.data?.publicKey;

      if (!vapidPublicKey) {
        setActionError('Missing VAPID public key from backend server.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      const rawSub = subscription.toJSON();
      if (!rawSub.endpoint || !rawSub.keys?.p256dh || !rawSub.keys?.auth) {
        setActionError('Incomplete push subscription payload.');
        return;
      }

      const saveRes = await api.driver.savePushSubscription({
        endpoint: rawSub.endpoint,
        expirationTime: rawSub.expirationTime,
        keys: {
          p256dh: rawSub.keys.p256dh,
          auth: rawSub.keys.auth
        }
      });

      if (!saveRes.success) {
        setActionError(saveRes.error || 'Failed to save push subscription.');
        return;
      }

      setIsNotificationEnabled(true);

      await registration.showNotification('Clik2Go Driver Console', {
        body: 'Push alerts are now enabled for incoming ride bookings.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png'
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
      if (pickupLat == null || pickupLng == null) {
        setActionError('Customer pickup GPS location is missing.');
        return;
      }
      destination = `${pickupLat},${pickupLng}`;
    } else {
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

    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleProgressRide = async (nextStatus: string) => {
    if (!activeRide) return;
    setActionError(null);
    const res = await api.driver.updateRideStatus(activeRide.id, nextStatus);
    if (res.success && res.data) {
      if (nextStatus === 'Ride Completed' || nextStatus === 'Cancelled') {
        if (nextStatus === 'Ride Completed') {
          setCompletedRideForPayment(res.data);
        }
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
    return <div className="py-20 text-center text-xs text-[#A1A1AA] bg-[#0B0B0D]">Loading driver terminal...</div>;
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 bg-[#0B0B0D] text-white safe-bottom">

      {/* Top Driver Console Header */}
      <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#202023] border border-[#303034] text-[#C6FF3D] flex items-center justify-center font-black text-2xl flex-shrink-0">
              🛺
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#C6FF3D]">Clik2Go Driver</span>
                <span className="text-xs text-[#A1A1AA]">•</span>
                <span className="text-xs text-[#A1A1AA] font-mono uppercase font-bold">{profile?.auto_number}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {getGreeting()}, {driverFirstName}
              </h1>
            </div>
          </div>

          {/* Online Toggle & Notifications */}
          <div className="w-full sm:w-auto flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                document.getElementById('driver-profile-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs bg-[#202023] hover:bg-[#26262A] text-white border border-[#303034] hover:border-[#C6FF3D]/50 transition-all flex items-center justify-center gap-2"
              title="Edit Profile and Payment Details"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#C6FF3D]" />
              <span>UPI & Profile</span>
            </button>

            {!isNotificationEnabled && (
              <button
                onClick={handleEnableNotifications}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs bg-[#202023] hover:bg-[#26262A] text-white border border-[#303034] transition-all flex items-center justify-center gap-2"
              >
                <span>🔔</span>
                <span>Enable Alerts</span>
              </button>
            )}

            {isApproved ? (
              <button
                onClick={handleToggleAvailability}
                disabled={isUpdatingStatus || profile?.availability_status === 'on_ride'}
                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2.5 border ${
                  isAvailable
                    ? 'bg-[#C6FF3D] text-[#0B0B0D] border-[#C6FF3D] hover:bg-[#B5F028] shadow-glow-lime'
                    : 'bg-[#202023] text-[#A1A1AA] border-[#303034] hover:text-white'
                } disabled:opacity-50`}
              >
                <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-[#0B0B0D] animate-pulse' : 'bg-[#71717A]'}`} />
                <Power className="w-3.5 h-3.5" />
                <span>{isAvailable ? 'Online' : 'Offline'}</span>
              </button>
            ) : (
              <div className="px-4 py-2.5 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-300 text-xs font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Status: {approvalStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {/* Today's Rides */}
          <div className="bg-[#202023] rounded-2xl p-5 border border-[#303034] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Today's Rides</span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1">{todayRidesCount}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#171719] text-[#C6FF3D] border border-[#303034] flex items-center justify-center">
              <Car className="w-6 h-6" />
            </div>
          </div>

          {/* Earnings */}
          <div className="bg-[#202023] rounded-2xl p-5 border border-[#303034] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Today's Earnings</span>
              <div className="text-2xl sm:text-3xl font-black text-[#C6FF3D] mt-1">₹{earnings?.todayEarnings ?? 0}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#171719] text-[#C6FF3D] border border-[#303034] flex items-center justify-center">
              <IndianRupee className="w-6 h-6" />
            </div>
          </div>

          {/* Rating */}
          <div className="bg-[#202023] rounded-2xl p-5 border border-[#303034] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Rating</span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1 flex items-baseline gap-1">
                <span>4.9</span>
                <span className="text-[#C6FF3D] text-base">★</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#171719] text-[#C6FF3D] border border-[#303034] flex items-center justify-center">
              <Star className="w-6 h-6 fill-[#C6FF3D]" />
            </div>
          </div>
        </div>

        {/* View Bookings Button & Recent Ride Quick Preview */}
        <div className="mt-6 pt-6 border-t border-[#303034] grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-5">
            <button
              onClick={() => {
                document.getElementById('incoming-requests-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-sm rounded-xl shadow-glow-lime transition-all flex items-center justify-center gap-2"
            >
              <span>View Bookings</span>
              {requests.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#0B0B0D] text-[#C6FF3D] text-xs font-black">
                  {requests.length} New
                </span>
              )}
            </button>
          </div>

          {/* Recent Ride Card */}
          <div className="md:col-span-7 bg-[#202023] rounded-xl p-4 border border-[#303034] flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C6FF3D] block mb-0.5">
                Recent Ride
              </span>
              {mostRecentRide ? (
                <div className="text-xs text-white truncate font-medium">
                  <span>{mostRecentRide.pickup_address}</span>
                  <span className="text-[#A1A1AA] mx-1.5">→</span>
                  <span>{mostRecentRide.destination_address}</span>
                </div>
              ) : (
                <div className="text-xs text-[#A1A1AA]">No rides yet today. Go online to accept rides.</div>
              )}
            </div>

            {mostRecentRide && (
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-black text-[#C6FF3D]">₹{mostRecentRide.estimated_fare}</div>
                <div className="text-[10px] text-[#A1A1AA]">{mostRecentRide.status}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* APPROVAL STATUS BANNER */}
      {!isApproved && (
        <div className="p-5 rounded-3xl bg-amber-950/40 border border-amber-800 text-amber-300 shadow-card flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-wide">
              {approvalStatus === 'PENDING' ? 'Account Pending Verification' : `Account Status: ${approvalStatus}`}
            </h3>
            <p className="text-xs text-amber-300/80 leading-relaxed">
              {approvalStatus === 'PENDING'
                ? 'Your driver partner application has been submitted to the Clik2Go Admin. Vehicle registration and license documents are currently under review. You will be enabled to accept passenger rides once verified.'
                : 'Your driver account cannot accept passenger rides in its current state. Please contact the Clik2Go support team.'}
            </p>
          </div>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* DRIVER FINANCIALS & EARNINGS CARD */}
      <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#303034]">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-[#C6FF3D]" />
              <span>Driver Earnings & Payout Settlements</span>
            </h2>
            <p className="text-xs text-[#A1A1AA]">
              Your split earnings from completed point-to-point auto rides (after platform fee)
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              document.getElementById('driver-profile-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 bg-[#202023] hover:bg-[#26262A] text-white border border-[#303034] hover:border-[#C6FF3D]/50 rounded-xl text-xs font-semibold flex items-center gap-2 break-all transition-colors cursor-pointer"
            title="Edit Driver Profile & UPI Details"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#C6FF3D] flex-shrink-0" />
            <span>Payout UPI: {profile?.payout_upi || 'Not configured'}</span>
            <span className="text-[10px] text-[#C6FF3D] font-bold underline ml-1">Edit</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-[#202023] border border-[#303034] rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-[#C6FF3D]">Today's Earnings</span>
            <div className="text-xl sm:text-2xl font-black text-[#C6FF3D] mt-1">₹{earnings?.todayEarnings ?? 0}</div>
          </div>

          <div className="p-4 bg-[#202023] border border-[#303034] rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-[#A1A1AA]">Lifetime Earnings</span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">₹{earnings?.totalEarnings ?? 0}</div>
          </div>

          <div className="p-4 bg-[#202023] border border-[#303034] rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-amber-400">Pending Settlement</span>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">₹{earnings?.pendingSettlement ?? 0}</div>
          </div>

          <div className="p-4 bg-[#202023] border border-[#303034] rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-[#A1A1AA]">Settled Payouts</span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">₹{earnings?.settledAmount ?? 0}</div>
          </div>
        </div>
      </div>

      {/* DRIVER PROFILE & UPI PAYMENT DETAILS */}
      <div id="driver-profile-section" className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303034]">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#202023] border border-[#303034] text-[11px] font-bold text-[#C6FF3D] mb-2">
              <User className="w-3.5 h-3.5" />
              <span>Driver Account Settings</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Driver Profile & Payment Details</span>
            </h2>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Configure your public display name, contact phone number, and direct UPI address used for auto-ride payments.
            </p>
          </div>

          {/* Read-only vehicle badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-[#202023] border border-[#303034] text-xs font-mono font-bold text-white flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-[#C6FF3D]" />
              <span>{profile?.auto_number || 'Auto Number'}</span>
            </span>
            <span className="px-2.5 py-1.5 rounded-xl bg-[#202023] border border-[#303034] text-[11px] font-bold text-[#A1A1AA]">
              {profile?.auto_model || 'Bajaj Compact 4S'}
            </span>
          </div>
        </div>

        {/* Success Alert */}
        {profileSuccessMsg && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-start justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-semibold">{profileSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setProfileSuccessMsg(null)}
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {profileErrorMsg && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-start justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span className="font-semibold">{profileErrorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setProfileErrorMsg(null)}
              className="text-rose-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Profile Form */}
        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Field 1: Display Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#C6FF3D]" />
                <span>Display Name (Rider Visible)</span>
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                required
                className="w-full bg-[#202023] border border-[#303034] focus:border-[#C6FF3D] rounded-xl px-4 py-2.5 text-sm font-semibold text-white placeholder-[#71717A] focus:outline-none transition-colors"
              />
              <p className="text-[10px] text-[#A1A1AA]">
                Shown to passengers on booking cards and ride tracking receipts.
              </p>
            </div>

            {/* Field 2: Mobile Number */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#C6FF3D]" />
                <span>Mobile Number</span>
              </label>
              <input
                type="tel"
                value={profileMobile}
                onChange={(e) => setProfileMobile(e.target.value)}
                placeholder="e.g. 9876543210"
                required
                className="w-full bg-[#202023] border border-[#303034] focus:border-[#C6FF3D] rounded-xl px-4 py-2.5 text-sm font-semibold text-white placeholder-[#71717A] focus:outline-none transition-colors"
              />
              <p className="text-[10px] text-[#A1A1AA]">
                Used for passenger pickup calls and dispatch notifications. Must be a valid mobile number.
              </p>
            </div>
          </div>

          {/* Field 3: UPI ID (VPA) */}
          <div className="space-y-1.5 p-4 sm:p-5 rounded-2xl bg-[#202023] border border-[#303034]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#C6FF3D] flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#C6FF3D]" />
                <span>Direct UPI Payment ID (VPA)</span>
              </label>
              <span className="text-[10px] font-mono text-[#A1A1AA] bg-[#171719] px-2 py-0.5 rounded border border-[#303034]">
                Auto-Ride Payment Flow
              </span>
            </div>

            <div className="relative mt-1">
              <input
                type="text"
                value={profileUpi}
                onChange={(e) => setProfileUpi(e.target.value)}
                placeholder="e.g. driver@oksbi or 9876543210@ybl"
                required
                className="w-full bg-[#171719] border border-[#303034] focus:border-[#C6FF3D] rounded-xl px-4 py-2.5 text-sm font-semibold text-white placeholder-[#71717A] focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-start gap-2 pt-1 text-[11px] text-[#A1A1AA]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C6FF3D] flex-shrink-0 mt-0.5" />
              <span>
                <strong>Important:</strong> Enter your full UPI address including bank handle (e.g. <code className="text-[#C6FF3D]">yourname@oksbi</code>, <code className="text-[#C6FF3D]">9876543210@paytm</code>). A phone number alone is <em>not</em> automatically a UPI ID. Riders will scan or launch their UPI app to pay directly to this ID upon ride completion.
              </span>
            </div>
          </div>

          {/* Vehicle & Verification Metadata (Read-only reference) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-[#202023]/60 border border-[#303034]">
              <span className="text-[10px] uppercase font-bold text-[#A1A1AA] block">License Number</span>
              <span className="font-mono font-bold text-white text-xs">{profile?.license_number || '—'}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#202023]/60 border border-[#303034]">
              <span className="text-[10px] uppercase font-bold text-[#A1A1AA] block">Verification Status</span>
              <span className={`font-bold text-xs ${profile?.approval_status === 'APPROVED' || profile?.approval_status === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {profile?.approval_status || 'PENDING'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#202023]/60 border border-[#303034]">
              <span className="text-[10px] uppercase font-bold text-[#A1A1AA] block">Current Active UPI</span>
              <span className="font-mono font-bold text-[#C6FF3D] text-xs truncate block">{profile?.payout_upi || 'Not configured'}</span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
            {isProfileModified && (
              <button
                type="button"
                onClick={handleResetProfile}
                disabled={isSavingProfile}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#202023] hover:bg-[#26262A] text-[#A1A1AA] hover:text-white font-bold text-xs border border-[#303034] transition-colors cursor-pointer"
              >
                Reset to Saved
              </button>
            )}

            <button
              type="submit"
              disabled={isSavingProfile}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[42px] cursor-pointer"
            >
              {isSavingProfile ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#0B0B0D] border-t-transparent rounded-full animate-spin" />
                  <span>Saving Details...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-[#0B0B0D]" />
                  <span>Save Profile & Payment Details</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ACTIVE ONGOING RIDE CONTROLLER */}
      {activeRide && (
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 shadow-card border-2 border-[#C6FF3D] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#303034]">
            <div>
              <span className="text-[10px] font-bold uppercase text-[#C6FF3D]">
                Active Ride Assignment
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white font-mono break-all">
                {activeRide.booking_reference}
              </h2>
            </div>
            <StatusBadge status={activeRide.status} size="lg" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 text-xs bg-[#202023] p-4 rounded-2xl border border-[#303034]">
              <div className="flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#C6FF3D] mt-1 flex-shrink-0 ring-4 ring-[#C6FF3D]/20" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-[#A1A1AA]">Pickup</span>
                  <div className="font-black text-white text-sm">
                    {activeRide.pickup_area_name || 'Pickup'}
                  </div>
                  <div className="text-xs text-[#A1A1AA] mt-0.5 break-words">
                    {activeRide.pickup_address}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 bg-white mt-1 flex-shrink-0 ring-4 ring-white/20 rounded-xs" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-[#A1A1AA]">Destination</span>
                  <div className="font-black text-white text-sm">
                    {activeRide.destination_area_name || 'Destination'}
                  </div>
                  <div className="text-xs text-[#A1A1AA] mt-0.5 break-words">
                    {activeRide.destination_address}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-[#A1A1AA] border-t border-[#303034]">
                <div>
                  Passenger(s):{' '}
                  <span className="font-bold text-white">
                    {activeRide.passengers}
                  </span>
                </div>
                <div>
                  Customer Fare:{' '}
                  <span className="font-black text-[#C6FF3D] text-sm">
                    ₹{activeRide.estimated_fare}
                  </span>
                </div>
              </div>
            </div>

            {/* Status advancement buttons */}
            <div className="bg-[#202023] rounded-2xl p-5 border border-[#303034] space-y-3 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase text-[#A1A1AA]">
                Update Ride Progression
              </span>

              <button
                onClick={handleOpenNavigation}
                className="w-full py-3 bg-[#171719] hover:bg-[#26262A] text-white border border-[#303034] font-bold text-xs rounded-xl shadow-subtle flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Navigation className="w-4 h-4 text-[#C6FF3D]" />
                {activeRide.status === 'Driver Assigned'
                  ? 'Navigate to Pickup (Google Maps)'
                  : 'Navigate to Destination (Google Maps)'}
              </button>

              {activeRide.status === 'Driver Assigned' && (
                <button
                  onClick={() => handleProgressRide('Driver Arriving')}
                  className="w-full py-3 bg-[#202023] hover:bg-[#26262A] text-white border border-[#303034] font-bold text-xs rounded-xl transition-all min-h-[44px]"
                >
                  Mark as "Driver Arriving at Pickup"
                </button>
              )}

              {activeRide.status === 'Driver Arriving' && (
                <button
                  onClick={() => handleProgressRide('Ride Started')}
                  className="w-full py-3 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime transition-all min-h-[44px]"
                >
                  Start Ride (Passenger Onboard)
                </button>
              )}

              {activeRide.status === 'Ride Started' && (
                <button
                  onClick={() => handleProgressRide('Ride Completed')}
                  className="w-full py-3 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime transition-all min-h-[44px]"
                >
                  Complete Ride (Collect ₹{activeRide.estimated_fare})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RIDE COMPLETED — COLLECT PAYMENT (UPI QR DISPLAY) */}
      {completedRideForPayment && completedRideForPayment.payment_status !== 'COMPLETED' && (
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border-2 border-[#C6FF3D]/50 shadow-glow-lime-sm space-y-5 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-[#303034]">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#C6FF3D]" />
              <div>
                <h2 className="text-base sm:text-lg font-black text-white">Ride Completed — Collect Payment</h2>
                <p className="text-xs text-[#A1A1AA]">Show this QR code to the passenger to scan with their UPI app</p>
              </div>
            </div>
            <button
              onClick={() => setCompletedRideForPayment(null)}
              className="text-[#A1A1AA] hover:text-white text-xs px-2.5 py-1 rounded-lg bg-[#202023] border border-[#303034] transition-colors"
            >
              Hide
            </button>
          </div>

          <div className="p-4 bg-[#202023] rounded-2xl border border-[#303034] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider block">
                Booking: {completedRideForPayment.booking_reference}
              </span>
              <div className="text-xs font-semibold text-white mt-0.5">
                {completedRideForPayment.pickup_address} → {completedRideForPayment.destination_address}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-[10px] text-[#A1A1AA] block">Exact Fare to Collect:</span>
              <span className="text-2xl font-black text-[#C6FF3D]">₹{completedRideForPayment.estimated_fare}</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-[#202023] rounded-2xl border border-[#303034] space-y-3">
            <DriverPaymentQr
              ride={completedRideForPayment}
              payoutUpi={profile?.payout_upi || ''}
              driverName={profile?.name || 'Driver'}
            />
            <div className="text-center text-xs text-[#A1A1AA] max-w-sm space-y-1">
              <p className="font-semibold text-white">
                The exact fare of ₹{completedRideForPayment.estimated_fare} is prefilled automatically in this QR.
              </p>
              <p className="text-[11px] text-[#71717A]">
                Customer opens PhonePe, Google Pay, Paytm, or BHIM and scans this screen.
              </p>
            </div>
          </div>

          <div className="pt-1 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={async () => {
                const verified = window.confirm(
                  `Please verify: Have you checked your bank account or UPI app and confirmed that ₹${completedRideForPayment.estimated_fare} was credited?`
                );
                if (!verified) return;

                try {
                  const result = await api.payments.confirmDriverPayment(completedRideForPayment.id);
                  if (result.success) {
                    alert('Payment receipt confirmed.');
                    setCompletedRideForPayment(null);
                    await loadDriverData();
                  } else {
                    alert(result.error || 'Unable to confirm payment.');
                  }
                } catch {
                  alert('Unable to confirm payment. Please try again.');
                }
              }}
              className="w-full sm:flex-1 py-3 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-[#0B0B0D]" />
              <span>Confirm Payment Received (₹{completedRideForPayment.estimated_fare})</span>
            </button>
          </div>
        </div>
      )}

      {/* INCOMING RIDE REQUESTS QUEUE */}
      <div id="incoming-requests-section" className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#303034]">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Incoming Ride Requests</h2>
            <p className="text-xs text-[#A1A1AA]">Available customer ride requests across authorized routes</p>
          </div>
          <span className="px-3 py-1 bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30 font-bold text-xs rounded-full whitespace-nowrap">
            {requests.length} Available
          </span>
        </div>

        {!isApproved ? (
          <div className="py-8 text-center bg-[#202023] rounded-2xl border border-[#303034] p-6 space-y-2">
            <div className="text-3xl">🔒</div>
            <h3 className="text-sm font-bold text-white">Trip Acceptance Locked</h3>
            <p className="text-xs text-[#A1A1AA] max-w-md mx-auto">
              You must be approved by the Clik2Go Admin before accepting customer ride requests.
            </p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center space-y-2 bg-[#202023] rounded-2xl border border-[#303034]">
            <div className="text-3xl">📡</div>
            <h3 className="text-sm font-bold text-white">No pending ride requests</h3>
            <p className="text-xs text-[#A1A1AA]">Keep your status "Online" to receive new customer bookings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-5 rounded-2xl border border-[#303034] bg-[#202023] hover:border-[#C6FF3D]/50 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-white break-all">{req.booking_reference}</span>
                  <span className="font-black text-[#C6FF3D] text-base">₹{req.estimated_fare}</span>
                </div>

                <div className="space-y-2 text-xs text-[#A1A1AA]">
                  <div>
                    <div className="font-bold text-white">
                      {req.pickup_area_name || 'Pickup'} → {req.destination_area_name || 'Destination'}
                    </div>
                    <div className="mt-1 break-words">
                      <span className="text-[#A1A1AA]">Pickup:</span> {req.pickup_address}
                    </div>
                  </div>

                  <div>
                    <div className="break-words">
                      <span className="text-[#A1A1AA]">Drop:</span> {req.destination_address}
                    </div>
                  </div>

                  <div className="text-[11px] text-[#A1A1AA]">
                    Passengers: {req.passengers}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#303034]">
                  <button
                    onClick={() => handleAcceptRide(req.id)}
                    className="flex-1 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-[#0B0B0D]" />
                    <span>Accept Ride</span>
                  </button>
                  <button
                    onClick={() => handleRejectRide(req.id)}
                    className="px-3.5 py-2.5 bg-[#171719] hover:bg-rose-950/40 text-rose-400 font-semibold text-xs rounded-xl transition-colors min-h-[44px] flex items-center justify-center border border-[#303034] hover:border-rose-800"
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
      <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-4">
        <h3 className="text-base font-bold text-white">Completed Ride History</h3>
        {completedRides.length === 0 ? (
          <p className="text-xs text-[#A1A1AA] py-4">No completed rides recorded yet.</p>
        ) : (
          <div className="divide-y divide-[#303034] bg-[#202023] rounded-2xl border border-[#303034] px-4">
            {completedRides.map((ride) => (
              <div key={ride.id} className="py-3 flex items-start sm:items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="font-mono font-bold text-white">{ride.booking_reference}</span>
                  <div className="text-[#A1A1AA] text-[11px] break-words">
                    {ride.pickup_address} → {ride.destination_address}
                  </div>
                </div>
                                <div className="text-right flex-shrink-0 space-y-2">
                  <div className="font-black text-[#C6FF3D]">₹{ride.estimated_fare}</div>
                  <span className="text-[10px] text-emerald-400 font-bold block">Ride Completed</span>

                  {ride.payment_status === 'COMPLETED' ? (
                    <span className="text-[10px] text-emerald-400 font-bold block">
                      Payment Confirmed
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          setCompletedRideForPayment(ride);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1.5 bg-[#202023] hover:bg-[#26262A] text-[#C6FF3D] border border-[#303034] rounded-lg font-bold text-[10px] flex items-center gap-1 transition-colors"
                      >
                        <QrCode className="w-3 h-3" />
                        <span>Show QR</span>
                      </button>
                      <button
                        onClick={async () => {
                          const verified = window.confirm(
                            `Please verify: Have you checked your bank account or UPI app and confirmed that ₹${ride.estimated_fare} was credited?`
                          );
                          if (!verified) return;

                          try {
                            const result = await api.payments.confirmDriverPayment(ride.id);
                            if (result.success) {
                              alert('Payment receipt confirmed.');
                              if (completedRideForPayment?.id === ride.id) {
                                setCompletedRideForPayment(null);
                              }
                              await loadDriverData();
                            } else {
                              alert(result.error || 'Unable to confirm payment.');
                            }
                          } catch {
                            alert('Unable to confirm payment. Please try again.');
                          }
                        }}
                        className="px-3 py-1.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] rounded-lg font-bold text-[10px] transition-colors"
                      >
                        Payment Received
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
