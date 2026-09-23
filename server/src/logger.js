import fs from 'node:fs';
import path from 'node:path';
import { LOG_DIR, LOG_LEVEL } from './config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[LOG_LEVEL] || LEVELS.info;

const SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'passwordhash',
  'token',
  'authorization',
  'jwt',
  'secret',
  'api_key',
  'apikey',
  'cookie',
  'set-cookie',
  'x-api-key',
  'captchaanswer',
];

if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    // في حال تعذّر إنشاء مجلد السجلات نكتفي بسجلات الطرفية.
  }
}

export function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[deep]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.includes(String(k).toLowerCase())) {
        out[k] = '[redacted]';
      } else if (k === 'req' || k === 'res') {
        continue; // لا نطبع كائنات الطلب/الرد كاملة
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}...`;
  return value;
}

function serialize(meta) {
  if (meta instanceof Error) {
    return { message: meta.message, name: meta.name, stack: meta.stack };
  }
  return redact(meta);
}

function write(level, message, meta) {
  if ((LEVELS[level] || 0) < threshold) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: String(message),
    ...(meta !== undefined ? { meta: serialize(meta) } : {}),
  };
  const line = JSON.stringify(entry);

  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleFn(`[${level}] ${entry.msg}`, meta !== undefined ? serialize(meta) : '');

  try {
    const file = path.join(LOG_DIR, level === 'error' ? 'error.log' : 'app.log');
    fs.appendFileSync(file, `${line}\n`);
  } catch {
    // تجاهل أخطاء كتابة السجل حتى لا نُسقط الطلب.
  }
}

export const logger = {
  debug: (msg, meta) => write('debug', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userId: req.user?.id,
    });
  });
  next();
}
