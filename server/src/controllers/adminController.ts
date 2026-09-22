import { Request, Response } from 'express';
import { query } from '../config/db';
import { RouteService } from '../services/routeService';
import { PaymentService } from '../services/paymentService';

export class AdminController {
  /**
   * Get administrative metrics and overview statistics
   */
  public static async getDashboardStats(req: Request, res: Response) {
    try {
      const customersRes = await query(`SELECT COUNT(*) as count FROM users WHERE role = 'customer'`);
      const totalCustomers = parseInt(customersRes.rows[0].count, 10);

      const driversRes = await query(`SELECT COUNT(*) as count FROM drivers`);
      const totalDrivers = parseInt(driversRes.rows[0].count, 10);

      const pendingDriversRes = await query(`SELECT COUNT(*) as count FROM drivers WHERE approval_status = 'PENDING'`);
      const pendingDrivers = parseInt(pendingDriversRes.rows[0].count, 10);

      const bookingsRes = await query(`SELECT COUNT(*) as count FROM bookings`);
      const totalBookings = parseInt(bookingsRes.rows[0].count, 10);

      const activeRes = await query(
        `SELECT COUNT(*) as count FROM bookings WHERE status IN ('Searching for Auto', 'Driver Assigned', 'Driver Arriving', 'Ride Started')`
      );
      const activeBookings = parseInt(activeRes.rows[0].count, 10);

      const completedRes = await query(
        `SELECT COUNT(*) as count, COALESCE(SUM(estimated_fare), 0) as revenue FROM bookings WHERE status = 'Ride Completed'`
      );
      const completedRides = parseInt(completedRes.rows[0].count, 10);

      const cancelledRes = await query(`SELECT COUNT(*) as count FROM bookings WHERE status = 'Cancelled'`);
      const cancelledRides = parseInt(cancelledRes.rows[0].count, 10);

      // Financials from marketplace payments
      const financials = await PaymentService.getPlatformFinancials();

      // Current fixed fare routes
      const fareRoutes = await RouteService.getAllFareRoutes();

      return res.json({
        success: true,
        data: {
          metrics: {
            totalCustomers,
            totalDrivers,
            pendingDrivers,
            totalBookings,
            activeBookings,
            completedRides,
            cancelledRides,
            totalRevenue: financials.totalGrossVolume,
            ownerCommission: financials.ownerCommissionEarned,
            driverPayouts: financials.driverPayoutsTotal,
            pendingSettlements: financials.pendingSettlementsAmount,
            settledPayouts: financials.settledPayoutsAmount
          },
          financials,
          fareRoutes
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get all bookings with customer, driver, route, and payment details
   */
  public static async getAllBookings(req: Request, res: Response) {
    try {
      const bookingsRes = await query(
        `SELECT b.*, 
                u.name as customer_name, u.mobile as customer_mobile, u.email as customer_email,
                d.auto_number, d.auto_model,
                du.name as driver_name, du.mobile as driver_mobile,
                p.payment_status, p.payment_method, p.transaction_reference, p.settlement_status,
                p.driver_amount, p.owner_amount
         FROM bookings b
         LEFT JOIN users u ON b.customer_id = u.id
         LEFT JOIN drivers d ON b.driver_id = d.id
         LEFT JOIN users du ON d.user_id = du.id
         LEFT JOIN payments p ON b.id = p.booking_id
         ORDER BY b.created_at DESC`
      );

      return res.json({ success: true, data: bookingsRes.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Update any booking status
   */
  public static async updateBookingStatus(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { status } = req.body;

      const validStatuses = [
        'Searching for Auto',
        'Driver Assigned',
        'Driver Arriving',
        'Ride Started',
        'Ride Completed',
        'Cancelled'
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid booking status.' });
      }

      const updateRes = await query(
        `UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [status, id]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Booking not found.' });
      }

      const booking = updateRes.rows[0];

      // If ride completed, ensure payment record exists
      if (status === 'Ride Completed') {
        const existingPay = await query('SELECT id FROM payments WHERE booking_id = $1 LIMIT 1', [booking.id]);
        if (existingPay.rows.length === 0) {
          const commission = await PaymentService.getCommissionPerTrip();
          const totalFare = Number(booking.estimated_fare);
          const ownerAmt = Math.min(commission, totalFare);
          const driverAmt = Math.max(0, totalFare - ownerAmt);
          const rand = Math.floor(100000 + Math.random() * 900000);

          await query(
            `INSERT INTO payments (
              booking_id, customer_id, driver_id, total_amount, driver_amount, owner_amount, commission_amount,
              payment_status, settlement_status, payment_method, transaction_reference, gateway_order_id,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              'COMPLETED', 'PENDING', 'Cash', $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )`,
            [
              booking.id,
              booking.customer_id,
              booking.driver_id,
              totalFare,
              driverAmt,
              ownerAmt,
              ownerAmt,
              `TXN_CASH_${rand}`,
              `ORDER_CASH_${rand}`
            ]
          );
        }
      }

      return res.json({
        success: true,
        message: `Booking status updated to ${status}`,
        data: booking
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get all registered drivers with approval status, auto details, and payout info
   */
  public static async getDrivers(req: Request, res: Response) {
    try {
      const drivers = await query(
        `SELECT d.*, u.name, u.email, u.mobile, u.created_at as registered_at,
                COUNT(b.id) as total_trips,
                COALESCE(SUM(CASE WHEN p.payment_status = 'COMPLETED' THEN p.driver_amount ELSE 0 END), 0) as total_earnings,
                COALESCE(SUM(CASE WHEN p.payment_status = 'COMPLETED' AND p.settlement_status = 'PENDING' THEN p.driver_amount ELSE 0 END), 0) as pending_payout
         FROM drivers d
         JOIN users u ON d.user_id = u.id
         LEFT JOIN bookings b ON d.id = b.driver_id AND b.status = 'Ride Completed'
         LEFT JOIN payments p ON b.id = p.booking_id
         GROUP BY d.id, u.name, u.email, u.mobile, u.created_at
         ORDER BY d.created_at DESC`
      );
      return res.json({ success: true, data: drivers.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Update driver approval status: 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'SUSPENDED'
   */
  public static async updateDriverApproval(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'SUSPENDED'];
      const normStatus = (status || '').toUpperCase();

      if (!validStatuses.includes(normStatus)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: [${validStatuses.join(', ')}]`
        });
      }

      const resUpdate = await query(
        `UPDATE drivers SET approval_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [normStatus, id]
      );

      if (resUpdate.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Driver not found.' });
      }

      return res.json({
        success: true,
        message: `Driver status successfully updated to ${normStatus}.`,
        data: resUpdate.rows[0]
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get all registered customers
   */
  public static async getCustomers(req: Request, res: Response) {
    try {
      const customers = await query(
        `SELECT u.id, u.name, u.email, u.mobile, u.created_at,
                COUNT(b.id) as ride_count,
                COALESCE(SUM(CASE WHEN b.status = 'Ride Completed' THEN b.estimated_fare ELSE 0 END), 0) as total_spent
         FROM users u
         LEFT JOIN bookings b ON u.id = b.customer_id
         WHERE u.role = 'customer'
         GROUP BY u.id, u.name, u.email, u.mobile, u.created_at
         ORDER BY u.created_at DESC`
      );
      return res.json({ success: true, data: customers.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get fixed route fare rates
   */
  public static async getFareConfig(req: Request, res: Response) {
    try {
      const routes = await RouteService.getAllFareRoutes();
      return res.json({ success: true, data: routes });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Update fixed route fare
   */
  public static async updateFareConfig(req: Request, res: Response) {
    try {
      const { id, fare } = req.body;
      if (!id || fare === undefined) {
        return res.status(400).json({ success: false, error: 'Route ID and fare are required.' });
      }
      const updated = await RouteService.updateRouteFare(Number(id), Number(fare));
      return res.json({
        success: true,
        message: 'Route fare updated successfully.',
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Toggle route active status
   */
  public static async toggleRoute(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updated = await RouteService.toggleRouteActive(Number(id));
      return res.json({
        success: true,
        message: `Route status updated to ${updated.is_active ? 'Active' : 'Inactive'}`,
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Add a new fixed route
   */
  public static async addRoute(req: Request, res: Response) {
    try {
      const { fromLocation, toLocation, fare } = req.body;
      const newRoute = await RouteService.addRoute(fromLocation, toLocation, Number(fare));
      return res.status(201).json({
        success: true,
        message: 'New fixed route added successfully.',
        data: newRoute
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Get owner commission setting
   */
  public static async getCommission(req: Request, res: Response) {
    try {
      const commission = await PaymentService.getCommissionPerTrip();
      return res.json({ success: true, data: { commissionPerTrip: commission } });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Update owner commission setting
   */
  public static async updateCommission(req: Request, res: Response) {
    try {
      const { commission } = req.body;
      if (commission === undefined || isNaN(Number(commission))) {
        return res.status(400).json({ success: false, error: 'Valid commission amount is required.' });
      }
      const updated = await PaymentService.updateCommissionPerTrip(Number(commission));
      return res.json({
        success: true,
        message: `Platform commission updated to ₹${updated} per trip.`,
        data: { commissionPerTrip: updated }
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Platform financials & marketplace summary
   */
  public static async getFinancials(req: Request, res: Response) {
    try {
      const financials = await PaymentService.getPlatformFinancials();
      return res.json({ success: true, data: financials });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * View pending driver settlements & history
   */
  public static async getSettlements(req: Request, res: Response) {
    try {
      const pendingRes = await query(
        `SELECT d.id as driver_id, u.name as driver_name, u.mobile, d.auto_number,
                d.payout_upi, d.payout_bank_account, d.payout_ifsc,
                COUNT(p.id) as pending_trips_count,
                COALESCE(SUM(p.driver_amount), 0) as pending_amount
         FROM drivers d
         JOIN users u ON d.user_id = u.id
         JOIN payments p ON d.id = p.driver_id
         WHERE p.payment_status = 'COMPLETED' AND p.settlement_status = 'PENDING'
         GROUP BY d.id, u.name, u.mobile, d.auto_number, d.payout_upi, d.payout_bank_account, d.payout_ifsc
         ORDER BY pending_amount DESC`
      );

      const settledHistoryRes = await query(
        `SELECT p.*, u.name as driver_name, d.auto_number, b.booking_reference
         FROM payments p
         JOIN drivers d ON p.driver_id = d.id
         JOIN users u ON d.user_id = u.id
         JOIN bookings b ON p.booking_id = b.id
         WHERE p.settlement_status = 'SETTLED'
         ORDER BY p.settled_at DESC
         LIMIT 50`
      );

      return res.json({
        success: true,
        data: {
          pendingDrivers: pendingRes.rows,
          settledHistory: settledHistoryRes.rows
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Settle pending payouts for a driver or all drivers
   */
  public static async settlePayouts(req: Request, res: Response) {
    try {
      const { driverId, paymentId } = req.body;
      const result = await PaymentService.settleDriverPayouts(
        driverId ? Number(driverId) : undefined,
        paymentId ? Number(paymentId) : undefined
      );

      return res.json({
        success: true,
        message: `Successfully marked ${result.settledCount} payment(s) as SETTLED (Total: ₹${result.settledAmount}).`,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
