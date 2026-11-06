import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import 'dotenv/config';

dotenv.config();

import { initDb } from './config/db';
import { initPlatformDefaults } from './db/seed';
import { getJwtSecret, parseCookies, csrfProtection } from './middleware/auth';
import { AuthService } from './services/authService';
import authRoutes from './routes/authRoutes';
import bookingRoutes from './routes/bookingRoutes';
import driverRoutes from './routes/driverRoutes';
import adminRoutes from './routes/adminRoutes';
import paymentRoutes from './routes/paymentRoutes';
import tripBookingRoutes from './routes/tripBookingRoutes';

const app = express();
// Enable single-hop reverse proxy trust for Render / Cloudflare architecture
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

/**
 * Resolves verified CORS allowed origins based on environment (OBS-01).
 * - Production: allows verified Clik2Go domain(s) and configured FRONTEND_URL.
 * - Development: additionally allows localhost origins.
 */
export const getAllowedOrigins = (): string[] => {
  const isProduction = process.env.NODE_ENV === 'production';
  const origins: string[] = ['https://clik2go.in', 'https://www.clik2go.in'];

  if (process.env.FRONTEND_URL) {
    const customFrontend = process.env.FRONTEND_URL.trim().replace(/\/$/, '');
    if (customFrontend && !origins.includes(customFrontend)) {
      origins.push(customFrontend);
    }
  }

  if (!isProduction) {
    origins.push(
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5000'
    );
  }

  return origins;
};

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests with no origin (e.g. mobile apps, webhooks, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    const allowed = getAllowedOrigins();
    if (allowed.includes(origin)) {
      return callback(null, true);
    }

    // Reject unknown origin
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-webhook-signature',
    'x-webhook-timestamp',
    'x-csrf-token',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['Retry-After']
};

// Security headers (OBS-02)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://sdk.cashfree.com',
          'https://maps.googleapis.com'
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com'
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: [
          "'self'",
          'https://sandbox.cashfree.com',
          'https://api.cashfree.com',
          'https://payments.cashfree.com',
          'https://maps.googleapis.com'
        ],
        frameSrc: [
          "'self'",
          'https://sandbox.cashfree.com',
          'https://api.cashfree.com',
          'https://payments.cashfree.com'
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'sameorigin' },
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false
  })
);

// Restricted CORS middleware (OBS-01)
app.use(cors(corsOptions));
app.use(express.json({
  verify: (req, _res, buf) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname === '/api/payments/webhook') {
      (req as any).rawBody = buf.toString('utf8');
    }
  }
}));
// Parse cookies before routing
app.use((req, _res, next) => {
  (req as any).cookies = parseCookies(req.headers.cookie);
  next();
});

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/static')) {
      console.log(`[API] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Kk_Auto API',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', csrfProtection);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/trip-bookings', tripBookingRoutes);
app.use('/api/car-bookings', tripBookingRoutes);

// Serve static frontend in production if built
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      next();
    }
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'Not allowed by CORS'
    });
  }
  console.error('[Unhandled Server Error]', err);
  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = status >= 500 && isProduction
    ? 'Internal server error.'
    : (err.message || 'Internal server error.');

  res.status(status).json({
    success: false,
    error: errorMessage
  });
});

// Start Server
export async function startServer() {
  try {
    // Validate critical environment secrets before bootstrap
    getJwtSecret();

    await initDb();
    await initPlatformDefaults();

    // Initial background cleanup of expired rate limits, revoked tokens, and password resets
    await AuthService.cleanupExpiredRateLimits().catch(() => {});
    await AuthService.cleanExpiredRevokedTokens().catch(() => {});
    await AuthService.cleanupExpiredPasswordResets().catch(() => {});

    // Periodic cleanup (every 24 hours)
    const cleanupInterval = setInterval(() => {
      AuthService.cleanupExpiredRateLimits().catch(() => {});
      AuthService.cleanExpiredRevokedTokens().catch(() => {});
      AuthService.cleanupExpiredPasswordResets().catch(() => {});
    }, 24 * 60 * 60 * 1000);
    cleanupInterval.unref();

    app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🛺 Kk_Auto API Server Running!`);
      console.log(`🚀 URL: http://localhost:${PORT}`);
      console.log(`🛠 Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=========================================`);
    });
  } catch (error) {
    console.error('[Server Start Error]', error);
    process.exit(1);
  }
}

export { app };

const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('index.ts') ||
  process.argv[1].endsWith('index.js')
);

if (isDirectExecution && process.env.NODE_ENV !== 'test') {
  startServer();
}
