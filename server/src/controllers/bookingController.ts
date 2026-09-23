import { Request, Response } from 'express';
import { query } from '../config/db';
import { RouteService } from '../services/routeService';
import { FareService } from '../services/fareService';

export class BookingController {
  /**
   * Get all selectable fixed locations from the database
   */
  public static async getLocations(req: Request, res: Response) {
    try {
      const locations = await RouteService.getLocations();
      return res.json({ success: true, data: locations });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Server-side fixed route fare check against fare_routes table
   */
  public static async calculateFareEstimate(req: Request, res: Response) {
    try {
      const fromLoc = req.body.fromLocation || req.body.pickupAddress;
      const toLoc = req.body.toLocation || req.body.destinationAddress;
      const passengers = Math.min(4, Math.max(1, Number(req.body.passengers) || 1));

      if (!fromLoc || !toLoc) {
        return res.status(400).json({
          success: false,
          available: false,
          error: 'Please select both pickup and destination locations.'
        });
      }

      const result = await FareService.calculateFare(fromLoc, toLoc);

      if (!result.available) {
        return res.status(404).json({
          success: false,
          available: false,
          error: result.error || 'Sorry, this route is currently unavailable.'
        });
      }

      return res.json({
        success: true,
        data: {
          available: true,
          pickupAddress: result.fromLocation,
          destinationAddress: result.toLocation,
          passengers,
          estimatedFare: (result.fare ?? 0) * passengers        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Create a new booking on an authorized fixed route
   */
  public static async createBooking(req: Request, res: Response) {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        return res.status(401).json({ success: false, error: 'Customer login required to book an auto.' });
      }

      const pickupAddress = (req.body.pickupAddress || req.body.fromLocation || '').trim();
      const destinationAddress = (req.body.destinationAddress || req.body.toLocation || '').trim();
      const { pickupDateTime, passengers } = req.body;

      if (!pickupAddress || !destinationAddress) {
        return res.status(400).json({ success: false, error: 'Pickup and destination locations are required.' });
      }

      // Strictly verify route in the database
      const routeCheck = await RouteService.getRouteFare(pickupAddress, destinationAddress);
      if (!routeCheck.available || routeCheck.fare === undefined) {
        return res.status(400).json({
          success: false,
          error: routeCheck.error || 'Sorry, this route is currently unavailable.'
        });
      }

      const numPassengers = Math.min(4, Math.max(1, Number(passengers) || 1));

      // Validate pickup date time
      const scheduledTime = pickupDateTime ? new Date(pickupDateTime) : new Date();
      if (isNaN(scheduledTime.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid pickup date/time format.' });
      }

      const now = new Date();
      if (scheduledTime.getTime() < now.getTime() - 2 * 60 * 1000) {
        return res.status(400).json({ success: false, error: 'Pickup time cannot be in the past.' });
      }

      // Generate unique Booking Reference (KK-XXXXXX)
      const randomCode = Math.floor(100000 + Math.random() * 900000);
      const bookingReference = `KK-${randomCode}`;

      const insertResult = await query(
        `INSERT INTO bookings (
          booking_reference,
          customer_id,
          pickup_address,
          destination_address,
          pickup_datetime,
          passengers,
          estimated_fare,
          status,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *;`,
        [
          bookingReference,
          customerId,
          routeCheck.fromLocation,
          routeCheck.toLocation,
          scheduledTime.toISOString(),
          numPassengers,
          routeCheck.fare * numPassengers,
          'Searching for Auto'
        ]
      );

      const booking = insertResult.rows[0];

      return res.status(201).json({
        success: true,
        message: 'Auto booked successfully!',
        data: booking
      });
    } catch (err: any) {
      console.error('[CreateBooking Error]', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to create booking.' });
    }
  }

  /**
   * Get all bookings for logged-in customer (or all if admin)
   */
  public static async getMyBookings(req: Request, res: Response) {
    try {
      const user = req.user!;
      let sql = `
        SELECT b.*, 
               u.name as customer_name, u.mobile as customer_mobile,
               d.auto_number, d.auto_model,
               du.name as driver_name, du.mobile as driver_mobile
        FROM bookings b
        LEFT JOIN users u ON b.customer_id = u.id
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN users du ON d.user_id = du.id
      `;
      const params: any[] = [];

      if (user.role === 'customer') {
        sql += ' WHERE b.customer_id = $1 ORDER BY b.created_at DESC';
        params.push(user.id);
      } else if (user.role === 'driver') {
        const driverRes = await query('SELECT id FROM drivers WHERE user_id = $1', [user.id]);
        if (driverRes.rows.length > 0) {
          sql += ' WHERE b.driver_id = $1 ORDER BY b.created_at DESC';
          params.push(driverRes.rows[0].id);
        } else {
          return res.json({ success: true, data: [] });
        }
      } else {
        sql += ' ORDER BY b.created_at DESC';
      }

      const resBookings = await query(sql, params);
      return res.json({ success: true, data: resBookings.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get single booking details by ID or reference
   */
  public static async getBookingById(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const user = req.user!;

      const isNumeric = /^\d+$/.test(id);
      const lookupField = isNumeric ? 'b.id' : 'b.booking_reference';

      const resBooking = await query(
        `SELECT b.*, 
                u.name as customer_name, u.mobile as customer_mobile, u.email as customer_email,
                d.auto_number, d.auto_model, d.license_number,
                du.name as driver_name, du.mobile as driver_mobile
         FROM bookings b
         LEFT JOIN users u ON b.customer_id = u.id
         LEFT JOIN drivers d ON b.driver_id = d.id
         LEFT JOIN users du ON d.user_id = du.id
         WHERE ${lookupField} = $1 LIMIT 1`,
        [isNumeric ? Number(id) : id]
      );

      if (resBooking.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Booking not found.' });
      }

      const booking = resBooking.rows[0];

      if (user.role === 'customer' && booking.customer_id !== user.id) {
        return res.status(403).json({ success: false, error: 'Unauthorized to view this booking.' });
      }

      return res.json({ success: true, data: booking });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Cancel booking
   */
  public static async cancelBooking(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const user = req.user!;

      const isNumeric = /^\d+$/.test(id);
      const lookupField = isNumeric ? 'id' : 'booking_reference';

      const resBooking = await query(
        `SELECT * FROM bookings WHERE ${lookupField} = $1 LIMIT 1`,
        [isNumeric ? Number(id) : id]
      );

      if (resBooking.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Booking not found.' });
      }

      const booking = resBooking.rows[0];

      if (user.role === 'customer' && booking.customer_id !== user.id) {
        return res.status(403).json({ success: false, error: 'Unauthorized to cancel this booking.' });
      }

      if (booking.status === 'Ride Completed') {
        return res.status(400).json({ success: false, error: 'Cannot cancel a completed ride.' });
      }

      if (booking.status === 'Cancelled') {
        return res.status(400).json({ success: false, error: 'Booking is already cancelled.' });
      }

      const updatedRes = await query(
        `UPDATE bookings SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [booking.id]
      );

      if (booking.driver_id) {
        await query(
          `UPDATE drivers SET availability_status = 'available' WHERE id = $1`,
          [booking.driver_id]
        );
      }

      return res.json({
        success: true,
        message: 'Booking cancelled successfully.',
        data: updatedRes.rows[0]
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
