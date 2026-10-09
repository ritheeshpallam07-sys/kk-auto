import { Request, Response } from 'express';
import { PaymentService } from '../services/paymentService';

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
    console.error('Cashfree webhook error:', err);
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
}
  /**
   * Get payment details and status for a booking
   */
  public static async getBookingPayment(req: Request, res: Response) {
    try {
      const { bookingId } = req.params;
      const payment = await PaymentService.getPaymentByBookingId(Number(bookingId));
      const rating = await PaymentService.getBookingRating(Number(bookingId));

      return res.json({
        success: true,
        data: {
          payment,
          rating
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
}
