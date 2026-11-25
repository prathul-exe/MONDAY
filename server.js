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
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
app.use((err, req, res, next) => {
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
  app.listen(PORT, () => {
    console.log(`Monday Attendance Tracker running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
