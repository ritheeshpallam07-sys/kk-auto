import { query } from '../config/db';
import { Cashfree, CFEnvironment } from 'cashfree-pg';

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

export interface CreateTripBookingInput {
  customerName: string;
  phoneNumber: string;
  members: number;
  tripPlace?: string;
  destinations?: Array<TripDestination | string>;
  days: number;
  tripDate: string;
  pickupTime: string;
}

const MAX_TRIP_DESTINATIONS = 10;

const normalizeDestinationsInput = (
  destinations?: Array<TripDestination | string>,
  fallbackPlace?: string
): TripDestination[] => {
  if (Array.isArray(destinations)) {
    if (destinations.length > MAX_TRIP_DESTINATIONS) {
      throw new Error(`You can add a maximum of ${MAX_TRIP_DESTINATIONS} destinations per trip.`);
    }

    if (destinations.length > 0) {
      const normalized: TripDestination[] = [];
      for (const entry of destinations) {
        if (typeof entry === 'string') {
          const name = entry.trim();
          if (!name) {
            throw new Error('Please fill in or remove empty destination fields.');
          }
          normalized.push({ name });
          continue;
        }

        if (!entry || typeof entry !== 'object') {
          throw new Error('Invalid destination entry provided.');
        }

        const name = (entry.name || entry.address || '').trim();
        if (!name) {
          throw new Error('Please fill in or remove empty destination fields.');
        }

        const item: TripDestination = { name };
        if (typeof entry.address === 'string' && entry.address.trim()) {
          item.address = entry.address.trim();
        }
        if (typeof entry.placeId === 'string' && entry.placeId.trim()) {
          item.placeId = entry.placeId.trim();
        }
        if (typeof entry.lat === 'number' && Number.isFinite(entry.lat)) {
          item.lat = entry.lat;
        }
        if (typeof entry.lng === 'number' && Number.isFinite(entry.lng)) {
          item.lng = entry.lng;
        }
        normalized.push(item);
      }
      return normalized;
    }

    if (!(fallbackPlace || '').trim()) {
      throw new Error('At least one destination is required.');
    }
  } else if (destinations !== undefined) {
    throw new Error('Destinations must be provided as a valid list.');
  }

  const singlePlace = (fallbackPlace || '').trim();
  if (!singlePlace) {
    throw new Error('At least one destination is required.');
  }
  return [{ name: singlePlace }];
};

const normalizeTripBookingRow = (row: TripBooking): TripBooking => {
  let parsedDestinations: TripDestination[] = [];
  const raw = (row as any).trip_destinations;

  if (Array.isArray(raw)) {
    parsedDestinations = raw
      .filter((d) => d && typeof d.name === 'string' && d.name.trim())
      .map((d) => ({
        name: d.name.trim(),
        ...(d.address ? { address: String(d.address) } : {}),
        ...(d.placeId ? { placeId: String(d.placeId) } : {}),
        ...(typeof d.lat === 'number' && Number.isFinite(d.lat) ? { lat: d.lat } : {}),
        ...(typeof d.lng === 'number' && Number.isFinite(d.lng) ? { lng: d.lng } : {})
      }));
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const json = JSON.parse(raw);
      if (Array.isArray(json)) {
        parsedDestinations = json
          .filter((d) => d && typeof d.name === 'string' && d.name.trim())
          .map((d) => ({
            name: d.name.trim(),
            ...(d.address ? { address: String(d.address) } : {}),
            ...(d.placeId ? { placeId: String(d.placeId) } : {}),
            ...(typeof d.lat === 'number' && Number.isFinite(d.lat) ? { lat: d.lat } : {}),
            ...(typeof d.lng === 'number' && Number.isFinite(d.lng) ? { lng: d.lng } : {})
          }));
      }
    } catch {
      parsedDestinations = [];
    }
  }

  if (parsedDestinations.length === 0 && typeof row.trip_place === 'string' && row.trip_place.trim()) {
    parsedDestinations = [{ name: row.trip_place.trim() }];
  }

  return {
    ...row,
    trip_destinations: parsedDestinations
  };
};

const validatePhoneNumber = (phoneNumber: string): void => {
  const digits = phoneNumber.replace(/\D/g, '');
  let national = digits;
  if (digits.length === 12 && digits.startsWith('91')) {
    national = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    national = digits.slice(1);
  }
  if (!/^\d{10}$/.test(national) || /^(\d)\1{9}$/.test(national)) {
    throw new Error('Please provide a valid 10-digit phone number.');
  }
};

