import { Router } from 'express';
import { DriverController } from '../controllers/driverController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, DriverController.getAllDrivers);
router.get('/me', authenticateToken, requireRole(['driver']), DriverController.getDriverProfile);
router.patch('/status', authenticateToken, requireRole(['driver']), DriverController.updateAvailability);
router.get('/requests', authenticateToken, requireRole(['driver']), DriverController.getIncomingRequests);
router.post('/rides/:id/accept', authenticateToken, requireRole(['driver']), DriverController.acceptBooking);
router.patch('/rides/:id/status', authenticateToken, requireRole(['driver']), DriverController.updateRideStatus);

export default router;
