import crypto from 'node:crypto';
import { CAPTCHA_ENABLED } from '../config.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challenges = new Map();

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of challenges) {
    if (now > entry.expires) challenges.delete(id);
  }
}, 60 * 1000);
if (cleanup.unref) cleanup.unref();

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// تحويل الأرقام العربية-الهندية إلى أرقام غربية قبل المقارنة.
function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function isCaptchaEnabled() {
  return CAPTCHA_ENABLED;
}

export function createChallenge() {
  const a = randInt(2, 9);
  const b = randInt(2, 9);
  const useAddition = Math.random() < 0.5 || a < b;
  const answer = useAddition ? a + b : a - b;
  const question = `كم ناتج ${a} ${useAddition ? '+' : '−'} ${b}؟`;
  const id = crypto.randomUUID();
  challenges.set(id, { answer, expires: Date.now() + CHALLENGE_TTL_MS });
  return { captchaId: id, question, expiresIn: Math.floor(CHALLENGE_TTL_MS / 1000) };
}

export function verifyChallenge(id, answer) {
  if (!id) return false;
  const entry = challenges.get(String(id));
  if (!entry) return false;
  challenges.delete(String(id)); // استخدام لمرة واحدة
  if (Date.now() > entry.expires) return false;
  return normalizeDigits(answer).trim() === String(entry.answer);
}

// Middleware: يفرض حل الكابتشا على النماذج الحساسة عند تفعيلها.
export function requireCaptcha(req, res, next) {
  if (!CAPTCHA_ENABLED) return next();
  const { captchaId, captchaAnswer } = req.body || {};
  if (!captchaId || captchaAnswer === undefined || captchaAnswer === null || captchaAnswer === '') {
    return res.status(400).json({ error: 'أكملي تحقق الأمان (الكابتشا) أولًا.', captchaRequired: true });
  }
  if (!verifyChallenge(captchaId, captchaAnswer)) {
    return res.status(400).json({ error: 'إجابة تحقق الأمان غير صحيحة أو منتهية، حدّثي السؤال وحاولي مرة أخرى.', captchaRequired: true });
  }
  return next();
}
