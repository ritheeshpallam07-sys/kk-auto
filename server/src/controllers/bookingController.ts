import { Request, Response } from 'express';
import { query } from '../config/db';
import { RouteService } from '../services/routeService';
import { FareService } from '../services/fareService';
import { notifyAvailableDriversOfNewRide } from '../services/pushNotificationService';

export class BookingController {
  /**
   * Get all selectable fixed locations from the database
   */
  public static async getLocations(req: Request, res: Response) {
    try {
      const locations = await RouteService.getLocations();
      return res.json({ success: true, data: locations });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to fetch locations.' : err.message
      });
    }
  }

  /**
   * Public endpoint to get all approved canonical fare zones and aliases
   */
  public static async getFareZones(req: Request, res: Response) {
    try {
      const zones = await RouteService.getApprovedZones();
      return res.json({ success: true, data: zones });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to fetch fare zones.' : err.message
      });
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

      const pickupLatitude = req.body.pickupLatitude !== undefined ? Number(req.body.pickupLatitude) : undefined;
      const pickupLongitude = req.body.pickupLongitude !== undefined ? Number(req.body.pickupLongitude) : undefined;
      const destinationLatitude = req.body.destinationLatitude !== undefined ? Number(req.body.destinationLatitude) : undefined;
      const destinationLongitude = req.body.destinationLongitude !== undefined ? Number(req.body.destinationLongitude) : undefined;

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
            pickupAddress: fromLoc,
            destinationAddress: toLoc,
            pickupZone: result.fromLocation,
            destinationZone: result.toLocation,
            pickupZoneId: result.fromZoneId,
            destinationZoneId: result.toZoneId,
            passengers,
            estimatedFare: Number(result.fare) * passengers,
            distanceKm: result.distanceKm,
            durationSeconds: result.durationSeconds,
            fareSource: result.fareSource || 'fixed',
            isAutoFare: Boolean(result.isAutoFare)
          }
        });
      }

      if (result.error === 'Pickup and destination cannot be the same location.') {
        return res.status(400).json({
          success: false,
          available: false,
          error: 'Pickup and destination cannot be the same location.'
        });
      }

      if (
        result.error === 'Fare not configured for this location' ||
        result.error === 'Fare not configured for this route. Please contact the admin.'
      ) {
        return res.status(404).json({
          success: false,
          available: false,
          error: 'Fare not configured for this location'
        });
      }

      return res.status(400).json({
        success: false,
        available: false,
        error: result.error || 'Unable to calculate fare estimate.'
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to calculate fare estimate.' : err.message
      });
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

      // Prevent duplicate concurrent active rides for the same customer
      const activeBookingResult = await query(
        `SELECT id, booking_reference, status, pickup_address, destination_address, created_at
         FROM bookings
         WHERE customer_id = $1
           AND status IN ('Searching for Auto', 'Driver Assigned', 'Driver Arriving', 'Ride Started')
         ORDER BY created_at DESC
         LIMIT 1;`,
        [customerId]
      );

      if (activeBookingResult.rows.length > 0) {
        const activeRide = activeBookingResult.rows[0];
        return res.status(409).json({
          success: false,
          error: `You already have an active ride (${activeRide.booking_reference}) with status "${activeRide.status}". Please complete or cancel it before booking another ride.`,
          data: activeRide
        });
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
        'marava': { lat: 13.6408, lng: 78.8010 },
        'indiramma colony': { lat: 13.6550, lng: 78.7960 }
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
      let distanceKm: number | null = null;
      let fareSource: string = 'fixed';

      // Unified server-side calculation: fixed route priority -> automatic distance fallback
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
          error: fareResult.error || 'Fare not configured for this location'
        });
      }

      estimatedFare = Number(fareResult.fare) * numPassengers;
      pickupAreaName = fareResult.fromLocation || pickupAddress;
      destinationAreaName = fareResult.toLocation || destinationAddress;
      distanceKm = fareResult.distanceKm ?? null;
      fareSource = fareResult.fareSource || (fareResult.isAutoFare ? 'distance' : 'fixed');

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
          distance_km,
          fare_source,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
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
          'Searching for Auto',
          distanceKm,
          fareSource
        ]
      );

      const booking = insertResult.rows[0];
      console.log('BOOKING AREA NAMES:', {
  pickupAreaName: booking.pickup_area_name,
  destinationAreaName: booking.destination_area_name,
});

      // Notify subscribed available drivers via Web Push (non-blocking)
      void notifyAvailableDriversOfNewRide(booking).catch((pushErr: any) => {
        console.warn('[Push] New ride notification skipped:', pushErr?.message || 'dispatch error');
      });

      return res.status(201).json({
        success: true,
        message: 'Auto booked successfully!',
        data: booking
      });
    } catch (err: any) {
      console.error('[CreateBooking Error]', err);
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
          ? 'Failed to create booking due to an internal server error.'
          : (err.message || 'Failed to create booking.')
      });
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
               du.name as driver_name, du.mobile as driver_mobile,
               p.payment_status,
               p.driver_payment_confirmed_at
        FROM bookings b
        LEFT JOIN users u ON b.customer_id = u.id
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN users du ON d.user_id = du.id
        LEFT JOIN (
          SELECT booking_id, payment_status, driver_payment_confirmed_at,
                 ROW_NUMBER() OVER (PARTITION BY booking_id ORDER BY id DESC) as rn
          FROM payments
        ) p ON p.booking_id = b.id AND p.rn = 1
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
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to fetch bookings.' : err.message
      });
    }
  }

  /**
   * Get single booking details by ID or reference
   * Strictly enforces role-based access control (CONF-04):
   * - Customer: can access only their own bookings (booking.customer_id matches user.id)
   * - Driver: resolves driver record; can access only bookings assigned to them (booking.driver_id matches driver.id)
   * - Admin: full access
   * Denies access with HTTP 403 and zero booking/customer PII for unauthorized requests.
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
                du.name as driver_name, du.mobile as driver_mobile,
                p.payment_status,
                p.driver_payment_confirmed_at
         FROM bookings b
         LEFT JOIN users u ON b.customer_id = u.id
         LEFT JOIN drivers d ON b.driver_id = d.id
         LEFT JOIN users du ON d.user_id = du.id
         LEFT JOIN (
           SELECT booking_id, payment_status, driver_payment_confirmed_at,
                  ROW_NUMBER() OVER (PARTITION BY booking_id ORDER BY id DESC) as rn
           FROM payments
         ) p ON p.booking_id = b.id AND p.rn = 1
         WHERE ${lookupField} = $1 LIMIT 1`,
        [isNumeric ? Number(id) : id]
      );

      if (resBooking.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Booking not found.' });
      }

      const booking = resBooking.rows[0];

      // Authorization Check (CONF-04)
      if (user.role === 'customer') {
        if (Number(booking.customer_id) !== Number(user.id)) {
          return res.status(403).json({ success: false, error: 'Unauthorized to view this booking.' });
        }
      } else if (user.role === 'driver') {
        const driverRes = await query(
          `SELECT id FROM drivers WHERE user_id = $1 LIMIT 1`,
          [user.id]
        );
        if (driverRes.rows.length === 0) {
          return res.status(403).json({ success: false, error: 'Unauthorized to view this booking.' });
        }
        const driverId = driverRes.rows[0].id;
        if (!booking.driver_id || Number(booking.driver_id) !== Number(driverId)) {
          return res.status(403).json({ success: false, error: 'Unauthorized to view this booking.' });
        }
      } else if (user.role === 'admin') {
        // Administrative access explicitly verified
      } else {
        return res.status(403).json({ success: false, error: 'Unauthorized to view this booking.' });
      }

      return res.json({ success: true, data: booking });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to fetch booking details.' : err.message
      });
    }
  }

  /**
   * Cancel booking
   */
  /**
   * Cancel booking
   * Enforces strict role-based authorization:
   * - Customer: can cancel only their own bookings in 'Searching for Auto', 'Driver Assigned', or 'Driver Arriving'.
   * - Driver: can cancel only bookings assigned to their resolved driver ID in 'Driver Assigned' or 'Driver Arriving'.
   * - Admin: authorized to cancel cancellable bookings.
   * Disallows cancelling 'Ride Started', 'Ride Completed', or already 'Cancelled' bookings.
   * Atomically updates booking status and assigned driver availability in a single transactional query.
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
      let driverId: number | null = null;

      // 1. Authorization checks
      if (user.role === 'customer') {
        if (Number(booking.customer_id) !== Number(user.id)) {
          return res.status(403).json({ success: false, error: 'Unauthorized to cancel this booking.' });
        }
      } else if (user.role === 'driver') {
        const driverRes = await query(
          `SELECT id FROM drivers WHERE user_id = $1 LIMIT 1`,
          [user.id]
        );
        if (driverRes.rows.length === 0) {
          return res.status(403).json({ success: false, error: 'Driver record not found.' });
        }
        driverId = driverRes.rows[0].id;

        if (!booking.driver_id) {
          return res.status(403).json({ success: false, error: 'Unauthorized to cancel an unassigned booking.' });
        }

        if (Number(booking.driver_id) !== Number(driverId)) {
          return res.status(403).json({ success: false, error: 'Unauthorized to cancel a booking not assigned to you.' });
        }
      } else if (user.role === 'admin') {
        // Administrative cancellation explicitly verified server-side
      } else {
        return res.status(403).json({ success: false, error: 'Unauthorized.' });
      }

      // 2. Status validation checks
      if (booking.status === 'Cancelled') {
        return res.status(400).json({ success: false, error: 'Booking is already cancelled.' });
      }

      if (booking.status === 'Ride Completed') {
        return res.status(400).json({ success: false, error: 'Cannot cancel a completed ride.' });
      }

      if (booking.status === 'Ride Started') {
        return res.status(400).json({ success: false, error: 'Cannot cancel a ride that is already in progress.' });
      }

      const allowedStatuses = ['Searching for Auto', 'Driver Assigned', 'Driver Arriving'];
      if (!allowedStatuses.includes(booking.status)) {
        return res.status(400).json({ success: false, error: `Cannot cancel a ride with status "${booking.status}".` });
      }

      // 3. Atomic state update using CTE transaction with embedded authorization predicates:
      // - Customer: embeds customer_id check directly into the UPDATE WHERE condition.
      // - Driver: embeds driver_id check directly into the UPDATE WHERE condition.
      // - Admin: verified server-side role check.
      // If assignment, ownership, or status changes concurrently, the update affects 0 rows.
      // Driver availability updates ONLY if the booking was actually cancelled for that specific driver.
      let updateSql = '';
      let updateParams: any[] = [];

      if (user.role === 'customer') {
        updateSql = `
          WITH cancelled_booking AS (
            UPDATE bookings
            SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND customer_id = $2
              AND status IN ('Searching for Auto', 'Driver Assigned', 'Driver Arriving')
            RETURNING *
          ),
          updated_driver AS (
            UPDATE drivers
            SET availability_status = 'available', updated_at = CURRENT_TIMESTAMP
            WHERE id = (SELECT driver_id FROM cancelled_booking WHERE driver_id IS NOT NULL)
            RETURNING id
          )
          SELECT * FROM cancelled_booking`;
        updateParams = [booking.id, user.id];
      } else if (user.role === 'driver') {
        updateSql = `
          WITH cancelled_booking AS (
            UPDATE bookings
            SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND driver_id = $2
              AND status IN ('Driver Assigned', 'Driver Arriving')
            RETURNING *
          ),
          updated_driver AS (
            UPDATE drivers
            SET availability_status = 'available', updated_at = CURRENT_TIMESTAMP
            WHERE id = (SELECT driver_id FROM cancelled_booking WHERE driver_id IS NOT NULL)
            RETURNING id
          )
          SELECT * FROM cancelled_booking`;
        updateParams = [booking.id, driverId];
      } else if (user.role === 'admin') {
        updateSql = `
          WITH cancelled_booking AS (
            UPDATE bookings
            SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND status IN ('Searching for Auto', 'Driver Assigned', 'Driver Arriving')
            RETURNING *
          ),
          updated_driver AS (
            UPDATE drivers
            SET availability_status = 'available', updated_at = CURRENT_TIMESTAMP
            WHERE id = (SELECT driver_id FROM cancelled_booking WHERE driver_id IS NOT NULL)
            RETURNING id
          )
          SELECT * FROM cancelled_booking`;
        updateParams = [booking.id];
      }

      const updatedRes = await query(updateSql, updateParams);

      if (updatedRes.rows.length === 0) {
        // Query the latest database state to provide exact, safe conflict or authorization error
        const latestRes = await query(
          `SELECT customer_id, driver_id, status FROM bookings WHERE id = $1 LIMIT 1`,
          [booking.id]
        );
        if (latestRes.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Booking not found.' });
        }
        const current = latestRes.rows[0];

        if (user.role === 'customer' && Number(current.customer_id) !== Number(user.id)) {
          return res.status(403).json({ success: false, error: 'Unauthorized to cancel this booking.' });
        }

        if (user.role === 'driver' && Number(current.driver_id) !== Number(driverId)) {
          return res.status(403).json({ success: false, error: 'Booking assignment changed. Unauthorized to cancel.' });
        }

        if (current.status === 'Cancelled') {
          return res.status(400).json({ success: false, error: 'Booking is already cancelled.' });
        }

        if (current.status === 'Ride Started') {
          return res.status(400).json({ success: false, error: 'Cannot cancel a ride that is already in progress.' });
        }

        if (current.status === 'Ride Completed') {
          return res.status(400).json({ success: false, error: 'Cannot cancel a completed ride.' });
        }

        return res.status(409).json({
          success: false,
          error: `Booking status changed to "${current.status}". Cancellation failed.`
        });
      }

      return res.json({
        success: true,
        message: 'Booking cancelled successfully.',
        data: updatedRes.rows[0]
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to cancel booking.' : err.message
      });
    }
  }
}
