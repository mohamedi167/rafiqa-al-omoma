import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const isProduction = NODE_ENV === 'production';

// ---------- الأسرار ----------
const DEV_JWT_FALLBACK = 'rafiqa-al-omoma-dev-secret-change-me';
const rawSecret = process.env.JWT_SECRET || '';
const weakSecret = !rawSecret || rawSecret.length < 32 || rawSecret === DEV_JWT_FALLBACK;

if (isProduction && weakSecret) {
  // لا نسمح بالتشغيل في الإنتاج بسر ضعيف أو افتراضي.
  throw new Error(
    'JWT_SECRET غير آمن: عيّني قيمة عشوائية قوية (32 حرفًا على الأقل) في متغيرات البيئة قبل التشغيل في الإنتاج.',
  );
}
if (weakSecret && !isProduction) {
  console.warn('[security] تحذير: يتم استخدام JWT_SECRET التطويري. عيّني JWT_SECRET قويًا قبل الإنتاج.');
}

export const JWT_SECRET = rawSecret || DEV_JWT_FALLBACK;
export const JWT_TTL = process.env.JWT_TTL || '7d';

// ---------- CORS ----------
export const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// في التطوير نسمح بنطاقات المعاينة المحلية فقط عند عدم تحديد قائمة صريحة.
export const DEV_ORIGIN_PATTERNS = isProduction
  ? []
  : [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.monkeycode-ai\.live$/];

// ---------- HTTPS ----------
export const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '';
export const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '';
export const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';

// ---------- Proxy ----------
export const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

// ---------- CAPTCHA ----------
// مفعّل افتراضيًا في الإنتاج، ويمكن تعطيله صراحةً للتطوير/الاختبارات.
export const CAPTCHA_ENABLED =
  process.env.CAPTCHA_ENABLED === 'true' || (process.env.CAPTCHA_ENABLED !== 'false' && isProduction);

// ---------- كلمات المرور ----------
export const PASSWORD_MIN_LENGTH = Math.max(8, Number(process.env.PASSWORD_MIN_LENGTH) || 8);
export const BCRYPT_ROUNDS = Math.min(15, Math.max(10, Number(process.env.BCRYPT_ROUNDS) || 12));

// ---------- Rate limiting ----------
const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
export const RATE_LIMIT = {
  login: { windowMs: num(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 15 * 60 * 1000), max: num(process.env.RATE_LIMIT_LOGIN_MAX, 20) },
  register: { windowMs: num(process.env.RATE_LIMIT_REGISTER_WINDOW_MS, 60 * 60 * 1000), max: num(process.env.RATE_LIMIT_REGISTER_MAX, 10) },
  sensitive: { windowMs: num(process.env.RATE_LIMIT_SENSITIVE_WINDOW_MS, 60 * 1000), max: num(process.env.RATE_LIMIT_SENSITIVE_MAX, 60) },
  general: { windowMs: num(process.env.RATE_LIMIT_GENERAL_WINDOW_MS, 60 * 1000), max: num(process.env.RATE_LIMIT_GENERAL_MAX, 300) },
  maxFailures: num(process.env.RATE_LIMIT_LOGIN_MAX_FAILURES, 5),
};

// ---------- السجلات ----------
export const LOG_DIR = process.env.LOG_DIR || path.resolve(__dirname, '..', 'logs');
export const LOG_LEVEL = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// ---------- حدّ حجم الطلب ----------
export const BODY_LIMIT = process.env.BODY_LIMIT || '256kb';

export const MAX_TEXT_LENGTH = Number(process.env.MAX_TEXT_LENGTH) || 5000;
