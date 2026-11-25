const jwt = require('jsonwebtoken');

const DEV_FALLBACK_SECRET = 'dev-secret-change-in-production';
const INSECURE_PLACEHOLDER_SECRETS = new Set([
  DEV_FALLBACK_SECRET,
  'change-this-to-a-secure-random-string-in-production'
]);
const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Validate JWT configuration for production startup.
 * Fails fast without ever logging the secret value.
 */
function validateJwtConfig() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new Error('JWT_SECRET environment variable is required when NODE_ENV=production');
  }

  const trimmed = secret.trim();
  if (INSECURE_PLACEHOLDER_SECRETS.has(trimmed)) {
    throw new Error('JWT_SECRET must not use a default or placeholder value in production');
  }

  if (trimmed.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long in production');
  }
}

/**
 * Generate JWT token for a user
 * @param {object} user - User object with id and email
 * @returns {string} JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Express middleware to authenticate JWT tokens
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired, please login again' });
    }
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

module.exports = { authenticate, generateToken, validateJwtConfig };
