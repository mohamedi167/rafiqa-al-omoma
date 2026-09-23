import { VACCINE_SCHEDULE } from '../data/vaccineSchedule.js';
import { all, get, run } from '../db.js';
import { ageInMonths, formatAge } from './growthService.js';

const DAY = 1000 * 60 * 60 * 24;

export function addMonths(dateInput, months) {
  const d = new Date(dateInput);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export function ensureVaccinationRows(childId) {
  for (const group of VACCINE_SCHEDULE) {
    const existing = get('SELECT id FROM child_vaccinations WHERE child_id = ? AND group_key = ?', childId, group.key);
    if (!existing) {
      run('INSERT INTO child_vaccinations (child_id, group_key, status) VALUES (?, ?, ?)', childId, group.key, 'upcoming');
    }
  }
}

const STATUS_META = {
  confirmed: { label: 'مؤكد', color: 'green' },
  pending: { label: 'قيد التأكيد', color: 'orange' },
  due: { label: 'مستحق الآن', color: 'red' },
  soon: { label: 'قريبًا', color: 'amber' },
  upcoming: { label: 'لم يحن بعد', color: 'gray' },
};

export function buildTimeline(child, now = new Date()) {
  ensureVaccinationRows(child.id);
  const rows = all('SELECT * FROM child_vaccinations WHERE child_id = ?', child.id);
  const byKey = Object.fromEntries(rows.map((r) => [r.group_key, r]));
  const age = ageInMonths(child.birth_date, now) || 0;

  return VACCINE_SCHEDULE.map((group) => {
    const row = byKey[group.key];
    const due = addMonths(child.birth_date, group.ageMonths);
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / DAY);
    let status = 'upcoming';
    if (row?.status === 'confirmed') status = 'confirmed';
    else if (row?.status === 'pending' || row?.mother_marked_at) status = 'pending';
    else if (daysUntil <= 0) status = 'due';
    else if (daysUntil <= 14) status = 'soon';

    return {
      groupKey: group.key,
      ageMonths: group.ageMonths,
      ageLabel: group.ageLabel,
      dueDate: due.toISOString().slice(0, 10),
      daysUntil,
      status,
      statusLabel: STATUS_META[status].label,
      color: STATUS_META[status].color,
      vaccines: group.vaccines,
      generalSideEffects: group.generalSideEffects,
      homeCare: group.homeCare,
      callDoctorIf: group.callDoctorIf,
      motherMarkedAt: row?.mother_marked_at || null,
      confirmedAt: row?.confirmed_at || null,
    };
  }).sort((a, b) => a.ageMonths - b.ageMonths);
}

export function getVaccinationOverview(child, now = new Date()) {
  const timeline = buildTimeline(child, now);
  const pending = timeline.filter((t) => t.status === 'pending');
  const due = timeline.filter((t) => t.status === 'due');
  const upcoming = timeline.filter((t) => t.status === 'soon' || t.status === 'upcoming');
  const confirmed = timeline.filter((t) => t.status === 'confirmed');

  const next = upcoming[0] || null;
  const currentDue =
    due.find((t) => t.status === 'due') ||
    pending.find((t) => t.status === 'pending') ||
    next;

  return {
    timeline,
    confirmedCount: confirmed.length,
    totalCount: timeline.length,
    dueNow: due,
    pending,
    nextVaccination: next,
    currentDue,
    nextAfterCurrent: next,
    ageMonths: Number(ageInMonths(child.birth_date, now)?.toFixed(1) || 0),
    ageLabel: formatAge(ageInMonths(child.birth_date, now)),
  };
}

// هل تتابع الأم التطعيمات بنفسها (بدون وحدة صحية)؟
// نعم إذا لم تكن مرتبطة بوحدة، وليس لديها طلب ربط معلّق بالوحدة.
export function motherVaccinationMode(motherId) {
  const profile = get('SELECT health_unit_id FROM mother_profiles WHERE user_id = ?', motherId);
  if (!profile || profile.health_unit_id) return { selfManaged: false, healthUnitId: profile?.health_unit_id || null };
  const pending = get(
    "SELECT id FROM link_requests WHERE mother_id = ? AND target_role = 'health_unit' AND status = 'pending'",
    motherId,
  );
  return { selfManaged: !pending, healthUnitId: null };
}

export function markVaccination(childId, groupKey, { selfConfirm = false, confirmedBy = null } = {}) {
  const row = get('SELECT * FROM child_vaccinations WHERE child_id = ? AND group_key = ?', childId, groupKey);
  if (!row) return null;
  if (selfConfirm) {
    run(
      "UPDATE child_vaccinations SET status='confirmed', mother_marked_at=datetime('now'), confirmed_at=datetime('now'), confirmed_by=?, notes='تأكيد ذاتي (بدون وحدة صحية)' WHERE id = ?",
      confirmedBy || null,
      row.id,
    );
  } else {
    run(
      "UPDATE child_vaccinations SET status='pending', mother_marked_at=datetime('now') WHERE id = ?",
      row.id,
    );
  }
  return get('SELECT * FROM child_vaccinations WHERE id = ?', row.id);
}

export function confirmVaccination(childId, groupKey, confirmedBy) {
  const row = get('SELECT * FROM child_vaccinations WHERE child_id = ? AND group_key = ?', childId, groupKey);
  if (!row) return null;
  run(
    "UPDATE child_vaccinations SET status='confirmed', confirmed_at=datetime('now'), confirmed_by=? WHERE id = ?",
    confirmedBy || null,
    row.id,
  );
  return get('SELECT * FROM child_vaccinations WHERE id = ?', row.id);
}

export { VACCINE_SCHEDULE };