const validateTripDateAndTime = (tripDate: string, pickupTime: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tripDate)) {
    throw new Error('Please provide a valid travel date (YYYY-MM-DD).');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)) {
    throw new Error('Please provide a valid pickup time (HH:MM).');
  }

  const [year, month, day] = tripDate.split('-').map(Number);
  const checkUtc = new Date(Date.UTC(year, month - 1, day));
  if (
    checkUtc.getUTCFullYear() !== year ||
    checkUtc.getUTCMonth() + 1 !== month ||
    checkUtc.getUTCDate() !== day
  ) {
    throw new Error('Please provide a valid calendar travel date.');
  }

  // Interpret trip date & pickup time in IST (+05:30) with a 60s submission grace window
  const scheduledIst = new Date(`${tripDate}T${pickupTime}:00+05:30`);
  if (isNaN(scheduledIst.getTime())) {
    throw new Error('Invalid travel date or pickup time.');
  }

  if (scheduledIst.getTime() < Date.now() - 60_000) {
    throw new Error('Travel date and pickup time cannot be in the past.');
  }
};

export class TripBookingService {
  /**
   * Helper to determine Cashfree environment
   */
  public static isProductionEnvironment(): boolean {
    const appId = process.env.CASHFREE_APP_ID || '';
    return (
      process.env.CASHFREE_ENVIRONMENT === 'production' ||
      process.env.CASHFREE_ENV === 'production' ||
      (process.env.NODE_ENV === 'production' && !appId.startsWith('TEST'))
    );
  }

  /**
   * Helper to lazily instantiate Cashfree SDK client
   */
  private static getCashfreeClient(): Cashfree | null {
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    if (!appId || !secretKey) {
      return null;
    }
    const isProd = this.isProductionEnvironment();
    const client = new Cashfree(
      isProd ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
      appId,
      secretKey
    );
    client.XApiVersion = '2025-01-01';
    return client;
  }

  /**
   * Customer creates a new car/trip booking request
   */
  public static async createTripBooking(
    customerId: number,
    data: CreateTripBookingInput
  ): Promise<TripBooking> {
    const customerName = (data.customerName || '').trim();
    const phoneNumber = (data.phoneNumber || '').trim();
    const rawTripPlace = (data.tripPlace || '').trim();
    const tripDate = (data.tripDate || '').trim();
    const pickupTime = (data.pickupTime || '').trim();
    const members = Number(data.members);
    const days = Number(data.days);

    if (!customerName) {
      throw new Error('Customer Name is required.');
    }

    validatePhoneNumber(phoneNumber);

    if (!Number.isInteger(members) || members < 1 || members > 20) {
      throw new Error('Number of passengers must be between 1 and 20.');
    }

    const destinations = normalizeDestinationsInput(data.destinations, rawTripPlace);
    const tripPlace = destinations.map((d) => d.name).join(' → ');

    if (!Number.isInteger(days) || days < 1 || days > 30) {
      throw new Error('Trip duration must be between 1 and 30 days.');
    }

    if (!tripDate) {
      throw new Error('Travel Date is required.');
    }

    if (!pickupTime) {
      throw new Error('Pickup Time is required.');
    }

    validateTripDateAndTime(tripDate, pickupTime);

    // Generate unique booking reference: e.g. CB-104829
    let bookingReference = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      attempts++;
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      bookingReference = `CB-${randomSuffix}`;
      const check = await query('SELECT id FROM trip_bookings WHERE booking_reference = $1 LIMIT 1', [
        bookingReference
      ]);
      if (check.rows.length === 0) {
        isUnique = true;
      }
    }

    const result = await query<TripBooking>(
      `INSERT INTO trip_bookings (
        booking_reference,
        customer_id,
        customer_name,
        phone_number,
        members,
        trip_place,
        trip_destinations,
        days,
        trip_date,
        pickup_time,
        status,
        quoted_price,
        payment_status,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, 'NEW', NULL, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *`,
      [
        bookingReference,
        customerId,
        customerName,
        phoneNumber,
        members,
        tripPlace,
        JSON.stringify(destinations),
        days,
        tripDate,
        pickupTime
      ]
    );

