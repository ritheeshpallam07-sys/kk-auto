import { Request, Response } from 'express';
import { SupportService } from '../services/supportService';
import { AuthService } from '../services/authService';

export class SupportController {
  /**
   * Helper to retrieve client IP safely
   */
  private static getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || '127.0.0.1';
  }

  /**
   * Public / Authenticated: Get support configuration (email, phone, WhatsApp)
   */
  public static async getConfig(req: Request, res: Response) {
    try {
      const config = await SupportService.getSupportConfig();
      return res.json({
        success: true,
        data: config
      });
    } catch (err: any) {
      console.error('[SupportController.getConfig] Error:', err);
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to retrieve support configuration.' : err.message
      });
    }
  }

  /**
   * Create a new support ticket (Customer, Driver, Admin)
   */
  public static async createTicket(req: Request, res: Response) {
    try {
      const user = req.user!;
      const { category, subject, message, bookingId } = req.body;

      // Rate limiting: Max 5 tickets per user per 15 minutes
      const rateLimitKey = `support_ticket_user_${user.id}`;
      const rateLimit = await AuthService.checkRateLimit(rateLimitKey, 5, 15 * 60);
      if (!rateLimit.allowed) {
        if (typeof res.set === 'function') {
          res.set('Retry-After', String(rateLimit.retryAfterSeconds));
        }
        return res.status(429).json({
          success: false,
          error: 'Too many support tickets submitted recently. Please wait a few minutes before opening another ticket.'
        });
      }

      if (!category || typeof category !== 'string') {
        return res.status(400).json({ success: false, error: 'Category is required.' });
      }
      if (!subject || typeof subject !== 'string') {
        return res.status(400).json({ success: false, error: 'Subject is required.' });
      }
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'Description message is required.' });
      }

      const ticket = await SupportService.createTicket(user.id, user.role, {
        category: category.trim(),
        subject: subject.trim(),
        message: message.trim(),
        bookingId: bookingId ? Number(bookingId) : undefined
      });

      return res.status(201).json({
        success: true,
        message: 'Support ticket submitted successfully.',
        data: ticket
      });
    } catch (err: any) {
      const isClientError =
        err.message.includes('Invalid') ||
        err.message.includes('between') ||
        err.message.includes('not found') ||
        err.message.includes('not owned') ||
        err.message.includes('not assigned') ||
        err.message.includes('Unsupported');

      const status = isClientError ? 400 : 500;
      return res.status(status).json({
        success: false,
        error: isClientError ? err.message : (process.env.NODE_ENV === 'production' ? 'Failed to create support ticket.' : err.message)
      });
    }
  }

  /**
   * Retrieve tickets:
   * - Admin: Returns paginated & filtered ticket list across all users
   * - Customer/Driver: Returns their own tickets
   */
  public static async getTickets(req: Request, res: Response) {
    try {
      const user = req.user!;

      if (user.role === 'admin') {
        const { page, limit, userRole, category, status, priority, search } = req.query;
        const result = await SupportService.getAdminTickets({
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
          userRole: typeof userRole === 'string' ? userRole : undefined,
          category: typeof category === 'string' ? category : undefined,
          status: typeof status === 'string' ? status : undefined,
          priority: typeof priority === 'string' ? priority : undefined,
          search: typeof search === 'string' ? search : undefined
        });

        return res.json({
          success: true,
          data: result.tickets,
          meta: {
            total: result.total,
            page: result.page,
            totalPages: result.totalPages
          }
        });
      }

      // Customer or Driver: Get user's own tickets
      const tickets = await SupportService.getUserTickets(user.id, user.role);
      return res.json({
        success: true,
        data: tickets
      });
    } catch (err: any) {
      console.error('[SupportController.getTickets] Error:', err);
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to retrieve tickets.' : err.message
      });
    }
  }

  /**
   * Get single ticket details and conversation thread
   */
  public static async getTicketDetails(req: Request, res: Response) {
    try {
      const user = req.user!;
      const ticketId = Number(req.params.id);

      if (!Number.isInteger(ticketId) || ticketId <= 0) {
        return res.status(400).json({ success: false, error: 'Valid ticket ID is required.' });
      }

      const details = await SupportService.getTicketDetails(ticketId, user.id, user.role);

      return res.json({
        success: true,
        data: details
      });
    } catch (err: any) {
      if (err.message.includes('not found')) {
        return res.status(404).json({ success: false, error: err.message });
      }
      if (err.message.includes('Unauthorized')) {
        return res.status(403).json({ success: false, error: err.message });
      }
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to retrieve ticket details.' : err.message
      });
    }
  }

  /**
   * Add a reply message to an open support ticket
   */
  public static async addMessage(req: Request, res: Response) {
    try {
      const user = req.user!;
      const ticketId = Number(req.params.id);
      const { message } = req.body;

      if (!Number.isInteger(ticketId) || ticketId <= 0) {
        return res.status(400).json({ success: false, error: 'Valid ticket ID is required.' });
      }

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Message content is required.' });
      }

      // Rate limiting: Max 20 messages per user per 15 minutes
      const rateLimitKey = `support_msg_user_${user.id}`;
      const msgRateLimit = await AuthService.checkRateLimit(rateLimitKey, 20, 15 * 60);
      if (!msgRateLimit.allowed) {
        if (typeof res.set === 'function') {
          res.set('Retry-After', String(msgRateLimit.retryAfterSeconds));
        }
        return res.status(429).json({
          success: false,
          error: 'Too many messages sent recently. Please wait a moment before sending another message.'
        });
      }

      const newMessage = await SupportService.addMessage(
        ticketId,
        user.id,
        user.role,
        message.trim()
      );

      return res.status(201).json({
        success: true,
        message: 'Reply sent successfully.',
        data: newMessage
      });
    } catch (err: any) {
      if (err.message.includes('not found')) {
        return res.status(404).json({ success: false, error: err.message });
      }
      if (err.message.includes('Unauthorized')) {
        return res.status(403).json({ success: false, error: err.message });
      }
      if (err.message.includes('closed') || err.message.includes('between')) {
        return res.status(400).json({ success: false, error: err.message });
      }
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to send message.' : err.message
      });
    }
  }

  /**
   * Admin: Update ticket status and/or priority
   */
  public static async updateTicketStatus(req: Request, res: Response) {
    try {
      const user = req.user!;
      const ticketId = Number(req.params.id);
      const { status, priority } = req.body;

      if (!Number.isInteger(ticketId) || ticketId <= 0) {
        return res.status(400).json({ success: false, error: 'Valid ticket ID is required.' });
      }

      const clientIp = SupportController.getClientIp(req);

      const updated = await SupportService.updateTicketStatus(
        ticketId,
        { id: user.id, email: user.email },
        { status, priority },
        clientIp
      );

      return res.json({
        success: true,
        message: 'Ticket updated successfully.',
        data: updated
      });
    } catch (err: any) {
      if (err.message.includes('not found')) {
        return res.status(404).json({ success: false, error: err.message });
      }
      if (err.message.includes('Invalid') || err.message.includes('At least one')) {
        return res.status(400).json({ success: false, error: err.message });
      }
      return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to update ticket.' : err.message
      });
    }
  }
}
