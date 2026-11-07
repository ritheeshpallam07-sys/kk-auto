import { Router } from 'express';
import { SupportController } from '../controllers/supportController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Public / Guest / Authenticated: Support configuration (email, WhatsApp, phone)
router.get('/config', SupportController.getConfig);

// Authenticated ticket endpoints (Customer, Driver, Admin)
router.post('/tickets', authenticateToken, SupportController.createTicket);
router.get('/tickets', authenticateToken, SupportController.getTickets);
router.get('/tickets/:id', authenticateToken, SupportController.getTicketDetails);
router.post('/tickets/:id/messages', authenticateToken, SupportController.addMessage);

// Admin-only ticket management (Status & Priority updates with audit logging)
router.patch('/tickets/:id/status', authenticateToken, requireRole(['admin']), SupportController.updateTicketStatus);

export default router;
