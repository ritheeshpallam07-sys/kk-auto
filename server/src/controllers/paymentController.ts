import { Request, Response } from 'express';
import { query } from '../config/db';
import { PaymentService, WebhookValidationError } from '../services/paymentService';

export class PaymentController {
  /**
   * Create payment order with marketplace split
   */
  public static async createOrder(req: Request, res: Response) {
    try {
      const user = req.user!;
      const { bookingId, paymentMethod } = req.body;

      if (!bookingId) {
        return res.status(400).json({ success: false, error: 'Booking ID is required.' });
      }

      const order = await PaymentService.createPaymentOrder(
        Number(bookingId),
        user.id,
        paymentMethod || 'UPI'
      );

      return res.status(201).json({
        success: true,
        message: 'Payment order generated successfully.',
        data: order
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Simulate sandbox online payment (UPI / Card / NetBanking)
   */
  /**

* Sandbox payment simulation — disabled in production
  */
  public static async sandboxPay(req: Request, res: Response) {
  if (process.env.NODE_ENV === 'production') {
  return res.status(403).json({
  success: false,
  error: 'Sandbox payments are disabled in production.'
  });
  }

try {

  const user = req.user!;
  const { bookingId, paymentMethod } = req.body;

  if (!bookingId) {
    return res.status(400).json({
      success: false,
      error: 'Booking ID is required.'
    });
  }

  const payment = await PaymentService.processSandboxPayment(
    Number(bookingId),
    user.id,
    paymentMethod || 'UPI'
  );

  return res.json({
    success: true,
    message: 'Sandbox payment processed successfully.',
    data: payment
  });
} catch (err: any) {
  return res.status(400).json({
    success: false,
    error: err.message
  });
}

}


  /**
   * Cashfree payment gateway webhook
   */
  public static async handleWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;
      const rawBody = (req as any).rawBody as string;

      const result = await PaymentService.handleWebhook(
        req.body,
        signature,
        timestamp,
        rawBody
      );

      return res.json({ success: true, ...result });
    } catch (err: any) {
      // 1. Explicit error classification:
      // Known permanent validation failures (invalid signature, malformed fields, prefix/amount mismatch) -> HTTP 400
      // Any other error (database failure, query exception, unexpected error) -> defaults to HTTP 500
      const isValidation = err instanceof WebhookValidationError || err?.isWebhookValidationError === true;
      const statusCode = isValidation ? 400 : 500;

      // 2. Safe allowlisted diagnostic code for logging
      const rawCode = String(err?.code || (isValidation ? 'WEBHOOK_VALIDATION_FAILED' : 'INTERNAL_ERROR'));
      const code = /^[A-Z0-9_-]{1,32}$/i.test(rawCode) ? rawCode.toUpperCase() : (isValidation ? 'WEBHOOK_VALIDATION_FAILED' : 'INTERNAL_ERROR');

      console.error(`Cashfree webhook processing failed (status: ${statusCode}, code: ${code})`);

      // 3. Fixed generic response message - never return err.message, stack traces, or SQL
      const responseMessage = isValidation
        ? 'Invalid webhook request.'
        : 'Internal webhook processing error.';

      return res.status(statusCode).json({
        success: false,
        error: responseMessage
      });
    }
  }
  /**
   * Get payment details and status for a booking.
   * Strictly enforces role-based access control and authorization (CONF-05):
   * - Validates bookingId as a positive integer (400 if invalid).
   * - Verifies booking existence (404 if not found).
   * - Customer: may view only their own booking's payment details.
   * - Driver: may view only payment details for a booking assigned to their driver profile.
   * - Admin: full administrative access.
   * - Other roles / unauthorized: 403 Forbidden with zero data.
   * - Sanitizes output per role (driver excludes owner_amount, commission, settlements, ratings; customer receives receipt-safe fields).
   */
  public static async getBookingPayment(req: Request, res: Response) {
    try {
      const user = req.user!;
      const rawBookingId = String(req.params.bookingId || '');

      // 1. Validate bookingId format (must be a positive integer)
      if (!/^\d+$/.test(rawBookingId)) {
        return res.status(400).json({ success: false, error: 'Valid booking ID is required.' });
      }
      const bookingId = Number(rawBookingId);
      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        return res.status(400).json({ success: false, error: 'Valid booking ID is required.' });
      }

      // 2. Look up booking to verify existence and ownership
      const bookingRes = await query(
        `SELECT id, customer_id, driver_id, status FROM bookings WHERE id = $1 LIMIT 1`,
        [bookingId]
      );

      if (bookingRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Booking not found.' });
      }

      const booking = bookingRes.rows[0];

      // 3. Verify authorization based on server-verified user identity
      if (user.role === 'customer') {
        if (Number(booking.customer_id) !== Number(user.id)) {
          return res.status(403).json({ success: false, error: 'Unauthorized to view payment details.' });
        }
      } else if (user.role === 'driver') {
        const driverRes = await query(
          `SELECT id FROM drivers WHERE user_id = $1 LIMIT 1`,
          [user.id]
        );
        if (driverRes.rows.length === 0) {
          return res.status(403).json({ success: false, error: 'Unauthorized to view payment details.' });
        }
        const driverId = driverRes.rows[0].id;
        if (!booking.driver_id || Number(booking.driver_id) !== Number(driverId)) {
          return res.status(403).json({ success: false, error: 'Unauthorized to view payment details.' });
        }
      } else if (user.role === 'admin') {
        // Administrative access explicitly verified
      } else {
        return res.status(403).json({ success: false, error: 'Unauthorized to view payment details.' });
      }

      // 4. Retrieve payment and rating records
      const rawPayment = await PaymentService.getPaymentByBookingId(bookingId);
      const rawRating = await PaymentService.getBookingRating(bookingId);

      // 5. Role-specific response sanitization
      if (!rawPayment) {
        return res.json({
          success: true,
          data: {
            payment: null,
            rating: user.role === 'driver' ? null : rawRating
          }
        });
      }

      if (user.role === 'customer') {
        // Customer receipt projection: preserves fields needed by BookingStatusPage.tsx
        // while omitting internal settlement details, private driver IDs, and Cashfree gateway internals
        const customerPayment = {
          id: rawPayment.id,
          booking_id: rawPayment.booking_id,
          total_amount: rawPayment.total_amount,
          driver_amount: rawPayment.driver_amount,
          owner_amount: rawPayment.owner_amount,
          payment_status: rawPayment.payment_status,
          payment_method: rawPayment.payment_method,
          transaction_reference: rawPayment.transaction_reference,
          created_at: rawPayment.created_at,
          updated_at: rawPayment.updated_at
        };

        return res.json({
          success: true,
          data: {
            payment: customerPayment,
            rating: rawRating
          }
        });
      }

      if (user.role === 'driver') {
        // Driver projection: contains only payment details required for driver collection/verification
        // Strictly omits owner_amount, commission_amount, settlement_status, settled_at,
        // gateway_order_id, gateway_payment_id, customer_id, and customer ratings/reviews
        const driverPayment = {
          id: rawPayment.id,
          booking_id: rawPayment.booking_id,
          total_amount: rawPayment.total_amount,
          driver_amount: rawPayment.driver_amount,
          payment_status: rawPayment.payment_status,
          payment_method: rawPayment.payment_method,
          transaction_reference: rawPayment.transaction_reference,
          driver_payment_confirmed_at: (rawPayment as any).driver_payment_confirmed_at,
          created_at: rawPayment.created_at,
          updated_at: rawPayment.updated_at
        };

        return res.json({
          success: true,
          data: {
            payment: driverPayment,
            rating: null
          }
        });
      }

      // Admin receives complete payment and rating records
      return res.json({
        success: true,
        data: {
          payment: rawPayment,
          rating: rawRating
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get driver earnings summary (driver only)
   */
  public static async getDriverEarnings(req: Request, res: Response) {
    try {
      const user = req.user!;
      const earnings = await PaymentService.getDriverEarnings(user.id);
      return res.json({ success: true, data: earnings });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Customer rates driver
   */
  public static async rateDriver(req: Request, res: Response) {
    try {
      const user = req.user!;
      const { bookingId, rating, review } = req.body;

      if (!bookingId || !rating) {
        return res.status(400).json({ success: false, error: 'Booking ID and 1-5 star rating are required.' });
      }

      const rated = await PaymentService.rateDriver(
        Number(bookingId),
        user.id,
        Number(rating),
        review
      );

      return res.json({
        success: true,
        message: 'Thank you for rating your ride!',
        data: rated
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
    /**
   * Driver manually confirms direct UPI payment for a completed auto ride.
   */
  public static async confirmDriverPayment(req: Request, res: Response) {
    try {
      const user = req.user!;
      const bookingId = Number(req.params.bookingId);

      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid booking ID is required.'
        });
      }

      const result = await PaymentService.confirmDriverPayment(
        bookingId,
        user.id
      );

      return res.json({
        success: true,
        message: 'Driver confirmed payment receipt.',
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Unable to confirm payment.'
      });
    }
  }
}
