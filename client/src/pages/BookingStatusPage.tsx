import React, { useState, useEffect, useRef } from 'react';
import { api, Booking, PaymentRecord, RatingRecord } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Clock,
  Users,
  IndianRupee,
  Phone,
  ShieldCheck,
  Car,
  AlertCircle,
  XCircle,
  PlayCircle,
  CheckCircle2,
  CreditCard,
  Receipt,
  Star,
  Send,
  Sparkles,
  MessageCircle
} from 'lucide-react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

interface BookingStatusPageProps {
  bookingId: string;
  navigate: (path: string) => void;
}

export const BookingStatusPage: React.FC<BookingStatusPageProps> = ({ bookingId, navigate }) => {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [rating, setRating] = useState<RatingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentTab, setPaymentTab] = useState<'online' | 'cash'>('online');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Rating state
  const [selectedStars, setSelectedStars] = useState<number>(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);

  // Status simulation for testing
  const [isSimulating, setIsSimulating] = useState(false);

  // Google Maps tracking state
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!key || !mapContainerRef.current) return;

    let isCancelled = false;
    async function initStatusMap() {
      try {
        if (!window.google) {
          setOptions({ key, v: 'weekly' });
        }
        const { Map } = (await importLibrary('maps')) as any;
        if (isCancelled || !mapContainerRef.current) return;

        const defaultCenter = { lat: 13.6480, lng: 78.7950 };
        const darkMapStyle = [
          { elementType: 'geometry', stylers: [{ color: '#171719' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0B0D' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#A1A1AA' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#202023' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#303034' }] },
          { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B0B0D' }] },
        ];

        const map = new Map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 14,
          styles: darkMapStyle,
          disableDefaultUI: true,
          zoomControl: false,
        });
        mapInstanceRef.current = map;
        setMapsLoaded(true);
      } catch (e) {
        console.warn('Status map load error:', e);
      }
    }
    initStatusMap();
    return () => { isCancelled = true; };
  }, []);

  // Update map markers when booking coordinates or status load
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current || !booking) return;
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!google) return;

    const pPos = {
      lat: Number(booking.pickup_latitude) || 13.6480,
      lng: Number(booking.pickup_longitude) || 78.7950
    };
    const dPos = {
      lat: Number(booking.destination_latitude) || 13.6525,
      lng: Number(booking.destination_longitude) || 78.8035
    };

    new google.maps.Marker({
      position: pPos,
      map,
      title: 'Pickup',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#C6FF3D',
        fillOpacity: 1,
        strokeColor: '#0B0B0D',
        strokeWeight: 2.5
      }
    });

    new google.maps.Marker({
      position: dPos,
      map,
      title: 'Destination',
      icon: {
        path: 'M -5,-5 L 5,-5 L 5,5 L -5,5 Z',
        scale: 1,
        fillColor: '#FFFFFF',
        fillOpacity: 1,
        strokeColor: '#C6FF3D',
        strokeWeight: 2
      }
    });

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(pPos);
    bounds.extend(dPos);
    map.fitBounds(bounds, 50);

    new google.maps.Polyline({
      path: [pPos, dPos],
      strokeColor: '#C6FF3D',
      strokeOpacity: 0.85,
      strokeWeight: 4,
      map
    });
  }, [mapsLoaded, booking]);

  useEffect(() => {
    loadBookingAndPayment();
    const interval = setInterval(() => {
      loadBookingAndPayment(false);
    }, 8000);
    return () => clearInterval(interval);
  }, [bookingId]);

  const loadBookingAndPayment = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        api.bookings.getById(bookingId),
        api.payments.getBookingPayment(Number(bookingId))
      ]);

      if (bRes.success && bRes.data) {
        setBooking(bRes.data);
      } else {
        setError(bRes.error || 'Failed to load booking details.');
      }

      if (pRes.success && pRes.data) {
        setPayment(pRes.data.payment);
        setRating(pRes.data.rating);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!booking) return;
    setIsCancelling(true);
    const res = await api.bookings.cancel(booking.id);
    setIsCancelling(false);
    setIsCancelModalOpen(false);

    if (res.success && res.data) {
      setBooking(res.data);
    } else {
      setError(res.error || 'Cancellation failed.');
    }
  };

  


  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setIsSubmittingRating(true);
    const res = await api.payments.rateDriver({
      bookingId: booking.id,
      rating: selectedStars,
      review: reviewText
    });
    setIsSubmittingRating(false);

    if (res.success && res.data) {
      setRating(res.data);
      setRatingSuccess(true);
      setTimeout(() => setRatingSuccess(false), 3000);
    }
  };

  const handleSimulateNextStatus = async () => {
    if (!booking) return;
    const stages: Booking['status'][] = [
      'Searching for Auto',
      'Driver Assigned',
      'Driver Arriving',
      'Ride Started',
      'Ride Completed'
    ];
    const currentIndex = stages.indexOf(booking.status);
    if (currentIndex < stages.length - 1) {
      const nextStatus = stages[currentIndex + 1];
      setIsSimulating(true);
      const res = await api.admin.updateBookingStatus(booking.id, nextStatus);
      setIsSimulating(false);
      if (res.success && res.data) {
        setBooking(res.data);
        loadBookingAndPayment(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-[#0B0B0D] text-white">
        <div className="w-10 h-10 border-4 border-[#C6FF3D] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-[#A1A1AA]">Loading ride tracking...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center bg-[#0B0B0D] text-white">
        <div className="w-12 h-12 bg-rose-950/40 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-800">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Booking Not Found</h2>
        <p className="text-xs text-[#A1A1AA] mb-6">{error || 'Unable to locate this booking.'}</p>
        <button
          onClick={() => navigate('/my-rides')}
          className="px-6 py-2.5 bg-[#C6FF3D] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime"
        >
          Back to My Rides
        </button>
      </div>
    );
  }

  const steps = [
    { label: 'Searching for Auto', desc: 'Looking for nearby drivers' },
    { label: 'Driver Assigned', desc: 'Driver confirmed your ride' },
    { label: 'Driver Arriving', desc: 'Auto is en route to pickup' },
    { label: 'Ride Started', desc: 'On the way to destination' },
    { label: 'Ride Completed', desc: 'Destination reached' }
  ];

  const currentStepIndex = steps.findIndex(s => s.label === booking.status);
  const isCancelled = booking.status === 'Cancelled';
  const isCompleted = booking.status === 'Ride Completed';
  const isPaid =
    payment?.payment_status === 'COMPLETED' &&
    payment?.payment_method !== 'Cash';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 bg-[#0B0B0D] text-white safe-bottom">

      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b border-[#303034]">
        <button
          onClick={() => navigate('/my-rides')}
          className="inline-flex items-center gap-2 text-xs font-bold text-white hover:text-[#C6FF3D] transition-colors px-3 py-2 rounded-xl bg-[#171719] border border-[#303034]"
        >
          <ArrowLeft className="w-4 h-4 text-[#C6FF3D]" />
          <span>Back to All Rides</span>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Pay Online CTA */}
          {isCompleted && !isPaid && !isCancelled && (
            <button
              onClick={() => setIsPayModalOpen(true)}
              className="px-4 py-2 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pay Online (₹{booking.estimated_fare})</span>
            </button>
          )}

          {/* View Receipt */}
          <button
            onClick={() => setIsReceiptModalOpen(true)}
            className="px-3.5 py-2 bg-[#171719] hover:bg-[#202023] text-white text-xs font-bold rounded-xl border border-[#303034] transition-colors flex items-center gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5 text-[#C6FF3D]" />
            <span>View Receipt</span>
          </button>

          {/* Review testing simulation helper */}
          {!isCompleted && !isCancelled && (
            <button
              onClick={handleSimulateNextStatus}
              disabled={isSimulating}
              className="px-3.5 py-2 bg-[#202023] hover:bg-[#26262A] text-white rounded-xl text-xs font-bold border border-[#303034] flex items-center gap-1.5 transition-colors"
              title="Advances ride progression for testing"
            >
              <PlayCircle className="w-3.5 h-3.5 text-[#C6FF3D]" />
              <span>Simulate Next Step</span>
            </button>
          )}

          {/* Cancellation button */}
          {!isCompleted && !isCancelled && (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="px-3.5 py-2 border border-rose-900/60 bg-rose-950/20 text-rose-400 hover:bg-rose-950/40 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Status & Tracking Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">

        {/* Left Column: Live Progress Stepper & Details */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#171719] rounded-3xl p-5 sm:p-8 border border-[#303034] shadow-card space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-[#303034]">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#A1A1AA]">Booking Reference</span>
                <h1 className="text-xl sm:text-2xl font-black text-white font-mono tracking-wider">
                  {booking.booking_reference}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {isPaid ? (
                  <span className="px-3 py-1 bg-emerald-950/40 text-emerald-300 border border-emerald-800 rounded-full font-bold text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Paid Online</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-[#202023] text-[#A1A1AA] border border-[#303034] rounded-full font-bold text-xs">
                    Pay on Arrival
                  </span>
                )}
                <StatusBadge status={booking.status} size="lg" />
              </div>
            </div>

            {/* Visual Stepper */}
            {!isCancelled ? (
              <div className="overflow-x-auto -mx-2 px-2 pb-2 scrollbar-none">
                <div className="min-w-[340px] py-2">
                  <div className="relative">
                    <div className="absolute top-4 sm:top-5 left-4 right-4 sm:left-5 sm:right-5 h-0.5 bg-[#303034] -z-0" />
                    <div
                      className="absolute top-4 sm:top-5 left-4 sm:left-5 h-0.5 bg-[#C6FF3D] transition-all duration-500 -z-0"
                      style={{
                        width: `${Math.max(0, currentStepIndex) / (steps.length - 1) * 90}%`
                      }}
                    />

                    <div className="flex justify-between items-start relative z-10">
                      {steps.map((step, idx) => {
                        const isPast = idx <= currentStepIndex;
                        const isCurrent = idx === currentStepIndex;

                        return (
                          <div key={step.label} className="flex flex-col items-center text-center max-w-[64px] sm:max-w-[80px]">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-[11px] sm:text-xs transition-all shadow-subtle ${
                                isCurrent
                                  ? 'bg-[#C6FF3D] text-[#0B0B0D] ring-4 ring-[#C6FF3D]/20 scale-105 sm:scale-110 font-black'
                                  : isPast
                                  ? 'bg-white text-[#0B0B0D]'
                                  : 'bg-[#202023] border border-[#303034] text-[#A1A1AA]'
                              }`}
                            >
                              {isPast ? (idx < currentStepIndex ? '✓' : idx + 1) : idx + 1}
                            </div>
                            <div className={`mt-2 text-[9px] sm:text-[10px] font-bold leading-tight ${isCurrent ? 'text-[#C6FF3D] font-black' : isPast ? 'text-white' : 'text-[#A1A1AA]'}`}>
                              {step.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-3">
                <XCircle className="w-6 h-6 text-rose-400 flex-shrink-0" />
                <div>
                  <div className="font-bold">This booking has been cancelled</div>
                  <div className="text-[11px] text-rose-400/80 mt-0.5">No cancellation fee was charged. You may book another auto at any time.</div>
                </div>
              </div>
            )}

            {/* Ride Route Card */}
            <div className="p-5 bg-[#202023] rounded-2xl border border-[#303034] space-y-3.5 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#C6FF3D] mt-1 flex-shrink-0 ring-4 ring-[#C6FF3D]/20" />
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-[#A1A1AA] uppercase">Pickup Location</div>
                  <div className="font-bold text-white text-sm">{booking.pickup_address}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 bg-white mt-1 flex-shrink-0 ring-4 ring-white/20 rounded-xs" />
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-[#A1A1AA] uppercase">Destination</div>
                  <div className="font-bold text-white text-sm">{booking.destination_address}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#303034]">
                <div>
                  <div className="text-[10px] font-bold text-[#A1A1AA] uppercase">Date & Time</div>
                  <div className="font-semibold text-white">
                    {new Date(booking.pickup_datetime).toLocaleDateString()} {new Date(booking.pickup_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[#A1A1AA] uppercase">Passengers</div>
                  <div className="font-semibold text-white">{booking.passengers} Passenger(s)</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[#A1A1AA] uppercase">Fixed Route Fare</div>
                  <div className="font-black text-[#C6FF3D] text-base">₹{booking.estimated_fare}</div>
                </div>
              </div>
            </div>

            {/* Assigned Driver Card */}
            {booking.auto_number && (
              <div className="p-5 bg-[#202023] rounded-2xl border border-[#303034] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white uppercase flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-[#C6FF3D]" />
                    <span>Assigned Auto Driver</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#C6FF3D]/10 text-[#C6FF3D] text-[10px] font-bold border border-[#C6FF3D]/30">
                    Verified Driver
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-black text-white">{booking.driver_name || 'Ramesh Kumar'}</div>
                    <div className="text-xs text-[#A1A1AA] font-medium">{booking.auto_model || 'Bajaj Compact 4S'}</div>
                  </div>

                  <div className="text-right">
                    <div className="px-3 py-1 bg-[#171719] text-[#C6FF3D] border border-[#303034] font-black rounded-lg text-xs font-mono uppercase tracking-wider">
                      {booking.auto_number}
                    </div>
                  </div>
                </div>

                {booking.driver_mobile && (
                  <div className="pt-2 flex items-center justify-between text-xs border-t border-[#303034]">
                    <span className="text-[#A1A1AA] font-semibold">Contact: {booking.driver_mobile}</span>
                    <a
                      href={`tel:${booking.driver_mobile}`}
                      className="px-3 py-1.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] rounded-lg font-black text-[11px] flex items-center gap-1.5 transition-colors shadow-subtle"
                    >
                      <Phone className="w-3 h-3 text-[#0B0B0D]" />
                      <span>Call Driver</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* RATE DRIVER SECTION */}
            {isCompleted && (
              <div className="p-6 bg-[#202023] rounded-2xl border border-[#303034] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Star className="w-4 h-4 text-[#C6FF3D] fill-[#C6FF3D]" />
                    <span>Rate Your Driver</span>
                  </h3>
                  {rating && (
                    <span className="text-xs font-bold text-[#C6FF3D]">✓ Submitted</span>
                  )}
                </div>

                {rating ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-5 h-5 ${
                            star <= rating.rating
                              ? 'text-[#C6FF3D] fill-[#C6FF3D]'
                              : 'text-[#303034]'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold ml-2 text-white">
                        {rating.rating} / 5 Stars
                      </span>
                    </div>
                    {rating.review && (
                      <p className="text-xs text-[#A1A1AA] italic">"{rating.review}"</p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSubmitRating} className="space-y-3">
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSelectedStars(star)}
                          className="p-1 transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= selectedStars
                                ? 'text-[#C6FF3D] fill-[#C6FF3D]'
                                : 'text-[#303034]'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold ml-2 text-white">
                        {selectedStars} Star{selectedStars > 1 ? 's' : ''}
                      </span>
                    </div>

                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Write optional review comments for this trip..."
                      className="w-full px-3 py-2 text-xs bg-[#171719] border border-[#303034] rounded-xl text-white placeholder-[#71717A] focus:outline-none focus:border-[#C6FF3D]"
                      rows={2}
                    />

                    <button
                      type="submit"
                      disabled={isSubmittingRating}
                      className="px-4 py-2 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime flex items-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmittingRating ? 'Submitting...' : 'Submit Rating'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Tracking Map */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#171719] rounded-3xl p-5 border border-[#303034] shadow-card space-y-4 overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-[#303034]">
              <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                <Navigation className="w-4 h-4 text-[#C6FF3D]" />
                <span>Live Route Tracking</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30 text-[10px] font-bold">
                GPS Active
              </span>
            </div>

            {/* Map Canvas with overlay badge */}
            <div className="relative w-full h-52 sm:h-56 rounded-2xl overflow-hidden border border-[#303034] bg-[#202023]">
              <div ref={mapContainerRef} className="w-full h-full" />

              {/* Floating "Driver is nearby" pill */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-3 z-10 px-3.5 py-1.5 rounded-full bg-[#0B0B0D]/90 border border-[#303034] text-white text-xs font-bold shadow-elevated flex items-center gap-2 whitespace-nowrap max-w-[90%] backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-[#C6FF3D] animate-ping flex-shrink-0" />
                <span className="truncate">Auto driver en route</span>
              </div>
            </div>

            {/* Driver Profile Card */}
            <div className="p-4 bg-[#202023] rounded-2xl border border-[#303034] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#171719] border border-[#303034] text-[#C6FF3D] font-black text-lg flex items-center justify-center">
                  {(booking.driver_name || 'Ramesh').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-black text-white text-sm">{booking.driver_name || 'Ramesh'}</div>
                  <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA] font-medium">
                    <span className="text-[#C6FF3D] font-bold">4.8 ★</span>
                    <span>•</span>
                    <span className="font-mono text-[11px] font-bold text-white">Auto • {booking.auto_number || 'AP 39 XX 1234'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {booking.driver_mobile && (
                  <a
                    href={`tel:${booking.driver_mobile}`}
                    className="w-9 h-9 rounded-full bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] flex items-center justify-center transition-transform hover:scale-105 shadow-subtle"
                    title="Call Driver"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Fare Guarantee Card */}
          <div className="bg-[#171719] rounded-3xl p-6 border border-[#303034] shadow-card space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#303034]">
              <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#C6FF3D]" />
                <span>Verified Route Fare</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30 text-[10px] font-bold">
                Fixed Rate
              </span>
            </div>

            <div className="p-4 bg-[#202023] rounded-2xl border border-[#303034] space-y-3">
              <div className="text-xs font-bold text-white">
                Route: {booking.pickup_address} → {booking.destination_address}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[#A1A1AA]">Total Fare:</span>
                <span className="text-2xl font-black text-[#C6FF3D]">₹{booking.estimated_fare}</span>
              </div>
              <div className="text-[11px] text-[#A1A1AA]">
                Direct fixed point-to-point auto fare from Clik2Go verified fare schedule.
              </div>
            </div>

            {/* Payment status pill */}
            <div className="p-3.5 rounded-2xl bg-[#202023] border border-[#303034] flex items-center justify-between text-xs">
              <span className="font-semibold text-[#A1A1AA]">Payment Status:</span>
              {isPaid ? (
                <span className="font-black text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Paid ({payment?.payment_method || 'UPI'})</span>
                </span>
              ) : isCompleted && !isCancelled ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPaymentTab('online');
                      setIsPayModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black rounded-lg text-xs shadow-glow-lime flex items-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay Online</span>
                  </button>
                  <button
                    onClick={() => {
                      setPaymentTab('cash');
                      setIsPayModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-[#171719] hover:bg-[#202023] text-white border border-[#303034] font-bold rounded-lg text-xs flex items-center gap-1.5"
                  >
                    <IndianRupee className="w-3.5 h-3.5 text-[#C6FF3D]" />
                    <span>Cash</span>
                  </button>
                </div>
              ) : (
                <span className="font-semibold text-[#A1A1AA]">
                  Payment after ride
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs text-[#A1A1AA]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#C6FF3D]" />
                <span>No meter haggling or surge pricing</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#C6FF3D]" />
                <span>Doorstep pickup by verified auto driver</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#C6FF3D]" />
                <span>Split payment recorded with driver & owner</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAY ONLINE & CASH MODAL */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#171719] rounded-3xl p-6 sm:p-7 max-w-md w-full max-h-[92dvh] overflow-y-auto shadow-2xl border border-[#303034] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#303034]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#C6FF3D]" />
                <h3 className="text-base font-black text-white">Ride Payment</h3>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="text-[#A1A1AA] hover:text-white text-base p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Fare Summary */}
            <div className="p-3.5 bg-[#202023] rounded-2xl border border-[#303034] space-y-1.5 text-xs">
              <div className="flex justify-between font-bold text-white truncate">
                <span className="truncate">{booking.pickup_address} → {booking.destination_address}</span>
              </div>
              <div className="flex justify-between items-baseline text-base font-black text-white">
                <span className="text-xs text-[#A1A1AA] font-semibold">Total Fare:</span>
                <span className="text-[#C6FF3D] text-xl font-black">₹{booking.estimated_fare}</span>
              </div>
            </div>

            {/* Payment Method Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#202023] rounded-2xl border border-[#303034]">
              <button
                type="button"
                onClick={() => setPaymentTab('online')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  paymentTab === 'online'
                    ? 'bg-[#C6FF3D] text-[#0B0B0D] shadow-glow-lime-sm'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay Online (UPI)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentTab('cash')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  paymentTab === 'cash'
                    ? 'bg-[#C6FF3D] text-[#0B0B0D] shadow-glow-lime-sm'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Pay Cash</span>
              </button>
            </div>

            {/* TAB 1: Pay Online via Driver's UPI QR */}
            {paymentTab === 'online' && (
              <div className="space-y-4 animate-fade-in">
                {/* Fare Summary Card */}
                <div className="p-4 bg-[#202023] rounded-2xl border border-[#303034] text-center space-y-1">
                  <div className="text-xs text-[#A1A1AA]">Fare to Pay to Driver:</div>
                  <div className="text-3xl font-black text-[#C6FF3D]">₹{booking.estimated_fare}</div>
                  <div className="text-[11px] text-[#71717A]">Pre-encoded in Driver's UPI QR Code</div>
                </div>

                {/* Step-by-Step UPI Scanning Instructions */}
                <div className="p-3.5 bg-[#202023] rounded-2xl border border-[#303034] text-xs text-[#A1A1AA] space-y-2.5 leading-relaxed">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#C6FF3D]" />
                    <span>How to Pay using any UPI App:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-2 pl-1 text-[11px] text-[#D4D4D8]">
                    <li>
                      Open your preferred UPI app on your phone:
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold text-white">
                        <span className="px-2 py-0.5 rounded-lg bg-[#171719] border border-[#303034]">PhonePe</span>
                        <span className="px-2 py-0.5 rounded-lg bg-[#171719] border border-[#303034]">Google Pay</span>
                        <span className="px-2 py-0.5 rounded-lg bg-[#171719] border border-[#303034]">Paytm</span>
                        <span className="px-2 py-0.5 rounded-lg bg-[#171719] border border-[#303034]">BHIM</span>
                        <span className="px-2 py-0.5 rounded-lg bg-[#171719] border border-[#303034]">Any Bank UPI</span>
                      </div>
                    </li>
                    <li>
                      Tap the in-app <strong className="text-white">Scan QR (📷)</strong> icon on your app's home screen.
                    </li>
                    <li>
                      Point your phone camera at the payment QR code displayed on your auto driver's phone.
                    </li>
                    <li>
                      The exact fare of <strong className="text-[#C6FF3D]">₹{booking.estimated_fare}</strong> will appear automatically. Authorize payment with your UPI PIN.
                    </li>
                    <li>
                      Your driver will verify the bank credit and confirm payment on their device.
                    </li>
                  </ol>
                </div>

                {/* Driver Info Pill */}
                <div className="p-3 rounded-xl bg-[#202023] border border-[#303034] text-center text-xs space-y-0.5">
                  <div className="text-[#A1A1AA]">Assigned Driver: <strong className="text-white">{booking.driver_name || 'Driver'}</strong></div>
                  <div className="text-[11px] text-[#71717A] font-mono">Ride Reference: {booking.booking_reference || `#${booking.id}`}</div>
                </div>
              </div>
            )}

            {/* TAB 2: Pay Cash */}
            {paymentTab === 'cash' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 bg-[#202023] rounded-2xl border border-[#303034] text-center space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-[#171719] border border-[#303034] text-[#C6FF3D] font-black text-xl flex items-center justify-center mx-auto">
                    ₹
                  </div>
                  <div className="text-xs text-[#A1A1AA]">Cash Amount to Hand Over:</div>
                  <div className="text-2xl font-black text-[#C6FF3D]">₹{booking.estimated_fare}</div>
                </div>

                <div className="p-3.5 bg-[#202023] rounded-2xl border border-[#303034] text-xs text-[#A1A1AA] space-y-2 leading-relaxed">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#C6FF3D]" />
                    <span>Cash Payment Steps:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px]">
                    <li>Hand <strong className="text-[#C6FF3D]">₹{booking.estimated_fare}</strong> directly to your driver.</li>
                    <li>Your driver will tap "Payment Received" on their phone to confirm.</li>
                    <li>Your ride receipt will be automatically unlocked here.</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Verification Status Banner */}
            <div className="p-2.5 bg-[#202023]/60 rounded-xl border border-[#303034] flex items-center justify-center gap-2 text-[11px] text-[#A1A1AA]">
              <span className="w-2 h-2 rounded-full bg-[#C6FF3D] animate-ping flex-shrink-0" />
              <span>Awaiting driver confirmation upon payment</span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW RECEIPT MODAL */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#303034] space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#303034]">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#C6FF3D]" />
                <h3 className="text-base font-black text-white">Clik2Go Tax Invoice</h3>
              </div>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-[#A1A1AA] hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-[#A1A1AA]">
                <span>Receipt No:</span>
                <span className="font-mono font-bold text-white">{payment?.transaction_reference || 'RECEIPT-C2G-' + booking.id}</span>
              </div>
              <div className="flex justify-between text-[#A1A1AA]">
                <span>Booking ID:</span>
                <span className="font-mono font-bold text-white">{booking.booking_reference}</span>
              </div>
              <div className="flex justify-between text-[#A1A1AA]">
                <span>Date:</span>
                <span className="font-medium text-white">{new Date(booking.pickup_datetime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#A1A1AA]">
                <span>Pickup → Drop:</span>
                <span className="font-bold text-white">{booking.pickup_address} → {booking.destination_address}</span>
              </div>
              <div className="flex justify-between text-[#A1A1AA]">
                <span>Payment Mode:</span>
                <span className="font-bold text-white">{payment?.payment_method || 'Cash / Post-Ride'}</span>
              </div>

              <div className="pt-3 border-t border-[#303034] space-y-2">
                <div className="flex justify-between text-[#A1A1AA]">
                  <span>Driver Base Fare:</span>
                  <span>₹{payment?.driver_amount ?? Math.max(0, booking.estimated_fare - 5)}</span>
                </div>
                <div className="flex justify-between text-[#A1A1AA]">
                  <span>Platform Commission & Tech Fee:</span>
                  <span>₹{payment?.owner_amount ?? 5}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-[#303034]">
                  <span>Total Paid:</span>
                  <span className="text-[#C6FF3D]">₹{booking.estimated_fare}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsReceiptModalOpen(false)}
              className="w-full py-3 bg-[#202023] hover:bg-[#26262A] text-white border border-[#303034] font-bold text-xs rounded-xl"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}

      {/* Cancellation Dialog */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelBooking}
        title="Cancel this Booking?"
        message="Are you sure you want to cancel your auto booking? Your driver request will be dismissed and marked as cancelled."
        confirmText="Yes, Cancel Booking"
        cancelText="Keep Ride"
        confirmVariant="danger"
        isLoading={isCancelling}
      />
    </div>
  );
};

