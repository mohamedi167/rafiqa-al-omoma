import { isProduction, FORCE_HTTPS } from '../config.js';

// مسارات وامتدادات لا يجب تقديمها للعامة إطلاقًا (منع الوصول للملفات الحساسة).
const FORBIDDEN_PATH_RE = /(^|\/)(\.git|\.env|\.svn|node_modules|server|data)(\/|$)|\.(env|pem|key|crt|cer|csr|p12|pfx|db|db-wal|db-shm|sqlite|sqlite3|log|bak|swp)$/i;

export function blockSensitivePaths(req, res, next) {
  if (FORBIDDEN_PATH_RE.test(req.path)) {
    return res.status(404).json({ error: 'المسار غير موجود' });
  }
  next();
}

export function securityHeaders(req, res, next) {
  res.removeHeader('X-Powered-By');

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // سياسة CSP: التطبيق SPA يقدّم ملفات من نفس الأصل، ونسمح بالأنماط المضمّنة فقط.
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (isProduction) csp.push('upgrade-insecure-requests');
  res.setHeader('Content-Security-Policy', csp.join('; '));

  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
}

export function forceHttps(req, res, next) {
  if (!FORCE_HTTPS) return next();
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
  const host = req.headers.host;
  if (!host) return res.status(400).json({ error: 'طلب غير صالح' });
  return res.redirect(301, `https://${host}${req.originalUrl}`);
}