    return normalizeTripBookingRow(result.rows[0]);
  }

  /**
   * Get all car/trip bookings for the logged-in customer
   */
  public static async getMyTripBookings(customerId: number): Promise<TripBooking[]> {
    const result = await query<TripBooking>(
      `SELECT * FROM trip_bookings
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    );
    return result.rows.map(normalizeTripBookingRow);
  }

  /**
   * Get single trip booking by ID (with ownership check if customer)
   */
  public static async getTripBookingById(id: number, customerId?: number): Promise<TripBooking> {
    const result = await query<TripBooking>(
      `SELECT * FROM trip_bookings WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Trip booking request not found.');
    }

    const trip = normalizeTripBookingRow(result.rows[0]);
    if (customerId && Number(trip.customer_id) !== Number(customerId)) {
      throw new Error('You are not authorized to view this trip booking.');
    }

    return trip;
  }

  /**
   * Owner/Admin views all trip booking requests
   */
  public static async getAllTripBookings(): Promise<TripBooking[]> {
    const result = await query<TripBooking>(
      `SELECT tb.*, u.email as customer_account_email
       FROM trip_bookings tb
       JOIN users u ON tb.customer_id = u.id
       ORDER BY tb.created_at DESC`
    );
    return result.rows.map(normalizeTripBookingRow);
  }

  /**
   * Owner sets final quoted price and/or updates booking status
   */
  public static async updateTripBookingByOwner(
    id: number,
    data: { quotedPrice?: number; status?: string }
  ): Promise<TripBooking> {
    const existing = await query<TripBooking>(
      `SELECT * FROM trip_bookings WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (existing.rows.length === 0) {
      throw new Error('Trip booking request not found.');
    }

    const current = existing.rows[0];
    const allowedStatuses = ['NEW', 'CONTACTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

    let newStatus = current.status;
    if (data.status !== undefined && data.status !== null) {
      const upper = String(data.status).trim().toUpperCase();
      if (!allowedStatuses.includes(upper)) {
        throw new Error(`Invalid status. Allowed values: ${allowedStatuses.join(', ')}`);
      }
      newStatus = upper as TripBooking['status'];
    }

    let newPrice = current.quoted_price;
    if (data.quotedPrice !== undefined && data.quotedPrice !== null) {
      const priceNum = Number(data.quotedPrice);
      if (isNaN(priceNum) || priceNum < 0) {
        throw new Error('Quoted price must be a valid positive number.');
      }
      newPrice = priceNum;
    }

    const result = await query<TripBooking>(
      `UPDATE trip_bookings
       SET quoted_price = $1,
           status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [newPrice, newStatus, id]
    );

    return normalizeTripBookingRow(result.rows[0]);
  }

  /**
   * Customer initiates online payment: creates Cashfree order for confirmed trip
   */
  public static async createTripPaymentOrder(
    tripId: number,
    customerId: number,
    paymentMethod: string = 'UPI'
  ): Promise<TripBooking & { payment_session_id?: string }> {
    const trip = await this.getTripBookingById(tripId, customerId);
    
    if (!trip.customer_confirmed) {
      throw new Error('Please confirm the trip before making payment.');
    }

    if (trip.status !== 'CONFIRMED') {
      throw new Error('Payment is available only after the booking is confirmed by the owner.');
    }

    if (!trip.quoted_price || trip.quoted_price <= 0) {
      throw new Error('Quoted price has not been set by the owner yet.');
    }

    if (trip.payment_status === 'PAID') {
      return trip;
    }

    // Get customer account details
    const userRes = await query(
      `SELECT email, mobile, name FROM users WHERE id = $1 LIMIT 1`,
      [customerId]
    );
    const user = userRes.rows[0] || {};

    const amount = Number(trip.quoted_price);
    const orderId = `TRIP_${trip.id}_${Date.now()}`;
    const cleanPhone = (trip.phone_number || user.mobile || '').replace(/\D/g, '').slice(-10) || '9999999999';

    // Update payment method & pending reference in DB
    await query(
      `UPDATE trip_bookings
       SET payment_method = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [paymentMethod, trip.id]
    );

    const cashfree = this.getCashfreeClient();
    if (!cashfree) {
      // In development if credentials not provided, return order info
      return {
        ...trip,
        payment_reference: orderId
      };
    }

    try {
      const cashfreeRequest = {
        order_amount: Number(amount.toFixed(2)),
        order_currency: 'INR',
        order_id: orderId,
        customer_details: {
          customer_id: String(customerId),
          customer_name: trip.customer_name || user.name || `Customer ${customerId}`,
          customer_email: user.email || 'customer@kkauto.com',
          customer_phone: cleanPhone
        },
        order_meta: {
          return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?trip_order_id={order_id}`,
          notify_url: 'https://kk-auto.onrender.com/api/payments/webhook'
        },
        order_note: `Kk_Auto trip booking ${trip.booking_reference}`
      };

      const response = await cashfree.PGCreateOrder(cashfreeRequest);
      const cashfreeOrder = response.data;

      if (!cashfreeOrder?.payment_session_id) {
        throw new Error('Cashfree did not return a payment session ID.');
      }

      await query(
        `UPDATE trip_bookings
         SET payment_reference = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [orderId, trip.id]
      );

      return {
        ...trip,
        payment_reference: orderId,
        payment_session_id: cashfreeOrder.payment_session_id,
        environment: this.isProductionEnvironment() ? 'production' : 'sandbox'
      };
    } catch (err: any) {
      const rawStatus = Number(err?.response?.status || err?.status);
      const status = Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : 500;
      const rawCode = String(err?.response?.data?.code || err?.code || '');
      const code = /^[A-Z0-9_-]{1,32}$/i.test(rawCode) ? rawCode.toUpperCase() : 'GATEWAY_ERROR';
      console.error(`Cashfree trip order creation failed (status: ${status}, code: ${code})`);
      throw new Error('Unable to create payment order. Please try again later.');
    }
  }

  /**
   * Process sandbox payment simulation for confirmed trip
   */
  public static async processTripSandboxPayment(
    tripId: number,
    customerId: number,
    paymentMethod: string = 'UPI'
  ): Promise<TripBooking> {
    const trip = await this.getTripBookingById(tripId, customerId);

    if (trip.status !== 'CONFIRMED') {
      throw new Error('Payment can only be processed after the booking is confirmed by the owner.');
    }

    if (!trip.quoted_price || trip.quoted_price <= 0) {
      throw new Error('Quoted price has not been set by the owner.');
    }

    if (trip.payment_status === 'PAID') {
      return trip;
    }

    const paymentRandom = Math.floor(100000 + Math.random() * 900000);
    const paymentRef = `PAY_TRIP_${paymentRandom}`;

    const updated = await query<TripBooking>(
      `UPDATE trip_bookings
       SET payment_status = 'PAID',
           payment_reference = $1,
           payment_method = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [paymentRef, paymentMethod, tripId]
    );

    return normalizeTripBookingRow(updated.rows[0]);
  }

  /**
   * Retrieve Owner business contact details (Phone & WhatsApp)
   */
  public static async getOwnerContactInfo(): Promise<{ phone: string; whatsapp: string }> {
    const adminRes = await query(`SELECT mobile FROM users WHERE role = 'admin' LIMIT 1`);
    const phone =
      process.env.OWNER_PHONE ||
      process.env.OWNER_CONTACT_NUMBER ||
      (adminRes.rows.length > 0 ? adminRes.rows[0].mobile : '9876543210');

    const clean = phone.replace(/\D/g, '').slice(-10) || '9876543210';
    return {
      phone: clean,
      whatsapp: clean
    };
  }
    /**
   * Customer confirms the final trip quote
   */
  public static async confirmTripBooking(
    tripBookingId: number,
    customerId: number
  ): Promise<TripBooking> {
    const trip = await this.getTripBookingById(tripBookingId, customerId);

    if (trip.status !== 'CONFIRMED') {
      throw new Error('Trip can be confirmed only after the owner confirms the booking.');
    }

    if (!trip.quoted_price || trip.quoted_price <= 0) {
      throw new Error('Final quoted price has not been set by the owner.');
    }

    if (trip.customer_confirmed) {
      return trip;
    }

    const result = await query<TripBooking>(
      `UPDATE trip_bookings
       SET customer_confirmed = TRUE,
           customer_confirmed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [tripBookingId]
    );

    return normalizeTripBookingRow(result.rows[0]);
  }
    
  
}

  
