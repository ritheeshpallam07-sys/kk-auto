import { query } from '../config/db';
import { Cashfree, CFEnvironment } from 'cashfree-pg';

export interface TripBooking {
  id: number;
  booking_reference: string;
  customer_id: number;
  customer_name: string;
  phone_number: string;
  members: number;
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

export interface CreateTripBookingInput {
  customerName: string;
  phoneNumber: string;
  members: number;
  tripPlace: string;
  days: number;
  tripDate: string;
  pickupTime: string;
}

export class TripBookingService {
  /**
   * Helper to lazily instantiate Cashfree SDK client
   */
  private static getCashfreeClient(): Cashfree | null {
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    if (!appId || !secretKey) {
      return null;
    }
    const client = new Cashfree(CFEnvironment.PRODUCTION, appId, secretKey);
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
    const tripPlace = (data.tripPlace || '').trim();
    const tripDate = (data.tripDate || '').trim();
    const pickupTime = (data.pickupTime || '').trim();
    const members = Number(data.members);
    const days = Number(data.days);

    if (!customerName) {
      throw new Error('Customer Name is required.');
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Please provide a valid 10-digit phone number.');
    }

    if (!Number.isInteger(members) || members <= 0) {
      throw new Error('Number of members must be a positive number.');
    }

    if (!tripPlace) {
      throw new Error('Trip Place is required.');
    }

    if (!Number.isInteger(days) || days <= 0) {
      throw new Error('Number of days must be a positive number.');
    }

    if (!tripDate) {
      throw new Error('Trip Date is required.');
    }

    if (!pickupTime) {
      throw new Error('Pickup Time is required.');
    }

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
        days,
        trip_date,
        pickup_time,
        status,
        quoted_price,
        payment_status,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'NEW', NULL, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *`,
      [
        bookingReference,
        customerId,
        customerName,
        phoneNumber,
        members,
        tripPlace,
        days,
        tripDate,
        pickupTime
      ]
    );

    return result.rows[0];
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
    return result.rows;
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

    const trip = result.rows[0];
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
    return result.rows;
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

    return result.rows[0];
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
        payment_session_id: cashfreeOrder.payment_session_id
      };
    } catch (err: any) {
      console.error(
        'Cashfree trip order creation failed:',
        err?.response?.data || err?.message || err
      );
      throw new Error(
        err?.response?.data?.message || err?.message || 'Unable to create payment order.'
      );
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

    return updated.rows[0];
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

    return result.rows[0];
  }
    
  
}

  
