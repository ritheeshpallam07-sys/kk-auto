import React, { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';

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
  const [isPaying, setIsPaying] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('UPI');

  // Rating state
  const [selectedStars, setSelectedStars] = useState<number>(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);

  // Status simulation for testing
  const [isSimulating, setIsSimulating] = useState(false);

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

  const handleProcessPayment = async () => {
    if (!booking) return;
    setIsPaying(true);
    const res = await api.payments.sandboxPay({
      bookingId: booking.id,
      paymentMethod: selectedPaymentMethod
    });
    setIsPaying(false);
    setIsPayModalOpen(false);

    if (res.success && res.data) {
      setPayment(res.data);
      loadBookingAndPayment(false);
    } else {
      setError(res.error || 'Payment failed.');
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
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading ride tracking...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Booking Not Found</h2>
        <p className="text-xs text-slate-600 mb-6">{error || 'Unable to locate this booking.'}</p>
        <button
          onClick={() => navigate('/my-rides')}
          className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl"
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
  const isPaid = payment?.payment_status === 'COMPLETED';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/my-rides')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Rides</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pay Online CTA */}
          {!isPaid && !isCancelled && (
            <button
              onClick={() => setIsPayModalOpen(true)}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-transform hover:scale-105 flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pay Online (₹{booking.estimated_fare})</span>
            </button>
          )}

          {/* View Receipt */}
          <button
            onClick={() => setIsReceiptModalOpen(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-600" />
            <span>View Receipt</span>
          </button>

          {/* Review testing simulation helper */}
          {!isCompleted && !isCancelled && (
            <button
              onClick={handleSimulateNextStatus}
              disabled={isSimulating}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Advances ride progression for quick testing"
            >
              <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Next Step</span>
            </button>
          )}

          {/* Cancellation button */}
          {!isCompleted && !isCancelled && (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Status & Tracking Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Live Progress Stepper & Details */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Booking Reference</span>
                <h1 className="text-2xl font-black text-slate-900 font-mono tracking-wider">
                  {booking.booking_reference}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {isPaid ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Paid Online</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full font-bold text-xs">
                    Pay on Arrival
                  </span>
                )}
                <StatusBadge status={booking.status} size="lg" />
              </div>
            </div>

            {/* Visual Stepper */}
            {!isCancelled ? (
              <div className="py-2">
                <div className="relative">
                  <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-200 -z-0" />
                  <div 
                    className="absolute top-5 left-5 h-0.5 bg-amber-400 transition-all duration-500 -z-0"
                    style={{ 
                      width: `${Math.max(0, currentStepIndex) / (steps.length - 1) * 90}%` 
                    }}
                  />

                  <div className="flex justify-between items-start relative z-10">
                    {steps.map((step, idx) => {
                      const isPast = idx <= currentStepIndex;
                      const isCurrent = idx === currentStepIndex;

                      return (
                        <div key={step.label} className="flex flex-col items-center text-center max-w-[80px]">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-sm ${
                              isCurrent
                                ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-100 scale-110'
                                : isPast
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white border-2 border-slate-300 text-slate-400'
                            }`}
                          >
                            {isPast ? (idx < currentStepIndex ? '✓' : idx + 1) : idx + 1}
                          </div>
                          <div className={`mt-2 text-[10px] font-bold leading-tight ${isCurrent ? 'text-amber-700' : isPast ? 'text-slate-900' : 'text-slate-400'}`}>
                            {step.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
                <XCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
                <div>
                  <div className="font-bold">This booking has been cancelled</div>
                  <div className="text-[11px] text-rose-600 mt-0.5">No charges were deducted. You may book another auto at any time.</div>
                </div>
              </div>
            )}

            {/* Ride Route Card */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3.5 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Pickup Location</div>
                  <div className="font-bold text-slate-800 text-sm">{booking.pickup_address}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Destination</div>
                  <div className="font-bold text-slate-800 text-sm">{booking.destination_address}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200/80">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Date & Time</div>
                  <div className="font-semibold text-slate-800">
                    {new Date(booking.pickup_datetime).toLocaleDateString()} {new Date(booking.pickup_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Passengers</div>
                  <div className="font-semibold text-slate-800">{booking.passengers} Passenger(s)</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Fixed Route Fare</div>
                  <div className="font-extrabold text-amber-600 text-base">₹{booking.estimated_fare}</div>
                </div>
              </div>
            </div>

            {/* Assigned Driver Card */}
            {booking.auto_number && (
              <div className="p-5 bg-gradient-to-r from-amber-50 to-amber-100/50 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-amber-700" />
                    <span>Assigned Auto Driver</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Verified Driver
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-black text-slate-900">{booking.driver_name || 'Ramesh Kumar'}</div>
                    <div className="text-xs text-slate-600">{booking.auto_model || 'Bajaj Compact 4S'}</div>
                  </div>

                  <div className="text-right">
                    <div className="px-3 py-1 bg-amber-400 text-slate-950 font-black rounded-lg text-xs font-mono uppercase tracking-wider">
                      {booking.auto_number}
                    </div>
                  </div>
                </div>

                {booking.driver_mobile && (
                  <div className="pt-2 flex items-center justify-between text-xs border-t border-amber-200/80">
                    <span className="text-slate-600">Contact: {booking.driver_mobile}</span>
                    <a
                      href={`tel:${booking.driver_mobile}`}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call Driver</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* RATE DRIVER SECTION (When completed) */}
            {isCompleted && (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>Rate Your Driver</span>
                  </h3>
                  {rating && (
                    <span className="text-xs font-bold text-emerald-700">✓ Submitted</span>
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
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold ml-2 text-slate-800">
                        {rating.rating} / 5 Stars
                      </span>
                    </div>
                    {rating.review && (
                      <p className="text-xs text-slate-600 italic">"{rating.review}"</p>
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
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold ml-2 text-slate-700">
                        {selectedStars} Star{selectedStars > 1 ? 's' : ''}
                      </span>
                    </div>

                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Write optional review comments for this trip..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                      rows={2}
                    />

                    <button
                      type="submit"
                      disabled={isSubmittingRating}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-transform hover:scale-102 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isSubmittingRating ? 'Submitting...' : 'Submit Rating'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Fare Guarantee & Receipt Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-extrabold uppercase text-slate-900 tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Route Fare</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Fixed Rate
              </span>
            </div>

            <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 space-y-3">
              <div className="text-xs font-bold text-amber-900">
                Route: {booking.pickup_address} → {booking.destination_address}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-600">Total Fare:</span>
                <span className="text-2xl font-black text-slate-900">₹{booking.estimated_fare}</span>
              </div>
              <div className="text-[11px] text-slate-500 italic">
                Direct fixed point-to-point auto-rickshaw fare from Kk_Auto verified fare schedule.
              </div>
            </div>

            {/* Payment status pill */}
            <div className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">Payment Status:</span>
              {isPaid ? (
                <span className="font-black text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Paid ({payment?.payment_method || 'UPI'})</span>
                </span>
              ) : (
                <button
                  onClick={() => setIsPayModalOpen(true)}
                  className="px-3 py-1 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                >
                  Pay Online
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>No meter tampering or surge pricing</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Doorstep pickup by verified auto driver</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Split payment recorded with driver & owner</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAY ONLINE MODAL */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-black text-slate-900">Pay Online</h3>
              </div>
              <button onClick={() => setIsPayModalOpen(false)} className="text-slate-400 hover:text-slate-800">✕</button>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Trip: {booking.pickup_address} → {booking.destination_address}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900">
                <span>Total Amount:</span>
                <span className="text-amber-600">₹{booking.estimated_fare}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-slate-700">Select Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {['UPI', 'Card', 'NetBanking'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                      selectedPaymentMethod === method
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl">
              Simulated sandbox gateway with server-side marketplace split calculation (Driver cut + Owner commission).
            </div>

            <button
              onClick={handleProcessPayment}
              disabled={isPaying}
              className="w-full py-3.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm rounded-xl shadow-md transition-transform hover:scale-102 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPaying ? (
                <span>Processing Payment...</span>
              ) : (
                <>
                  <span>Confirm & Pay ₹{booking.estimated_fare}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* VIEW RECEIPT MODAL */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-slate-900" />
                <h3 className="text-base font-black text-slate-900">Kk_Auto Tax Invoice</h3>
              </div>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-800">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Receipt No:</span>
                <span className="font-mono font-bold text-slate-900">{payment?.transaction_reference || 'RECEIPT-KK-' + booking.id}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Booking ID:</span>
                <span className="font-mono font-bold text-slate-900">{booking.booking_reference}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Date:</span>
                <span className="font-medium text-slate-800">{new Date(booking.pickup_datetime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Pickup → Drop:</span>
                <span className="font-bold text-slate-900">{booking.pickup_address} → {booking.destination_address}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Payment Mode:</span>
                <span className="font-bold text-slate-900">{payment?.payment_method || 'Cash / Post-Ride'}</span>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Driver Base Fare:</span>
                  <span>₹{payment?.driver_amount ?? Math.max(0, booking.estimated_fare - 5)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Platform Commission & Tech Fee:</span>
                  <span>₹{payment?.owner_amount ?? 5}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Paid:</span>
                  <span className="text-amber-600">₹{booking.estimated_fare}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsReceiptModalOpen(false)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl"
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
