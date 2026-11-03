const crypto = require('crypto');

// HTTP Basic auth for admin APIs.
// Credentials come from environment variables: ADMIN_USERNAME / ADMIN_PASSWORD.
// Fails closed: if they are not configured, admin routes are unavailable.

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map(); // ip -> { count, resetAt }

// Clean up old entries so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of failedAttempts) {
    if (record.resetAt <= now) failedAttempts.delete(ip);
  }
}, WINDOW_MS).unref();

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

// Constant-time comparison (hashing makes both buffers equal length)
function safeEqual(a, b) {
  return crypto.timingSafeEqual(digest(a), digest(b));
}

function adminAuth(req, res, next) {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return res.status(503).json({ error: 'Admin access is not configured on the server' });
  }

  const ip = req.ip;
  const now = Date.now();
  const record = failedAttempts.get(ip);

  if (record && record.resetAt > now && record.count >= MAX_FAILED_ATTEMPTS) {
    res.set('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many failed login attempts. Try again later.' });
  }

  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (scheme && scheme.toLowerCase() === 'basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separator = decoded.indexOf(':');

    if (separator >= 0) {
      const user = decoded.slice(0, separator);
      const pass = decoded.slice(separator + 1);
      // Evaluate both so timing doesn't reveal which one was wrong
      const userOk = safeEqual(user, expectedUser);
      const passOk = safeEqual(pass, expectedPass);

      if (userOk && passOk) {
        failedAttempts.delete(ip);
        return next();
      }
    }
  }

  const current = record && record.resetAt > now ? record : { count: 0, resetAt: now + WINDOW_MS };
  current.count += 1;
  failedAttempts.set(ip, current);

  res.set('WWW-Authenticate', 'Basic realm="Chatbot Admin"');
  return res.status(401).json({ error: 'Invalid or missing admin credentials' });
}

module.exports = adminAuth;
