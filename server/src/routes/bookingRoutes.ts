import { Router } from 'express';
import { BookingController } from '../controllers/bookingController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public location list and fare check
router.get('/locations', BookingController.getLocations);
router.post('/fare-estimate', BookingController.calculateFareEstimate);

// Protected customer booking routes
router.post('/', authenticateToken, BookingController.createBooking);
router.get('/', authenticateToken, BookingController.getMyBookings);
router.get('/:id', authenticateToken, BookingController.getBookingById);
router.patch('/:id/cancel', authenticateToken, BookingController.cancelBooking);

export default router;
