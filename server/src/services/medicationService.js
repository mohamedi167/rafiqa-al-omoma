import { all, get, run } from '../db.js';
import { createNotification } from './notificationService.js';

export const MED_FORMS = ['أقراص', 'شراب', 'قطرة', 'تحاميل', 'كبسولات', 'بخاخ', 'مرهم', 'أخرى'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value) {
  return TIME_RE.test(String(value || ''));
}

export function normalizeTimes(input) {
  const list = Array.isArray(input) ? input : [];
  const cleaned = list
    .map((t) => String(t || '').trim())
    .filter((t) => isValidTime(t));
  return [...new Set(cleaned)].sort();
}

export function parseTimes(med) {
  try {
    const parsed = JSON.parse(med.times || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function localTime(date = new Date()) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function activeOn(med, dateStr) {
  if (!med.is_active) return false;
  if (med.start_date && dateStr < med.start_date) return false;
  if (med.end_date && dateStr > med.end_date) return false;
  return true;
}

export function listMedications(motherId) {
  return all(
    `SELECT m.*, c.name AS child_name, c.gender AS child_gender
     FROM medications m
     LEFT JOIN children c ON c.id = m.child_id
     WHERE m.mother_id = ?
     ORDER BY m.is_active DESC, m.id DESC`,
    motherId,
  ).map((m) => ({ ...m, times: parseTimes(m) }));
}

export function getMedication(motherId, id) {
  const med = get('SELECT * FROM medications WHERE id = ? AND mother_id = ?', id, motherId);
  return med ? { ...med, times: parseTimes(med) } : null;
}

export function dosesForDate(motherId, dateStr) {
  const meds = all(
    `SELECT m.*, c.name AS child_name
     FROM medications m
     LEFT JOIN children c ON c.id = m.child_id
     WHERE m.mother_id = ?`,
    motherId,
  );
  const logs = all(
    'SELECT medication_id, dose_time, status FROM medication_logs WHERE mother_id = ? AND dose_date = ?',
    motherId,
    dateStr,
  );
  const logKey = new Map();
  for (const l of logs) logKey.set(`${l.medication_id}|${l.dose_time}`, l.status);

  const doses = [];
  for (const med of meds) {
    if (!activeOn(med, dateStr)) continue;
    for (const time of parseTimes(med)) {
      doses.push({
        medicationId: med.id,
        name: med.name,
        dose: med.dose,
        form: med.form,
        childId: med.child_id,
        childName: med.child_name,
        forWhom: med.child_id ? med.child_name : 'أنا',
        time,
        status: logKey.get(`${med.id}|${time}`) || 'pending',
      });
    }
  }
  doses.sort((a, b) => a.time.localeCompare(b.time));
  return doses;
}

export function logDose(motherId, medicationId, time, status = 'taken') {
  const med = getMedication(motherId, medicationId);
  if (!med) return null;
  const today = localDate();
  run(
    'DELETE FROM medication_logs WHERE medication_id = ? AND dose_date = ? AND dose_time = ?',
    medicationId,
    today,
    time,
  );
  const res = run(
    'INSERT INTO medication_logs (medication_id, mother_id, dose_date, dose_time, status) VALUES (?, ?, ?, ?, ?)',
    medicationId,
    motherId,
    today,
    time,
    status,
  );
  return get('SELECT * FROM medication_logs WHERE id = ?', Number(res.lastInsertRowid));
}

// منبّه الخادم: يفحص أوقات الأدوية وينشئ إشعارًا للأم (نسخة احتياطية للتنبيه داخل المتصفح)
export function runMedicationReminderTick() {
  const now = new Date();
  const today = localDate(now);
  const hm = localTime(now);
  const created = [];
  const meds = all(
    `SELECT m.*, c.name AS child_name
     FROM medications m
     LEFT JOIN children c ON c.id = m.child_id
     WHERE m.is_active = 1`,
  );
  for (const med of meds) {
    if (!activeOn(med, today)) continue;
    if (!parseTimes(med).includes(hm)) continue;
    const title = `موعد دواء: ${med.name}`;
    const body = `حان الآن وقت ${med.name}${med.dose ? ` (${med.dose})` : ''}${
      med.child_name ? ` لـ ${med.child_name}` : ''
    }.`;
    const existing = get(
      "SELECT id FROM notifications WHERE user_id = ? AND type = 'medication_reminder' AND title = ? AND body = ? AND created_at > datetime('now','-3 minutes') LIMIT 1",
      med.mother_id,
      title,
      body,
    );
    if (!existing) {
      created.push(createNotification(med.mother_id, 'medication_reminder', title, body, med.id));
    }
  }
  return created;
}

export function startMedicationScheduler() {
  runMedicationReminderTick();
  return setInterval(runMedicationReminderTick, 45 * 1000);
}
