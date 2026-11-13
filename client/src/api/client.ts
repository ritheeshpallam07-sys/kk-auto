import { safeGetLocal, safeRemoveLocal } from '../utils/storage';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta?: {
    total: number;
    page: number;
    totalPages: number;
  };
  error?: string;
  status?: number;
  valid?: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role: 'customer' | 'driver' | 'admin';
  terms_version?: string | null;
  terms_accepted_at?: string | null;
}

export interface AccountDeletionRequest {
  id: number;
  user_id: number;
  user_role: string;
  user_email: string;
  user_mobile: string;
  reason?: string | null;
  status: 'PENDING' | 'PROCESSED' | 'REJECTED';
  requested_at: string;
  processed_at?: string | null;
}

export interface DeletionRequestResponse {
  hasPendingRequest: boolean;
  request: AccountDeletionRequest | null;
}

export interface AdminAuditLog {
  id: number;
  admin_id?: number | null;
  admin_email: string;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  details?: Record<string, any> | null;
  client_ip?: string | null;
  created_at: string;
}

export interface AuditLogsResponse {
  data: AdminAuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FareEstimate {
  available: boolean;
  pickupAddress: string;
  destinationAddress: string;
  estimatedFare: number;
  passengers: number;
  pickupZone?: string;
  destinationZone?: string;
  pickupZoneId?: number;
  destinationZoneId?: number;
}

export interface FareZone {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  aliases: string[];
}

export interface Booking {
  id: number;
  booking_reference: string;
  customer_id: number;
  driver_id?: number | null;
  customer_name?: string;
  customer_mobile?: string;
  customer_email?: string;
  driver_name?: string;
  driver_mobile?: string;
  driver_payout_upi?: string;
  driver_payment_confirmed_at?: string | null;
  auto_number?: string;
  auto_model?: string;
  license_number?: string;
  pickup_address: string;
  destination_address: string;
  pickup_latitude?: number | null;
pickup_longitude?: number | null;
destination_latitude?: number | null;
destination_longitude?: number | null;
  pickup_area_name?: string;
  destination_area_name?: string;
  pickup_datetime: string;
  passengers: number;
  estimated_fare: number;
  status: 'Searching for Auto' | 'Driver Assigned' | 'Driver Arriving' | 'Ride Started' | 'Ride Completed' | 'Cancelled';
  payment_status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  payment_method?: string;
  transaction_reference?: string;
  settlement_status?: 'PENDING' | 'SETTLED';
  driver_amount?: number;
  owner_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface TripDestination {
  name: string;
  address?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
}

export interface TripBooking {
  id: number;
  booking_reference: string;
  customer_id: number;
  customer_name: string;
  phone_number: string;
  members: number;
  email?: string;
  trip_place: string;
  trip_destinations?: TripDestination[];
  days: number;
  trip_date: string;
  pickup_time: string;
  status: 'NEW' | 'CONTACTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  quoted_price: number | null;
  customer_confirmed: boolean;
  customer_confirmed_at: string | null;
  payment_status: 'PENDING' | 'PAID' | 'FAILED';
  payment_reference: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  customer_account_email?: string;
  payment_session_id?: string;
  environment?: 'sandbox' | 'production';
}

export interface PaymentRecord {
  id: number;
  booking_id: number;
  customer_id: number;
  driver_id?: number | null;
  total_amount: number;
  driver_amount: number;
  owner_amount: number;
  commission_amount: number;
  payment_status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  settlement_status: 'PENDING' | 'SETTLED';
  payment_method: string;
  transaction_reference: string;
  gateway_order_id?: string;
  gateway_payment_id?: string;
  payment_session_id?: string;
  environment?: 'sandbox' | 'production';
  settled_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Resolves Cashfree SDK mode ('sandbox' | 'production') based on:
 * 1. Environment returned by server for the specific order (if present)
 * 2. VITE_CASHFREE_MODE environment variable
 * 3. Default fallback: 'sandbox'
 */
export const getCashfreeMode = (orderEnvironment?: string): 'sandbox' | 'production' => {
  if (orderEnvironment === 'production' || orderEnvironment === 'sandbox') {
    return orderEnvironment;
  }
  const configured = (import.meta.env.VITE_CASHFREE_MODE || '').toLowerCase();
  if (configured === 'production') return 'production';
  return 'sandbox';
};

export interface DriverEarningsSummary {
  todayEarnings: number;
  todayRidesCount?: number;
  averageRating?: number | null;
  ratingCount?: number;
  totalEarnings: number;
  pendingSettlement: number;
  settledAmount: number;
  completedRidesCount: number;
  payoutUpi?: string;
  payoutBankAccount?: string;
  payoutIfsc?: string;
  payments: PaymentRecord[];
}

export interface SafeDriver {
  id: number;
  name: string;
  auto_number: string;
  auto_model: string;
  availability_status: 'available' | 'offline' | 'on_ride';
}

export interface DriverProfile {
  id: number;
  user_id: number;
  name: string;
  email: string;
  mobile: string;
  auto_number: string;
  auto_model: string;
  license_number: string;
  availability_status: 'available' | 'offline' | 'on_ride';
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'SUSPENDED';
  payout_upi?: string;
  payout_bank_account?: string;
  payout_ifsc?: string;
  earnings?: DriverEarningsSummary;
}

export interface DriverAdminDetail extends DriverProfile {
  registered_at: string;
  total_trips: number;
  total_earnings: number;
  pending_payout: number;
}

export interface SupportConfig {
  email: string;
  phone: string | null;
  whatsapp: string | null;
  phoneConfigured: boolean;
  whatsappConfigured: boolean;
}

export interface SupportTicket {
  id: number;
  ticket_reference: string;
  user_id: number;
  user_role: string;
  user_name?: string;
  user_email?: string;
  user_mobile?: string;
  user_phone?: string;
  category: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  booking_id: number | null;
  booking_reference?: string | null;
  message_count?: number;
  latest_message?: string | null;
  latest_message_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: number;
  ticket_id: number;
  sender_user_id: number;
  sender_role: string;
  sender_name?: string;
  message: string;
  created_at: string;
}

export interface SupportTicketDetails {
  ticket: SupportTicket;
  messages: SupportMessage[];
  booking?: {
    id: number;
    booking_reference: string;
    pickup_address: string;
    destination_address: string;
    status: string;
    estimated_fare: number;
    pickup_datetime: string;
  } | null;
}

export interface FareRoute {
  id: number;
  from_location: string;
  to_location: string;
  fare: number;
  is_active: boolean;
  updated_at: string;
}

export interface PlatformFinancials {
  totalGrossVolume: number;
  ownerCommissionEarned: number;
  driverPayoutsTotal: number;
  pendingSettlementsAmount: number;
  settledPayoutsAmount: number;
  totalCompletedPayments: number;
  commissionPerTrip: number;
}

export interface AdminStats {
  metrics: {
    totalCustomers: number;
    totalDrivers: number;
    pendingDrivers?: number;
    totalBookings: number;
    activeBookings: number;
    completedRides: number;
    cancelledRides: number;
    totalRevenue: number;
    ownerCommission?: number;
    driverPayouts?: number;
    pendingSettlements?: number;
    settledPayouts?: number;
  };
  financials?: PlatformFinancials;
  fareRoutes: FareRoute[];
}

export interface SettlementOverview {
  pendingDrivers: {
    driver_id: number;
    driver_name: string;
    mobile: string;
    auto_number: string;
    payout_upi?: string;
    payout_bank_account?: string;
    payout_ifsc?: string;
    pending_trips_count: number;
    pending_amount: number;
  }[];
  settledHistory: (PaymentRecord & { driver_name: string; auto_number: string; booking_reference: string })[];
}

export interface RatingRecord {
  id: number;
  booking_id: number;
  customer_id: number;
  driver_id: number;
  rating: number;
  review?: string;
  created_at: string;
    driver_name?: string;
  customer_name?: string;
  auto_number?: string;
  booking_reference?: string;
}

let inMemoryCsrfToken: string | null = null;
let csrfFetchPromise: Promise<string | null> | null = null;

function getCsrfTokenFromCookie(): string | null {
  try {
    if (typeof document === 'undefined' || !document.cookie) return null;
    const match = document.cookie.match(/(?:^|;\s*)kk_csrf=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function getStoredCsrfToken(): string | null {
  return inMemoryCsrfToken || getCsrfTokenFromCookie();
}

export function setStoredCsrfToken(token: string | null) {
  inMemoryCsrfToken = token;
}

export async function ensureCsrfToken(): Promise<string | null> {
  const current = getStoredCsrfToken();
  if (current) return current;

  if (!csrfFetchPromise) {
    csrfFetchPromise = fetch(`${API_BASE}/auth/csrf-token`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json().catch(() => ({}));
        if (data && data.success && typeof data.csrfToken === 'string') {
          inMemoryCsrfToken = data.csrfToken;
          return data.csrfToken;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        csrfFetchPromise = null;
      });
  }

  return csrfFetchPromise;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<ApiResponse<T>> {
  // Proactive migration safeguard: scrub any legacy localStorage token
  if (safeGetLocal('kk_token')) {
    safeRemoveLocal('kk_token');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  // SEC-05: Attach CSRF token on state-changing requests when available
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: options.signal || controller.signal
    });
    clearTimeout(timeoutId);

    let data: any = {};
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || 'Server returned invalid response' };
      }
    }

    if (data && typeof data.csrfToken === 'string') {
      inMemoryCsrfToken = data.csrfToken;
    }

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: data.error || (res.status === 401 ? 'Session expired' : 'Request failed')
      };
    }

