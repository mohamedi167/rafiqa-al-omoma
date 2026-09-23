import { MAX_TEXT_LENGTH, PASSWORD_MIN_LENGTH } from '../config.js';

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function cleanText(value, maxLength = MAX_TEXT_LENGTH) {
  if (value === null || value === undefined) return value;
  let out = String(value);
  out = out.replace(CONTROL_CHARS_RE, '');
  // إزالة الوسوم التي قد تُستخدم في XSS (دفاع في العمق مع ترميز React و CSP).
  out = out.replace(HTML_TAG_RE, '');
  out = out.replace(/\u0000/g, '');
  out = out.trim();
  if (out.length > maxLength) out = out.slice(0, maxLength);
  return out;
}

// تنظيف مدخلات الطلب بشكل متكرر: تقليم النصوص وإزالة الأحرف الخطرة وحدّ الطول.
export function sanitizeValue(value, key = '', depth = 0) {
  if (depth > 6) return null;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (key.toLowerCase().includes('password')) {
      return value.replace(CONTROL_CHARS_RE, '');
    }
    return cleanText(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => sanitizeValue(v, key, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      out[k] = sanitizeValue(v, k, depth + 1);
    }
    return out;
  }
  return value;
}

export function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}

export function isEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || email.length > 254) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email);
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isPhone(value) {
  const phone = String(value || '').trim();
  if (!phone) return true; // اختياري
  return /^[0-9+\-() ]{6,20}$/.test(phone);
}

const COMMON_PASSWORDS = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'qwerty',
  'qwerty123',
  '11111111',
  '00000000',
  'iloveyou',
  'admin123',
  'letmein1',
  'welcome1',
  'rafiqa123',
]);

export function passwordPolicy(value) {
  const password = String(value || '');
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل.` };
  }
  if (password.length > 128) {
    return { ok: false, error: 'كلمة المرور طويلة جدًا (الحد 128 حرفًا).' };
  }
  if (/\s/.test(password)) {
    return { ok: false, error: 'كلمة المرور لا يجب أن تحتوي على مسافات.' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, error: 'كلمة المرور يجب أن تحتوي على حرف واحد على الأقل ورقم واحد على الأقل.' };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, error: 'كلمة المرور ضعيفة جدًا، اختاري كلمة أقوى.' };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: 'كلمة المرور شائعة جدًا، اختاري كلمة أقوى.' };
  }
  return { ok: true };
}

export function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function inRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}
