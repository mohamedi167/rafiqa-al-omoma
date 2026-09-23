import { Router } from 'express';
import { get, all, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { computePregnancy, getWeeklyPregnancyContent, PREGNANCY_MONTHS } from '../services/pregnancyService.js';
import { ensureVaccineReminders, createNotification } from '../services/notificationService.js';
import { linkMeta, findLinkTarget, createLinkRequest } from '../services/linkService.js';

const router = Router();
router.use(authRequired, requireRole('mother'));

function latestLinkRequest(userId, targetRole) {
  return get(
    'SELECT * FROM link_requests WHERE mother_id = ? AND target_role = ? ORDER BY id DESC LIMIT 1',
    userId,
    targetRole,
  );
}

function profilePayload(userId) {
  const profile = get('SELECT * FROM mother_profiles WHERE user_id = ?', userId);
  const doctor = profile?.doctor_id
    ? get('SELECT id, name, speciality, organization, phone FROM users WHERE id = ?', profile.doctor_id)
    : null;
  const unit = profile?.health_unit_id
    ? get('SELECT id, name, organization, code FROM users WHERE id = ?', profile.health_unit_id)
    : null;
  const unitRequest = latestLinkRequest(userId, 'health_unit');
  const requestUnit = unitRequest
    ? get('SELECT id, name, organization FROM users WHERE id = ?', unitRequest.target_id)
    : null;
  const doctorRequest = latestLinkRequest(userId, 'doctor');
  const requestDoctor = doctorRequest
    ? get('SELECT id, name, speciality, organization FROM users WHERE id = ?', doctorRequest.target_id)
    : null;
  const pregnancy = profile?.lmp_date ? computePregnancy(profile.lmp_date) : null;
  return {
    profile,
    doctor,
    healthUnit: unit,
    linkRequest: unitRequest ? { ...unitRequest, unit: requestUnit } : null,
    doctorLinkRequest: doctorRequest ? { ...doctorRequest, doctor: requestDoctor } : null,
    pregnancy,
  };
}

router.get('/profile', (req, res) => {
  const children = all('SELECT * FROM children WHERE mother_id = ? ORDER BY id', req.user.id);
  for (const child of children) ensureVaccineReminders(child);
  res.json({ ...profilePayload(req.user.id), children });
});

router.put('/profile', (req, res) => {
  const { lmpDate, doctorId, pregnancyStatus } = req.body || {};
  const profile = get('SELECT * FROM mother_profiles WHERE user_id = ?', req.user.id);
  if (!profile) return res.status(404).json({ error: 'الملف غير موجود' });

  let lmp = profile.lmp_date;
  let due = profile.due_date;
  if (lmpDate !== undefined) {
    lmp = lmpDate || null;
    if (lmp) {
      const d = new Date(lmp);
      if (!Number.isNaN(d.getTime())) {
        d.setDate(d.getDate() + 280);
        due = d.toISOString().slice(0, 10);
      }
    } else {
      due = null;
    }
  }
  run(
    'UPDATE mother_profiles SET lmp_date=?, due_date=?, doctor_id=?, pregnancy_status=? WHERE user_id=?',
    lmp,
    due,
    doctorId !== undefined ? doctorId || null : profile.doctor_id,
    pregnancyStatus || profile.pregnancy_status,
    req.user.id,
  );
  res.json(profilePayload(req.user.id));
});

// ---------- ربط الطبيبة/الوحدة الصحية عن طريق كود مع موافقة الطرف الآخر ----------
function submitLinkRequest(req, res, targetRole) {
  const code = String(req.body?.code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const meta = linkMeta[targetRole];
  const label = targetRole === 'doctor' ? 'الطبيبة' : 'الوحدة الصحية';
  if (!code) return res.status(400).json({ error: `أدخلي كود ${label}` });

  const target = findLinkTarget(targetRole, code);
  if (!target) return res.status(404).json({ error: `الكود غير صحيح، تأكدي من ${label}` });

  const profile = get('SELECT * FROM mother_profiles WHERE user_id = ?', req.user.id);
  const linkedField = targetRole === 'doctor' ? 'doctor_id' : 'health_unit_id';
  if (profile?.[linkedField] === target.id) {
    return res.status(400).json({ error: `حسابك مرتبط بالفعل بهذه ${label}` });
  }

  const existing = get(
    "SELECT * FROM link_requests WHERE mother_id = ? AND target_role = ? AND status = 'pending'",
    req.user.id,
    targetRole,
  );
  if (existing && existing.target_id === target.id) {
    return res.status(200).json({ ...profilePayload(req.user.id), message: `طلبك مسجّل بالفعل وبانتظار موافقة ${label}.` });
  }
  if (existing) {
    run("UPDATE link_requests SET status='rejected', responded_at=datetime('now') WHERE id = ?", existing.id);
  }

  createLinkRequest({
    motherId: req.user.id,
    motherName: req.user.name,
    targetRole,
    targetId: target.id,
    code,
  });

  const messages = {
    doctor: 'تم إرسال طلب الربط للطبيبة، بانتظار الموافقة.',
    health_unit: 'تم إرسال طلب الربط للوحدة الصحية، بانتظار الموافقة.',
  };
  res.status(201).json({ ...profilePayload(req.user.id), message: messages[targetRole] });
}

router.get('/link-unit', (req, res) => {
  res.json(profilePayload(req.user.id));
});

router.post('/link-unit', (req, res) => submitLinkRequest(req, res, 'health_unit'));

router.get('/link-doctor', (req, res) => {
  res.json(profilePayload(req.user.id));
});

router.post('/link-doctor', (req, res) => submitLinkRequest(req, res, 'doctor'));

router.get('/pregnancy/content', (req, res) => {
  const profile = get('SELECT * FROM mother_profiles WHERE user_id = ?', req.user.id);
  const pregnancy = profile?.lmp_date ? computePregnancy(profile.lmp_date) : null;
  const week = Number(req.query.week) || pregnancy?.week || 1;
  res.json({ content: getWeeklyPregnancyContent(week), months: PREGNANCY_MONTHS, pregnancy });
});

router.get('/pregnancy/logs', (req, res) => {
  res.json({ logs: all('SELECT * FROM pregnancy_logs WHERE mother_id = ? ORDER BY id DESC', req.user.id) });
});

router.post('/contact-doctor', (req, res) => {
  const { message } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'اكتبي رسالتك أولاً' });
  }
  const profile = get('SELECT doctor_id FROM mother_profiles WHERE user_id = ?', req.user.id);
  if (!profile?.doctor_id) {
    return res.status(400).json({ error: 'لم يتم ربط طبيبة بحسابك بعد. اربطيها من تبويب "ملفي".' });
  }
  const notif = createNotification(
    profile.doctor_id,
    'mother_message',
    `رسالة من الأم ${req.user.name}`,
    String(message).trim(),
    req.user.id,
  );
  res.status(201).json({ ok: true, notificationId: notif.id });
});

router.post('/pregnancy/logs', (req, res) => {
  const { month, week, notes } = req.body || {};
  if (!month) return res.status(400).json({ error: 'الشهر مطلوب' });
  const result = run(
    'INSERT INTO pregnancy_logs (mother_id, month, gestational_week, notes) VALUES (?, ?, ?, ?)',
    req.user.id,
    month,
    week || null,
    notes || null,
  );
  res.status(201).json({ log: get('SELECT * FROM pregnancy_logs WHERE id = ?', Number(result.lastInsertRowid)) });
});

export default router;
