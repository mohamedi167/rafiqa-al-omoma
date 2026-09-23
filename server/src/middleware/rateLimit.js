import { RATE_LIMIT } from '../config.js';
import { logger } from '../logger.js';

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// محدّد معدّل بسيط في الذاكرة (نافذة ثابتة) يكفي لنسخة واحدة من الخادم.
export function createRateLimiter({ windowMs, max, prefix = 'rl', message, keyGenerator } = {}) {
  const hits = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now - entry.start >= windowMs) hits.delete(key);
    }
  }, Math.min(windowMs, 60 * 1000));
  if (cleanup.unref) cleanup.unref();

  return function rateLimit(req, res, next) {
    const key = `${prefix}:${(keyGenerator ? keyGenerator(req) : clientKey(req))}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      entry = { start: now, count: 0 };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      logger.warn('rate_limit_exceeded', { prefix, key, count: entry.count, path: req.originalUrl });
      return res.status(429).json({
        error: message || 'عدد المحاولات كبير، حاولي مرة أخرى بعد قليل.',
        retryAfter,
      });
    }
    next();
  };
}

// قفل مؤقت بعد تكرار فشل تسجيل الدخول لنفس المتصفح/الحساب.
const loginFailures = new Map();

function failureKey(req, email) {
  return `${clientKey(req)}|${String(email || '').toLowerCase()}`;
}

export function loginLockout(req, res, next) {
  const key = failureKey(req, req.body?.email);
  const entry = loginFailures.get(key);
  if (entry && entry.count >= RATE_LIMIT.maxFailures) {
    const retryAfter = Math.max(1, Math.ceil((entry.last + RATE_LIMIT.login.windowMs - Date.now()) / 1000));
    if (retryAfter <= 0) {
      loginFailures.delete(key);
      return next();
    }
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'تم إيقاف المحاولات مؤقتًا بعد محاولات دخول فاشلة. حاولي لاحقًا.', retryAfter });
  }
  next();
}

export function recordLoginFailure(req, email) {
  const key = failureKey(req, email);
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || now - entry.last > RATE_LIMIT.login.windowMs) {
    loginFailures.set(key, { count: 1, last: now });
  } else {
    entry.count += 1;
    entry.last = now;
  }
}

export function clearLoginFailures(req, email) {
  loginFailures.delete(failureKey(req, email));
}

export const generalLimiter = createRateLimiter({
  ...RATE_LIMIT.general,
  prefix: 'general',
  message: 'عدد الطلبات كبير، حاولي بعد قليل.',
});

export const loginLimiter = createRateLimiter({
  ...RATE_LIMIT.login,
  prefix: 'login',
  message: 'محاولات تسجيل دخول كثيرة، حاولي بعد قليل.',
});

export const registerLimiter = createRateLimiter({
  ...RATE_LIMIT.register,
  prefix: 'register',
  message: 'عدد مرات إنشاء الحساب كبير، حاولي لاحقًا.',
});

export const sensitiveLimiter = createRateLimiter({
  ...RATE_LIMIT.sensitive,
  prefix: 'sensitive',
  message: 'عدد الطلبات كبير، حاولي بعد قليل.',
});
