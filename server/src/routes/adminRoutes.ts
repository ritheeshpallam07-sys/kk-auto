import { Router } from 'express';
import { AdminController } from '../controllers/adminController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// All admin routes strictly protected by admin role
router.use(authenticateToken, requireRole(['admin']));

// Metrics & Overview
router.get('/dashboard', AdminController.getDashboardStats);
router.get('/financials', AdminController.getFinancials);

// Bookings
router.get('/bookings', AdminController.getAllBookings);
router.patch('/bookings/:id/status', AdminController.updateBookingStatus);

// Drivers Management & Approvals
router.get('/drivers', AdminController.getDrivers);
router.patch('/drivers/:id/approval', AdminController.updateDriverApproval);

// Customer directory
router.get('/customers', AdminController.getCustomers);

// Fixed Route & Fare Config
router.get('/fare-config', AdminController.getFareConfig);
router.patch('/fare-config', AdminController.updateFareConfig);
router.post('/routes', AdminController.addRoute);
router.patch('/routes/:id/toggle', AdminController.toggleRoute);

// Platform Commission
router.get('/commission', AdminController.getCommission);
router.patch('/commission', AdminController.updateCommission);

// Settlements
router.get('/settlements', AdminController.getSettlements);
router.post('/settlements/settle', AdminController.settlePayouts);

export default router;
