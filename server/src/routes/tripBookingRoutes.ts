import { Router } from 'express';
import { TripBookingController } from '../controllers/tripBookingController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Customer car/trip booking requests (Customers & Admins only, DRIVERS STRICTLY FORBIDDEN)
router.post('/', authenticateToken, requireRole(['customer', 'admin']), TripBookingController.create);
router.get('/my', authenticateToken, requireRole(['customer', 'admin']), TripBookingController.getMyBookings);
router.get('/contact', authenticateToken, TripBookingController.getOwnerContact);

// Owner / Admin car/trip management (Admins only)
router.get('/owner/all', authenticateToken, requireRole(['admin']), TripBookingController.getAllByOwner);
router.patch('/owner/:id', authenticateToken, requireRole(['admin']), TripBookingController.updateByOwner);

// Single booking details (customer owns or admin)
router.get('/:id', authenticateToken, TripBookingController.getById);

// Customer payment routes for confirmed trips
router.post('/:id/create-order', authenticateToken, requireRole(['customer', 'admin']), TripBookingController.createPaymentOrder);
router.post('/:id/sandbox-pay', authenticateToken, requireRole(['customer', 'admin']), TripBookingController.processSandboxPayment);

export default router;
