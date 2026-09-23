const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role: 'customer' | 'driver' | 'admin';
}

export interface FareEstimate {
  available: boolean;
  pickupAddress: string;
  destinationAddress: string;
  estimatedFare: number;
  passengers: number;
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
  auto_number?: string;
  auto_model?: string;
  license_number?: string;
  pickup_address: string;
  destination_address: string;
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
  settled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DriverEarningsSummary {
  todayEarnings: number;
  totalEarnings: number;
  pendingSettlement: number;
  settledAmount: number;
  completedRidesCount: number;
  payoutUpi?: string;
  payoutBankAccount?: string;
  payoutIfsc?: string;
  payments: PaymentRecord[];
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
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('kk_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong');
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error'
    };
  }
}

export const api = {
  auth: {
    register: (data: any) => request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    login: (identifier: string, password: string) => request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request<User>('/auth/me')
  },
  bookings: {
    getLocations: () => request<string[]>('/bookings/locations'),
    getFareEstimate: (params: { fromLocation: string; toLocation: string; passengers?: number }) =>
      request<FareEstimate>('/bookings/fare-estimate', {
        method: 'POST',
        body: JSON.stringify(params)
      }),
    create: (data: {
      pickupAddress: string;
      destinationAddress: string;
      pickupDateTime?: string;
      passengers?: number;
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
    rateDriver: (params: { bookingId: number; rating: number; review?: string }) =>
      request<RatingRecord>('/payments/rate-driver', {
        method: 'POST',
        body: JSON.stringify(params)
      })
  },
  driver: {
    getProfile: () => request<DriverProfile>('/drivers/me'),
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
    getEarnings: () => request<DriverEarningsSummary>('/payments/driver/earnings')
  },
  admin: {
    getDashboard: () => request<AdminStats>('/admin/dashboard'),
    getFinancials: () => request<PlatformFinancials>('/admin/financials'),
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
      })
  }
};
