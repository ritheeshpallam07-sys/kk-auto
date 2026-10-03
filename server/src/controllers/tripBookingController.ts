import { Request, Response } from 'express';
import { TripBookingService } from '../services/tripBookingService';

export class TripBookingController {
  /**
   * Customer submits a new car / trip booking request
   */
  public static async create(req: Request, res: Response) {
    try {
      const user = req.user!;
      const {
        customerName,
        phoneNumber,
        members,
        tripPlace,
        days,
        tripDate,
        pickupTime
      } = req.body;

      const trip = await TripBookingService.createTripBooking(user.id, {
        customerName,
        phoneNumber,
        members,
        tripPlace,
        days,
        tripDate,
        pickupTime
      });

      return res.status(201).json({
        success: true,
        message: 'Trip request submitted successfully. Owner will contact you after confirming the trip.',
        data: trip
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to submit trip booking request.'
      });
    }
  }

  /**
   * Customer views their own car / trip requests
   */
  public static async getMyBookings(req: Request, res: Response) {
    try {
      const user = req.user!;
      const trips = await TripBookingService.getMyTripBookings(user.id);
      return res.json({
        success: true,
        data: trips
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch trip requests.'
      });
    }
  }

  /**
   * Customer or Owner gets trip booking details by ID
   */
  public static async getById(req: Request, res: Response) {
    try {
      const user = req.user!;
      const tripId = Number(req.params.id);

      if (isNaN(tripId)) {
        return res.status(400).json({ success: false, error: 'Invalid trip booking ID.' });
      }

      // If not admin, restrict to owner of the booking
      const customerId = user.role === 'admin' ? undefined : user.id;
      const trip = await TripBookingService.getTripBookingById(tripId, customerId);

      return res.json({
        success: true,
        data: trip
      });
    } catch (err: any) {
      const status = err.message?.includes('not authorized') ? 403 : 404;
      return res.status(status).json({
        success: false,
        error: err.message || 'Trip booking not found.'
      });
    }
  }

  /**
   * Owner views all car / trip requests across the platform
   */
  public static async getAllByOwner(req: Request, res: Response) {
    try {
      const trips = await TripBookingService.getAllTripBookings();
      return res.json({
        success: true,
        data: trips
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch trip requests.'
      });
    }
  }

  /**
   * Owner sets final quoted price and/or updates booking status
   */
  public static async updateByOwner(req: Request, res: Response) {
    try {
      const tripId = Number(req.params.id);
      if (isNaN(tripId)) {
        return res.status(400).json({ success: false, error: 'Invalid trip booking ID.' });
      }

      const { quotedPrice, status } = req.body;
      const updated = await TripBookingService.updateTripBookingByOwner(tripId, {
        quotedPrice,
        status
      });

      return res.json({
        success: true,
        message: 'Trip booking updated successfully.',
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to update trip booking.'
      });
    }
  }

  /**
   * Customer initiates online payment order for confirmed trip
   */
  public static async createPaymentOrder(req: Request, res: Response) {
    try {
      const user = req.user!;
      const tripId = Number(req.params.id);
      const { paymentMethod } = req.body;

      if (isNaN(tripId)) {
        return res.status(400).json({ success: false, error: 'Invalid trip booking ID.' });
      }

      const result = await TripBookingService.createTripPaymentOrder(
        tripId,
        user.id,
        paymentMethod || 'UPI'
      );

      return res.json({
        success: true,
        message: 'Payment order generated successfully.',
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to create payment order.'
      });
    }
  }

  /**
   * Customer completes sandbox payment simulation for confirmed trip
   */
  public static async processSandboxPayment(req: Request, res: Response) {
    try {
      const user = req.user!;
      const tripId = Number(req.params.id);
      const { paymentMethod } = req.body;

      if (isNaN(tripId)) {
        return res.status(400).json({ success: false, error: 'Invalid trip booking ID.' });
      }

      const updated = await TripBookingService.processTripSandboxPayment(
        tripId,
        user.id,
        paymentMethod || 'UPI'
      );

      return res.json({
        success: true,
        message: 'Trip payment completed successfully!',
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Payment simulation failed.'
      });
    }
  }

  /**
   * Customer fetches Owner business contact details (Phone & WhatsApp)
   */
  public static async getOwnerContact(req: Request, res: Response) {
    try {
      const contact = await TripBookingService.getOwnerContactInfo();
      return res.json({
        success: true,
        data: contact
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to retrieve owner contact details.'
      });
    }
  }
  public static async getTripMessages(req: Request, res: Response) {
  try {
    const tripBookingId = Number(req.params.id);
    const userId = Number(req.user?.id);

    const messages = await TripBookingService.getTripMessages(
      tripBookingId,
      userId
    );

    return res.json(messages);
  } catch (error: any) {
    return res.status(400).json({
      message: error?.message || 'Unable to load messages'
    });
  }
}

public static async sendTripMessage(req: Request, res: Response) {
  try {
    const tripBookingId = Number(req.params.id);
    const userId = Number(req.user?.id);
    const { message } = req.body;

    const result = await TripBookingService.sendTripMessage(
      tripBookingId,
      userId,
      message
    );

    return res.status(201).json({
  success: true,
  data: result
});
  } catch (error: any) {
    return res.status(400).json({
      message: error?.message || 'Unable to send message'
    });
  }
}
 public static async confirmTrip(req: Request, res: Response) {
  try {
    const tripBookingId = Number(req.params.id);
    const customerId = Number(req.user?.id);

    const trip = await TripBookingService.confirmTripBooking(
      tripBookingId,
      customerId
    );

    return res.json(trip);
  } catch (error: any) {
    return res.status(400).json({
      message: error?.message || 'Unable to confirm trip'
    });
  }
}
}
