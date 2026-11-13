import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, SupportTicket, SupportMessage, SupportConfig, Booking } from '../api/client';
import {
  LifeBuoy,
  MessageSquare,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  MessageCircle,
  Mail,
  ArrowLeft,
  Send,
  Loader2,
  Calendar,
  Car,
  ChevronRight,
  ShieldCheck,
  Info
} from 'lucide-react';

interface SupportPageProps {
  navigate: (path: string) => void;
}

const CUSTOMER_CATEGORIES = [
  'Booking Issue',
  'Driver Issue',
  'Payment Issue',
  'Cancellation Issue',
  'Refund Query',
  'Account/Login Issue',
  'App Technical Issue',
  'Other'
];

const DRIVER_CATEGORIES = [
  'Booking/Trip Issue',
  'Customer Issue',
  'Payment Issue',
  'Account Verification',
  'Document Issue',
  'App Technical Issue',
  'Other'
];

export const SupportPage: React.FC<SupportPageProps> = ({ navigate }) => {
  const { user, isDriver, isAdmin } = useAuth();

  // Support Config (Phone, WhatsApp, Email)
  const [supportConfig, setSupportConfig] = useState<SupportConfig>({
    email: 'supportclik2go@gmail.com',
    phone: null,
    whatsapp: null,
    phoneConfigured: false,
    whatsappConfigured: false
  });

  // Ticket states
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([]);
  const [linkedBooking, setLinkedBooking] = useState<any | null>(null);

  // Recent bookings for attachment
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);

  // Form states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newCategory, setNewCategory] = useState<string>('');
  const [newSubject, setNewSubject] = useState<string>('');
  const [newMessage, setNewMessage] = useState<string>('');
  const [newBookingId, setNewBookingId] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');

  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If admin opens /support, offer redirect to Owner console
  useEffect(() => {
    if (isAdmin) {
      navigate('/owner/dashboard');
    }
  }, [isAdmin, navigate]);

  // Load support configuration
  useEffect(() => {
    api.support.getConfig()
      .then((res) => {
        if (res.success && res.data) {
          setSupportConfig(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // Load tickets and user's recent bookings
  const loadUserTickets = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.support.getTickets();
      if (res.success && Array.isArray(res.data)) {
        setTickets(res.data);
      }
      // Fetch recent bookings for dropdown attachment
      const bRes = await api.bookings.getMyBookings();
      if (bRes.success && bRes.data) {
        setRecentBookings(bRes.data.slice(0, 10));
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load support tickets.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserTickets();
  }, [user]);

  // Load ticket details when selected
  const loadTicketDetails = async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.support.getTicketDetails(id);
      if (res.success && res.data) {
        setSelectedTicket(res.data.ticket);
        setTicketMessages(res.data.messages);
        setLinkedBooking(res.data.booking || null);
        setSelectedTicketId(id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load ticket conversation.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Ticket Submission
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory || !newSubject.trim() || !newMessage.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.support.createTicket({
        category: newCategory,
        subject: newSubject.trim(),
        message: newMessage.trim(),
        bookingId: newBookingId ? Number(newBookingId) : undefined
      });

      if (res.success && res.data) {
        setSuccessMessage('Support ticket created successfully. Our team will review and reply shortly.');
        setShowCreateModal(false);
        setNewCategory('');
        setNewSubject('');
        setNewMessage('');
        setNewBookingId('');
        await loadUserTickets();
        setSelectedTicketId(res.data.id);
        await loadTicketDetails(res.data.id);
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setError(res.error || 'Failed to submit ticket.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reply Submission
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyText.trim()) return;

    setIsSendingReply(true);
    setError(null);

    try {
      const res = await api.support.addMessage(selectedTicketId, replyText.trim());
      if (res.success && res.data) {
        setReplyText('');
        // Reload ticket details to update status and message list
        await loadTicketDetails(selectedTicketId);
        // Refresh ticket summary in background
        api.support.getTickets().then((r) => {
          if (r.success && Array.isArray(r.data)) setTickets(r.data);
        });
      } else {
        setError(res.error || 'Failed to send reply.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to send reply.');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Build Safe WhatsApp URI
  const getWhatsAppUri = (ticketRef?: string) => {
    if (!supportConfig.whatsapp) return '#';
    const text = ticketRef
      ? `Hello Clik2Go Support, I am following up on my support ticket #${ticketRef}.`
      : `Hello Clik2Go Support, I need assistance with my ${isDriver ? 'driver account' : 'ride booking'}.`;
    return `https://wa.me/91${supportConfig.whatsapp}?text=${encodeURIComponent(text)}`;
  };

  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">Open</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">In Progress</span>;
      case 'WAITING_FOR_USER':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30">Action Needed</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Resolved</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#303034] text-[#A1A1AA] border border-[#303034]">Closed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#202023] text-white">{status}</span>;
    }
  };

  const categories = isDriver ? DRIVER_CATEGORIES : CUSTOMER_CATEGORIES;

  // =========================================================================
  // VIEW 1: PUBLIC / GUEST SUPPORT (When accessed without login)
  // =========================================================================
  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#0B0B0D] text-white p-4 sm:p-6 lg:p-8 safe-bottom">
        <div className="max-w-4xl mx-auto space-y-8 py-4">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#171719] border border-[#303034] text-[11px] font-bold text-[#C6FF3D]">
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Clik2Go Help & Support</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              How Can We Help You?
            </h1>
            <p className="text-sm text-[#A1A1AA] max-w-lg mx-auto leading-relaxed">
              Find quick answers, contact our 24/7 support channels, or sign in to open an in-app support ticket with our local team.
            </p>
          </div>

          {/* Contact Fallback Channels */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Email Support */}
            <a
              href={`mailto:${supportConfig.email || 'supportclik2go@gmail.com'}`}
              className="p-5 bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/40 rounded-2xl flex flex-col justify-between transition-all group shadow-card"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#202023] group-hover:bg-[#C6FF3D]/10 text-[#C6FF3D] flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-[#C6FF3D] transition-colors">Official Email</h3>
                  <p className="text-xs text-[#A1A1AA] mt-0.5">24/7 Support Desk</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#303034] text-xs font-mono text-white truncate">
                {supportConfig.email || 'supportclik2go@gmail.com'}
              </div>
            </a>

            {/* WhatsApp Support */}
            {supportConfig.whatsappConfigured ? (
              <a
                href={getWhatsAppUri()}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-emerald-500/40 rounded-2xl flex flex-col justify-between transition-all group shadow-card"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">WhatsApp Chat</h3>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">Instant Chat Support</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#303034] text-xs font-bold text-emerald-400 flex items-center justify-between">
                  <span>Chat on WhatsApp</span>
                  <span>↗</span>
                </div>
              </a>
            ) : (
              <div className="p-5 bg-[#171719] border border-[#303034] rounded-2xl flex flex-col justify-between opacity-80 shadow-card">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#202023] text-[#A1A1AA] flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">WhatsApp Chat</h3>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">Direct Messaging</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#303034] text-xs text-[#71717A] italic">
                  Not configured yet
                </div>
              </div>
            )}

            {/* Phone Call Support */}
            {supportConfig.phoneConfigured ? (
              <a
                href={`tel:${supportConfig.phone}`}
                className="p-5 bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#4285F4]/40 rounded-2xl flex flex-col justify-between transition-all group shadow-card"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#4285F4]/10 text-[#4285F4] flex items-center justify-center">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-[#4285F4] transition-colors">Helpline Call</h3>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">Emergency & Booking Helpline</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#303034] text-xs font-bold text-[#4285F4] flex items-center justify-between">
                  <span>Call Support</span>
                  <span>↗</span>
                </div>
              </a>
            ) : (
              <div className="p-5 bg-[#171719] border border-[#303034] rounded-2xl flex flex-col justify-between opacity-80 shadow-card">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#202023] text-[#A1A1AA] flex items-center justify-center">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Helpline Call</h3>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">Phone Assistance</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#303034] text-xs text-[#71717A] italic">
                  Not configured yet
                </div>
              </div>
            )}
          </div>

          {/* Action Card: Sign in to manage tickets */}
          <div className="p-6 sm:p-8 bg-gradient-to-br from-[#171719] to-[#202023] border border-[#303034] rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left">
              <h2 className="text-xl font-bold text-white">Have an account or ride issue?</h2>
              <p className="text-xs sm:text-sm text-[#A1A1AA] max-w-md">
                Log in to open tracked in-app support tickets, view full conversation histories, and coordinate directly with our team.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-6 py-3 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs uppercase tracking-wider rounded-xl shadow-glow-lime transition-all active:scale-95"
              >
                Log In to Clik2Go
              </button>
            </div>
          </div>

          {/* Common FAQs */}
          <div className="space-y-4 pt-4">
            <h2 className="text-base font-bold text-white">Frequently Asked Questions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#171719] border border-[#303034] rounded-2xl space-y-1.5">
                <h3 className="font-bold text-white">How do fixed fares work?</h3>
                <p className="text-[#A1A1AA] leading-relaxed">
                  Clik2Go fares are point-to-point and fixed by the local Auto Union committee. The fare shown at booking time is exactly what you pay.
                </p>
              </div>
              <div className="p-4 bg-[#171719] border border-[#303034] rounded-2xl space-y-1.5">
                <h3 className="font-bold text-white">How do I pay my driver?</h3>
                <p className="text-[#A1A1AA] leading-relaxed">
                  Pay directly via Google Pay/PhonePe QR or in cash upon reaching your destination. The driver will confirm receipt on their phone to unlock your receipt.
                </p>
              </div>
              <div className="p-4 bg-[#171719] border border-[#303034] rounded-2xl space-y-1.5">
                <h3 className="font-bold text-white">Can I cancel my ride?</h3>
                <p className="text-[#A1A1AA] leading-relaxed">
                  Yes, rides can be cancelled freely while searching or before the driver starts the trip. Once a ride is started, it cannot be cancelled.
                </p>
              </div>
              <div className="p-4 bg-[#171719] border border-[#303034] rounded-2xl space-y-1.5">
                <h3 className="font-bold text-white">How do drivers get approved?</h3>
                <p className="text-[#A1A1AA] leading-relaxed">
                  Registered auto drivers submit vehicle details and licenses, which are verified by our operations team before ride dispatch is enabled.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: AUTHENTICATED TICKET DETAIL & CONVERSATION
  // =========================================================================
  if (selectedTicketId && selectedTicket) {
    const isClosed = selectedTicket.status === 'CLOSED';

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#0B0B0D] text-white p-4 sm:p-6 lg:p-8 safe-bottom">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between pb-2 border-b border-[#303034]">
            <button
              type="button"
              onClick={() => {
                setSelectedTicketId(null);
                setSelectedTicket(null);
                setTicketMessages([]);
                setLinkedBooking(null);
              }}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#A1A1AA] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Tickets</span>
            </button>

            <div className="flex items-center gap-2">
              {getStatusBadge(selectedTicket.status)}
              <span className="text-[11px] font-mono text-[#71717A]">
                {selectedTicket.ticket_reference}
              </span>
            </div>
          </div>

          {/* Ticket Header Card */}
          <div className="p-5 sm:p-6 bg-[#171719] border border-[#303034] rounded-3xl space-y-4 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-[11px] text-[#A1A1AA]">
                  <span className="px-2 py-0.5 rounded-md bg-[#202023] border border-[#303034] font-medium text-white">
                    {selectedTicket.category}
                  </span>
                  <span>• Priority: <strong className="text-white">{selectedTicket.priority}</strong></span>
                  <span>• Opened: {new Date(selectedTicket.created_at).toLocaleDateString()}</span>
                </div>
                <h1 className="text-xl font-black text-white">{selectedTicket.subject}</h1>
              </div>

              {/* Quick WhatsApp Escalate Button */}
              {supportConfig.whatsappConfigured && (
                <a
                  href={getWhatsAppUri(selectedTicket.ticket_reference)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-auto transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Escalate to WhatsApp</span>
                </a>
              )}
            </div>

            {/* Linked Booking pill if applicable */}
            {linkedBooking && (
              <div className="p-3 bg-[#202023] border border-[#303034] rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#171719] text-[#C6FF3D] flex items-center justify-center flex-shrink-0">
                    <Car className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <span className="text-[#A1A1AA]">Associated Ride: </span>
                    <strong className="text-white">{linkedBooking.booking_reference}</strong>
                    <span className="text-[#71717A] ml-2">({linkedBooking.pickup_address} → {linkedBooking.destination_address})</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/booking/${linkedBooking.id}`)}
                  className="text-xs font-bold text-[#C6FF3D] hover:underline flex-shrink-0"
                >
                  View Ride
                </button>
              </div>
            )}
          </div>

          {/* Conversation Feed */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA] px-1">
              Conversation Thread
            </h2>

            <div className="space-y-3.5">
              {ticketMessages.map((msg) => {
                const isAdminMsg = msg.sender_role === 'admin';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAdminMsg ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-[#71717A]">
                      <span className="font-bold text-[#A1A1AA]">
                        {isAdminMsg ? '🛡️ Clik2Go Support' : msg.sender_name || 'You'}
                      </span>
                      <span>•</span>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      className={`max-w-xl p-4 rounded-3xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                        isAdminMsg
                          ? 'bg-[#1E293B] border border-blue-500/30 text-white rounded-tl-sm'
                          : 'bg-[#202023] border border-[#303034] text-white rounded-tr-sm'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reply Form / Closed Status Notice */}
          <div className="pt-4">
            {isClosed ? (
              <div className="p-4 bg-[#171719] border border-[#303034] rounded-2xl flex items-center gap-3 text-xs text-[#A1A1AA]">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="font-bold text-white">This ticket has been marked as Closed.</p>
                  <p className="text-[11px]">If you have an additional question or new issue, please open a new support ticket.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendReply} className="space-y-3">
                <div className="relative">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your response here..."
                    rows={3}
                    maxLength={4000}
                    className="w-full p-4 bg-[#171719] border border-[#303034] focus:border-[#C6FF3D] rounded-2xl text-xs sm:text-sm text-white placeholder-[#71717A] focus:outline-none transition-colors resize-none"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#71717A]">
                    {replyText.length}/4000 characters
                  </span>
                  <button
                    type="submit"
                    disabled={isSendingReply || !replyText.trim()}
                    className="px-5 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] disabled:opacity-50 text-[#0B0B0D] font-black text-xs rounded-xl flex items-center gap-1.5 shadow-glow-lime transition-all active:scale-95"
                  >
                    {isSendingReply ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Reply</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: AUTHENTICATED TICKET DASHBOARD (Customer / Driver)
  // =========================================================================
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0B0B0D] text-white p-4 sm:p-6 lg:p-8 safe-bottom">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#171719] border border-[#303034] text-[11px] font-bold text-[#C6FF3D] mb-1.5">
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>{isDriver ? 'Driver Help Desk' : 'Customer Support'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Support Center
            </h1>
            <p className="text-xs sm:text-sm text-[#A1A1AA]">
              View your open tickets or submit a new inquiry
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-glow-lime transition-all active:scale-95 self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4 text-[#0B0B0D]" />
            <span>New Support Ticket</span>
          </button>
        </div>

        {/* Success / Error Banners */}
        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Support Channels Mini-Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Email */}
          <a
            href={`mailto:${supportConfig.email || 'supportclik2go@gmail.com'}`}
            className="p-3.5 bg-[#171719] hover:bg-[#202023] border border-[#303034] rounded-2xl flex items-center gap-3 transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-[#202023] text-[#C6FF3D] flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-[#A1A1AA]">Email Help</p>
              <p className="text-xs font-bold text-white truncate">{supportConfig.email || 'supportclik2go@gmail.com'}</p>
            </div>
          </a>

          {/* WhatsApp */}
          {supportConfig.whatsappConfigured ? (
            <a
              href={getWhatsAppUri()}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 bg-[#171719] hover:bg-[#202023] border border-[#303034] rounded-2xl flex items-center gap-3 transition-colors"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-[#A1A1AA]">WhatsApp</p>
                <p className="text-xs font-bold text-emerald-400 truncate">Chat with Support ↗</p>
              </div>
            </a>
          ) : (
            <div className="p-3.5 bg-[#171719] border border-[#303034] rounded-2xl flex items-center gap-3 opacity-70">
              <div className="w-8 h-8 rounded-xl bg-[#202023] text-[#71717A] flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-[#71717A]">WhatsApp</p>
                <p className="text-xs text-[#71717A] italic">Not configured yet</p>
              </div>
            </div>
          )}

          {/* Phone Helpline */}
          {supportConfig.phoneConfigured ? (
            <a
              href={`tel:${supportConfig.phone}`}
              className="p-3.5 bg-[#171719] hover:bg-[#202023] border border-[#303034] rounded-2xl flex items-center gap-3 transition-colors"
            >
              <div className="w-8 h-8 rounded-xl bg-[#4285F4]/10 text-[#4285F4] flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-[#A1A1AA]">Helpline Call</p>
                <p className="text-xs font-bold text-[#4285F4] truncate">Call Support ↗</p>
              </div>
            </a>
          ) : (
            <div className="p-3.5 bg-[#171719] border border-[#303034] rounded-2xl flex items-center gap-3 opacity-70">
              <div className="w-8 h-8 rounded-xl bg-[#202023] text-[#71717A] flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-[#71717A]">Helpline Call</p>
                <p className="text-xs text-[#71717A] italic">Not configured yet</p>
              </div>
            </div>
          )}
        </div>

        {/* Tickets List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
              Your Support Tickets ({tickets.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center bg-[#171719] border border-[#303034] rounded-3xl space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#C6FF3D] mx-auto" />
              <p className="text-xs text-[#A1A1AA]">Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-10 text-center bg-[#171719] border border-[#303034] rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#202023] text-[#C6FF3D] flex items-center justify-center mx-auto text-xl">
                🎫
              </div>
              <h3 className="text-base font-bold text-white">No Support Tickets Yet</h3>
              <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                Need help with a booking, payment, or your account? Click below to submit an inquiry to our support desk.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-bold text-xs rounded-xl shadow-glow-lime transition-all inline-flex items-center gap-2"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#0B0B0D]" />
                <span>Open First Ticket</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => loadTicketDetails(t.id)}
                  className="p-4 sm:p-5 bg-[#171719] hover:bg-[#202023] border border-[#303034] hover:border-[#C6FF3D]/40 rounded-3xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-card group"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(t.status)}
                      <span className="text-[10px] font-mono text-[#71717A]">#{t.ticket_reference}</span>
                      <span className="text-[10px] text-[#A1A1AA]">• {t.category}</span>
                    </div>

                    <h3 className="text-sm font-bold text-white group-hover:text-[#C6FF3D] transition-colors truncate">
                      {t.subject}
                    </h3>

                    {t.latest_message && (
                      <p className="text-xs text-[#A1A1AA] truncate max-w-md">
                        {t.latest_message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#303034] text-[11px] text-[#71717A]">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#A1A1AA]" />
                      <span>{t.message_count || 1} msg{(t.message_count || 1) > 1 ? 's' : ''}</span>
                    </div>
                    <span>{new Date(t.updated_at).toLocaleDateString()}</span>
                    <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* CREATE TICKET MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-[#303034] space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#303034]">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-[#C6FF3D]" />
                <h3 className="text-base font-black text-white">New Support Ticket</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[#A1A1AA] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                  Category *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  required
                  className="w-full p-3 bg-[#202023] border border-[#303034] focus:border-[#C6FF3D] rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="">Select an issue category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                  Subject *
                </label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Brief summary of your issue"
                  required
                  maxLength={255}
                  className="w-full p-3 bg-[#202023] border border-[#303034] focus:border-[#C6FF3D] rounded-xl text-xs text-white focus:outline-none placeholder-[#71717A]"
                />
              </div>

              {/* Optional Booking Association */}
              {recentBookings.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                    Related Booking (Optional)
                  </label>
                  <select
                    value={newBookingId}
                    onChange={(e) => setNewBookingId(e.target.value)}
                    className="w-full p-3 bg-[#202023] border border-[#303034] focus:border-[#C6FF3D] rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="">None / Not related to a specific ride</option>
                    {recentBookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.booking_reference} ({b.pickup_address} → {b.destination_address})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                  Detailed Description *
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Please provide details about what happened so our team can resolve it quickly..."
                  required
                  rows={4}
                  maxLength={4000}
                  className="w-full p-3 bg-[#202023] border border-[#303034] focus:border-[#C6FF3D] rounded-xl text-xs text-white focus:outline-none placeholder-[#71717A] resize-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-[#202023] hover:bg-[#26262A] text-[#A1A1AA] hover:text-white rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] disabled:opacity-50 text-[#0B0B0D] font-black text-xs rounded-xl shadow-glow-lime transition-all"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