    return {
      ...data,
      status: res.status
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return {
      success: false,
      status: 0,
      error: isTimeout ? 'Connection timed out. Please check your internet.' : (err.message || 'Network error')
    };
  }
}

export const api = {
  auth: {
    register: (data: any) => request<
      | { requiresVerification: true; email: string }
      | { user: User }
    >('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    verifyEmailOtp: (email: string, otp: string) =>
      request<{ user: User }>('/auth/verify-email-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp })
      }),
    login: (identifier: string, password: string) => request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    }),
    getCsrfToken: () => request<{ csrfToken: string }>('/auth/csrf-token'),
    logout: async () => {
      try {
        return await request('/auth/logout', { method: 'POST' });
      } finally {
        inMemoryCsrfToken = null;
      }
    },
    forgotPassword: (email: string) =>
      request<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      }),
    verifyResetToken: (token: string) =>
      request<{ valid: boolean }>('/auth/verify-reset-token', {
        method: 'POST',
        body: JSON.stringify({ token })
      }),
    resetPassword: (data: { token: string; newPassword: string; confirmPassword: string }) =>
      request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      request<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    me: () => request<User>('/auth/me'),
    acceptTerms: (version = '1.0') =>
      request<User>('/auth/accept-terms', {
        method: 'POST',
        body: JSON.stringify({ version })
      }),
    getDeletionRequest: () =>
      request<DeletionRequestResponse>('/auth/deletion-request'),
    requestAccountDeletion: (reason?: string) =>
      request<AccountDeletionRequest>('/auth/deletion-request', {
        method: 'POST',
        body: JSON.stringify({ reason })
      }),
    cancelAccountDeletion: () =>
      request<{ success: boolean }>('/auth/deletion-request', {
        method: 'DELETE'
      })
  },
  bookings: {
    getLocations: () => request<string[]>('/bookings/locations'),
    getFareZones: () => request<FareZone[]>('/bookings/zones'),
    getFareEstimate: (params: {
      fromLocation: string;
      toLocation: string;
      passengers?: number;
      pickupLatitude?: number;
      pickupLongitude?: number;
      destinationLatitude?: number;
      destinationLongitude?: number;
    }) =>
      request<FareEstimate>('/bookings/fare-estimate', {
        method: 'POST',
        body: JSON.stringify(params)
      }),
    create: (data: {
      pickupAddress: string;
      destinationAddress: string;
      pickupDateTime?: string;
      passengers?: number;
      pickupLatitude?: number;
      pickupLongitude?: number;
      destinationLatitude?: number;
      destinationLongitude?: number;
    }) => request<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getMyBookings: () => request<Booking[]>('/bookings'),
    getById: (id: string | number) => request<Booking>(`/bookings/${id}`),
    cancel: (id: string | number) => request<Booking>(`/bookings/${id}/cancel`, {
      method: 'PATCH'
    })
  },
  payments: {
    createOrder: (params: { bookingId: number; paymentMethod?: string }) =>
      request<PaymentRecord>('/payments/create-order', {
        method: 'POST',
        body: JSON.stringify(params)
      }),
    sandboxPay: (params: { bookingId: number; paymentMethod?: string }) =>
      request<PaymentRecord>('/payments/sandbox-pay', {
        method: 'POST',
        body: JSON.stringify(params)
      }),
    getBookingPayment: (bookingId: number) =>
      request<{ payment: PaymentRecord | null; rating: RatingRecord | null }>(`/payments/booking/${bookingId}`),
        confirmDriverPayment: (bookingId: number) =>
      request<PaymentRecord>(
        `/payments/driver/confirm-payment/${bookingId}`,
        { method: 'POST' }
      ),
    rateDriver: (params: { bookingId: number; rating: number; review?: string }) =>
      request<RatingRecord>('/payments/rate-driver', {
        method: 'POST',
        body: JSON.stringify(params)
      })
  },
  driver: {
    getProfile: () => request<DriverProfile>('/drivers/me'),
    updateProfile: (data: { name: string; mobile: string; payout_upi?: string; payoutUpi?: string }) =>
      request<DriverProfile>('/drivers/me', {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    getPushPublicKey: () =>
  request<{ publicKey: string }>('/drivers/push-public-key'),

savePushSubscription: (subscription: {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}) =>
  request('/drivers/push-subscription', {
    method: 'POST',
    body: JSON.stringify(subscription)
  }),
    updateStatus: (status: string) => request('/drivers/status', {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),
    getRequests: () => request<Booking[]>('/drivers/requests'),
    acceptRide: (bookingId: number) => request<Booking>(`/drivers/rides/${bookingId}/accept`, {
      method: 'POST'
    }),
    updateRideStatus: (bookingId: number, status: string) => request<Booking>(`/drivers/rides/${bookingId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),
    getDirectory: () => request<SafeDriver[]>('/drivers'),
    getEarnings: () => request<DriverEarningsSummary>('/payments/driver/earnings')
  },
  admin: {
    getDashboard: () => request<AdminStats>('/admin/dashboard'),
    getFinancials: () => request<PlatformFinancials>('/admin/financials'),
    getDriverRatings: () => request<any>('/admin/ratings'),
    getAllBookings: () => request<Booking[]>('/admin/bookings'),
    updateBookingStatus: (id: number, status: string) => request<Booking>(`/admin/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),
    getDrivers: () => request<DriverAdminDetail[]>('/admin/drivers'),
    updateDriverApproval: (id: number, status: string) => request<DriverProfile>(`/admin/drivers/${id}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),
    getCustomers: () => request<any[]>('/admin/customers'),
    getFareRoutes: () => request<FareRoute[]>('/admin/fare-config'),
    updateFareRoute: (id: number, fare: number) => request<FareRoute>('/admin/fare-config', {
      method: 'PATCH',
      body: JSON.stringify({ id, fare })
    }),
    addRoute: (params: { fromLocation: string; toLocation: string; fare: number }) =>
      request<FareRoute>('/admin/routes', {
        method: 'POST',
        body: JSON.stringify(params)
      }),
    toggleRoute: (id: number) => request<FareRoute>(`/admin/routes/${id}/toggle`, {
      method: 'PATCH'
    }),
    getCommission: () => request<{ commissionPerTrip: number }>('/admin/commission'),
    updateCommission: (commission: number) => request<{ commissionPerTrip: number }>('/admin/commission', {
      method: 'PATCH',
      body: JSON.stringify({ commission })
    }),
    getSettlements: () => request<SettlementOverview>('/admin/settlements'),
    settlePayouts: (params: { driverId?: number; paymentId?: number }) =>
      request<{ settledCount: number; settledAmount: number }>('/admin/settlements/settle', {
        method: 'POST',
        body: JSON.stringify(params)
      }),
    getDeletionRequests: () =>
      request<Array<{
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
      }>>('/admin/deletion-requests'),
    processDeletionRequest: (id: number, data: { action: 'APPROVE' | 'REJECT'; adminNotes?: string }) =>
      request<{ success: boolean; message: string }>(`/admin/deletion-requests/${id}/process`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    getAuditLogs: (params?: { page?: number; limit?: number; action?: string; admin?: string; targetId?: string; startDate?: string; endDate?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.action) q.set('action', params.action);
      if (params?.admin) q.set('admin', params.admin);
      if (params?.targetId) q.set('targetId', params.targetId);
      if (params?.startDate) q.set('startDate', params.startDate);
      if (params?.endDate) q.set('endDate', params.endDate);
      const qs = q.toString();
      return request<AdminAuditLog[]>(`/admin/audit-logs${qs ? '?' + qs : ''}`);
    }
  },
  tripBookings: {
    create: (data: {
      customerName: string;
      phoneNumber: string;
      members: number;
      tripPlace: string;
      destinations?: TripDestination[];
      days: number;
      tripDate: string;
      pickupTime: string;
    }) =>
      request<TripBooking>('/trip-bookings', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    getMy: () => request<TripBooking[]>('/trip-bookings/my'),
    getById: (id: number) => request<TripBooking>(`/trip-bookings/${id}`),
    createOrder: (id: number, paymentMethod?: string) =>
      request<TripBooking>(`/trip-bookings/${id}/create-order`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod })
      }),
    sandboxPay: (id: number, paymentMethod?: string) =>
      request<TripBooking>(`/trip-bookings/${id}/sandbox-pay`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod })
      }),
    getOwnerContact: () => request<{ phone: string; whatsapp: string }>('/trip-bookings/contact'),
    getAllOwner: () => request<TripBooking[]>('/trip-bookings/owner/all'),
    updateByOwner: (id: number, data: { quotedPrice?: number; status?: string }) =>
      request<TripBooking>(`/trip-bookings/owner/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
      

confirmTrip: (id: number) =>
  request<TripBooking>(`/trip-bookings/${id}/confirm`, {
    method: 'POST'
  })

      
  },
  support: {
    getConfig: () => request<SupportConfig>('/support/config'),
    createTicket: (data: { category: string; subject: string; message: string; bookingId?: number }) =>
      request<SupportTicket>('/support/tickets', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    getTickets: (params?: {
      page?: number;
      limit?: number;
      userRole?: string;
      category?: string;
      status?: string;
      priority?: string;
      search?: string;
    }) => {
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
        });
      }
      const qs = sp.toString();
      return request<any>(`/support/tickets${qs ? '?' + qs : ''}`);
    },
    getTicketDetails: (id: number) => request<SupportTicketDetails>(`/support/tickets/${id}`),
    addMessage: (id: number, message: string) =>
      request<SupportMessage>(`/support/tickets/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message })
      }),
    updateStatus: (id: number, data: { status?: string; priority?: string }) =>
      request<SupportTicket>(`/support/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      })
  }
};
