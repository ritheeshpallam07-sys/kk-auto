import React, { useState, useEffect } from 'react';
import { 
  api, 
  AdminStats, 
  Booking, 
  FareRoute, 
  DriverAdminDetail, 
  SettlementOverview, 
  PlatformFinancials,
  TripBooking,
  RatingRecord,
  AdminAuditLog,
  SupportTicket,
  SupportTicketDetails
} from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { 
  Shield, 
  Search, 
  Save, 
  Sliders, 
  Users, 
  Car, 
  IndianRupee, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Plus, 
  RefreshCw,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  Percent,
  Trash2,
  ClipboardList,
  Key,
  LifeBuoy,
  MessageSquare,
  Send,
  MessageCircle,
  Clock,
  User,
  X
} from 'lucide-react';

interface AdminDashboardProps {
  navigate: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ navigate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'drivers' | 'settlements' | 'routes' | 'commission' | 'bookings' | 'tripBookings' | 'ratings' | 'deletions' | 'auditLogs' | 'support'>('overview');
  
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [financials, setFinancials] = useState<PlatformFinancials | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tripBookings, setTripBookings] = useState<TripBooking[]>([]);
  const [tripSearchQuery, setTripSearchQuery] = useState('');
  const [tripStatusFilter, setTripStatusFilter] = useState('all');
  const [tripQuoteInputs, setTripQuoteInputs] = useState<Record<number, number>>({});
  const [drivers, setDrivers] = useState<DriverAdminDetail[]>([]);
  const [settlements, setSettlements] = useState<SettlementOverview | null>(null);
  const [driverRatings, setDriverRatings] = useState<RatingRecord[]>([]);
  const [routes, setRoutes] = useState<FareRoute[]>([]);
  const [commissionInput, setCommissionInput] = useState<number>(5);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletionRequests, setDeletionRequests] = useState<Array<{
    id: number;
    user_id: number;
    user_name: string;
    user_role: string;
    user_email: string;
    user_mobile: string;
    reason?: string | null;
    status: 'PENDING' | 'PROCESSED' | 'REJECTED';
    requested_at: string;
    processed_at?: string | null;
    admin_notes?: string | null;
  }>>([]);
  const [isProcessingDeletion, setIsProcessingDeletion] = useState<number | null>(null);

  // Activity Audit Log state
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Support Management state
  const [adminTickets, setAdminTickets] = useState<SupportTicket[]>([]);
  const [adminTicketsTotal, setAdminTicketsTotal] = useState(0);
  const [adminTicketsPage, setAdminTicketsPage] = useState(1);
  const [adminTicketsTotalPages, setAdminTicketsTotalPages] = useState(1);
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
  const [supportRoleFilter, setSupportRoleFilter] = useState('all');
  const [supportStatusFilter, setSupportStatusFilter] = useState('all');
  const [supportPriorityFilter, setSupportPriorityFilter] = useState('all');
  const [supportSearchQuery, setSupportSearchQuery] = useState('');
  const [selectedSupportTicketDetails, setSelectedSupportTicketDetails] = useState<SupportTicketDetails | null>(null);
  const [selectedSupportTicketId, setSelectedSupportTicketId] = useState<number | null>(null);
  const [adminReplyInput, setAdminReplyInput] = useState('');
  const [adminStatusUpdate, setAdminStatusUpdate] = useState('');
  const [adminPriorityUpdate, setAdminPriorityUpdate] = useState('');
  const [isUpdatingSupportStatus, setIsUpdatingSupportStatus] = useState(false);
  const [isSendingAdminReply, setIsSendingAdminReply] = useState(false);
  const [supportFeedback, setSupportFeedback] = useState<string | null>(null);

  const loadAdminSupportTickets = async (
    page = 1,
    role = supportRoleFilter,
    status = supportStatusFilter,
    priority = supportPriorityFilter,
    search = supportSearchQuery
  ) => {
    setIsLoadingSupport(true);
    try {
      const res = await api.support.getTickets({
        page,
        limit: 15,
        userRole: role !== 'all' ? role : undefined,
        status: status !== 'all' ? status : undefined,
        priority: priority !== 'all' ? priority : undefined,
        search: search.trim() || undefined
      });
      if (res && res.success && res.data) {
        setAdminTickets(res.data);
        if (res.meta) {
          setAdminTicketsTotal(res.meta.total);
          setAdminTicketsPage(res.meta.page);
          setAdminTicketsTotalPages(res.meta.totalPages);
        }
      }
    } catch (err: any) {
      console.error('Failed to load support tickets:', err);
    } finally {
      setIsLoadingSupport(false);
    }
  };

  const loadSupportTicketDetails = async (id: number) => {
    try {
      const res = await api.support.getTicketDetails(id);
      if (res && res.success && res.data) {
        setSelectedSupportTicketDetails(res.data);
        setSelectedSupportTicketId(id);
        setAdminStatusUpdate(res.data.ticket.status);
        setAdminPriorityUpdate(res.data.ticket.priority);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to load ticket details.');
    }
  };

  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupportTicketId || !adminReplyInput.trim()) return;
    setIsSendingAdminReply(true);
    try {
      const res = await api.support.addMessage(selectedSupportTicketId, adminReplyInput.trim());
      if (res && res.success) {
        setAdminReplyInput('');
        await loadSupportTicketDetails(selectedSupportTicketId);
        loadAdminSupportTickets(adminTicketsPage);
        setSupportFeedback('Reply sent to user successfully.');
        setTimeout(() => setSupportFeedback(null), 3000);
      } else {
        alert((res as any)?.error || 'Failed to send reply.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to send reply.');
    } finally {
      setIsSendingAdminReply(false);
    }
  };

  const handleAdminUpdateStatus = async () => {
    if (!selectedSupportTicketId) return;
    setIsUpdatingSupportStatus(true);
    try {
      const res = await api.support.updateStatus(selectedSupportTicketId, {
        status: adminStatusUpdate,
        priority: adminPriorityUpdate
      });
      if (res && res.success) {
        await loadSupportTicketDetails(selectedSupportTicketId);
        loadAdminSupportTickets(adminTicketsPage);
        setSupportFeedback('Ticket status/priority updated & audit logged.');
        setTimeout(() => setSupportFeedback(null), 3000);
      } else {
        alert((res as any)?.error || 'Failed to update ticket.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update ticket.');
    } finally {
      setIsUpdatingSupportStatus(false);
    }
  };

  const loadAuditLogs = async (page = 1, actionFilter = auditActionFilter) => {
    setIsLoadingAudit(true);
    try {
      const res = await api.admin.getAuditLogs({
        page,
        limit: 15,
        action: actionFilter || undefined
      });
      if (res && res.data) {
        setAuditLogs(res.data);
      }
      if (res && res.pagination) {
        setAuditPage(res.pagination.page);
        setAuditTotalPages(res.pagination.totalPages);
        setAuditTotalCount(res.pagination.total);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Route editing state
  const [editingFares, setEditingFares] = useState<Record<number, number>>({});
  const [isSavingFare, setIsSavingFare] = useState<number | null>(null);

  // New route form state
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newFare, setNewFare] = useState<number>(25);
  const [isAddingRoute, setIsAddingRoute] = useState(false);

  // Action status messages
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [dashRes, bookRes, drivRes, setlRes, commRes, finRes, tripRes, ratRes, delRes] = await Promise.all([
        api.admin.getDashboard(),
        api.admin.getAllBookings(),
        api.admin.getDrivers(),
        api.admin.getSettlements(),
        api.admin.getCommission(),
        api.admin.getFinancials(),
        api.tripBookings.getAllOwner(),
        api.admin.getDriverRatings(),
        api.admin.getDeletionRequests()
      ]);

      if (dashRes.success && dashRes.data) {
        setStats(dashRes.data);
        if (dashRes.data.fareRoutes) {
          setRoutes(dashRes.data.fareRoutes);
          const initialFares: Record<number, number> = {};
          dashRes.data.fareRoutes.forEach((r) => {
            initialFares[r.id] = r.fare;
          });
          setEditingFares(initialFares);
        }
      }

      if (finRes.success && finRes.data) {
        setFinancials(finRes.data);
      }

      if (bookRes.success && bookRes.data) {
        setBookings(bookRes.data);
      }

      if (drivRes.success && drivRes.data) {
        setDrivers(drivRes.data);
      }

      if (setlRes.success && setlRes.data) {
        setSettlements(setlRes.data);
      }

      if (ratRes.success && ratRes.data) {
        setDriverRatings(
          Array.isArray(ratRes.data)
            ? ratRes.data
            : (ratRes.data as any).data || []
        );
      }

      if (commRes.success && commRes.data) {
        setCommissionInput(commRes.data.commissionPerTrip);
      }

      if (tripRes.success && tripRes.data) {
        setTripBookings(tripRes.data);
        const quoteInputs: Record<number, number> = {};
        tripRes.data.forEach((trip) => {
          if (trip.quoted_price !== null && trip.quoted_price !== undefined) {
            quoteInputs[trip.id] = trip.quoted_price;
          }
        });
        setTripQuoteInputs(quoteInputs);
      }

      if (delRes.success && delRes.data) {
        setDeletionRequests(delRes.data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Process account deletion request
  const handleProcessDeletion = async (id: number, action: 'APPROVE' | 'REJECT') => {
    const confirmMsg = action === 'APPROVE'
      ? 'Are you sure you want to APPROVE this deletion request? The user account will be DEACTIVATED and their access revoked.'
      : 'Are you sure you want to REJECT this deletion request?';
    if (!window.confirm(confirmMsg)) return;

    setIsProcessingDeletion(id);
    try {
      const res = await api.admin.processDeletionRequest(id, { action });
      if (res.success) {
        showToast(action === 'APPROVE' ? 'Account deactivated successfully.' : 'Request rejected.');
        loadAllData();
      } else {
        showToast(`Error: ${res.error || 'Failed to process request.'}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Network error'}`);
    } finally {
      setIsProcessingDeletion(null);
    }
  };

  // Driver approval action
  const handleDriverApproval = async (driverId: number, status: string) => {
    const res = await api.admin.updateDriverApproval(driverId, status);
    if (res.success) {
      showToast(`Driver status updated to ${status}`);
      loadAllData();
    } else {
      showToast(`Error: ${res.error}`);
    }
  };

  // Settle driver payout
  const handleSettlePayout = async (driverId: number) => {
    const res = await api.admin.settlePayouts({ driverId });
    if (res.success && res.data) {
      showToast(`Settled ₹${res.data.settledAmount} across ${res.data.settledCount} trip(s).`);
      loadAllData();
    } else {
      showToast(`Error: ${res.error}`);
    }
  };

  // Update commission rate
  const handleUpdateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.admin.updateCommission(commissionInput);
    if (res.success) {
      showToast(`Platform commission set to ₹${commissionInput} per trip.`);
      loadAllData();
    } else {
      showToast(`Error: ${res.error}`);
    }
  };

  // Save route fare
  const handleSaveRouteFare = async (routeId: number) => {
    const newFareVal = editingFares[routeId];
    if (newFareVal === undefined || isNaN(newFareVal)) return;

    setIsSavingFare(routeId);
    const res = await api.admin.updateFareRoute(routeId, Number(newFareVal));
    setIsSavingFare(null);

    if (res.success) {
      showToast(`Route #${routeId} fare updated to ₹${newFareVal}`);
      loadAllData();
    }
  };

  // Toggle route active/inactive
  const handleToggleRoute = async (routeId: number) => {
    const res = await api.admin.toggleRoute(routeId);
    if (res.success && res.data) {
      showToast(`Route #${routeId} is now ${res.data.is_active ? 'Active' : 'Inactive'}`);
      loadAllData();
    }
  };

  // Add new route
  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFrom.trim() || !newTo.trim() || newFare <= 0) return;

    setIsAddingRoute(true);
    const res = await api.admin.addRoute({
      fromLocation: newFrom.trim(),
      toLocation: newTo.trim(),
      fare: Number(newFare)
    });
    setIsAddingRoute(false);

    if (res.success) {
      showToast(`Added new fixed route: ${newFrom} → ${newTo} (₹${newFare})`);
      setNewFrom('');
      setNewTo('');
      loadAllData();
    } else {
      showToast(`Error: ${res.error}`);
    }
  };

  // Update booking status
  const handleUpdateStatus = async (bookingId: number, newStatus: string) => {
    const res = await api.admin.updateBookingStatus(bookingId, newStatus);
    if (res.success) {
      showToast(`Booking status updated to ${newStatus}`);
      loadAllData();
    }
  };

  const handleUpdateTrip = async (
    tripId: number,
    data: { quotedPrice?: number; status?: string }
  ) => {
    const res = await api.tripBookings.updateByOwner(tripId, data);
    if (res.success) {
      showToast('Trip booking updated successfully');
      loadAllData();
    } else {
      showToast(`Error: ${res.error}`);
    }
  };

  const handleSaveTripQuote = async (tripId: number) => {
    const quote = tripQuoteInputs[tripId];
    if (quote === undefined || isNaN(quote) || quote < 0) {
      showToast('Enter a valid quoted price');
      return;
    }
    await handleUpdateTrip(tripId, { quotedPrice: Number(quote) });
  };

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        b.booking_reference.toLowerCase().includes(q) ||
        (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
        b.pickup_address.toLowerCase().includes(q) ||
        b.destination_address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (isLoading) {
    return <div className="py-20 text-center text-xs text-[#A1A1AA]">Loading Owner/Admin Console...</div>;
  }

  const m = stats?.metrics;
  const fin = financials || stats?.financials;
  const pendingDeletionsCount = deletionRequests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 bg-[#0B0B0D] text-white safe-bottom">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#303034]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#171719] border border-[#303034] text-white text-xs font-bold uppercase mb-2">
            <span className="w-2 h-2 rounded-full bg-[#C6FF3D]" />
            <Shield className="w-3.5 h-3.5 text-[#C6FF3D]" />
            <span>Clik2Go Admin Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Owner Management Console
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Manage driver verifications, fixed routes, platform commission, marketplace payouts, live rides, and outstation trips.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => navigate('/profile')}
            className="px-4 py-2 bg-[#171719] hover:bg-[#26262A] text-white text-xs font-bold rounded-xl border border-[#303034] hover:border-[#C6FF3D]/40 flex items-center gap-1.5 transition-colors min-h-[40px] shadow-xs"
            title="Manage admin account security and change password"
          >
            <Key className="w-3.5 h-3.5 text-[#C6FF3D]" />
            <span>Change Password</span>
          </button>

          <button
            onClick={loadAllData}
            className="px-4 py-2 bg-[#171719] hover:bg-[#26262A] text-white text-xs font-bold rounded-xl border border-[#303034] flex items-center gap-1.5 transition-colors min-h-[40px] shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#C6FF3D]" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Global Toast Message */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-[#171717] text-white text-xs font-bold shadow-elevated flex items-center justify-between animate-in fade-in duration-150">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-[#A1A1AA] hover:text-white p-1">✕</button>
        </div>
      )}

      {/* TABS CONTROLLER NAVIGATION */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-[#171719] rounded-2xl text-xs font-bold border border-[#303034]">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'overview' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-glow-lime' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-[#C6FF3D]" />
          <span>Overview & Financials</span>
        </button>

        <button
          onClick={() => setActiveTab('drivers')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'drivers' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-glow-lime' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <Car className="w-3.5 h-3.5 text-[#C6FF3D]" />
          <span>Driver Management</span>
          {m?.pendingDrivers && m.pendingDrivers > 0 ? (
            <span className="px-1.5 py-0.5 bg-[#C6FF3D] text-[#0B0B0D] font-black rounded-full text-[10px] font-black">
              {m.pendingDrivers}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab('settlements')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'settlements' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-glow-lime' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-[#C6FF3D]" />
          <span>Payout Settlements</span>
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'routes' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-glow-lime' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-[#C6FF3D]" />
          <span>Fixed Routes & Fares</span>
        </button>

        <button
          onClick={() => setActiveTab('commission')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'commission' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-glow-lime' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <Percent className="w-3.5 h-3.5 text-[#C6FF3D]" />
          <span>Commission Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('tripBookings')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'tripBookings' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-glow-lime' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <span>🚗</span>
          <span>Car / Trip Bookings ({tripBookings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'bookings' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-glow-lime' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-[#C6FF3D]" />
          <span>All Bookings ({bookings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ratings')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'ratings' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-glow-lime' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <span>⭐ Driver Ratings ({driverRatings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('deletions')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'deletions' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-glow-lime' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5 text-[#C6FF3D]" />
          <span>Deletion Requests ({deletionRequests.length})</span>
          {pendingDeletionsCount > 0 && (
            <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-black">
              {pendingDeletionsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('auditLogs');
            loadAuditLogs(1);
          }}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'auditLogs' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-glow-lime' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Audit Trail</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('support');
            loadAdminSupportTickets(1);
          }}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'support' ? 'bg-[#C6FF3D] text-[#0B0B0D] font-black shadow-glow-lime' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>Support Desk</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & FINANCIALS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Financial Split Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#171719] rounded-3xl p-6 border border-[#303034] shadow-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-[#A1A1AA]">Total Gross Volume</span>
              <div className="text-2xl sm:text-3xl font-black text-white">₹{fin?.totalGrossVolume ?? 0}</div>
              <p className="text-xs text-[#A1A1AA]">All customer bookings completed</p>
            </div>

            <div className="bg-[#C6FF3D]/10 rounded-3xl p-6 border border-[#36C98F]/40 shadow-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-[#C6FF3D]">Owner Commission Earned</span>
              <div className="text-2xl sm:text-3xl font-black text-[#C6FF3D]">₹{fin?.ownerCommissionEarned ?? 0}</div>
              <p className="text-xs text-[#C6FF3D]">Platform fee retained (₹{fin?.commissionPerTrip ?? 5}/ride)</p>
            </div>

            <div className="bg-[#171719] rounded-3xl p-6 border border-[#303034] shadow-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-[#A1A1AA]">Driver Payouts (Total)</span>
              <div className="text-2xl sm:text-3xl font-black text-white">₹{fin?.driverPayoutsTotal ?? 0}</div>
              <p className="text-xs text-[#A1A1AA]">Net earned by auto drivers</p>
            </div>

            <div className="bg-rose-50 rounded-3xl p-6 border border-rose-200 shadow-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-rose-700">Pending Driver Settlements</span>
              <div className="text-2xl sm:text-3xl font-black text-rose-600">₹{fin?.pendingSettlementsAmount ?? 0}</div>
              <p className="text-xs text-rose-600">Unsettled driver earnings balance</p>
            </div>
          </div>

          {/* Operational Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-[#202023] rounded-2xl p-4 border border-[#303034] shadow-xs">
              <span className="text-[10px] font-bold text-[#A1A1AA] uppercase">Customers</span>
              <div className="text-xl font-black text-white mt-1">{m?.totalCustomers ?? 0}</div>
            </div>

            <div className="bg-[#202023] rounded-2xl p-4 border border-[#303034] shadow-xs">
              <span className="text-[10px] font-bold text-[#A1A1AA] uppercase">Fleet Drivers</span>
              <div className="text-xl font-black text-white mt-1">{m?.totalDrivers ?? 0}</div>
            </div>

            <div className="bg-[#202023] rounded-2xl p-4 border border-[#303034] shadow-xs">
              <span className="text-[10px] font-bold text-[#A1A1AA] uppercase">Pending Approvals</span>
              <div className="text-xl font-black text-amber-600 mt-1">{m?.pendingDrivers ?? 0}</div>
            </div>

            <div className="bg-[#202023] rounded-2xl p-4 border border-[#303034] shadow-xs">
              <span className="text-[10px] font-bold text-[#A1A1AA] uppercase">Total Rides</span>
              <div className="text-xl font-black text-white mt-1">{m?.totalBookings ?? 0}</div>
            </div>

            <div className="bg-[#202023] rounded-2xl p-4 border border-[#303034] shadow-xs">
              <span className="text-[10px] font-bold text-[#A1A1AA] uppercase">Active Rides</span>
              <div className="text-xl font-black text-[#C6FF3D] mt-1">{m?.activeBookings ?? 0}</div>
            </div>

            <div className="bg-[#202023] rounded-2xl p-4 border border-[#303034] shadow-xs">
              <span className="text-[10px] font-bold text-[#A1A1AA] uppercase">Completed</span>
              <div className="text-xl font-black text-[#C6FF3D] mt-1">{m?.completedRides ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DRIVER MANAGEMENT & APPROVALS */}
      {activeTab === 'drivers' && (
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#303034]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-[#C6FF3D]" />
                <span>Driver Partner Registrations & Approvals</span>
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Review applicant documents and authorize drivers to accept customer rides
              </p>
            </div>
            <span className="px-3 py-1 bg-[#202023] border border-[#303034] text-white text-xs font-bold rounded-xl shadow-xs">
              {drivers.length} Total Drivers
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#303034] bg-[#202023]">
            <table className="w-full text-left text-xs text-white min-w-[680px]">
              <thead className="bg-[#171719] text-[10px] uppercase font-bold text-[#A1A1AA] border-b border-[#303034]">
                <tr>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Auto Details</th>
                  <th className="px-4 py-3">License</th>
                  <th className="px-4 py-3">Payout Details</th>
                  <th className="px-4 py-3">Trips / Earnings</th>
                  <th className="px-4 py-3">Approval Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {drivers.map((d) => {
                  const status = (d.approval_status || 'PENDING').toUpperCase();
                  return (
                    <tr key={d.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white">{d.name}</div>
                        <div className="text-[10px] text-[#A1A1AA]">{d.mobile} • {d.email}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold uppercase text-white bg-[#171719] px-2 py-0.5 rounded-lg inline-block border border-[#303034]">{d.auto_number}</div>
                        <div className="text-[10px] text-[#A1A1AA]">{d.auto_model}</div>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-[11px] text-[#A1A1AA]">
                        {d.license_number}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white">UPI: {d.payout_upi || '—'}</div>
                        {d.payout_bank_account && (
                          <div className="text-[10px] text-[#A1A1AA] font-mono">
                            A/C: {d.payout_bank_account} ({d.payout_ifsc})
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white">{d.total_trips || 0} trips</div>
                        <div className="text-[10px] text-[#C6FF3D] font-bold">₹{d.total_earnings || 0} earned</div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          status === 'APPROVED' || status === 'ACTIVE'
                            ? 'bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#36C98F]/40'
                            : status === 'PENDING'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {status !== 'APPROVED' && (
                            <button
                              onClick={() => handleDriverApproval(d.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-[#C6FF3D] hover:bg-[#B5F028] text-white font-bold text-[11px] rounded-lg shadow-xs"
                            >
                              Approve
                            </button>
                          )}
                          {status !== 'REJECTED' && status === 'PENDING' && (
                            <button
                              onClick={() => handleDriverApproval(d.id, 'REJECTED')}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg shadow-xs"
                            >
                              Reject
                            </button>
                          )}
                          {status === 'APPROVED' && (
                            <button
                              onClick={() => handleDriverApproval(d.id, 'SUSPENDED')}
                              className="px-2.5 py-1 bg-[#171719] hover:bg-[#26262A] text-white border border-[#303034] font-bold text-[11px] rounded-lg"
                            >
                              Suspend
                            </button>
                          )}
                          {status === 'SUSPENDED' && (
                            <button
                              onClick={() => handleDriverApproval(d.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-[#171717] hover:bg-[#262626] text-white font-bold text-[11px] rounded-lg shadow-xs"
                            >
                              Re-activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PAYOUT SETTLEMENTS */}
      {activeTab === 'settlements' && (
        <div className="space-y-6">
          <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#303034]">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#C6FF3D]" />
                  <span>Pending Driver Payouts</span>
                </h2>
                <p className="text-xs text-[#A1A1AA]">
                  Driver balances earned from completed customer rides pending bank/UPI transfer
                </p>
              </div>
            </div>

            {(!settlements?.pendingDrivers || settlements.pendingDrivers.length === 0) ? (
              <div className="py-10 text-center space-y-2 bg-[#202023] rounded-2xl border border-[#303034]">
                <div className="text-3xl text-[#C6FF3D]">✓</div>
                <p className="text-xs font-bold text-white">All driver accounts are settled</p>
                <p className="text-[11px] text-[#A1A1AA]">Zero pending driver payout balances</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#303034] bg-[#202023]">
                <table className="w-full text-left text-xs text-white min-w-[640px]">
                  <thead className="bg-[#171719] text-[10px] uppercase font-bold text-[#A1A1AA] border-b border-[#303034]">
                    <tr>
                      <th className="px-4 py-3">Driver</th>
                      <th className="px-4 py-3">Auto Number</th>
                      <th className="px-4 py-3">Payout Account</th>
                      <th className="px-4 py-3">Pending Trips</th>
                      <th className="px-4 py-3">Pending Amount</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {settlements.pendingDrivers.map((p) => (
                      <tr key={p.driver_id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-white">
                          <div>{p.driver_name}</div>
                          <div className="text-[10px] text-[#A1A1AA]">{p.mobile}</div>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold uppercase text-white">
                          <span className="bg-[#171719] px-2 py-0.5 rounded-lg border border-[#303034]">{p.auto_number}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-white">UPI: {p.payout_upi || '—'}</div>
                          {p.payout_bank_account && (
                            <div className="text-[10px] text-[#A1A1AA] font-mono">
                              A/C: {p.payout_bank_account} ({p.payout_ifsc})
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-white">
                          {p.pending_trips_count} trip(s)
                        </td>
                        <td className="px-4 py-3.5 font-black text-rose-600 text-sm">
                          ₹{p.pending_amount}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <button
                            onClick={() => handleSettlePayout(p.driver_id)}
                            className="px-4 py-1.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-white font-black text-xs rounded-xl shadow-xs transition-transform hover:scale-102 flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Mark as Settled</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Settled History Log */}
          {settlements?.settledHistory && settlements.settledHistory.length > 0 && (
            <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-4">
              <h3 className="text-base font-bold text-white">Recent Settled Payouts History</h3>
              <div className="divide-y divide-[#E5E7EB] bg-[#202023] rounded-2xl border border-[#303034] px-4">
                {settlements.settledHistory.map((s) => (
                  <div key={s.id} className="py-3 flex items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-white">{s.driver_name}</span>
                      <span className="text-[#A1A1AA] font-mono ml-2">({s.auto_number})</span>
                      <div className="text-[10px] text-[#A1A1AA] break-all">
                        Ref: {s.transaction_reference} • Booking: {s.booking_reference}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-[#C6FF3D]">₹{s.driver_amount} Paid</div>
                      <span className="text-[10px] text-[#A1A1AA]">
                        {s.settled_at ? new Date(s.settled_at).toLocaleDateString() : 'Settled'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FIXED ROUTES & FARES */}
      {activeTab === 'routes' && (
        <div className="space-y-6">
          <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303034]">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#C6FF3D]" />
                  <span>Fixed Place-to-Place Routes & Fares</span>
                </h2>
                <p className="text-xs text-[#A1A1AA]">
                  Manage fixed rate routes stored in the database. Fares are fixed place-to-place with zero distance calculations.
                </p>
              </div>
              <span className="px-3 py-1 bg-[#202023] border border-[#303034] text-white text-xs font-bold rounded-xl shadow-xs self-start sm:self-auto">
                {routes.length} Configured Routes
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#303034] bg-[#202023]">
              <table className="w-full text-left text-xs text-white min-w-[640px]">
                <thead className="bg-[#171719] text-[10px] uppercase font-bold text-[#A1A1AA] border-b border-[#303034]">
                  <tr>
                    <th className="px-4 py-3">Route ID</th>
                    <th className="px-4 py-3">From Location</th>
                    <th className="px-4 py-3">To Location</th>
                    <th className="px-4 py-3">Fixed Fare (₹)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {routes.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-[#A1A1AA]">
                        #{r.id}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-white">
                        {r.from_location}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-white">
                        {r.to_location}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#A1A1AA] font-bold">₹</span>
                          <input
                            type="number"
                            min="1"
                            value={editingFares[r.id] ?? r.fare}
                            onChange={(e) =>
                              setEditingFares({
                                ...editingFares,
                                [r.id]: Number(e.target.value)
                              })
                            }
                            className="w-20 px-2.5 py-1 border border-[#303034] rounded-lg text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-[#36C98F]"
                          />
                          <button
                            onClick={() => handleSaveRouteFare(r.id)}
                            disabled={isSavingFare === r.id}
                            className="px-2.5 py-1 bg-[#171717] hover:bg-[#262626] text-white font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Save className="w-3 h-3 text-[#C6FF3D]" />
                            <span>{isSavingFare === r.id ? 'Saving...' : 'Save'}</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            r.is_active
                              ? 'bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#36C98F]/40'
                              : 'bg-neutral-100 text-[#A1A1AA]'
                          }`}
                        >
                          {r.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleRoute(r.id)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors border ${
                            r.is_active
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-[#C6FF3D]/10 text-[#C6FF3D] border-[#36C98F]/40 hover:bg-[#D5F5E7]'
                          }`}
                        >
                          {r.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add New Route Card */}
            <div className="bg-[#202023] rounded-2xl p-5 border border-[#303034] shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#C6FF3D]" />
                <span>Add New Fixed Fare Route</span>
              </h3>
              <form onSubmit={handleAddRoute} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1">From Location</label>
                  <input
                    type="text"
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value)}
                    placeholder="e.g. JNTUA"
                    className="w-full px-3 py-2 bg-[#171719] border border-[#303034] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#36C98F]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1">To Location</label>
                  <input
                    type="text"
                    value={newTo}
                    onChange={(e) => setNewTo(e.target.value)}
                    placeholder="e.g. Railway Station"
                    className="w-full px-3 py-2 bg-[#171719] border border-[#303034] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#36C98F]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1">Fixed Fare (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={newFare}
                    onChange={(e) => setNewFare(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#171719] border border-[#303034] rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-[#36C98F]"
                    required
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isAddingRoute}
                    className="w-full py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-white font-black text-xs rounded-xl shadow-subtle transition-transform hover:scale-102 flex items-center justify-center gap-1.5 min-h-[40px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingRoute ? 'Adding...' : 'Add Route'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: COMMISSION SETTINGS */}
      {activeTab === 'commission' && (
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card max-w-xl space-y-6">
          <div className="pb-4 border-b border-[#303034]">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Percent className="w-5 h-5 text-[#C6FF3D]" />
              <span>Platform Commission Settings</span>
            </h2>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Fixed commission retained by the platform owner for each completed auto ride.
            </p>
          </div>

          <form onSubmit={handleUpdateCommission} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white uppercase mb-1">
                Owner Commission Per Trip (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-bold text-[#A1A1AA]">₹</span>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={commissionInput}
                  onChange={(e) => setCommissionInput(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[#303034] text-sm font-black text-white bg-[#202023] focus:outline-none focus:ring-2 focus:ring-[#36C98F]"
                  required
                />
              </div>
              <p className="text-[11px] text-[#A1A1AA] mt-1.5">
                Example: On a ₹20 ride (JNTUA ↔ Cross), driver receives <strong>₹{Math.max(0, 20 - commissionInput)}</strong> and owner retains <strong>₹{commissionInput}</strong>.
              </p>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-[#C6FF3D] hover:bg-[#B5F028] text-white font-black text-xs rounded-xl shadow-subtle transition-transform hover:scale-102 flex items-center gap-1.5 min-h-[40px]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Update Commission Rate</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB: CAR / TRIP BOOKINGS */}
      {activeTab === 'tripBookings' && (
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>🚗</span>
                <span>Car / Trip Bookings</span>
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Manage customer trip requests, enter travel quotes, and confirm bookings.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <select
                value={tripStatusFilter}
                onChange={(e) => setTripStatusFilter(e.target.value)}
                className="px-3 py-2 border border-[#303034] rounded-xl text-xs font-semibold bg-[#202023] w-full sm:w-auto"
              >
                <option value="all">All Statuses</option>
                <option value="NEW">NEW</option>
                <option value="CONTACTED">CONTACTED</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>

              <input
                type="text"
                value={tripSearchQuery}
                onChange={(e) => setTripSearchQuery(e.target.value)}
                placeholder="Search booking / customer / place"
                className="px-3 py-2 bg-[#202023] border border-[#303034] rounded-xl text-xs w-full sm:w-auto"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#303034] bg-[#202023]">
            <table className="w-full text-left text-xs text-white min-w-[720px]">
              <thead className="bg-[#171719] text-[10px] uppercase font-bold text-[#A1A1AA] border-b border-[#303034]">
                <tr>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Trip Details</th>
                  <th className="px-4 py-3">Date / Time</th>
                  <th className="px-4 py-3">Quote</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#E5E7EB]">
                {tripBookings
                  .filter((trip) => {
                    if (tripStatusFilter !== 'all' && trip.status !== tripStatusFilter) return false;
                    const q = tripSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    const destMatch = Array.isArray(trip.trip_destinations)
                      ? trip.trip_destinations.some(
                          (d) =>
                            d.name.toLowerCase().includes(q) ||
                            (d.address && d.address.toLowerCase().includes(q))
                        )
                      : false;
                    return (
                      trip.booking_reference.toLowerCase().includes(q) ||
                      trip.customer_name.toLowerCase().includes(q) ||
                      trip.phone_number.toLowerCase().includes(q) ||
                      trip.trip_place.toLowerCase().includes(q) ||
                      destMatch
                    );
                  })
                  .map((trip) => (
                    <tr key={trip.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-mono font-bold text-white">
                          {trip.booking_reference}
                        </div>
                        <div className="text-[10px] text-[#A1A1AA] break-all">
                          {trip.email || ''}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-bold text-white">
                          {trip.customer_name}
                        </div>
                        <div className="text-[10px] text-[#A1A1AA]">
                          {trip.phone_number}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-bold text-white">
                          {trip.trip_place}
                        </div>
                        {Array.isArray(trip.trip_destinations) && trip.trip_destinations.length > 1 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {trip.trip_destinations.map((dest, idx) => (
                              <span
                                key={`${trip.id}-dest-${idx}`}
                                className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#202023] border border-[#303034] text-[10px] text-[#C6FF3D]"
                              >
                                {idx + 1}. {dest.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-[10px] text-[#A1A1AA] mt-0.5">
                          {trip.members} member(s) • {trip.days} day(s)
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">
                          {trip.trip_date}
                        </div>
                        <div className="text-[10px] text-[#A1A1AA]">
                          Pickup: {trip.pickup_time}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-[#A1A1AA]">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={tripQuoteInputs[trip.id] ?? trip.quoted_price ?? ''}
                            onChange={(e) =>
                              setTripQuoteInputs({
                                ...tripQuoteInputs,
                                [trip.id]: Number(e.target.value)
                              })
                            }
                            placeholder="Enter quote"
                            className="w-28 px-2 py-1.5 border border-[#303034] rounded-lg text-xs font-bold"
                          />
                        </div>

                        <button
                          onClick={() => handleSaveTripQuote(trip.id)}
                          className="mt-2 px-3 py-1 bg-[#171717] hover:bg-[#262626] text-white rounded-lg text-[10px] font-bold transition-colors shadow-xs"
                        >
                          Save Quote
                        </button>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            trip.payment_status === 'PAID'
                              ? 'bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#36C98F]/40'
                              : 'bg-neutral-100 text-[#A1A1AA]'
                          }`}
                        >
                          {trip.payment_status}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <select
                          value={trip.status}
                          onChange={(e) =>
                            handleUpdateTrip(trip.id, {
                              status: e.target.value
                            })
                          }
                          className="px-2 py-1.5 bg-[#171719] border border-[#303034] rounded-lg text-[10px] font-bold"
                        >
                          <option value="NEW">NEW</option>
                          <option value="CONTACTED">CONTACTED</option>
                          <option value="CONFIRMED">CONFIRMED</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {tripBookings.length === 0 && (
              <div className="py-12 text-center text-xs text-[#A1A1AA]">
                No car / trip bookings yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: ALL BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">All System Bookings</h2>
              <p className="text-xs text-[#A1A1AA]">Live feed of all customer ride bookings with split payment records</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-[#303034] rounded-xl text-xs font-semibold bg-[#202023] focus:outline-none w-full sm:w-auto"
              >
                <option value="all">All Statuses</option>
                <option value="Searching for Auto">Searching for Auto</option>
                <option value="Driver Assigned">Driver Assigned</option>
                <option value="Driver Arriving">Driver Arriving</option>
                <option value="Ride Started">Ride Started</option>
                <option value="Ride Completed">Ride Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#A1A1AA]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reference, customer..."
                  className="w-full pl-8 pr-3 py-2 bg-[#202023] border border-[#303034] rounded-xl text-xs focus:outline-none font-medium"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#303034] bg-[#202023]">
            <table className="w-full text-left text-xs text-white min-w-[760px]">
              <thead className="bg-[#171719] text-[10px] uppercase font-bold text-[#A1A1AA] border-b border-[#303034]">
                <tr>
                  <th className="px-4 py-3">Booking ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Driver / Auto</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Fare & Split</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-white">
                      {b.booking_reference}
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-white">
                      <div>{b.customer_name || 'Customer'}</div>
                      <div className="text-[10px] text-[#A1A1AA]">{b.customer_mobile}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      {b.auto_number ? (
                        <div>
                          <div className="font-bold text-white">{b.driver_name}</div>
                          <div className="text-[10px] text-[#C6FF3D] font-mono font-bold uppercase">{b.auto_number}</div>
                        </div>
                      ) : (
                        <span className="text-[#A1A1AA] italic text-[11px]">Unassigned</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 max-w-[200px]">
                      <div className="font-bold text-white break-words">{b.pickup_address} → {b.destination_address}</div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-black text-white">₹{b.estimated_fare}</div>
                      {b.driver_amount !== undefined && (
                        <div className="text-[10px] text-[#A1A1AA]">
                          Driver: ₹{b.driver_amount} • Owner: ₹{b.owner_amount}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {b.payment_status === 'COMPLETED' ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#36C98F]/40 font-bold text-[10px]">
                          ✓ Paid ({b.payment_method || 'UPI'})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-[#A1A1AA] text-[10px]">
                          Unpaid
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusBadge status={b.status} size="sm" />
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <select
                        value={b.status}
                        onChange={(e) => handleUpdateStatus(b.id, e.target.value)}
                        className="text-[11px] font-semibold bg-[#171719] border border-[#303034] rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                      >
                        <option value="Searching for Auto">Searching for Auto</option>
                        <option value="Driver Assigned">Driver Assigned</option>
                        <option value="Driver Arriving">Driver Arriving</option>
                        <option value="Ride Started">Ride Started</option>
                        <option value="Ride Completed">Ride Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: RATINGS */}
      {activeTab === 'ratings' && ( 
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#303034]">
            <h2 className="text-base sm:text-lg font-bold text-white">
              Driver Ratings & Reviews
            </h2>
            <span className="text-xs font-bold text-[#A1A1AA]">
              {driverRatings.length} Reviews
            </span>
          </div>

          {driverRatings.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#A1A1AA] bg-[#202023] rounded-2xl border border-[#303034]">
              No driver ratings submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#303034] bg-[#202023]">
              <table className="w-full text-left text-xs text-white min-w-[640px]">
                <thead className="bg-[#171719] text-[#A1A1AA] border-b border-[#303034]">
                  <tr>
                    <th className="px-4 py-3">Driver</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Review</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Booking</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {driverRatings.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-bold text-white">
                        {r.driver_name || `Driver #${r.driver_id}`}
                        <div className="text-[10px] text-[#A1A1AA]">
                          {r.auto_number || ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-amber-500">
                          {'★'.repeat(Math.max(0, Math.min(5, Number(r.rating) || 0)))}
                        </span>
                        {' '}{r.rating}/5
                      </td>
                      <td className="px-4 py-3">
                        {r.review?.trim() || 'No written review'}
                      </td>
                      <td className="px-4 py-3">
                        {r.customer_name || `Customer #${r.customer_id}`}
                      </td>
                      <td className="px-4 py-3">
                        {r.booking_reference || `#${r.booking_id}`}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 8: ACCOUNT DELETION REQUESTS */}
      {activeTab === 'deletions' && (
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#303034]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                <span>Account Deletion Requests</span>
              </h2>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Review submitted deletion requests. Approving will permanently deactivate the user account and revoke platform access.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#A1A1AA]">
                {deletionRequests.length} total ({pendingDeletionsCount} pending)
              </span>
            </div>
          </div>

          {deletionRequests.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#A1A1AA] bg-[#202023] rounded-2xl border border-[#303034]">
              No account deletion requests received.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#303034] bg-[#202023]">
              <table className="w-full text-left text-xs text-white min-w-[760px]">
                <thead className="bg-[#171719] text-[#A1A1AA] border-b border-[#303034]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Contact</th>
                    <th className="px-4 py-3 font-semibold">Reason</th>
                    <th className="px-4 py-3 font-semibold">Requested</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#303034]">
                  {deletionRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-[#28282C] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white">{req.user_name || `User #${req.user_id}`}</div>
                        <div className="text-[10px] text-[#A1A1AA]">ID: #{req.user_id}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          req.user_role === 'driver' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {req.user_role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-white">{req.user_mobile || '—'}</div>
                        <div className="text-[10px] text-[#A1A1AA]">{req.user_email || '—'}</div>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="line-clamp-2 text-[#A1A1AA] text-xs">
                          {req.reason || <span className="italic text-neutral-500">None provided</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#A1A1AA]">
                        {req.requested_at ? new Date(req.requested_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : req.status === 'PROCESSED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {req.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleProcessDeletion(req.id, 'APPROVE')}
                              disabled={isProcessingDeletion === req.id}
                              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            >
                              {isProcessingDeletion === req.id ? 'Processing...' : 'Approve Deactivation'}
                            </button>
                            <button
                              onClick={() => handleProcessDeletion(req.id, 'REJECT')}
                              disabled={isProcessingDeletion === req.id}
                              className="px-2.5 py-1.5 bg-[#303034] hover:bg-[#3E3E42] text-[#A1A1AA] hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#A1A1AA]">
                            {req.processed_at ? `Handled ${new Date(req.processed_at).toLocaleDateString()}` : 'Completed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 9: ACTIVITY AUDIT TRAIL */}
      {activeTab === 'auditLogs' && (
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#303034]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#C6FF3D]" />
                <span>Administrative Activity Audit Trail</span>
              </h2>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Tamper-evident record of all administrative operations, overrides, and settlements.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={auditActionFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setAuditActionFilter(val);
                  loadAuditLogs(1, val);
                }}
                className="bg-[#202023] border border-[#303034] text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#C6FF3D]"
              >
                <option value="">All Actions</option>
                <option value="UPDATE_DRIVER_APPROVAL">Driver Approvals</option>
                <option value="UPDATE_BOOKING_STATUS">Booking Status</option>
                <option value="UPDATE_FARE_CONFIG">Fare Config</option>
                <option value="ADD_ROUTE">Added Routes</option>
                <option value="TOGGLE_ROUTE">Route Status</option>
                <option value="UPDATE_COMMISSION">Commission Rates</option>
                <option value="SETTLE_PAYOUTS">Settlements</option>
                <option value="APPROVE_ACCOUNT_DELETION">Deletion Approvals</option>
                <option value="REJECT_ACCOUNT_DELETION">Deletion Rejections</option>
                <option value="UPDATE_TRIP_BOOKING_BY_OWNER">Trip Bookings</option>
              </select>
              <button
                onClick={() => loadAuditLogs(auditPage)}
                disabled={isLoadingAudit}
                className="p-1.5 bg-[#202023] hover:bg-[#28282C] border border-[#303034] rounded-xl text-[#A1A1AA] hover:text-white transition-all disabled:opacity-50"
                title="Refresh audit logs"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingAudit ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {isLoadingAudit && auditLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#A1A1AA] bg-[#202023] rounded-2xl border border-[#303034]">
              Loading audit logs...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#A1A1AA] bg-[#202023] rounded-2xl border border-[#303034]">
              No audit logs found for the selected filter.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-[#303034] bg-[#202023]">
                <table className="w-full text-left text-xs text-white min-w-[760px]">
                  <thead className="bg-[#171719] text-[#A1A1AA] border-b border-[#303034]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Timestamp</th>
                      <th className="px-4 py-3 font-semibold">Administrator</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                      <th className="px-4 py-3 font-semibold">Target</th>
                      <th className="px-4 py-3 font-semibold">Details</th>
                      <th className="px-4 py-3 font-semibold text-right">Client IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#303034]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#28282C] transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-[#A1A1AA]">
                          <div>{new Date(log.created_at).toLocaleDateString()}</div>
                          <div className="text-[10px] text-[#71717A]">{new Date(log.created_at).toLocaleTimeString()}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-white">{log.admin_email}</div>
                          {log.admin_id && <div className="text-[10px] text-[#A1A1AA]">ID: #{log.admin_id}</div>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#171719] border border-[#303034] text-[#C6FF3D]">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="capitalize text-[#E4E4E7]">{log.target_type || '—'}</div>
                          {log.target_id && <div className="text-[10px] text-[#A1A1AA]">ID: {log.target_id}</div>}
                        </td>
                        <td className="px-4 py-3.5 max-w-sm">
                          {log.details && Object.keys(log.details).length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(log.details)
                                .filter(([k]) => !/password|hash|token|secret|otp|jwt|key|cvv/i.test(k))
                                .slice(0, 3)
                                .map(([k, v]) => (
                                  <span key={k} className="inline-block px-1.5 py-0.5 rounded bg-[#171719] border border-[#303034] text-[10px] text-[#E4E4E7]">
                                    <span className="text-[#A1A1AA]">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                  </span>
                                ))}
                            </div>
                          ) : (
                            <span className="text-[#71717A] italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-[11px] text-[#A1A1AA]">
                          {log.client_ip || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between text-xs text-[#A1A1AA] pt-2">
                <div>
                  Showing {auditLogs.length} of {auditTotalCount} audit record{auditTotalCount === 1 ? '' : 's'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadAuditLogs(auditPage - 1)}
                    disabled={auditPage <= 1 || isLoadingAudit}
                    className="px-3 py-1.5 rounded-xl bg-[#202023] hover:bg-[#28282C] border border-[#303034] text-white disabled:opacity-40 disabled:hover:bg-[#202023] transition-all font-bold"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-medium">
                    Page {auditPage} of {auditTotalPages || 1}
                  </span>
                  <button
                    onClick={() => loadAuditLogs(auditPage + 1)}
                    disabled={auditPage >= auditTotalPages || isLoadingAudit}
                    className="px-3 py-1.5 rounded-xl bg-[#202023] hover:bg-[#28282C] border border-[#303034] text-white disabled:opacity-40 disabled:hover:bg-[#202023] transition-all font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 10: CUSTOMER & DRIVER SUPPORT DESK */}
      {activeTab === 'support' && (
        <div className="bg-[#171719] rounded-3xl p-6 sm:p-8 border border-[#303034] shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#303034]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-[#C6FF3D]" />
                <span>Customer & Driver Support Desk</span>
              </h2>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Manage, prioritize, and respond to incoming customer and driver support tickets.
              </p>
            </div>
            <button
              onClick={() => loadAdminSupportTickets(adminTicketsPage)}
              disabled={isLoadingSupport}
              className="px-3 py-1.5 rounded-xl bg-[#202023] hover:bg-[#28282C] border border-[#303034] text-white flex items-center gap-2 text-xs font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSupport ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#202023]/60 p-4 rounded-2xl border border-[#303034]">
            <div>
              <label className="block text-[11px] font-bold text-[#A1A1AA] uppercase mb-1">User Role</label>
              <select
                value={supportRoleFilter}
                onChange={(e) => {
                  setSupportRoleFilter(e.target.value);
                  loadAdminSupportTickets(1, e.target.value, supportStatusFilter, supportPriorityFilter, supportSearchQuery);
                }}
                className="w-full bg-[#171719] border border-[#303034] text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#C6FF3D]"
              >
                <option value="all">All Roles</option>
                <option value="customer">Customers</option>
                <option value="driver">Drivers</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#A1A1AA] uppercase mb-1">Status</label>
              <select
                value={supportStatusFilter}
                onChange={(e) => {
                  setSupportStatusFilter(e.target.value);
                  loadAdminSupportTickets(1, supportRoleFilter, e.target.value, supportPriorityFilter, supportSearchQuery);
                }}
                className="w-full bg-[#171719] border border-[#303034] text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#C6FF3D]"
              >
                <option value="all">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="WAITING_FOR_USER">WAITING FOR USER</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#A1A1AA] uppercase mb-1">Priority</label>
              <select
                value={supportPriorityFilter}
                onChange={(e) => {
                  setSupportPriorityFilter(e.target.value);
                  loadAdminSupportTickets(1, supportRoleFilter, supportStatusFilter, e.target.value, supportSearchQuery);
                }}
                className="w-full bg-[#171719] border border-[#303034] text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#C6FF3D]"
              >
                <option value="all">All Priorities</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#A1A1AA] uppercase mb-1">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ticket #, subject, name..."
                  value={supportSearchQuery}
                  onChange={(e) => setSupportSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadAdminSupportTickets(1, supportRoleFilter, supportStatusFilter, supportPriorityFilter, supportSearchQuery);
                    }
                  }}
                  className="w-full bg-[#171719] border border-[#303034] text-xs text-white rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-[#C6FF3D]"
                />
                <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Ticket Table */}
          {isLoadingSupport ? (
            <div className="text-center py-12 text-[#A1A1AA] text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#C6FF3D]" />
              <span>Loading support tickets...</span>
            </div>
          ) : adminTickets.length === 0 ? (
            <div className="text-center py-12 bg-[#202023]/40 rounded-2xl border border-[#303034] text-[#A1A1AA] text-sm">
              <LifeBuoy className="w-8 h-8 text-[#A1A1AA] mx-auto mb-2 opacity-50" />
              <p>No support tickets found matching the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-[#303034] rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] font-bold text-[#A1A1AA] uppercase bg-[#202023] border-b border-[#303034]">
                    <tr>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">User & Role</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#303034]/50">
                    {adminTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-[#202023]/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-white whitespace-nowrap">
                          {t.ticket_reference}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{t.user_name || 'User'}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[#A1A1AA]">
                            <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] ${
                              t.user_role === 'driver' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            }`}>
                              {t.user_role}
                            </span>
                            <span>{t.user_phone || t.user_email || ''}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#A1A1AA] whitespace-nowrap">
                          {t.category}
                        </td>
                        <td className="px-4 py-3 text-white max-w-xs truncate">
                          <div>{t.subject}</div>
                          {t.booking_id && (
                            <span className="text-[10px] text-[#C6FF3D]">Booking #{t.booking_id}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.priority === 'URGENT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            t.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                            t.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                          }`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            t.status === 'IN_PROGRESS' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                            t.status === 'WAITING_FOR_USER' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            t.status === 'RESOLVED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            'bg-zinc-600/30 text-zinc-400 border border-zinc-500/30'
                          }`}>
                            {t.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#A1A1AA] whitespace-nowrap">
                          {new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => loadSupportTicketDetails(t.id)}
                            className="px-2.5 py-1.5 bg-[#C6FF3D]/10 hover:bg-[#C6FF3D]/20 text-[#C6FF3D] border border-[#C6FF3D]/30 rounded-xl font-bold transition-all"
                          >
                            View Ticket
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Support Pagination Controls */}
              <div className="flex items-center justify-between text-xs text-[#A1A1AA] pt-2">
                <div>
                  Showing {adminTickets.length} of {adminTicketsTotal} support ticket{adminTicketsTotal === 1 ? '' : 's'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadAdminSupportTickets(adminTicketsPage - 1)}
                    disabled={adminTicketsPage <= 1 || isLoadingSupport}
                    className="px-3 py-1.5 rounded-xl bg-[#202023] hover:bg-[#28282C] border border-[#303034] text-white disabled:opacity-40 disabled:hover:bg-[#202023] transition-all font-bold"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-medium">
                    Page {adminTicketsPage} of {adminTicketsTotalPages || 1}
                  </span>
                  <button
                    onClick={() => loadAdminSupportTickets(adminTicketsPage + 1)}
                    disabled={adminTicketsPage >= adminTicketsTotalPages || isLoadingSupport}
                    className="px-3 py-1.5 rounded-xl bg-[#202023] hover:bg-[#28282C] border border-[#303034] text-white disabled:opacity-40 disabled:hover:bg-[#202023] transition-all font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Ticket Detail Modal */}
          {selectedSupportTicketDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#171719] border border-[#303034] rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="p-5 border-b border-[#303034] flex items-center justify-between bg-[#202023]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#C6FF3D] bg-[#C6FF3D]/10 px-2 py-0.5 rounded border border-[#C6FF3D]/30">
                        {selectedSupportTicketDetails.ticket.ticket_reference}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedSupportTicketDetails.ticket.user_role === 'driver' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {selectedSupportTicketDetails.ticket.user_role}
                      </span>
                      <span className="text-xs text-[#A1A1AA]">
                        • {selectedSupportTicketDetails.ticket.category}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1">
                      {selectedSupportTicketDetails.ticket.subject}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedSupportTicketDetails(null)}
                    className="p-2 text-[#A1A1AA] hover:text-white rounded-xl hover:bg-[#28282C] transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Ticket Meta Info & Status controls */}
                <div className="p-5 border-b border-[#303034] bg-[#1B1B1E] space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[#A1A1AA] uppercase block font-bold">User</span>
                      <span className="font-medium text-white">{selectedSupportTicketDetails.ticket.user_name || 'User'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#A1A1AA] uppercase block font-bold">Contact</span>
                      <span className="font-medium text-white">{selectedSupportTicketDetails.ticket.user_phone || selectedSupportTicketDetails.ticket.user_email || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#A1A1AA] uppercase block font-bold">Booking Link</span>
                      <span className="font-medium text-white">
                        {selectedSupportTicketDetails.ticket.booking_id ? `#${selectedSupportTicketDetails.ticket.booking_id}` : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#A1A1AA] uppercase block font-bold">Created</span>
                      <span className="font-medium text-white">
                        {new Date(selectedSupportTicketDetails.ticket.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Status / Priority update form */}
                  <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#303034]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#A1A1AA]">Status:</span>
                      <select
                        value={adminStatusUpdate}
                        onChange={(e) => setAdminStatusUpdate(e.target.value)}
                        className="bg-[#202023] border border-[#303034] text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#C6FF3D]"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="WAITING_FOR_USER">WAITING FOR USER</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#A1A1AA]">Priority:</span>
                      <select
                        value={adminPriorityUpdate}
                        onChange={(e) => setAdminPriorityUpdate(e.target.value)}
                        className="bg-[#202023] border border-[#303034] text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#C6FF3D]"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="URGENT">URGENT</option>
                      </select>
                    </div>

                    <button
                      onClick={handleAdminUpdateStatus}
                      disabled={isUpdatingSupportStatus}
                      className="px-3 py-1.5 bg-[#C6FF3D] hover:bg-[#B5F522] text-[#0B0B0D] rounded-xl text-xs font-black transition-all disabled:opacity-50"
                    >
                      {isUpdatingSupportStatus ? 'Saving...' : 'Update Status'}
                    </button>

                    {supportFeedback && (
                      <span className="text-xs text-[#C6FF3D] font-medium">{supportFeedback}</span>
                    )}
                  </div>
                </div>

                {/* Conversation Thread */}
                <div className="p-5 flex-1 overflow-y-auto space-y-4 max-h-[40vh] bg-[#121214]">
                  {selectedSupportTicketDetails.messages.map((m) => {
                    const isAdmin = m.sender_role === 'admin';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#A1A1AA]">
                          <span className={`font-bold uppercase ${isAdmin ? 'text-[#C6FF3D]' : 'text-white'}`}>
                            {isAdmin ? 'Admin / Support' : m.sender_name}
                          </span>
                          <span>•</span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs whitespace-pre-wrap leading-relaxed ${
                            isAdmin
                              ? 'bg-[#C6FF3D]/10 border border-[#C6FF3D]/30 text-white'
                              : 'bg-[#202023] border border-[#303034] text-[#E4E4E7]'
                          }`}
                        >
                          {m.message}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Admin Reply Box */}
                <div className="p-4 border-t border-[#303034] bg-[#171719]">
                  <form onSubmit={handleAdminReply} className="space-y-3">
                    <textarea
                      value={adminReplyInput}
                      onChange={(e) => setAdminReplyInput(e.target.value)}
                      placeholder="Type your reply to the user..."
                      rows={3}
                      className="w-full bg-[#202023] border border-[#303034] text-xs text-white rounded-2xl p-3 focus:outline-none focus:border-[#C6FF3D] placeholder-[#71717A] resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#A1A1AA]">
                        Sending a reply sets the ticket to Waiting for User.
                      </span>
                      <button
                        type="submit"
                        disabled={isSendingAdminReply || !adminReplyInput.trim()}
                        className="px-4 py-2 bg-[#C6FF3D] hover:bg-[#B5F522] text-[#0B0B0D] rounded-xl text-xs font-black transition-all flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isSendingAdminReply ? 'Sending...' : 'Send Reply'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
