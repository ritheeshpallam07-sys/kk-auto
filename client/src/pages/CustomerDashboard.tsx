import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, Booking, TripBooking, TripDestination, getCashfreeMode } from '../api/client';
import { load } from '@cashfreepayments/cashfree-js';
import {
  PlaceSuggestion,
  ensureGooglePlacesLoaded,
  searchPlacesNew,
  fetchPlaceDetailsNew
} from '../utils/places';
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
  Loader2,
  LifeBuoy,
  Plus,
  Trash2
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

const getLocalTodayYmd = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getLocalNowHm = (): string => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

interface DestinationStopItem extends TripDestination {
  uid: number;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ navigate }) => {
  const { user } = useAuth();

  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [myTripBookings, setMyTripBookings] = useState<TripBooking[]>([]);
  const [ownerContact, setOwnerContact] = useState<{ phone: string; whatsapp: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Trip form modal state
  const nextStopUidRef = useRef(2);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showTripListModal, setShowTripListModal] = useState(false);
  const [destinations, setDestinations] = useState<DestinationStopItem[]>([{ uid: 1, name: '' }]);
  const [activeStopUid, setActiveStopUid] = useState<number | null>(null);
  const activeStopUidRef = useRef<number | null>(null);
  const [destSuggestions, setDestSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [highlightedSuggestionIdx, setHighlightedSuggestionIdx] = useState<number>(-1);
  const [pendingDetailsByUid, setPendingDetailsByUid] = useState<Record<number, boolean>>({});
  const debounceTimersByUidRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const searchSeqByUidRef = useRef<Record<number, number>>({});
  const detailSeqByUidRef = useRef<Record<number, number>>({});

  const [tripForm, setTripForm] = useState({
    customerName: user?.name || '',
    phoneNumber: user?.mobile || '',
    members: 1,
    days: 1,
    tripDate: '',
    pickupTime: '',
  });
  const [isTripSubmitting, setIsTripSubmitting] = useState(false);
  const [tripSubmitSuccess, setTripSubmitSuccess] = useState<string | null>(null);
  const [tripSubmitError, setTripSubmitError] = useState<string | null>(null);
  const [tripPayingId, setTripPayingId] = useState<number | null>(null);
  const [tripPayError, setTripPayError] = useState<string | null>(null);

  const isFetchingAnyDetails = Object.values(pendingDetailsByUid).some(Boolean);

  useEffect(() => {
    if (showTripModal) {
      ensureGooglePlacesLoaded();
    }
  }, [showTripModal]);

  useEffect(() => {
    return () => {
      Object.values(debounceTimersByUidRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

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

  const handleDestinationInputChange = (uid: number, value: string) => {
    if (debounceTimersByUidRef.current[uid]) {
      clearTimeout(debounceTimersByUidRef.current[uid]);
      delete debounceTimersByUidRef.current[uid];
    }

    // Invalidate any in-flight autocomplete search or place-details lookup for this stop
    const nextSearchSeq = (searchSeqByUidRef.current[uid] || 0) + 1;
    searchSeqByUidRef.current[uid] = nextSearchSeq;
    detailSeqByUidRef.current[uid] = (detailSeqByUidRef.current[uid] || 0) + 1;

    setPendingDetailsByUid((prev) => {
      if (!prev[uid]) return prev;
      const next = { ...prev };
      delete next[uid];
      return next;
    });

    setDestinations((prev) =>
      prev.map((d) =>
        d.uid === uid
          ? { uid, name: value, address: undefined, placeId: undefined, lat: undefined, lng: undefined }
          : d
      )
    );
    setTripSubmitError(null);

    if (value.trim().length < 2) {
      if (activeStopUidRef.current === uid) {
        activeStopUidRef.current = null;
        setActiveStopUid(null);
        setDestSuggestions([]);
        setIsSearchingDest(false);
        setHighlightedSuggestionIdx(-1);
      }
      return;
    }

    activeStopUidRef.current = uid;
    setActiveStopUid(uid);
    setIsSearchingDest(true);
    setHighlightedSuggestionIdx(-1);

    debounceTimersByUidRef.current[uid] = setTimeout(async () => {
      delete debounceTimersByUidRef.current[uid];
      const results = await searchPlacesNew(value, {
        useLocationBias: false,
        includeLocalFallback: false
      });

      // Discard stale responses if the user edited/cleared this stop or moved focus
      if (searchSeqByUidRef.current[uid] !== nextSearchSeq || activeStopUidRef.current !== uid) {
        return;
      }

      setDestSuggestions(results);
      setIsSearchingDest(false);
      setHighlightedSuggestionIdx(-1);
    }, 300);
  };

  const handleSelectDestinationSuggestion = async (uid: number, suggestion: PlaceSuggestion) => {
    if (debounceTimersByUidRef.current[uid]) {
      clearTimeout(debounceTimersByUidRef.current[uid]);
      delete debounceTimersByUidRef.current[uid];
    }

    // Cancel pending search results and track this specific details fetch
    searchSeqByUidRef.current[uid] = (searchSeqByUidRef.current[uid] || 0) + 1;
    const detailSeq = (detailSeqByUidRef.current[uid] || 0) + 1;
    detailSeqByUidRef.current[uid] = detailSeq;

    if (activeStopUidRef.current === uid) {
      activeStopUidRef.current = null;
      setActiveStopUid(null);
      setDestSuggestions([]);
      setIsSearchingDest(false);
      setHighlightedSuggestionIdx(-1);
    }

    setPendingDetailsByUid((prev) => ({ ...prev, [uid]: true }));
    setDestinations((prev) =>
      prev.map((d) =>
        d.uid === uid
          ? {
              uid,
              name: suggestion.mainText || suggestion.fullText,
              address: suggestion.fullText,
              placeId: suggestion.placeId,
              lat: undefined,
              lng: undefined
            }
          : d
      )
    );

    try {
      const details = await fetchPlaceDetailsNew(suggestion.placeId, suggestion.fullText);
      if (detailSeqByUidRef.current[uid] !== detailSeq) {
        return;
      }
      if (details) {
        setDestinations((prev) =>
          prev.map((d) => {
            if (d.uid !== uid) return d;
            // Double-guard against newer user input or a different suggestion
            if (detailSeqByUidRef.current[uid] !== detailSeq || d.placeId !== suggestion.placeId) {
              return d;
            }
            return {
              uid,
              name: suggestion.mainText || details.address,
              address: details.address,
              placeId: suggestion.placeId,
              lat: details.coords.lat,
              lng: details.coords.lng
            };
          })
        );
      }
    } finally {
      if (detailSeqByUidRef.current[uid] === detailSeq) {
        setPendingDetailsByUid((prev) => {
          if (!prev[uid]) return prev;
          const next = { ...prev };
          delete next[uid];
          return next;
        });
      }
    }
  };

  const handleAddDestination = () => {
    const newUid = nextStopUidRef.current++;
    setTripSubmitError(null);
    activeStopUidRef.current = null;
    setActiveStopUid(null);
    setDestSuggestions([]);
    setIsSearchingDest(false);
    setHighlightedSuggestionIdx(-1);
    setDestinations((prev) => [...prev, { uid: newUid, name: '' }]);
  };

  const handleRemoveDestination = (uid: number, index: number) => {
    if (index === 0) return;
    if (debounceTimersByUidRef.current[uid]) {
      clearTimeout(debounceTimersByUidRef.current[uid]);
      delete debounceTimersByUidRef.current[uid];
    }
    searchSeqByUidRef.current[uid] = (searchSeqByUidRef.current[uid] || 0) + 1;
    detailSeqByUidRef.current[uid] = (detailSeqByUidRef.current[uid] || 0) + 1;

    setPendingDetailsByUid((prev) => {
      if (!prev[uid]) return prev;
      const next = { ...prev };
      delete next[uid];
      return next;
    });

    if (activeStopUidRef.current === uid) {
      activeStopUidRef.current = null;
      setActiveStopUid(null);
      setDestSuggestions([]);
      setIsSearchingDest(false);
      setHighlightedSuggestionIdx(-1);
    }

    setDestinations((prev) => prev.filter((d) => d.uid !== uid));
  };

  const handleTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTripSubmitError(null);
    setTripSubmitSuccess(null);

    if (isFetchingAnyDetails) {
      setTripSubmitError('Please wait for selected destination details to finish loading.');
      return;
    }

    const cleanedDestinations: TripDestination[] = destinations.map(({ uid: _uid, ...d }) => ({
      ...d,
      name: (d.name || '').trim()
    }));

    if (cleanedDestinations.length === 0 || !cleanedDestinations[0].name) {
      setTripSubmitError('Please enter your primary destination.');
      return;
    }
    if (cleanedDestinations.some((d) => !d.name)) {
      setTripSubmitError('Please fill in or remove any empty additional destinations.');
      return;
    }

    const membersNum = Number(tripForm.members);
    if (!Number.isInteger(membersNum) || membersNum < 1 || membersNum > 20) {
      setTripSubmitError('Passengers must be between 1 and 20.');
      return;
    }

    const daysNum = Number(tripForm.days);
    if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 30) {
      setTripSubmitError('Trip duration must be between 1 and 30 days.');
      return;
    }

    const todayYmd = getLocalTodayYmd();
    if (!tripForm.tripDate) {
      setTripSubmitError('Please select a start date.');
      return;
    }
    if (tripForm.tripDate < todayYmd) {
      setTripSubmitError('Start date cannot be in the past.');
      return;
    }

    if (!tripForm.pickupTime) {
      setTripSubmitError('Please select a pickup time.');
      return;
    }
    if (tripForm.tripDate === todayYmd) {
      const selectedDateTime = new Date(`${tripForm.tripDate}T${tripForm.pickupTime}:00`);
      if (selectedDateTime.getTime() < Date.now() - 60_000) {
        setTripSubmitError('Pickup time cannot be in the past.');
        return;
      }
    }

    const rawPhone = (tripForm.phoneNumber || user?.mobile || '').trim();
    const digits = rawPhone.replace(/\D/g, '');
    let nationalPhone = digits;
    if (digits.length === 12 && digits.startsWith('91')) nationalPhone = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) nationalPhone = digits.slice(1);

    if (!/^\d{10}$/.test(nationalPhone) || /^(\d)\1{9}$/.test(nationalPhone)) {
      setTripSubmitError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const formattedTripPlace = cleanedDestinations.map((d) => d.name).join(' → ');

    setIsTripSubmitting(true);
    const res = await api.tripBookings.create({
      customerName: tripForm.customerName || user?.name || 'Customer',
      phoneNumber: rawPhone,
      members: membersNum,
      tripPlace: formattedTripPlace,
      destinations: cleanedDestinations,
      days: daysNum,
      tripDate: tripForm.tripDate,
      pickupTime: tripForm.pickupTime,
    });
    setIsTripSubmitting(false);

    if (res.success) {
      setTripSubmitSuccess('Trip request submitted! The owner will review and contact you with fixed quote.');
      const resetUid = nextStopUidRef.current++;
      setDestinations([{ uid: resetUid, name: '' }]);
      setPendingDetailsByUid({});
      activeStopUidRef.current = null;
      setActiveStopUid(null);
      setDestSuggestions([]);
      setIsSearchingDest(false);
      setHighlightedSuggestionIdx(-1);
      setTripForm({
        customerName: user?.name || '',
        phoneNumber: user?.mobile || '',
        members: 1,
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
              Where to, Rider?
            </h1>
            <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1">
              Select an option below to get moving
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Quick link to view past/pending outstation trips */}
            {myTripBookings.length > 0 && (
              <button
                type="button"
                onClick={() => setShowTripListModal(true)}
                className="px-3.5 py-2 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] text-xs font-bold text-[#A1A1AA] hover:text-white flex items-center gap-2 transition-colors"
              >
                <CalendarDays className="w-4 h-4 text-[#C6FF3D]" />
                <span>My Outstation Trips ({myTripBookings.length})</span>
              </button>
            )}

            {/* Help & Support Quick Action */}
            <button
              type="button"
              onClick={() => navigate('/support')}
              className="px-3.5 py-2 rounded-2xl bg-[#171719] hover:bg-[#202023] border border-[#303034] text-xs font-bold text-[#A1A1AA] hover:text-white flex items-center gap-2 transition-colors"
            >
              <LifeBuoy className="w-4 h-4 text-[#C6FF3D]" />
              <span>Help & Support</span>
            </button>
          </div>
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
          <div className="w-full max-w-lg bg-[#171719] rounded-3xl border border-[#303034] shadow-2xl p-6 sm:p-8 space-y-5 my-auto max-h-[90vh] overflow-y-auto">

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

                {/* Destinations (Multi-stop with Google Places Autocomplete) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                      Destination / Place Name *
                    </label>
                    {destinations.length < 10 && (
                      <button
                        type="button"
                        onClick={handleAddDestination}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#202023] hover:bg-[#26262A] border border-[#303034] hover:border-[#C6FF3D]/60 text-[11px] font-bold text-[#C6FF3D] transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Destination</span>
                      </button>
                    )}
                  </div>

                  {destinations.map((dest, idx) => {
                    const isDropdownOpen = activeStopUid === dest.uid && dest.name.trim().length >= 2;
                    const isStopDetailsLoading = Boolean(pendingDetailsByUid[dest.uid]);
                    return (
                      <div
                        key={`trip-dest-uid-${dest.uid}`}
                        className="relative"
                        onBlur={(e) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) {
                            return;
                          }
                          if (activeStopUidRef.current === dest.uid) {
                            activeStopUidRef.current = null;
                            setActiveStopUid(null);
                            setDestSuggestions([]);
                            setIsSearchingDest(false);
                            setHighlightedSuggestionIdx(-1);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <MapPin className="w-3.5 h-3.5 text-[#C6FF3D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              required={idx === 0}
                              role="combobox"
                              aria-autocomplete="list"
                              aria-expanded={isDropdownOpen}
                              aria-controls={isDropdownOpen ? `trip-dest-listbox-${dest.uid}` : undefined}
                              value={dest.name}
                              onChange={(e) => handleDestinationInputChange(dest.uid, e.target.value)}
                              onFocus={() => {
                                const trimmed = dest.name.trim();
                                if (trimmed.length >= 2 && !dest.placeId) {
                                  if (activeStopUidRef.current !== dest.uid) {
                                    setDestSuggestions([]);
                                    handleDestinationInputChange(dest.uid, dest.name);
                                  } else {
                                    setActiveStopUid(dest.uid);
                                  }
                                }
                              }}
                              onKeyDown={(e) => {
                                if (!isDropdownOpen || destSuggestions.length === 0) {
                                  if (e.key === 'Escape' && activeStopUidRef.current === dest.uid) {
                                    activeStopUidRef.current = null;
                                    setActiveStopUid(null);
                                    setDestSuggestions([]);
                                    setHighlightedSuggestionIdx(-1);
                                  }
                                  return;
                                }
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setHighlightedSuggestionIdx((prev) =>
                                    prev < destSuggestions.length - 1 ? prev + 1 : 0
                                  );
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setHighlightedSuggestionIdx((prev) =>
                                    prev > 0 ? prev - 1 : destSuggestions.length - 1
                                  );
                                } else if (e.key === 'Enter' && highlightedSuggestionIdx >= 0) {
                                  e.preventDefault();
                                  const selected = destSuggestions[highlightedSuggestionIdx];
                                  if (selected) {
                                    handleSelectDestinationSuggestion(dest.uid, selected);
                                  }
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  activeStopUidRef.current = null;
                                  setActiveStopUid(null);
                                  setDestSuggestions([]);
                                  setHighlightedSuggestionIdx(-1);
                                }
                              }}
                              placeholder={
                                idx === 0
                                  ? 'Search primary destination (e.g. Tirupati, Bengaluru...)'
                                  : `Search stop ${idx + 1} (e.g. Kanipakam, Kalahasti...)`
                              }
                              aria-label={idx === 0 ? 'Destination / Place Name' : `Stop ${idx + 1}`}
                              className="w-full bg-[#202023] border border-[#303034] rounded-xl pl-8 pr-8 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#C6FF3D]"
                            />
                            {isStopDetailsLoading ? (
                              <Loader2
                                aria-label="Loading place details"
                                className="w-3.5 h-3.5 animate-spin text-[#C6FF3D] absolute right-2.5 top-1/2 -translate-y-1/2"
                              />
                            ) : (
                              dest.name && (
                                <button
                                  type="button"
                                  onClick={() => handleDestinationInputChange(dest.uid, '')}
                                  aria-label="Clear destination"
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </div>

                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDestination(dest.uid, idx)}
                              aria-label={`Remove stop ${idx + 1}`}
                              className="p-2.5 rounded-xl bg-[#202023] hover:bg-rose-950/40 border border-[#303034] hover:border-rose-800 text-[#A1A1AA] hover:text-rose-400 transition-colors cursor-pointer flex-shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {isDropdownOpen && (
                          <div
                            id={`trip-dest-listbox-${dest.uid}`}
                            role="listbox"
                            className="absolute left-0 right-0 mt-1 z-30 bg-[#171719] border border-[#303034] rounded-xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-[#26262A]"
                          >
                            {isSearchingDest ? (
                              <div className="px-3.5 py-3 text-xs text-[#A1A1AA] flex items-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C6FF3D]" />
                                <span>Searching places in India...</span>
                              </div>
                            ) : destSuggestions.length > 0 ? (
                              destSuggestions.map((s, sIdx) => (
                                <button
                                  key={`${s.placeId || s.fullText}-${sIdx}`}
                                  type="button"
                                  role="option"
                                  aria-selected={highlightedSuggestionIdx === sIdx}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => handleSelectDestinationSuggestion(dest.uid, s)}
                                  className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-start gap-2.5 cursor-pointer ${
                                    highlightedSuggestionIdx === sIdx
                                      ? 'bg-[#26262A]'
                                      : 'hover:bg-[#202023]'
                                  }`}
                                >
                                  <MapPin className="w-3.5 h-3.5 text-[#C6FF3D] mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-white truncate">{s.mainText}</div>
                                    {s.secondaryText && (
                                      <div className="text-[10px] text-[#A1A1AA] truncate">{s.secondaryText}</div>
                                    )}
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="px-3.5 py-2.5 text-[11px] text-[#A1A1AA]">
                                No autocomplete matches found. You can continue with your typed place name.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Passengers */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] block mb-1">
                      Passengers (1–20)
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

                  {/* Trip Duration */}
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
                  {/* Start Date */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] block mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      min={getLocalTodayYmd()}
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
                      min={tripForm.tripDate === getLocalTodayYmd() ? getLocalNowHm() : undefined}
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
                  disabled={isTripSubmitting || isFetchingAnyDetails}
                  className="w-full py-3.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl transition-all shadow-glow-lime disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isTripSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : isFetchingAnyDetails ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading Place Details...</span>
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
                          {Array.isArray(trip.trip_destinations) && trip.trip_destinations.length > 1 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {trip.trip_destinations.map((dest, idx) => (
                                <span
                                  key={`${trip.id}-stop-${idx}`}
                                  className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#171719] border border-[#303034] text-[10px] font-semibold text-[#C6FF3D]"
                                >
                                  Stop {idx + 1}: {dest.name}
                                </span>
                              ))}
                            </div>
                          )}
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
