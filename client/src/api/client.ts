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

export interface TripBooking {
  id: number;
  booking_reference: string;
  customer_id: number;
  customer_name: string;
  phone_number: string;
  members: number;
  email?: string;
  trip_place: string;
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
    driver_name?: string;
  customer_name?: string;
  auto_number?: string;
  booking_reference?: string;
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
  headers,
  cache: 'no-store'
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
    register: (data: any) =>request<
  | { requiresVerification: true; email: string }
  | { user: User; token: string }
>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    verifyEmailOtp: (email: string, otp: string) =>
  request<{ user: User; token: string }>('/auth/verify-email-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp })
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
    rateDriver: (params: { bookingId: number; rating: number; review?: string }) =>
      request<RatingRecord>('/payments/rate-driver', {
        method: 'POST',
        body: JSON.stringify(params)
      })
  },
  driver: {
    getProfile: () => request<DriverProfile>('/drivers/me'),
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
      })
  },
  tripBookings: {
    create: (data: {
      customerName: string;
      phoneNumber: string;
      members: number;
      tripPlace: string;
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

      
  }
};
