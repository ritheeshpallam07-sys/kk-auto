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
      const passengers = Math.min(6, Math.max(1, Number(req.body.passengers) || 1));

      if (!fromLoc || !toLoc) {
        return res.status(400).json({
          success: false,
          available: false,
          error: 'Please select both pickup and destination locations.'
        });
      }

      if (fromLoc.toLowerCase().trim() === toLoc.toLowerCase().trim()) {
        return res.status(400).json({
          success: false,
          available: false,
          error: 'Pickup and destination cannot be the same location.'
        });
      }

      // 1. Check fixed route in database fare_routes table first
      const fixedResult = await RouteService.getRouteFare(fromLoc, toLoc);
      if (fixedResult.available && fixedResult.fare !== undefined) {
        return res.json({
          success: true,
          data: {
            available: true,
            pickupAddress: fixedResult.fromLocation || fromLoc,
            destinationAddress: fixedResult.toLocation || toLoc,
            passengers,
            estimatedFare: Number(fixedResult.fare) * passengers
          }
        });
      }

      // 2. Fallback: GPS coordinate area calculation if coordinates provided
      const pickupLatitude = Number(req.body.pickupLatitude);
      const pickupLongitude = Number(req.body.pickupLongitude);
      const destinationLatitude = Number(req.body.destinationLatitude);
      const destinationLongitude = Number(req.body.destinationLongitude);

      if (
        Number.isFinite(pickupLatitude) &&
        Number.isFinite(pickupLongitude) &&
        Number.isFinite(destinationLatitude) &&
        Number.isFinite(destinationLongitude)
      ) {
        const result = await FareService.calculateFare(
          fromLoc,
          toLoc,
          pickupLatitude,
          pickupLongitude,
          destinationLatitude,
          destinationLongitude
        );

        if (result.available && result.fare !== undefined) {
          return res.json({
            success: true,
            data: {
              available: true,
              pickupAddress: result.fromLocation || fromLoc,
              destinationAddress: result.toLocation || toLoc,
              passengers,
              estimatedFare: (result.fare ?? 0) * passengers
            }
          });
        }
      }

      return res.status(404).json({
        success: false,
        available: false,
        error: 'Fare not configured for this route. Please contact the admin.'
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

      if (pickupAddress.toLowerCase().trim() === destinationAddress.toLowerCase().trim()) {
        return res.status(400).json({ success: false, error: 'Pickup and destination cannot be the same location.' });
      }



      const numPassengers = Math.min(6, Math.max(1, Number(passengers) || 1));

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
      let pickupLatitude = Number(req.body.pickupLatitude);
      let pickupLongitude = Number(req.body.pickupLongitude);
      let destinationLatitude = Number(req.body.destinationLatitude);
      let destinationLongitude = Number(req.body.destinationLongitude);

      const FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
        'jntua': { lat: 13.6508, lng: 78.7860 },
        'cross': { lat: 13.6525, lng: 78.8035 },
        'bus stand': { lat: 13.6455, lng: 78.8035 },
        'marava': { lat: 13.6408, lng: 78.8010 }
      };

      if (!Number.isFinite(pickupLatitude)) {
        const key = pickupAddress.toLowerCase().trim();
        if (FALLBACK_COORDS[key]) {
          pickupLatitude = FALLBACK_COORDS[key].lat;
          pickupLongitude = FALLBACK_COORDS[key].lng;
        }
      }

      if (!Number.isFinite(destinationLatitude)) {
        const key = destinationAddress.toLowerCase().trim();
        if (FALLBACK_COORDS[key]) {
          destinationLatitude = FALLBACK_COORDS[key].lat;
          destinationLongitude = FALLBACK_COORDS[key].lng;
        }
      }

      let estimatedFare: number;
      let pickupAreaName: string | undefined;
      let destinationAreaName: string | undefined;

      // 1. Check fixed route in database first
      const fixedRoute = await RouteService.getRouteFare(pickupAddress, destinationAddress);
      if (fixedRoute.available && fixedRoute.fare !== undefined) {
        estimatedFare = Number(fixedRoute.fare) * numPassengers;
        pickupAreaName = fixedRoute.fromLocation || pickupAddress;
        destinationAreaName = fixedRoute.toLocation || destinationAddress;
      } else {
        // 2. Fallback GPS check
        if (
          !Number.isFinite(pickupLatitude) ||
          !Number.isFinite(pickupLongitude) ||
          !Number.isFinite(destinationLatitude) ||
          !Number.isFinite(destinationLongitude)
        ) {
          return res.status(400).json({
            success: false,
            error: fixedRoute.error || 'Valid pickup and destination locations are required.'
          });
        }

        const fareResult = await FareService.calculateFare(
          pickupAddress,
          destinationAddress,
          pickupLatitude,
          pickupLongitude,
          destinationLatitude,
          destinationLongitude
        );

        if (!fareResult.available || fareResult.fare === undefined) {
          return res.status(400).json({
            success: false,
            error: 'Fare not configured for this route. Please contact the admin.'
          });
        }

        estimatedFare = Number(fareResult.fare) * numPassengers;
        pickupAreaName = fareResult.fromLocation;
        destinationAreaName = fareResult.toLocation;
      }

const insertResult = await query(
  `INSERT INTO bookings (
    booking_reference,
    customer_id,
    pickup_address,
    destination_address,
    pickup_area_name,
    destination_area_name,
    pickup_latitude,
    pickup_longitude,
    destination_latitude,
    destination_longitude,
    pickup_datetime,
    passengers,
    estimated_fare,
    status,
    created_at,
    updated_at
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
  RETURNING *;`,
  [
    bookingReference,
    customerId,
    pickupAddress,
    destinationAddress,
    pickupAreaName,
    destinationAreaName,
    pickupLatitude,
    pickupLongitude,
    destinationLatitude,
    destinationLongitude,
    scheduledTime.toISOString(),
    numPassengers,
    estimatedFare,
    'Searching for Auto'
  ]
);

      const booking = insertResult.rows[0];
      console.log('BOOKING AREA NAMES:', {
  pickupAreaName: booking.pickup_area_name,
  destinationAreaName: booking.destination_area_name,
});

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
               d.payout_upi AS driver_payout_upi,
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
                d.payout_upi AS driver_payout_upi, 
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
