import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Public webhook endpoint
router.post('/webhook', PaymentController.handleWebhook);

// Protected routes
router.post('/create-order', authenticateToken, PaymentController.createOrder);
router.post('/sandbox-pay', authenticateToken, PaymentController.sandboxPay);
router.get('/booking/:bookingId', authenticateToken, PaymentController.getBookingPayment);
router.post('/rate-driver', authenticateToken, PaymentController.rateDriver);

// Driver only: earnings & payouts
router.get('/driver/earnings', authenticateToken, requireRole(['driver', 'admin']), PaymentController.getDriverEarnings);

export default router;
