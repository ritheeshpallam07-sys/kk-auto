import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { initDb } from './config/db';
import { runSeed } from './db/seed';
import authRoutes from './routes/authRoutes';
import bookingRoutes from './routes/bookingRoutes';
import driverRoutes from './routes/driverRoutes';
import adminRoutes from './routes/adminRoutes';
import paymentRoutes from './routes/paymentRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

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
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

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
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error.'
  });
});

// Start Server
async function startServer() {
  try {
    await initDb();
    await runSeed();

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

startServer();
