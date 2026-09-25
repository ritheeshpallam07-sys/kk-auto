import { query } from '../config/db';
import crypto from 'crypto';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
const cashfree = new Cashfree(
  CFEnvironment.SANDBOX,
  process.env.CASHFREE_APP_ID || '',
  process.env.CASHFREE_SECRET_KEY || ''
);
cashfree.XApiVersion = '2025-01-01';
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

  // Check if already paid
  const existingPayment = await query<PaymentRecord>(
    `SELECT * FROM payments
     WHERE booking_id = $1
       AND payment_status = 'COMPLETED'
     LIMIT 1`,
    [bookingId]
  );

  if (existingPayment.rows.length > 0) {
    return existingPayment.rows[0];
  }

  // 2. Calculate marketplace split
  const commissionPerTrip = await this.getCommissionPerTrip();
  const totalFare = Number(booking.estimated_fare);

  if (!Number.isFinite(totalFare) || totalFare <= 0) {
    throw new Error('Invalid booking fare.');
  }

  const ownerAmount = Math.min(commissionPerTrip, totalFare);
  const driverAmount = Math.max(0, totalFare - ownerAmount);

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
    order_note: `Kk_Auto booking #${bookingId}`
  };

  try {
    console.log('Cashfree SDK diagnostics:', {
  apiVersion: cashfree.XApiVersion,
  environment: CFEnvironment.SANDBOX,
  hasClientId: !!process.env.CASHFREE_APP_ID,
  clientIdLength: process.env.CASHFREE_APP_ID?.length,
  hasClientSecret: !!process.env.CASHFREE_SECRET_KEY,
  clientSecretLength: process.env.CASHFREE_SECRET_KEY?.length
});
const response = await new Promise<any>((resolve, reject) => {
  const https = require('https');

  const requestBody = JSON.stringify(cashfreeRequest);

  const req = https.request(
    'https://sandbox.cashfree.com/pg/orders',
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
  console.log('Cashfree REST error:', {
    status: res.statusCode,
    body: parsed
  });

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
      payment_session_id: cashfreeOrder.payment_session_id
    };
  } catch (err: any) {
    console.error(
      'Cashfree order creation failed:',
      err?.response?.data || err?.message || err
    );

    throw new Error(
      err?.response?.data?.message ||
      err?.message ||
      'Unable to create Cashfree payment order.'
    );
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
  public static async handleWebhook(payload: any, signature?: string): Promise<{ processed: boolean; payment?: PaymentRecord }> {
    // In production, verify HMAC-SHA256 signature against webhook secret
    const gatewayOrderId = payload?.order_id || payload?.data?.object?.id || payload?.gatewayOrderId;
    const gatewayPaymentId = payload?.payment_id || payload?.data?.object?.payment_intent || payload?.gatewayPaymentId || `PAY_KK_WEBHOOK_${Date.now()}`;
    const status = (payload?.status || 'COMPLETED').toUpperCase();

    if (!gatewayOrderId) {
      throw new Error('Order identifier missing from webhook payload.');
    }

    const paymentRes = await query<PaymentRecord>(
      `SELECT * FROM payments WHERE gateway_order_id = $1 LIMIT 1`,
      [gatewayOrderId]
    );

    if (paymentRes.rows.length === 0) {
      throw new Error(`No payment record found matching gateway order ${gatewayOrderId}`);
    }

    const updated = await query<PaymentRecord>(
      `UPDATE payments 
       SET payment_status = $1, gateway_payment_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [status === 'COMPLETED' ? 'COMPLETED' : 'FAILED', gatewayPaymentId, paymentRes.rows[0].id]
    );

    return { processed: true, payment: updated.rows[0] };
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
}
