import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { all, get, run, uniqueUserCode, CODE_PREFIX } from '../db.js';
import { authRequired, signToken } from '../middleware/auth.js';
import { BCRYPT_ROUNDS } from '../config.js';
import { isEmail, normalizeEmail, isPhone, passwordPolicy, cleanText } from '../middleware/validate.js';
import { loginLimiter, registerLimiter, loginLockout, recordLoginFailure, clearLoginFailures } from '../middleware/rateLimit.js';
import { createChallenge, requireCaptcha, isCaptchaEnabled } from '../services/captchaService.js';
import { findLinkTarget, createLinkRequest } from '../services/linkService.js';

const router = Router();

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone,
  organization: u.organization,
  speciality: u.speciality,
  code: u.code || null,
});

// إتاحة تحقق الأمان (كابتشا) للنماذج الحساسة.
router.get('/captcha', registerLimiter, (_req, res) => {
  res.json({ enabled: isCaptchaEnabled(), ...createChallenge() });
});

function parseDateOnly(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return s;
}

router.post('/register', registerLimiter, requireCaptcha, (req, res) => {
  const { name, password, role, phone, organization, speciality } = req.body || {};
  const email = normalizeEmail(req.body?.email);
  const wantsUnit = req.body?.hasHealthUnit === true || req.body?.hasHealthUnit === 'true';
  const unitCode = String(req.body?.unitCode || '').trim().toUpperCase().replace(/\s+/g, '');

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'الاسم والبريد وكلمة المرور والدور مطلوبة' });
  }
  if (!['mother', 'doctor', 'health_unit'].includes(role)) {
    return res.status(400).json({ error: 'الدور غير صالح' });
  }
  if (String(name).trim().length < 2 || String(name).length > 100) {
    return res.status(400).json({ error: 'الاسم غير صالح' });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
  }
  if (!isPhone(phone)) {
    return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
  }
  const policy = passwordPolicy(password);
  if (!policy.ok) {
    return res.status(400).json({ error: policy.error });
  }
  if (get('SELECT id FROM users WHERE email = ?', email)) {
    return res.status(409).json({ error: 'هذا البريد مسجّل بالفعل' });
  }

  // الأم التي لديها وحدة صحية: نتأكد من صحة الكود قبل إنشاء الحساب
  let unit = null;
  if (role === 'mother' && wantsUnit) {
    if (!unitCode) return res.status(400).json({ error: 'أدخلي كود الوحدة الصحية' });
    unit = findLinkTarget('health_unit', unitCode);
    if (!unit) {
      return res.status(400).json({ error: 'كود الوحدة غير صحيح، تأكدي من الوحدة أو اختاري "بدون وحدة صحية".' });
    }
  }

  let lmpDate = null;
  if (role === 'mother' && req.body?.lmpDate) {
    const parsed = parseDateOnly(req.body.lmpDate);
    if (parsed === undefined) return res.status(400).json({ error: 'تاريخ آخر دورة غير صالح' });
    lmpDate = parsed;
  }

  const password_hash = bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
  const userCode = CODE_PREFIX[role] ? uniqueUserCode(CODE_PREFIX[role]) : null;
  const result = run(
    'INSERT INTO users (name, email, password_hash, role, phone, organization, speciality, code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    cleanText(name, 100),
    email,
    password_hash,
    role,
    cleanText(phone, 20) || null,
    cleanText(organization, 150) || null,
    cleanText(speciality, 100) || null,
    userCode,
  );
  const userId = Number(result.lastInsertRowid);
  let unitRequest = null;
  if (role === 'mother') {
    let dueDate = null;
    if (lmpDate) {
      const d = new Date(`${lmpDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 280);
      dueDate = d.toISOString().slice(0, 10);
    }
    run(
      'INSERT INTO mother_profiles (user_id, lmp_date, due_date) VALUES (?, ?, ?)',
      userId,
      lmpDate,
      dueDate,
    );
    if (unit) {
      unitRequest = createLinkRequest({
        motherId: userId,
        motherName: cleanText(name, 100),
        targetRole: 'health_unit',
        targetId: unit.id,
        code: unitCode,
      });
    }
  }
  const user = get('SELECT * FROM users WHERE id = ?', userId);
  res.status(201).json({
    token: signToken(user),
    user: publicUser(user),
    unitLinkPending: Boolean(unitRequest),
    message: unitRequest
      ? `تم إنشاء حسابك، وأرسلنا طلب ربط لوحدة "${unit.name}" بانتظار موافقتها. بعد الموافقة ستُتابع تطعيمات طفلك مع الوحدة (تأكيد مزدوج).`
      : null,
  });
});

router.post('/login', loginLimiter, loginLockout, requireCaptcha, (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!isEmail(email) || !password) {
    return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  }
  const user = get('SELECT * FROM users WHERE email = ?', email);
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    recordLoginFailure(req, email);
    return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  }
  clearLoginFailures(req, email);
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

router.get('/directory', authRequired, (_req, res) => {
  const doctors = all("SELECT id, name, speciality, organization FROM users WHERE role='doctor'");
  const units = all("SELECT id, name, organization FROM users WHERE role='health_unit'");
  res.json({ doctors, healthUnits: units, doctor: doctors, health_unit: units });
});

export default router;
