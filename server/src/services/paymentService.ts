import { query } from '../config/db';
import crypto from 'crypto';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
import { TripBooking } from './tripBookingService';
const isProduction =
  process.env.CASHFREE_ENVIRONMENT === 'production' ||
  process.env.CASHFREE_ENV === 'production' ||
  (process.env.NODE_ENV === 'production' && !process.env.CASHFREE_APP_ID?.startsWith('TEST'));

const cashfreeEnv = isProduction ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
const cashfreeEndpoint = isProduction
  ? 'https://api.cashfree.com/pg/orders'
  : 'https://sandbox.cashfree.com/pg/orders';

let cashfree: any = new Cashfree(
  cashfreeEnv,
  process.env.CASHFREE_APP_ID || '',
  process.env.CASHFREE_SECRET_KEY || ''
);
cashfree.XApiVersion = '2025-01-01';
export interface WebhookResult {
  processed: boolean;
  payment?: PaymentRecord;
  trip?: TripBooking;
}

export class WebhookValidationError extends Error {
  public readonly isWebhookValidationError = true;
  public readonly code: string;

  constructor(message: string, code: string = 'WEBHOOK_VALIDATION_FAILED') {
    super(message);
    this.name = 'WebhookValidationError';
    this.code = code;
    Object.setPrototypeOf(this, WebhookValidationError.prototype);
  }
}

export interface PaymentRecord {
  id: number;
  booking_id: number;
  customer_id: number;
  driver_id: number | null;
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
  environment?: 'sandbox' | 'production';
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

export interface PlatformFinancials {
  totalGrossVolume: number;
  ownerCommissionEarned: number;
  driverPayoutsTotal: number;
  pendingSettlementsAmount: number;
  settledPayoutsAmount: number;
  totalCompletedPayments: number;
  commissionPerTrip: number;
}

export class PaymentService {
  private static cashfreeClient: any = cashfree;

  public static setCashfreeClient(client: any): void {
    PaymentService.cashfreeClient = client;
    cashfree = client;
  }

  public static getCashfreeClient(): any {
    return PaymentService.cashfreeClient || cashfree;
  }

  /**
   * Retrieves current platform fixed commission per trip from platform_settings
   */
  public static async getCommissionPerTrip(): Promise<number> {
    const res = await query<{ value: string }>(
      `SELECT value FROM platform_settings WHERE key = 'owner_commission_fixed' LIMIT 1`
    );
    if (res.rows.length === 0) {
      return 5.0; // Default ₹5
    }
    const val = parseFloat(res.rows[0].value);
    return isNaN(val) ? 5.0 : val;
  }

  /**
   * Admin updates the platform fixed commission per trip
   */
  public static async updateCommissionPerTrip(commission: number): Promise<number> {
    if (commission < 0) {
      throw new Error('Commission rate cannot be negative.');
    }
    await query(
      `INSERT INTO platform_settings (key, value, description, updated_at)
       VALUES ('owner_commission_fixed', $1, 'Fixed platform commission retained by owner per completed auto trip', CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [commission.toString()]
    );
    return commission;
  }

  /**
   * Customer initiates online payment: creates an order with the marketplace split
   */
  public static async createPaymentOrder(
  bookingId: number,
  customerId: number,
  paymentMethod: string = 'UPI'
): Promise<PaymentRecord & { payment_session_id?: string }> {
  // 1. Verify booking exists
  const bookingRes = await query(
    `SELECT b.*, u.name AS customer_name, u.email AS customer_email, u.mobile AS customer_mobile
     FROM bookings b
     JOIN users u ON b.customer_id = u.id
     WHERE b.id = $1
     LIMIT 1`,
    [bookingId]
  );

  if (bookingRes.rows.length === 0) {
    throw new Error('Booking not found.');
  }

  const booking = bookingRes.rows[0];

  // Make sure the logged-in customer owns this booking
  if (Number(booking.customer_id) !== Number(customerId)) {
    throw new Error('You are not authorized to pay for this booking.');
  }
  // Online payment is allowed only after the driver completes the ride
  if (booking.status !== 'Ride Completed') {
    throw new Error('Online payment is available only after the ride is completed.');
}

  // Check if already paid
  const existingPayment = await query<PaymentRecord>(
    `SELECT * FROM payments
     WHERE booking_id = $1
       AND payment_status = 'COMPLETED'
     LIMIT 1`,
    [bookingId]
  );

  if (
  existingPayment.rows.length > 0 &&
  existingPayment.rows[0].payment_method !== 'Cash'
  ) {
  return existingPayment.rows[0];
  }
  
  // Normal Cashfree payment: no Easy Split.
  const totalFare = Number(booking.estimated_fare);
  

  if (!Number.isFinite(totalFare) || totalFare <= 0) {
    throw new Error('Invalid booking fare.');
  }
  const ownerAmount = Number((totalFare * 0.10).toFixed(2));
const driverAmount = Number((totalFare - ownerAmount).toFixed(2));
  // Reuse an existing pending payment if one exists
  const pendingPayment = await query<PaymentRecord>(
    `SELECT * FROM payments
     WHERE booking_id = $1
       AND payment_status = 'PENDING'
     LIMIT 1`,
    [bookingId]
  );

  let paymentRecord: PaymentRecord;

  if (pendingPayment.rows.length > 0) {
    const updated = await query<PaymentRecord>(
      `UPDATE payments
       SET payment_method = $1,
           driver_id = $2,
           total_amount = $3,
           driver_amount = $4,
           owner_amount = $5,
           commission_amount = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        paymentMethod,
        booking.driver_id,
        totalFare,
        driverAmount,
        ownerAmount,
        ownerAmount,
        pendingPayment.rows[0].id
      ]
    );

