import { Request, Response } from 'express';
import { query } from '../config/db';
import { PaymentService } from '../services/paymentService';

export class DriverController {
  /**
   * Get current driver profile, approval status, payout details, and earnings
   */
  public static async getDriverProfile(req: Request, res: Response) {
    try {
      const user = req.user!;
      const driverRes = await query(
        `SELECT d.*, u.name, u.email, u.mobile 
         FROM drivers d
         JOIN users u ON d.user_id = u.id
         WHERE d.user_id = $1 LIMIT 1`,
        [user.id]
      );

      if (driverRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Driver record not found.' });
      }

      const driver = driverRes.rows[0];
      const earnings = await PaymentService.getDriverEarnings(user.id);

      return res.json({
        success: true,
        data: {
          ...driver,
          earnings
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Toggle driver availability: 'available' | 'offline'
   */
  public static async updateAvailability(req: Request, res: Response) {
    try {
      const user = req.user!;
      const { status } = req.body;

      const validStatuses = ['available', 'offline', 'on_ride'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid availability status.' });
      }

      const updateRes = await query(
        `UPDATE drivers SET availability_status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 RETURNING *`,
        [status, user.id]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Driver profile not found.' });
      }

      return res.json({
        success: true,
        message: `Driver status updated to ${status}`,
        data: updateRes.rows[0]
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get available ride requests (Searching for Auto)
   */
  public static async getIncomingRequests(req: Request, res: Response) {
  try {
    const user = req.user!;

    const driverRes = await query(
      `SELECT approval_status, availability_status
       FROM drivers
       WHERE user_id = $1
       LIMIT 1`,
      [user.id]
    );

    if (driverRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Driver profile not found.'
      });
    }

    const driver = driverRes.rows[0];
    const approvalStatus = String(driver.approval_status || 'PENDING').toUpperCase();

    // Only approved/active and currently online drivers receive requests.
    if (
      !['APPROVED', 'ACTIVE'].includes(approvalStatus) ||
      driver.availability_status !== 'available'
    ) {
      return res.json({
        success: true,
        data: []
      });
    }

    const resRequests = await query(
      `SELECT b.*, u.name as customer_name, u.mobile as customer_mobile
       FROM bookings b
       JOIN users u ON b.customer_id = u.id
       WHERE b.status = 'Searching for Auto'
       ORDER BY b.created_at ASC
       LIMIT 20`
    );

    return res.json({
      success: true,
      data: resRequests.rows
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

  /**
   * Driver accepts a booking request
   * Strictly enforces approval_status guard
   */
  public static async acceptBooking(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;

    // Get driver record
    const driverRes = await query(
      `SELECT * FROM drivers WHERE user_id = $1 LIMIT 1`,
      [user.id]
    );

    if (driverRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Driver profile not found.'
      });
    }

    const driver = driverRes.rows[0];

    // Driver must be approved/active
    const approvalStatus = String(
      driver.approval_status || 'PENDING'
    ).toUpperCase();

    if (!['APPROVED', 'ACTIVE'].includes(approvalStatus)) {
      return res.status(403).json({
        success: false,
        error: `Your driver account is currently ${approvalStatus}. You can only accept rides after approval by Admin.`
      });
    }

    // Driver must be online and available
    if (driver.availability_status !== 'available') {
      return res.status(400).json({
        success: false,
        error: 'You must be online and available to accept a new ride.'
      });
    }

    /*
     * Important:
     * The status condition is part of the UPDATE itself.
     *
     * This prevents two drivers from accepting the same ride:
     * the first UPDATE changes the booking from
     * "Searching for Auto" -> "Driver Assigned".
     * Any later driver gets zero updated rows.
     */
    const updateRes = await query(
      `UPDATE bookings
       SET driver_id = $1,
           status = 'Driver Assigned',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
         AND status = 'Searching for Auto'
         AND driver_id IS NULL
       RETURNING *`,
      [driver.id, id]
    );

    // Another driver already accepted it
    if (updateRes.rows.length === 0) {
      return res.status(409).json({
        success: false,
        error: 'Ride request is no longer available.'
      });
    }

    // This driver now has the active ride
    await query(
      `UPDATE drivers
       SET availability_status = 'on_ride'
       WHERE id = $1`,
      [driver.id]
    );

    return res.json({
      success: true,
      message: 'Ride accepted successfully.',
      data: updateRes.rows[0]
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

  /**
   * Driver updates the ride progress status
   * Valid: Driver Arriving, Ride Started, Ride Completed, Cancelled
   */
  public static async updateRideStatus(req: Request, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['Driver Assigned', 'Driver Arriving', 'Ride Started', 'Ride Completed', 'Cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid ride status update.' });
      }

      // Check driver
      const driverRes = await query('SELECT id FROM drivers WHERE user_id = $1 LIMIT 1', [user.id]);
      if (driverRes.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'Driver record not found.' });
      }
      const driverId = driverRes.rows[0].id;

      const bookingRes = await query('SELECT * FROM bookings WHERE id = $1 AND driver_id = $2 LIMIT 1', [id, driverId]);
      if (bookingRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Assigned booking not found.' });
      }
      const booking = bookingRes.rows[0];

      const updateRes = await query(
        `UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [status, id]
      );

      // If ride completed, ensure marketplace split payment record exists
      if (status === 'Ride Completed') {
        const existingPay = await query('SELECT id FROM payments WHERE booking_id = $1 LIMIT 1', [booking.id]);
        if (existingPay.rows.length === 0) {
          // Record cash payment
          const commissionPerTrip = await PaymentService.getCommissionPerTrip();
          const totalFare = Number(booking.estimated_fare);
          const ownerAmount = Math.min(commissionPerTrip, totalFare);
          const driverAmount = Math.max(0, totalFare - ownerAmount);
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
              driverId,
              totalFare,
              driverAmount,
              ownerAmount,
              ownerAmount,
              `TXN_CASH_${rand}`,
              `ORDER_CASH_${rand}`
            ]
          );
        }
      }

      // If ride completed or cancelled, make driver available again
      if (status === 'Ride Completed' || status === 'Cancelled') {
        await query(`UPDATE drivers SET availability_status = 'available' WHERE id = $1`, [driverId]);
      }

      return res.json({
        success: true,
        message: `Ride status updated to "${status}"`,
        data: updateRes.rows[0]
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * List all drivers (for directory or admin)
   */
  public static async getAllDrivers(req: Request, res: Response) {
    try {
      const drivers = await query(
        `SELECT d.*, u.name, u.email, u.mobile
         FROM drivers d
         JOIN users u ON d.user_id = u.id
         ORDER BY d.id ASC`
      );
      return res.json({ success: true, data: drivers.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
