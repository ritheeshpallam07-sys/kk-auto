import { query, withTransaction, QueryResult } from '../config/db';
import { AuditService } from './auditService';

export interface SupportTicket {
  id: number;
  ticket_reference: string;
  user_id: number;
  user_role: string;
  user_name?: string;
  user_email?: string;
  user_mobile?: string;
  category: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  booking_id: number | null;
  booking_reference?: string | null;
  message_count?: number;
  latest_message?: string | null;
  latest_message_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: number;
  ticket_id: number;
  sender_user_id: number;
  sender_role: string;
  sender_name?: string;
  message: string;
  created_at: string;
}

export interface SupportConfig {
  email: string;
  phone: string | null;
  whatsapp: string | null;
  phoneConfigured: boolean;
  whatsappConfigured: boolean;
}

export const CUSTOMER_CATEGORIES = [
  'Booking Issue',
  'Driver Issue',
  'Payment Issue',
  'Cancellation Issue',
  'Refund Query',
  'Account/Login Issue',
  'App Technical Issue',
  'Other'
] as const;

export const DRIVER_CATEGORIES = [
  'Booking/Trip Issue',
  'Customer Issue',
  'Payment Issue',
  'Account Verification',
  'Document Issue',
  'App Technical Issue',
  'Other'
] as const;

export const VALID_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_USER',
  'RESOLVED',
  'CLOSED'
] as const;

export const VALID_PRIORITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
] as const;

export class SupportService {
  /**
   * Generates a unique user-friendly ticket reference (e.g. TKT-202611-0001)
   */
  private static async generateTicketReference(): Promise<string> {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    for (let attempts = 0; attempts < 10; attempts++) {
      const randFour = String(Math.floor(1000 + Math.random() * 9000));
      const ref = `TKT-${yyyymm}-${randFour}`;
      const existing = await query(
        `SELECT id FROM support_tickets WHERE ticket_reference = $1 LIMIT 1`,
        [ref]
      );
      if (existing.rows.length === 0) {
        return ref;
      }
    }
    return `TKT-${yyyymm}-${Date.now().toString().slice(-4)}`;
  }

  /**
   * Retrieve centralized support configuration (email, phone, WhatsApp)
   * Never invents fake phone/WhatsApp numbers.
   */
  public static async getSupportConfig(): Promise<SupportConfig> {
    const settingsRes = await query(
      `SELECT key, value FROM platform_settings WHERE key IN ('support_email', 'support_phone', 'support_whatsapp')`
    );
    const settings: Record<string, string> = {};
    for (const row of settingsRes.rows) {
      settings[row.key] = row.value;
    }

    const email = settings['support_email'] || 'support@clik2go.in';
    const rawPhone = process.env.SUPPORT_PHONE || settings['support_phone'] || '';
    const rawWhatsapp = process.env.SUPPORT_WHATSAPP || settings['support_whatsapp'] || '';

    // Sanitize phone & WhatsApp numbers to 10-digit digits or empty
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    const cleanWhatsapp = rawWhatsapp.replace(/\D/g, '').slice(-10);

    const isPhoneConfigured = cleanPhone.length === 10 && !cleanPhone.startsWith('000') && cleanPhone !== '9876543210';
    const isWhatsappConfigured = cleanWhatsapp.length === 10 && !cleanWhatsapp.startsWith('000') && cleanWhatsapp !== '9876543210';

    return {
      email,
      phone: isPhoneConfigured ? cleanPhone : null,
      whatsapp: isWhatsappConfigured ? cleanWhatsapp : null,
      phoneConfigured: isPhoneConfigured,
      whatsappConfigured: isWhatsappConfigured
    };
  }

  /**
   * Validate that an associated booking belongs to the requesting user or driver
   */
  public static async validateBookingAssociation(
    bookingId: number,
    userId: number,
    userRole: string
  ): Promise<boolean> {
    if (userRole === 'admin') {
      const res = await query(`SELECT id FROM bookings WHERE id = $1 LIMIT 1`, [bookingId]);
      return res.rows.length > 0;
    }

    if (userRole === 'customer') {
      const res = await query(
        `SELECT id FROM bookings WHERE id = $1 AND customer_id = $2 LIMIT 1`,
        [bookingId, userId]
      );
      return res.rows.length > 0;
    }

    if (userRole === 'driver') {
      const res = await query(
        `SELECT b.id FROM bookings b
         JOIN drivers d ON b.driver_id = d.id
         WHERE b.id = $1 AND d.user_id = $2 LIMIT 1`,
        [bookingId, userId]
      );
      return res.rows.length > 0;
    }

    return false;
  }