    paymentRecord = updated.rows[0];
  } else {
    const randomSuffix = `${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const gatewayOrderId = `ORDER_KK_${randomSuffix}`;
    const transactionRef = `TXN_KK_${randomSuffix}`;

    const inserted = await query<PaymentRecord>(
      `INSERT INTO payments (
        booking_id,
        customer_id,
        driver_id,
        total_amount,
        driver_amount,
        owner_amount,
        commission_amount,
        payment_status,
        settlement_status,
        payment_method,
        transaction_reference,
        gateway_order_id,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        'PENDING',
        'PENDING',
        $8, $9, $10,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING *`,
      [
        bookingId,
        customerId,
        booking.driver_id,
        totalFare,
        driverAmount,
        ownerAmount,
        ownerAmount,
        paymentMethod,
        transactionRef,
        gatewayOrderId
      ]
    );

    paymentRecord = inserted.rows[0];
  }

    // 3. Create a fresh Cashfree Sandbox order ID for every payment attempt
  const randomSuffix = `${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
  const cashfreeOrderId = `ORDER_KK_${bookingId}_${randomSuffix}`;

  // Store the new Cashfree order ID in the existing payment record
  const updatedPayment = await query<PaymentRecord>(
    `UPDATE payments
     SET gateway_order_id = $1,
         transaction_reference = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [
      cashfreeOrderId,
      `TXN_KK_${randomSuffix}`,
      paymentRecord.id
    ]
  );

  paymentRecord = updatedPayment.rows[0];

  const cashfreeRequest = {
  order_amount: Number(totalFare.toFixed(2)),
  order_currency: 'INR',
  order_id: cashfreeOrderId,
  customer_details: {
    customer_id: String(customerId),
    customer_name: booking.customer_name || `Customer ${customerId}`,
    customer_email: booking.customer_email || 'customer@example.com',
    customer_phone: booking.customer_mobile
  },
  order_meta: {
    return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking/${bookingId}?order_id={order_id}`,
    notify_url: 'https://kk-auto.onrender.com/api/payments/webhook'
  },
  order_note: `KkAuto booking ${bookingId}`
};

  try {
    const response = await new Promise<any>((resolve, reject) => {
      const https = require('https');

      const requestBody = JSON.stringify(cashfreeRequest);

      const req = https.request(
        cashfreeEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-version': '2025-01-01',
            'x-client-id': process.env.CASHFREE_APP_ID || '',
            'x-client-secret': process.env.CASHFREE_SECRET_KEY || '',
            'Content-Length': Buffer.byteLength(requestBody)
          }
        },
        (res: any) => {
          let data = '';

          res.on('data', (chunk: any) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);

              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ data: parsed });
              } else {
                reject({
                  response: {
                    data: parsed,
                    status: res.statusCode
                  }
                });
              }
            } catch {
              reject({
                response: {
                  data: data,
                  status: res.statusCode
                }
              });
            }
          });
        }
      );

      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });
    const cashfreeOrder = response.data;

    if (!cashfreeOrder?.payment_session_id) {
      throw new Error('Cashfree did not return a payment session ID.');
    }

    return {
      ...paymentRecord,
      payment_session_id: cashfreeOrder.payment_session_id,
      environment: isProduction ? 'production' : 'sandbox'
    };
  } catch (err: any) {
    const rawStatus = Number(err?.response?.status || err?.status);
    const status = Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : 500;
    const rawCode = String(err?.response?.data?.code || err?.code || '');
    const code = /^[A-Z0-9_-]{1,32}$/i.test(rawCode) ? rawCode.toUpperCase() : 'GATEWAY_ERROR';
    console.error(`Cashfree order creation failed (status: ${status}, code: ${code})`);

    throw new Error('Unable to create Cashfree payment order. Please try again later.');
  }
}

  /**
   * Process sandbox payment simulation: customer completes online checkout
   */
  public static async processSandboxPayment(
    bookingId: number,
    customerId: number,
    paymentMethod: string = 'UPI'
  ): Promise<PaymentRecord> {
    const order = await this.createPaymentOrder(bookingId, customerId, paymentMethod);

    const paymentRandom = Math.floor(100000 + Math.random() * 900000);
    const gatewayPaymentId = `PAY_KK_${paymentRandom}`;

    const completed = await query<PaymentRecord>(
      `UPDATE payments 
       SET payment_status = 'COMPLETED',
           gateway_payment_id = $1,
           payment_method = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [gatewayPaymentId, paymentMethod, order.id]
    );

    return completed.rows[0];
  }

  /**
   * Webhook processing: verified gateway notifications (Razorpay / Stripe webhook handler)
   */
  /**
   * Cashfree webhook handler with timing-safe signature verification
   * and isolated routing for regular bookings (ORDER_KK_) and trip bookings (TRIP_).
   */
  public static async handleWebhook(
    payload: any,
    signature?: string,
    timestamp?: string,
    rawBody?: string
  ): Promise<WebhookResult> {
    // 1. Signature Verification
    if (!signature || !timestamp || !rawBody) {
      throw new WebhookValidationError(
        'Cashfree webhook signature data is missing.',
        'MISSING_SIGNATURE_DATA'
      );
    }

    const clientSecret = process.env.CASHFREE_SECRET_KEY;
    if (!clientSecret) {
      throw new Error('Cashfree secret key is not configured.');
    }

    const signatureData = `${timestamp}${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', clientSecret)
      .update(signatureData)
      .digest('base64');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      throw new WebhookValidationError(
        'Invalid Cashfree webhook signature.',
        'INVALID_SIGNATURE'
      );
    }

    // 2. Extract Webhook Identifiers
    const gatewayOrderId =
      payload?.data?.order?.order_id ||
      payload?.data?.order?.orderId ||
      payload?.order_id;

    const gatewayPaymentId =
      payload?.data?.payment?.cf_payment_id ||
      payload?.data?.payment?.payment_id ||
      payload?.payment_id;

    const webhookStatus =
      payload?.data?.payment?.payment_status ||
      payload?.payment_status ||
      payload?.status;

    if (!gatewayOrderId) {
      throw new WebhookValidationError(
        'Cashfree order identifier missing from webhook payload.',
        'MISSING_ORDER_ID'
      );
    }

    if (!webhookStatus) {
      throw new WebhookValidationError(
        'Cashfree payment status missing from webhook payload.',
        'MISSING_PAYMENT_STATUS'
      );
    }

    if (!gatewayPaymentId) {
      throw new WebhookValidationError(
        'Cashfree payment ID missing from webhook.',
        'MISSING_PAYMENT_ID'
      );
    }

    const orderIdStr = String(gatewayOrderId);

    // 3. Webhook Routing by Order Identifier Prefix
    if (orderIdStr.startsWith('TRIP_')) {
      return await this.handleTripWebhook(
        orderIdStr,
        String(gatewayPaymentId),
        payload
      );
    }

    if (orderIdStr.startsWith('ORDER_KK_')) {
      return await this.handleRegularBookingWebhook(
        orderIdStr,
        String(gatewayPaymentId),
        payload
      );
    }

    throw new WebhookValidationError(
      `Unrecognized order identifier prefix: ${orderIdStr}`,
      'UNRECOGNIZED_ORDER_PREFIX'
    );
  }

  /**
   * Dedicated Cashfree Trip Payment Reconciliation (CONF-06)
   * Resolves trip booking by payment_reference and updates trip_bookings.payment_status.
   * Strictly isolated from regular bookings and payments table.
   */
  private static async handleTripWebhook(
    gatewayOrderId: string,
    gatewayPaymentId: string,
    payload: any
  ): Promise<WebhookResult> {
    const tripRes = await query<TripBooking>(
      `SELECT * FROM trip_bookings
       WHERE payment_reference = $1
       LIMIT 1`,
      [gatewayOrderId]
    );

    if (tripRes.rows.length === 0) {
      throw new WebhookValidationError(
        `No trip booking record found matching Cashfree order ${gatewayOrderId}`,
        'RECORD_NOT_FOUND'
      );
    }

    const existingTrip = tripRes.rows[0];

    // Idempotent return: already PAID trips are not re-processed or downgraded
    if (existingTrip.payment_status === 'PAID') {
      return { processed: true, trip: existingTrip };
    }

    const cf = this.getCashfreeClient();
    const cashfreeResponse = await cf.PGOrderFetchPayments(gatewayOrderId);
    const cashfreePayments = cashfreeResponse?.data || [];

    const verifiedPayment = cashfreePayments.find(
      (item: any) => String(item.cf_payment_id) === String(gatewayPaymentId)
    );

    if (!verifiedPayment) {
      throw new WebhookValidationError(
        'Payment ID could not be verified with Cashfree.',
        'PAYMENT_NOT_VERIFIED'
      );
    }

    if (String(verifiedPayment.order_id) !== String(gatewayOrderId)) {
      throw new WebhookValidationError(
        'Cashfree order ID mismatch.',
        'ORDER_ID_MISMATCH'
      );
    }

    const expectedAmount = Number(
      Number(existingTrip.quoted_price || 0).toFixed(2)
    );
    const orderAmount = Number(
      Number(verifiedPayment.order_amount).toFixed(2)
    );
    const paymentAmount = Number(
      Number(verifiedPayment.payment_amount).toFixed(2)
    );

    const currency =
      verifiedPayment.order_currency || verifiedPayment.payment_currency;

    if (
      currency !== 'INR' ||
      !Number.isFinite(expectedAmount) ||
      !Number.isFinite(orderAmount) ||
      !Number.isFinite(paymentAmount) ||
      expectedAmount <= 0 ||
      orderAmount !== expectedAmount ||
      paymentAmount !== expectedAmount
    ) {
      throw new WebhookValidationError(
        'Cashfree trip payment amount or currency verification failed.',
        'AMOUNT_CURRENCY_MISMATCH'
      );
    }

    const normalizedStatus = String(
      verifiedPayment.payment_status || ''
    ).toUpperCase();

    if (normalizedStatus === 'SUCCESS') {
      const paymentMethod =
        verifiedPayment.payment_group ||
        verifiedPayment.payment_method ||
        'ONLINE';

      const updated = await query<TripBooking>(
        `UPDATE trip_bookings
         SET payment_status = 'PAID',
             payment_method = COALESCE($1, payment_method, 'ONLINE'),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
           AND payment_status <> 'PAID'
         RETURNING *`,
        [paymentMethod, existingTrip.id]
      );

      return {
        processed: true,
        trip: updated.rows[0] || existingTrip
      };
    } else if (
      ['FAILED', 'USER_DROPPED', 'CANCELLED', 'VOID'].includes(
        normalizedStatus
      )
    ) {
      const updated = await query<TripBooking>(
        `UPDATE trip_bookings
         SET payment_status = 'FAILED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND payment_status <> 'PAID'
         RETURNING *`,
        [existingTrip.id]
      );

      return {
        processed: true,
        trip: updated.rows[0] || existingTrip
      };
    } else {
      // Pending or other status: do not mark as PAID
      return {
        processed: false,
        trip: existingTrip
      };
    }
  }

  /**
   * Cashfree Regular Booking Payment Reconciliation
   * Updates payments table. Strictly isolated from trip_bookings.
   */
  private static async handleRegularBookingWebhook(
    gatewayOrderId: string,
    gatewayPaymentId: string,
    payload: any
  ): Promise<WebhookResult> {
    const paymentRes = await query<PaymentRecord>(
      `SELECT * FROM payments
       WHERE gateway_order_id = $1
       LIMIT 1`,
      [gatewayOrderId]
    );

    if (paymentRes.rows.length === 0) {
      throw new WebhookValidationError(
        `No payment record found matching Cashfree order ${gatewayOrderId}`,
        'RECORD_NOT_FOUND'
      );
    }

    const existingPayment = paymentRes.rows[0];

    // Idempotent return: already COMPLETED payment is not re-processed or downgraded
    if (existingPayment.payment_status === 'COMPLETED') {
      return { processed: true, payment: existingPayment };
    }

    const cf = this.getCashfreeClient();
    const cashfreeResponse = await cf.PGOrderFetchPayments(gatewayOrderId);
    const cashfreePayments = cashfreeResponse?.data || [];

    const verifiedPayment = cashfreePayments.find(
      (item: any) => String(item.cf_payment_id) === String(gatewayPaymentId)
    );

    if (!verifiedPayment) {
      throw new WebhookValidationError(
        'Payment ID could not be verified with Cashfree.',
        'PAYMENT_NOT_VERIFIED'
      );
    }

    if (String(verifiedPayment.order_id) !== String(gatewayOrderId)) {
      throw new WebhookValidationError(
        'Cashfree order ID mismatch.',
        'ORDER_ID_MISMATCH'
      );
    }

    const expectedAmount = Number(
      Number(existingPayment.total_amount).toFixed(2)
    );
    const orderAmount = Number(
      Number(verifiedPayment.order_amount).toFixed(2)
    );
    const paymentAmount = Number(
      Number(verifiedPayment.payment_amount).toFixed(2)
    );

    const currency =
      verifiedPayment.order_currency || verifiedPayment.payment_currency;

    if (
      currency !== 'INR' ||
      !Number.isFinite(expectedAmount) ||
      !Number.isFinite(orderAmount) ||
      !Number.isFinite(paymentAmount) ||
      orderAmount !== expectedAmount ||
      paymentAmount !== expectedAmount
    ) {
      throw new WebhookValidationError(
        'Cashfree payment amount or currency verification failed.',
        'AMOUNT_CURRENCY_MISMATCH'
      );
    }

    const normalizedStatus = String(
      verifiedPayment.payment_status || ''
    ).toUpperCase();

    let paymentStatus: 'COMPLETED' | 'PENDING' | 'FAILED';

    if (normalizedStatus === 'SUCCESS') {
      paymentStatus = 'COMPLETED';
    } else if (normalizedStatus === 'PENDING') {
      paymentStatus = 'PENDING';
    } else if (
      ['FAILED', 'USER_DROPPED', 'CANCELLED', 'VOID'].includes(
        normalizedStatus
      )
    ) {
      paymentStatus = 'FAILED';
    } else {
      return { processed: false, payment: existingPayment };
    }

    const updated = await query<PaymentRecord>(
      `UPDATE payments
         SET payment_status = $1,
             gateway_payment_id = COALESCE($2, gateway_payment_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
           AND payment_status <> 'COMPLETED'
         RETURNING *`,
      [
        paymentStatus,
        String(verifiedPayment.cf_payment_id),
        existingPayment.id
      ]
    );

    return {
      processed: true,
      payment: updated.rows[0] || existingPayment
    };
  }

    public static async confirmDriverPayment(
    bookingId: number,
    userId: number
  ): Promise<any> {
    const bookingResult = await query(
      `SELECT
         b.id,
         b.customer_id,
         b.driver_id,
         b.estimated_fare,
         b.status,
         d.id AS assigned_driver_id
       FROM bookings b
       JOIN drivers d ON d.id = b.driver_id
       WHERE b.id = $1
         AND d.user_id = $2
         AND b.status = 'Ride Completed'
       LIMIT 1`,
      [bookingId, userId]
    );

    if (bookingResult.rows.length === 0) {
      throw new Error('Completed ride not found for this driver.');
    }

    const booking = bookingResult.rows[0];
    const fare = Number(booking.estimated_fare);

    if (!Number.isFinite(fare) || fare <= 0) {
      throw new Error('Invalid booking fare.');
    }

    const existing = await query(
      `SELECT *
       FROM payments
       WHERE booking_id = $1
         AND payment_method = 'UPI_DIRECT'
         AND driver_payment_confirmed_at IS NOT NULL
       LIMIT 1`,
      [bookingId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Direct UPI payment has already been confirmed.');
    }

    const pending = await query(
      `SELECT *
       FROM payments
       WHERE booking_id = $1
         AND payment_status = 'PENDING'
         AND gateway_order_id IS NULL
       ORDER BY id DESC
       LIMIT 1`,
      [bookingId]
    );

    if (pending.rows.length > 0) {
      const updated = await query(
        `UPDATE payments
         SET payment_status = 'COMPLETED',
             payment_method = 'UPI_DIRECT',
             driver_id = $2,
             total_amount = $3,
             driver_amount = $3,
             owner_amount = 0,
             commission_amount = 0,
             driver_payment_confirmed_at = CURRENT_TIMESTAMP,
             driver_payment_confirmed_by = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND payment_status = 'PENDING'
           AND gateway_order_id IS NULL
           AND driver_payment_confirmed_at IS NULL
         RETURNING *`,
        [pending.rows[0].id, booking.driver_id, fare, booking.assigned_driver_id]
      );

      if (updated.rows.length > 0) return updated.rows[0];
      throw new Error('Payment status changed. Refresh and try again.');
    }

    const transactionReference = `UPIDIRECT_${bookingId}_${Date.now()}`;

    const inserted = await query(
      `INSERT INTO payments (
         booking_id,
         customer_id,
         driver_id,
         total_amount,
         driver_amount,
         owner_amount,
         commission_amount,
         payment_status,
         settlement_status,
         payment_method,
         transaction_reference,
         gateway_order_id,
         driver_payment_confirmed_at,
         driver_payment_confirmed_by,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $4, 0, 0,
         'COMPLETED',
         'PENDING',
         'UPI_DIRECT',
         $5,
         NULL,
         CURRENT_TIMESTAMP,
         $6,
         CURRENT_TIMESTAMP,
         CURRENT_TIMESTAMP
       )
       RETURNING *`,
      [
        booking.id,
        booking.customer_id,
        booking.driver_id,
        fare,
        transactionReference,
        booking.assigned_driver_id
      ]
    );

    return inserted.rows[0];
  }
  /**
   * Get payment details for a specific booking
   */
  public static async getPaymentByBookingId(bookingId: number): Promise<PaymentRecord | null> {
    const res = await query<PaymentRecord>(
      `SELECT * FROM payments WHERE booking_id = $1 ORDER BY id DESC LIMIT 1`,
      [bookingId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * Driver earnings breakdown
   */
  public static async getDriverEarnings(userId: number): Promise<DriverEarningsSummary> {
    // 1. Get driver record
    const driverRes = await query(
      `SELECT id, payout_upi, payout_bank_account, payout_ifsc FROM drivers WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (driverRes.rows.length === 0) {
      throw new Error('Driver profile not found.');
    }
    const driver = driverRes.rows[0];
    const driverId = driver.id;

    // 2. All completed payments for this driver
    const paymentsRes = await query<PaymentRecord>(
      `SELECT p.*, b.booking_reference, b.pickup_address, b.destination_address
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       WHERE p.driver_id = $1 AND p.payment_status = 'COMPLETED'
       ORDER BY p.created_at DESC`,
      [driverId]
    );

    const payments = paymentsRes.rows;

    let todayEarnings = 0;
    let totalEarnings = 0;
    let pendingSettlement = 0;
    let settledAmount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    for (const p of payments) {
      const amount = Number(p.driver_amount);
      totalEarnings += amount;

      const pDate = new Date(p.created_at).toISOString().split('T')[0];
      if (pDate === todayStr) {
        todayEarnings += amount;
      }

      if (p.settlement_status === 'SETTLED') {
        settledAmount += amount;
      } else {
        pendingSettlement += amount;
      }
    }

    return {
      todayEarnings: Math.round(todayEarnings),
      totalEarnings: Math.round(totalEarnings),
      pendingSettlement: Math.round(pendingSettlement),
      settledAmount: Math.round(settledAmount),
      completedRidesCount: payments.length,
      payoutUpi: driver.payout_upi,
      payoutBankAccount: driver.payout_bank_account,
      payoutIfsc: driver.payout_ifsc,
      payments
    };
  }

  /**
   * Owner / Admin platform financial metrics
   */
  public static async getPlatformFinancials(): Promise<PlatformFinancials> {
    const commissionPerTrip = await this.getCommissionPerTrip();

    const sumRes = await query<{
      total_gross: string;
      total_owner: string;
      total_driver: string;
      pending_settlement: string;
      settled_payouts: string;
      total_count: string;
    }>(
      `SELECT 
         COALESCE(SUM(total_amount), 0) as total_gross,
         COALESCE(SUM(owner_amount), 0) as total_owner,
         COALESCE(SUM(driver_amount), 0) as total_driver,
         COALESCE(SUM(CASE WHEN settlement_status = 'PENDING' THEN driver_amount ELSE 0 END), 0) as pending_settlement,
         COALESCE(SUM(CASE WHEN settlement_status = 'SETTLED' THEN driver_amount ELSE 0 END), 0) as settled_payouts,
         COUNT(*) as total_count
       FROM payments 
       WHERE payment_status = 'COMPLETED'`
    );

    const row = sumRes.rows[0];

    return {
      totalGrossVolume: Math.round(parseFloat(row.total_gross || '0')),
      ownerCommissionEarned: Math.round(parseFloat(row.total_owner || '0')),
      driverPayoutsTotal: Math.round(parseFloat(row.total_driver || '0')),
      pendingSettlementsAmount: Math.round(parseFloat(row.pending_settlement || '0')),
      settledPayoutsAmount: Math.round(parseFloat(row.settled_payouts || '0')),
      totalCompletedPayments: parseInt(row.total_count || '0', 10),
      commissionPerTrip
    };
  }

  /**
   * Owner marks driver payouts as SETTLED
   */
  public static async settleDriverPayouts(driverId?: number, paymentId?: number): Promise<{ settledCount: number; settledAmount: number }> {
    let sql = `UPDATE payments SET settlement_status = 'SETTLED', settled_at = CURRENT_TIMESTAMP WHERE payment_status = 'COMPLETED' AND settlement_status = 'PENDING'`;
    const params: any[] = [];

    if (paymentId) {
      sql += ' AND id = $1 RETURNING *';
      params.push(paymentId);
    } else if (driverId) {
      sql += ' AND driver_id = $1 RETURNING *';
      params.push(driverId);
    } else {
      sql += ' RETURNING *';
    }

    const res = await query<PaymentRecord>(sql, params);
    const settledAmount = res.rows.reduce((acc, curr) => acc + Number(curr.driver_amount), 0);

    return {
      settledCount: res.rows.length,
      settledAmount: Math.round(settledAmount)
    };
  }

  /**
   * Customer rates driver for a completed ride
   */
  public static async rateDriver(
    bookingId: number,
    customerId: number,
    rating: number,
    review?: string
  ): Promise<any> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5 stars.');
    }

    const bookingRes = await query(
      `SELECT * FROM bookings WHERE id = $1 AND customer_id = $2 LIMIT 1`,
      [bookingId, customerId]
    );
    if (bookingRes.rows.length === 0) {
      throw new Error('Booking not found or does not belong to you.');
    }

    const booking = bookingRes.rows[0];
    if (booking.status !== 'Ride Completed') {
      throw new Error('You can only rate completed rides.');
    }
    if (!booking.driver_id) {
      throw new Error('No driver assigned to this booking.');
    }

    const res = await query(
      `INSERT INTO ratings (booking_id, customer_id, driver_id, rating, review, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (booking_id) 
       DO UPDATE SET rating = EXCLUDED.rating, review = EXCLUDED.review
       RETURNING *`,
      [bookingId, customerId, booking.driver_id, rating, review || '']
    );

    return res.rows[0];
  }

  /**
   * Get rating for a booking if submitted
   */
  public static async getBookingRating(bookingId: number): Promise<any | null> {
    const res = await query('SELECT * FROM ratings WHERE booking_id = $1 LIMIT 1', [bookingId]);
    return res.rows.length > 0 ? res.rows[0] : null;
  }
  /**
 * Get all customer ratings for the owner dashboard
 */
public static async getAllDriverRatings(): Promise<any[]> {
  const res = await query(
    `SELECT r.id, r.booking_id, r.driver_id, r.customer_id,
            r.rating, r.review, r.created_at,
            d.auto_number,
            u.name AS driver_name,
            c.name AS customer_name,
            b.booking_reference
     FROM ratings r
     LEFT JOIN drivers d ON d.id = r.driver_id
     LEFT JOIN users u ON u.id = d.user_id
     LEFT JOIN users c ON c.id = r.customer_id
     LEFT JOIN bookings b ON b.id = r.booking_id
     ORDER BY r.created_at DESC`
  );

  return res.rows;
}
}
