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
   * Update driver's own profile and payment details (display name, mobile, and payout UPI)
   */
  public static async updateDriverProfile(req: Request, res: Response) {
    try {
      const user = req.user!;
      const { name, mobile, payout_upi, payoutUpi } = req.body;

      // 1. Ensure driver record exists for this authenticated user
      const driverRes = await query(
        `SELECT id, user_id FROM drivers WHERE user_id = $1 LIMIT 1`,
        [user.id]
      );
      if (driverRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Driver profile not found.' });
      }

      // 2. Validate Display Name
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName || cleanName.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid display name (at least 2 characters).'
        });
      }
      if (cleanName.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Display name cannot exceed 100 characters.'
        });
      }

      // 3. Validate Mobile Number
      const cleanMobile = typeof mobile === 'string' ? mobile.trim().replace(/[\s\-]/g, '') : '';
      if (!cleanMobile || !/^\+?[0-9]{10,14}$/.test(cleanMobile)) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid 10-digit mobile number.'
        });
      }

      // Check if mobile number is already in use by another user
      const mobileCheck = await query(
        `SELECT id FROM users WHERE mobile = $1 AND id != $2 LIMIT 1`,
        [cleanMobile, user.id]
      );
      if (mobileCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'An account with this mobile number already exists.'
        });
      }

      // 4. Validate UPI ID
      // Separate field for mobile number and UPI ID.
      // Must not automatically treat a bare phone number as a UPI ID.
      const upiRaw = typeof payout_upi === 'string' ? payout_upi : (typeof payoutUpi === 'string' ? payoutUpi : '');
      const cleanUpi = upiRaw.trim();

      if (!cleanUpi) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid UPI ID (e.g. driver@oksbi or 9876543210@ybl).'
        });
      }

      // Ensure UPI ID has @ and valid bank handle format
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,64}$/;
      if (!upiRegex.test(cleanUpi)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid UPI ID format. A valid UPI ID must include a bank handle (e.g. name@oksbi or mobile@upi). Do not enter only a phone number.'
        });
      }

      // 5. Update users table (display name, mobile)
      await query(
        `UPDATE users
         SET name = $1, mobile = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [cleanName, cleanMobile, user.id]
      );

      // 6. Update drivers table (payout_upi)
      await query(
        `UPDATE drivers
         SET payout_upi = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [cleanUpi, user.id]
      );

      // 7. Fetch and return the updated driver profile
      const fullDriverRes = await query(
        `SELECT d.*, u.name, u.email, u.mobile
         FROM drivers d
         JOIN users u ON d.user_id = u.id
         WHERE d.user_id = $1 LIMIT 1`,
        [user.id]
      );

      const updatedDriver = fullDriverRes.rows[0];
      const earnings = await PaymentService.getDriverEarnings(user.id);

      return res.json({
        success: true,
        message: 'Driver profile and payment details updated successfully.',
        data: {
          ...updatedDriver,
          earnings
        }
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to update profile.'
      });
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

      await query(
        `UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [status, id]
      );

      // If ride completed or cancelled, make driver available again
      if (status === 'Ride Completed' || status === 'Cancelled') {
        await query(`UPDATE drivers SET availability_status = 'available' WHERE id = $1`, [driverId]);
      }

      const fullRes = await query(
        `SELECT b.*,
                u.name as customer_name, u.mobile as customer_mobile,
                d.auto_number, d.auto_model,
                d.payout_upi AS driver_payout_upi,
                du.name as driver_name, du.mobile as driver_mobile
         FROM bookings b
         LEFT JOIN users u ON b.customer_id = u.id
         LEFT JOIN drivers d ON b.driver_id = d.id
         LEFT JOIN users du ON d.user_id = du.id
         WHERE b.id = $1 LIMIT 1`,
        [id]
      );

      return res.json({
        success: true,
        message: `Ride status updated to "${status}"`,
        data: fullRes.rows[0]
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

    /**
   * Save the driver's browser Web Push subscription
   */
  public static async savePushSubscription(req: Request, res: Response) {
    try {
      const user = req.user!;
      const { endpoint, expirationTime, keys } = req.body;

      if (
        !endpoint ||
        !keys ||
        !keys.p256dh ||
        !keys.auth
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid push subscription data.'
        });
      }

      const driverRes = await query(
        `SELECT id
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

      const driverId = driverRes.rows[0].id;

      const subscriptionRes = await query(
        `INSERT INTO driver_push_subscriptions
          (driver_id, endpoint, p256dh, auth, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (endpoint)
         DO UPDATE SET
           driver_id = EXCLUDED.driver_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          driverId,
          endpoint,
          keys.p256dh,
          keys.auth
        ]
      );

      return res.json({
        success: true,
        message: 'Push notification subscription saved.',
        data: subscriptionRes.rows[0]
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
  /**
 * Get the public VAPID key for Web Push subscription
 */
public static getPushPublicKey(req: Request, res: Response) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return res.status(500).json({
      success: false,
      error: 'Push notifications are not configured.'
    });
  }

  return res.json({
    success: true,
    data: {
      publicKey
    }
  });
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
