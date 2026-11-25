require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com'],
      connectSrc: ["'self'"]
    }
  }
}));
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,https://localhost,http://localhost,capacitor://localhost')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    const err = new Error('Not allowed by CORS');
    err.status = 403;
    return callback(err);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Trust reverse proxy (e.g. Render) before registering rate limiters
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many auth attempts, please try again later.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes (v1 + backward-compatible unversioned aliases)
const apiRouters = {
  auth: require('./routes/auth'),
  subjects: require('./routes/subjects'),
  attendance: require('./routes/attendance'),
  dashboard: require('./routes/dashboard'),
  deadlines: require('./routes/deadlines'),
  timetable: require('./routes/timetable'),
  notifications: require('./routes/notifications'),
  settings: require('./routes/settings'),
  calendar: require('./routes/calendar'),
  system: require('./routes/system')
};

for (const [name, router] of Object.entries(apiRouters)) {
  app.use(`/api/v1/${name}`, router);
  app.use(`/api/${name}`, router);
}

// Health check (v1 + unversioned)
app.get(['/api/v1/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', apiVersion: '1.0.0', timestamp: new Date().toISOString() });
});

// Legal pages
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});
app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handler
const { logError } = require('./services/logger');
const { validateJwtConfig } = require('./middleware/auth');
const { close: closeDatabase } = require('./database/db');

app.use((err, req, res, next) => {
  if (err && err.status === 403) {
    return res.status(403).json({ error: err.message || 'Not allowed by CORS' });
  }
  logError(err, { method: req.method, path: req.path });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Run database migration on startup
try {
  require('./database/migrate');
} catch (e) {
  console.error('Database initialization error:', e.message);
}

if (require.main === module) {
  try {
    validateJwtConfig();
  } catch (err) {
    console.error(`[startup] Configuration error: ${err.message}`);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Monday Attendance Tracker running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  let isShuttingDown = false;
  function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[shutdown] Received ${signal}, closing HTTP server and database connections...`);

    const forceTimer = setTimeout(() => {
      console.error('[shutdown] Force exiting after 10s timeout');
      process.exit(1);
    }, 10000);
    forceTimer.unref();

    server.close(async (serverErr) => {
      let exitCode = serverErr ? 1 : 0;
      if (serverErr) {
        console.error('[shutdown] HTTP server close error:', serverErr.message);
      }
      try {
        await closeDatabase();
      } catch (dbErr) {
        console.error('[shutdown] Database close error:', dbErr.message);
        exitCode = 1;
      } finally {
        clearTimeout(forceTimer);
        process.exit(exitCode);
      }
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
