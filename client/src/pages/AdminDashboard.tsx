import React, { useState, useEffect } from 'react';
import { 
  api, 
  AdminStats, 
  Booking, 
  FareRoute, 
  DriverAdminDetail, 
  SettlementOverview, 
  PlatformFinancials 
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
  Percent
} from 'lucide-react';

interface AdminDashboardProps {
  navigate: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ navigate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'drivers' | 'settlements' | 'routes' | 'commission' | 'bookings'>('overview');
  
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [financials, setFinancials] = useState<PlatformFinancials | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<DriverAdminDetail[]>([]);
  const [settlements, setSettlements] = useState<SettlementOverview | null>(null);
  const [routes, setRoutes] = useState<FareRoute[]>([]);
  const [commissionInput, setCommissionInput] = useState<number>(5);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Route editing state
  const [editingFares, setEditingFares] = useState<Record<number, number>>({});
  const [isSavingFare, setIsSavingFare] = useState<number | null>(null);
  const [fareMessage, setFareMessage] = useState<string | null>(null);

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
      const [dashRes, bookRes, drivRes, setlRes, commRes, finRes] = await Promise.all([
        api.admin.getDashboard(),
        api.admin.getAllBookings(),
        api.admin.getDrivers(),
        api.admin.getSettlements(),
        api.admin.getCommission(),
        api.admin.getFinancials()
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

      if (commRes.success && commRes.data) {
        setCommissionInput(commRes.data.commissionPerTrip);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
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
    return <div className="py-20 text-center text-xs text-slate-400">Loading Owner/Admin Console...</div>;
  }

  const m = stats?.metrics;
  const fin = financials || stats?.financials;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-950 text-xs font-bold uppercase mb-2">
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            <span>Kk_Auto Owner & Platform Control</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Owner Management Console
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage driver verifications, fixed routes, platform commission, marketplace payouts, and live bookings.
          </p>
        </div>

        <button
          onClick={loadAllData}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Global Toast Message */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-lg flex items-center justify-between animate-in fade-in duration-150">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 5-TAB CONTROLLER NAVIGATION */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-2xl text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Overview & Financials</span>
        </button>

        <button
          onClick={() => setActiveTab('drivers')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === 'drivers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>Driver Management</span>
          {m?.pendingDrivers && m.pendingDrivers > 0 ? (
            <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 rounded-full text-[10px] font-black">
              {m.pendingDrivers}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab('settlements')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === 'settlements' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payout Settlements</span>
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === 'routes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Fixed Routes & Fares</span>
        </button>

        <button
          onClick={() => setActiveTab('commission')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === 'commission' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          <span>Commission Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === 'bookings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>All Bookings ({bookings.length})</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & FINANCIALS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Financial Split Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-1">
              <span className="text-[10px] font-bold uppercase text-amber-400">Total Gross Volume</span>
              <div className="text-3xl font-black text-amber-400">₹{fin?.totalGrossVolume ?? 0}</div>
              <p className="text-[11px] text-slate-400">All customer bookings completed</p>
            </div>

            <div className="bg-emerald-50 rounded-3xl p-6 border-2 border-emerald-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase text-emerald-800">Owner Commission Earned</span>
              <div className="text-3xl font-black text-emerald-700">₹{fin?.ownerCommissionEarned ?? 0}</div>
              <p className="text-[11px] text-emerald-600">Platform fee retained (₹{fin?.commissionPerTrip ?? 5}/ride)</p>
            </div>

            <div className="bg-amber-50 rounded-3xl p-6 border-2 border-amber-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase text-amber-800">Driver Payouts (Total)</span>
              <div className="text-3xl font-black text-amber-600">₹{fin?.driverPayoutsTotal ?? 0}</div>
              <p className="text-[11px] text-amber-700">Net earned by auto drivers</p>
            </div>

            <div className="bg-rose-50 rounded-3xl p-6 border-2 border-rose-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase text-rose-800">Pending Driver Settlements</span>
              <div className="text-3xl font-black text-rose-600">₹{fin?.pendingSettlementsAmount ?? 0}</div>
              <p className="text-[11px] text-rose-700">Unsettled driver earnings balance</p>
            </div>
          </div>

          {/* Operational Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Customers</span>
              <div className="text-xl font-black text-slate-900 mt-1">{m?.totalCustomers ?? 0}</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Fleet Drivers</span>
              <div className="text-xl font-black text-slate-900 mt-1">{m?.totalDrivers ?? 0}</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pending Approvals</span>
              <div className="text-xl font-black text-amber-600 mt-1">{m?.pendingDrivers ?? 0}</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Rides</span>
              <div className="text-xl font-black text-slate-900 mt-1">{m?.totalBookings ?? 0}</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Active Rides</span>
              <div className="text-xl font-black text-amber-600 mt-1">{m?.activeBookings ?? 0}</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Completed</span>
              <div className="text-xl font-black text-emerald-600 mt-1">{m?.completedRides ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DRIVER MANAGEMENT & APPROVALS */}
      {activeTab === 'drivers' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Car className="w-5 h-5 text-amber-600" />
                <span>Driver Partner Registrations & Approvals</span>
              </h2>
              <p className="text-xs text-slate-500">
                Review applicant documents and authorize drivers to accept customer rides
              </p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-xl">
              {drivers.length} Total Drivers
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
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
              <tbody className="divide-y divide-slate-100">
                {drivers.map((d) => {
                  const status = (d.approval_status || 'PENDING').toUpperCase();
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{d.name}</div>
                        <div className="text-[10px] text-slate-400">{d.mobile} • {d.email}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold uppercase text-amber-800">{d.auto_number}</div>
                        <div className="text-[10px] text-slate-500">{d.auto_model}</div>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-[11px]">
                        {d.license_number}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">UPI: {d.payout_upi || '—'}</div>
                        {d.payout_bank_account && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            A/C: {d.payout_bank_account} ({d.payout_ifsc})
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{d.total_trips || 0} trips</div>
                        <div className="text-[10px] text-emerald-600 font-bold">₹{d.total_earnings || 0} earned</div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          status === 'APPROVED' || status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : status === 'PENDING'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {status !== 'APPROVED' && (
                            <button
                              onClick={() => handleDriverApproval(d.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-xs"
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
                              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] rounded-lg shadow-xs"
                            >
                              Suspend
                            </button>
                          )}
                          {status === 'SUSPENDED' && (
                            <button
                              onClick={() => handleDriverApproval(d.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-slate-900 text-white font-bold text-[11px] rounded-lg shadow-xs"
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <span>Pending Driver Payouts</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Driver balances earned from completed customer rides pending bank/UPI transfer
                </p>
              </div>
            </div>

            {(!settlements?.pendingDrivers || settlements.pendingDrivers.length === 0) ? (
              <div className="py-10 text-center space-y-2">
                <div className="text-3xl">✓</div>
                <p className="text-xs font-bold text-slate-700">All driver accounts are settled</p>
                <p className="text-[11px] text-slate-400">Zero pending driver payout balances</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Driver</th>
                      <th className="px-4 py-3">Auto Number</th>
                      <th className="px-4 py-3">Payout Account</th>
                      <th className="px-4 py-3">Pending Trips</th>
                      <th className="px-4 py-3">Pending Amount</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {settlements.pendingDrivers.map((p) => (
                      <tr key={p.driver_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          <div>{p.driver_name}</div>
                          <div className="text-[10px] text-slate-400">{p.mobile}</div>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold uppercase text-amber-700">
                          {p.auto_number}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800">UPI: {p.payout_upi || '—'}</div>
                          {p.payout_bank_account && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              A/C: {p.payout_bank_account} ({p.payout_ifsc})
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-700">
                          {p.pending_trips_count} trip(s)
                        </td>
                        <td className="px-4 py-3.5 font-black text-rose-600 text-sm">
                          ₹{p.pending_amount}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <button
                            onClick={() => handleSettlePayout(p.driver_id)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-transform hover:scale-102 flex items-center gap-1.5"
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
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Recent Settled Payouts History</h3>
              <div className="divide-y divide-slate-100">
                {settlements.settledHistory.map((s) => (
                  <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{s.driver_name}</span>
                      <span className="text-slate-400 font-mono ml-2">({s.auto_number})</span>
                      <div className="text-[10px] text-slate-500">
                        Ref: {s.transaction_reference} • Booking: {s.booking_reference}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-600">₹{s.driver_amount} Paid</div>
                      <span className="text-[10px] text-slate-400">
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
          {/* Add New Route Form */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-600" />
              <span>Add New Place-to-Place Route</span>
            </h3>
            <form onSubmit={handleAddRoute} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From Location *</label>
                <input
                  type="text"
                  value={newFrom}
                  onChange={(e) => setNewFrom(e.target.value)}
                  placeholder="e.g. Railway Station"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To Location *</label>
                <input
                  type="text"
                  value={newTo}
                  onChange={(e) => setNewTo(e.target.value)}
                  placeholder="e.g. JNTUA"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fixed Fare (₹) *</label>
                <input
                  type="number"
                  value={newFare}
                  onChange={(e) => setNewFare(Number(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isAddingRoute}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-transform hover:scale-102 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Add Route</span>
                </button>
              </div>
            </form>
          </div>

          {/* Existing Routes Table */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-600" />
                  <span>Authorized Fixed-Route Schedule</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Exact rates loaded from the fare_routes database table (Zero distance formulas)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {routes.map((r) => (
                <div
                  key={r.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    r.is_active 
                      ? 'bg-slate-50 border-slate-200/80' 
                      : 'bg-rose-50/50 border-rose-200 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-slate-400">Route #{r.id}</span>
                    <button
                      onClick={() => handleToggleRoute(r.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        r.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {r.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <div className="text-xs font-black text-slate-900 mb-3">
                    {r.from_location} → {r.to_location}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <div className="relative w-24">
                      <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        value={editingFares[r.id] ?? r.fare}
                        onChange={(e) =>
                          setEditingFares({
                            ...editingFares,
                            [r.id]: Number(e.target.value)
                          })
                        }
                        className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <button
                      onClick={() => handleSaveRouteFare(r.id)}
                      disabled={isSavingFare === r.id}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-transform hover:scale-105 disabled:opacity-50"
                    >
                      <Save className="w-3 h-3 text-amber-400" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: COMMISSION SETTINGS */}
      {activeTab === 'commission' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 max-w-xl space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Percent className="w-5 h-5 text-amber-600" />
              <span>Platform Commission Settings</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Fixed commission retained by the platform owner for each completed auto ride.
            </p>
          </div>

          <form onSubmit={handleUpdateCommission} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Owner Commission Per Trip (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={commissionInput}
                  onChange={(e) => setCommissionInput(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Example: On a ₹20 ride (JNTUA ↔ Cross), driver receives <strong>₹{Math.max(0, 20 - commissionInput)}</strong> and owner retains <strong>₹{commissionInput}</strong>.
              </p>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-transform hover:scale-102 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              <span>Update Commission Rate</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 6: ALL BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">All System Bookings</h2>
              <p className="text-xs text-slate-500">Live feed of all customer ride bookings with split payment records</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="Searching for Auto">Searching for Auto</option>
                <option value="Driver Assigned">Driver Assigned</option>
                <option value="Driver Arriving">Driver Arriving</option>
                <option value="Ride Started">Ride Started</option>
                <option value="Ride Completed">Ride Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reference, customer..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-medium"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
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
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                      {b.booking_reference}
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      <div>{b.customer_name || 'Customer'}</div>
                      <div className="text-[10px] text-slate-400">{b.customer_mobile}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      {b.auto_number ? (
                        <div>
                          <div className="font-bold text-slate-800">{b.driver_name}</div>
                          <div className="text-[10px] text-amber-700 font-mono font-bold uppercase">{b.auto_number}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 max-w-[200px]">
                      <div className="font-bold text-slate-900">{b.pickup_address} → {b.destination_address}</div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-black text-slate-900">₹{b.estimated_fare}</div>
                      {b.driver_amount !== undefined && (
                        <div className="text-[10px] text-slate-500">
                          Driver: ₹{b.driver_amount} • Owner: ₹{b.owner_amount}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {b.payment_status === 'COMPLETED' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          ✓ Paid ({b.payment_method || 'UPI'})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">
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
                        className="text-[11px] font-semibold bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
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
    </div>
  );
};