  /**
   * Create a new support ticket and its initial conversation message
   */
  public static async createTicket(
    userId: number,
    userRole: string,
    data: {
      category: string;
      subject: string;
      message: string;
      bookingId?: number;
    }
  ): Promise<SupportTicket> {
    const { category, subject, message, bookingId } = data;

    // Validate category based on user role
    if (userRole === 'customer') {
      if (!CUSTOMER_CATEGORIES.includes(category as any)) {
        throw new Error(`Invalid category for customer. Allowed: ${CUSTOMER_CATEGORIES.join(', ')}`);
      }
    } else if (userRole === 'driver') {
      if (!DRIVER_CATEGORIES.includes(category as any)) {
        throw new Error(`Invalid category for driver. Allowed: ${DRIVER_CATEGORIES.join(', ')}`);
      }
    } else if (userRole === 'admin') {
      const allCategories = [...new Set([...CUSTOMER_CATEGORIES, ...DRIVER_CATEGORIES])];
      if (!allCategories.includes(category as any)) {
        throw new Error(`Invalid category. Allowed: ${allCategories.join(', ')}`);
      }
    } else {
      throw new Error('Unsupported user role for support ticket creation.');
    }

    // Validate subject & message length
    const cleanSubject = (subject || '').trim();
    const cleanMessage = (message || '').trim();

    if (cleanSubject.length < 3 || cleanSubject.length > 255) {
      throw new Error('Subject must be between 3 and 255 characters.');
    }
    if (cleanMessage.length < 5 || cleanMessage.length > 4000) {
      throw new Error('Description message must be between 5 and 4000 characters.');
    }

    // Validate booking association if provided
    let verifiedBookingId: number | null = null;
    if (bookingId) {
      const numBookingId = Number(bookingId);
      if (!Number.isInteger(numBookingId) || numBookingId <= 0) {
        throw new Error('Invalid booking ID.');
      }
      const isAuthorized = await this.validateBookingAssociation(numBookingId, userId, userRole);
      if (!isAuthorized) {
        throw new Error(
          userRole === 'driver'
            ? 'Booking not found or not assigned to your driver profile.'
            : 'Booking not found or not owned by your customer account.'
        );
      }
      verifiedBookingId = numBookingId;
    }

    const ticketRef = await this.generateTicketReference();

    return await withTransaction(async (tx) => {
      // 1. Insert support ticket
      const ticketRes = await tx.query<SupportTicket>(
        `INSERT INTO support_tickets (
           ticket_reference,
           user_id,
           user_role,
           category,
           subject,
           status,
           priority,
           booking_id,
           created_at,
           updated_at
         ) VALUES ($1, $2, $3, $4, $5, 'OPEN', 'MEDIUM', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [ticketRef, userId, userRole, category, cleanSubject, verifiedBookingId]
      );

      const createdTicket = ticketRes.rows[0];

      // 2. Insert initial message
      await tx.query(
        `INSERT INTO support_messages (
           ticket_id,
           sender_user_id,
           sender_role,
           message,
           created_at
         ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [createdTicket.id, userId, userRole, cleanMessage]
      );

      return createdTicket;
    });
  }

  /**
   * Retrieve list of support tickets for the authenticated customer or driver
   */
  public static async getUserTickets(userId: number, userRole: string): Promise<SupportTicket[]> {
    const res = await query<SupportTicket>(
      `SELECT t.*,
              b.booking_reference,
              COUNT(m.id)::int AS message_count,
              (
                SELECT sm.message
                FROM support_messages sm
                WHERE sm.ticket_id = t.id
                ORDER BY sm.created_at DESC
                LIMIT 1
              ) AS latest_message,
              (
                SELECT sm.created_at
                FROM support_messages sm
                WHERE sm.ticket_id = t.id
                ORDER BY sm.created_at DESC
                LIMIT 1
              ) AS latest_message_at
       FROM support_tickets t
       LEFT JOIN bookings b ON t.booking_id = b.id
       LEFT JOIN support_messages m ON t.id = m.ticket_id
       WHERE t.user_id = $1
       GROUP BY t.id, b.booking_reference
       ORDER BY t.updated_at DESC`,
      [userId]
    );

    return res.rows;
  }

  /**
   * Admin: List all tickets with search, filtering, and pagination
   */
  public static async getAdminTickets(options: {
    page?: number;
    limit?: number;
    userRole?: string;
    category?: string;
    status?: string;
    priority?: string;
    search?: string;
  }): Promise<{ tickets: SupportTicket[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.userRole && ['customer', 'driver'].includes(options.userRole)) {
      conditions.push(`t.user_role = $${paramIndex++}`);
      params.push(options.userRole);
    }

    if (options.category && options.category.trim() !== '') {
      conditions.push(`t.category = $${paramIndex++}`);
      params.push(options.category.trim());
    }

    if (options.status && VALID_STATUSES.includes(options.status as any)) {
      conditions.push(`t.status = $${paramIndex++}`);
      params.push(options.status);
    }

    if (options.priority && VALID_PRIORITIES.includes(options.priority as any)) {
      conditions.push(`t.priority = $${paramIndex++}`);
      params.push(options.priority);
    }

    if (options.search && options.search.trim() !== '') {
      const term = `%${options.search.trim()}%`;
      conditions.push(`(
        t.ticket_reference ILIKE $${paramIndex} OR
        t.subject ILIKE $${paramIndex} OR
        u.name ILIKE $${paramIndex} OR
        u.email ILIKE $${paramIndex} OR
        u.mobile ILIKE $${paramIndex}
      )`);
      params.push(term);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countSql = `
      SELECT COUNT(DISTINCT t.id)::int AS count
      FROM support_tickets t
      JOIN users u ON t.user_id = u.id
      ${whereClause}
    `;
    const countRes = await query(countSql, params);
    const total = Number(countRes.rows[0]?.count || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch paginated tickets
    const querySql = `
      SELECT t.*,
             u.name AS user_name,
             u.email AS user_email,
             u.mobile AS user_mobile,
             b.booking_reference,
             COUNT(m.id)::int AS message_count,
             (
               SELECT sm.message
               FROM support_messages sm
               WHERE sm.ticket_id = t.id
               ORDER BY sm.created_at DESC
               LIMIT 1
             ) AS latest_message,
             (
               SELECT sm.created_at
               FROM support_messages sm
               WHERE sm.ticket_id = t.id
               ORDER BY sm.created_at DESC
               LIMIT 1
             ) AS latest_message_at
      FROM support_tickets t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN bookings b ON t.booking_id = b.id
      LEFT JOIN support_messages m ON t.id = m.ticket_id
      ${whereClause}
      GROUP BY t.id, u.name, u.email, u.mobile, b.booking_reference
      ORDER BY t.updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const ticketsRes = await query<SupportTicket>(querySql, params);

    return {
      tickets: ticketsRes.rows,
      total,
      page,
      totalPages
    };
  }

  /**
   * Retrieve ticket conversation history with strict ownership checks
   */
  public static async getTicketDetails(
    ticketId: number,
    userId: number,
    userRole: string
  ): Promise<{ ticket: SupportTicket; messages: SupportMessage[]; booking: any | null }> {
    const ticketRes = await query<SupportTicket>(
      `SELECT t.*,
              u.name AS user_name,
              u.email AS user_email,
              u.mobile AS user_mobile,
              b.booking_reference
       FROM support_tickets t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN bookings b ON t.booking_id = b.id
       WHERE t.id = $1
       LIMIT 1`,
      [ticketId]
    );

    if (ticketRes.rows.length === 0) {
      throw new Error('Support ticket not found.');
    }

    const ticket = ticketRes.rows[0];

    // Enforce ownership: customers and drivers can view only their own tickets
    if (userRole !== 'admin' && Number(ticket.user_id) !== Number(userId)) {
      throw new Error('Unauthorized to view this support ticket.');
    }

    // Retrieve associated booking details if linked
    let booking: any = null;
    if (ticket.booking_id) {
      const bRes = await query(
        `SELECT id, booking_reference, pickup_address, destination_address, status, estimated_fare, pickup_datetime
         FROM bookings
         WHERE id = $1 LIMIT 1`,
        [ticket.booking_id]
      );
      if (bRes.rows.length > 0) {
        booking = bRes.rows[0];
      }
    }

    // Retrieve messages ordered by creation
    const messagesRes = await query<SupportMessage>(
      `SELECT sm.*, u.name AS sender_name
       FROM support_messages sm
       JOIN users u ON sm.sender_user_id = u.id
       WHERE sm.ticket_id = $1
       ORDER BY sm.created_at ASC`,
      [ticketId]
    );

    return {
      ticket,
      messages: messagesRes.rows,
      booking
    };
  }

  /**
   * Add a reply message to an open support ticket
   */
  public static async addMessage(
    ticketId: number,
    userId: number,
    userRole: string,
    messageText: string
  ): Promise<SupportMessage> {
    const cleanMessage = (messageText || '').trim();
    if (cleanMessage.length < 1 || cleanMessage.length > 4000) {
      throw new Error('Message must be between 1 and 4000 characters.');
    }

    const ticketRes = await query<SupportTicket>(
      `SELECT id, user_id, user_role, status FROM support_tickets WHERE id = $1 LIMIT 1`,
      [ticketId]
    );

    if (ticketRes.rows.length === 0) {
      throw new Error('Support ticket not found.');
    }

    const ticket = ticketRes.rows[0];

    // Ownership check
    if (userRole !== 'admin' && Number(ticket.user_id) !== Number(userId)) {
      throw new Error('Unauthorized to reply to this support ticket.');
    }

    // Closed ticket restrictions: users cannot reply to closed tickets unless reopened
    if (ticket.status === 'CLOSED' && userRole !== 'admin') {
      throw new Error('This ticket is closed. Please open a new ticket or request an administrator to reopen it.');
    }

    // Status transition:
    // - If admin replies, status moves to WAITING_FOR_USER (unless resolved/closed)
    // - If user replies, status moves to OPEN or IN_PROGRESS
    let nextStatus = ticket.status;
    if (userRole === 'admin') {
      if (['OPEN', 'IN_PROGRESS'].includes(ticket.status)) {
        nextStatus = 'WAITING_FOR_USER';
      }
    } else {
      if (['WAITING_FOR_USER', 'RESOLVED', 'CLOSED'].includes(ticket.status)) {
        nextStatus = 'IN_PROGRESS';
      }
    }

    return await withTransaction(async (tx) => {
      // 1. Insert message
      const msgRes = await tx.query<SupportMessage>(
        `INSERT INTO support_messages (
           ticket_id,
           sender_user_id,
           sender_role,
           message,
           created_at
         ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING *`,
        [ticketId, userId, userRole, cleanMessage]
      );

      // 2. Update ticket status & updated_at
      await tx.query(
        `UPDATE support_tickets
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [nextStatus, ticketId]
      );

      return msgRes.rows[0];
    });
  }

  /**
   * Admin updates ticket status and/or priority with audit logging
   */
  public static async updateTicketStatus(
    ticketId: number,
    adminUser: { id: number; email: string },
    data: { status?: string; priority?: string },
    clientIp?: string
  ): Promise<SupportTicket> {
    const { status, priority } = data;

    if (!status && !priority) {
      throw new Error('At least one of status or priority must be provided.');
    }

    if (status && !VALID_STATUSES.includes(status as any)) {
      throw new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`);
    }

    if (priority && !VALID_PRIORITIES.includes(priority as any)) {
      throw new Error(`Invalid priority. Allowed: ${VALID_PRIORITIES.join(', ')}`);
    }

    const currentRes = await query<SupportTicket>(
      `SELECT * FROM support_tickets WHERE id = $1 LIMIT 1`,
      [ticketId]
    );

    if (currentRes.rows.length === 0) {
      throw new Error('Support ticket not found.');
    }

    const currentTicket = currentRes.rows[0];
    const newStatus = (status || currentTicket.status) as SupportTicket['status'];
    const newPriority = (priority || currentTicket.priority) as SupportTicket['priority'];

    const updateRes = await query<SupportTicket>(
      `UPDATE support_tickets
       SET status = $1, priority = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [newStatus, newPriority, ticketId]
    );

    const updated = updateRes.rows[0];

    // Audit log admin status / priority change
    await AuditService.logAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'UPDATE_SUPPORT_TICKET_STATUS',
      targetType: 'support_ticket',
      targetId: String(ticketId),
      details: {
        ticketReference: updated.ticket_reference,
        previousStatus: currentTicket.status,
        newStatus: updated.status,
        previousPriority: currentTicket.priority,
        newPriority: updated.priority,
        userId: updated.user_id,
        userRole: updated.user_role
      },
      clientIp
    });

    return updated;
  }
}
