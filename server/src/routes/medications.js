import { Router } from 'express';
import { get, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import {
  MED_FORMS,
  dosesForDate,
  getMedication,
  isValidTime,
  listMedications,
  localDate,
  logDose,
  normalizeTimes,
} from '../services/medicationService.js';

const router = Router();
router.use(authRequired, requireRole('mother'));

function resolveChild(motherId, childId) {
  if (childId === null || childId === undefined || childId === '' || Number(childId) === 0) return null;
  const child = get('SELECT id FROM children WHERE id = ? AND mother_id = ?', childId, motherId);
  return child ? child.id : undefined;
}

function validate(body, motherId) {
  const name = String(body?.name || '').trim();
  if (!name) return { error: 'اسم الدواء مطلوب' };
  const times = normalizeTimes(body?.times);
  if (!times.length) return { error: 'أضيفي وقتًا واحدًا على الأقل للدواء' };
  const childId = resolveChild(motherId, body?.childId);
  if (childId === undefined) return { error: 'الطفل غير موجود' };
  const startDate = body?.startDate || null;
  const endDate = body?.endDate || null;
  if (startDate && endDate && endDate < startDate) {
    return { error: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' };
  }
  return {
    value: {
      name,
      dose: String(body?.dose || '').trim() || null,
      form: String(body?.form || '').trim() || null,
      times: JSON.stringify(times),
      childId,
      startDate,
      endDate,
      notes: String(body?.notes || '').trim() || null,
    },
  };
}

router.get('/', (req, res) => {
  res.json({ medications: listMedications(req.user.id), forms: MED_FORMS });
});

router.get('/today', (req, res) => {
  const requested = String(req.query.date || '');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : localDate();
  res.json({ date, doses: dosesForDate(req.user.id, date) });
});

router.post('/', (req, res) => {
  const { error, value } = validate(req.body, req.user.id);
  if (error) return res.status(400).json({ error });
  const result = run(
    'INSERT INTO medications (mother_id, child_id, name, dose, form, times, start_date, end_date, notes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
    req.user.id,
    value.childId,
    value.name,
    value.dose,
    value.form,
    value.times,
    value.startDate,
    value.endDate,
    value.notes,
  );
  res.status(201).json({ medication: getMedication(req.user.id, Number(result.lastInsertRowid)) });
});

router.put('/:id', (req, res) => {
  const existing = getMedication(req.user.id, req.params.id);
  if (!existing) return res.status(404).json({ error: 'الدواء غير موجود' });
  const { error, value } = validate(req.body, req.user.id);
  if (error) return res.status(400).json({ error });
  run(
    'UPDATE medications SET name=?, dose=?, form=?, times=?, child_id=?, start_date=?, end_date=?, notes=? WHERE id=? AND mother_id=?',
    value.name,
    value.dose,
    value.form,
    value.times,
    value.childId,
    value.startDate,
    value.endDate,
    value.notes,
    existing.id,
    req.user.id,
  );
  res.json({ medication: getMedication(req.user.id, existing.id) });
});

router.post('/:id/toggle', (req, res) => {
  const existing = getMedication(req.user.id, req.params.id);
  if (!existing) return res.status(404).json({ error: 'الدواء غير موجود' });
  run('UPDATE medications SET is_active = ? WHERE id = ? AND mother_id = ?', existing.is_active ? 0 : 1, existing.id, req.user.id);
  res.json({ medication: getMedication(req.user.id, existing.id) });
});

router.delete('/:id', (req, res) => {
  const existing = getMedication(req.user.id, req.params.id);
  if (!existing) return res.status(404).json({ error: 'الدواء غير موجود' });
  run('DELETE FROM medications WHERE id = ? AND mother_id = ?', existing.id, req.user.id);
  res.json({ ok: true });
});

router.post('/:id/log', (req, res) => {
  const { time, status } = req.body || {};
  if (!isValidTime(time)) return res.status(400).json({ error: 'وقت الجرعة غير صالح' });
  const med = getMedication(req.user.id, req.params.id);
  if (!med) return res.status(404).json({ error: 'الدواء غير موجود' });
  const log = logDose(req.user.id, med.id, time, status === 'skipped' ? 'skipped' : 'taken');
  res.status(201).json({ log, doses: dosesForDate(req.user.id, localDate()) });
});

export default router;
