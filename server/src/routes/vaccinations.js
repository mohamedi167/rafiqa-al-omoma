import { Router } from 'express';
import { get, all } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { getVaccinationOverview, markVaccination, confirmVaccination, motherVaccinationMode, VACCINE_SCHEDULE } from '../services/vaccineService.js';
import { getChildOr404, canAccessChild } from '../services/accessService.js';
import { createNotification } from '../services/notificationService.js';

const router = Router();
router.use(authRequired);

router.get('/schedule', (_req, res) => res.json({ schedule: VACCINE_SCHEDULE }));

router.get('/child/:childId/overview', (req, res) => {
  const child = getChildOr404(req.params.childId);
  if (!child || !canAccessChild(req.user, child)) return res.status(404).json({ error: 'الطفل غير موجود' });
  const mode = motherVaccinationMode(child.mother_id);
  res.json({ overview: getVaccinationOverview(child), child, selfManaged: mode.selfManaged });
});

router.post('/child/:childId/:groupKey/mark', requireRole('mother'), (req, res) => {
  const child = getChildOr404(req.params.childId);
  if (!child || child.mother_id !== req.user.id) return res.status(404).json({ error: 'الطفل غير موجود' });
  const mode = motherVaccinationMode(req.user.id);
  markVaccination(child.id, req.params.groupKey, {
    selfConfirm: mode.selfManaged,
    confirmedBy: mode.selfManaged ? req.user.id : null,
  });
  const overview = getVaccinationOverview(child);
  const group = overview.timeline.find((t) => t.groupKey === req.params.groupKey);

  if (mode.selfManaged && group) {
    createNotification(
      req.user.id,
      'vaccine_confirmed',
      `تم تسجيل تطعيم ${child.name}: ${group.ageLabel}`,
      `سجّلتِ التطعيم بنفسك (بدون وحدة صحية مرتبطة). التطعيمات: ${group.vaccines.map((v) => v.name).join('، ')}.`,
      child.id,
    );
    const next = overview.timeline.find((t) => t.status !== 'confirmed' && t.ageMonths > group.ageMonths);
    if (next) {
      createNotification(
        req.user.id,
        'vaccine_next',
        `موعد التطعيم القادم لـ ${child.name}: ${next.ageLabel}`,
        `المتبقي لهذا التطعيم: ${next.vaccines.map((v) => v.name).join('، ')}.`,
        child.id,
      );
    }
  }

  res.json({ overview, group, selfManaged: mode.selfManaged, selfConfirmed: mode.selfManaged });
});

router.post('/child/:childId/:groupKey/confirm', requireRole('health_unit'), (req, res) => {
  const child = getChildOr404(req.params.childId);
  if (!child || !canAccessChild(req.user, child)) return res.status(404).json({ error: 'الطفل غير موجود' });
  const before = getVaccinationOverview(child).timeline.find((t) => t.groupKey === req.params.groupKey);
  if (!before) return res.status(404).json({ error: 'التطعيم غير موجود في الجدول' });
  if (before.status === 'upcoming' || before.status === 'soon' || before.status === 'due') {
    return res.status(400).json({ error: 'لا يمكن تأكيد تطعيم لم تسجّله الأم بعد' });
  }
  confirmVaccination(child.id, req.params.groupKey, req.user.id);
  const overview = getVaccinationOverview(child);
  const group = overview.timeline.find((t) => t.groupKey === req.params.groupKey);

  createNotification(
    child.mother_id,
    'vaccine_confirmed',
    `تم تأكيد تطعيم ${child.name}: ${group.ageLabel}`,
    `التطعيمات: ${group.vaccines.map((v) => v.name).join('، ')}. الأعراض الجانبية المتوقعة: ${group.generalSideEffects.join('، ')}.`,
  );
  if (overview.nextAfterCurrent) {
    createNotification(
      child.mother_id,
      'vaccine_next',
      `موعد التطعيم القادم لـ ${child.name}: ${overview.nextAfterCurrent.ageLabel}`,
      `المتبقي لهذا التطعيم: ${overview.nextAfterCurrent.vaccines.map((v) => v.name).join('، ')}.`,
    );
  }
  res.json({ overview, group });
});

router.get('/pending', requireRole('health_unit', 'doctor'), (req, res) => {
  const query = `
    SELECT cv.group_key, cv.mother_marked_at, c.id AS child_id, c.name AS child_name, c.birth_date,
           u.id AS mother_id, u.name AS mother_name, u.phone AS mother_phone
    FROM child_vaccinations cv
    JOIN children c ON c.id = cv.child_id
    JOIN users u ON u.id = c.mother_id
    JOIN mother_profiles mp ON mp.user_id = c.mother_id
    WHERE cv.status = 'pending' ${req.user.role === 'doctor' ? 'AND mp.doctor_id = ?' : 'AND mp.health_unit_id = ?'}
    ORDER BY cv.mother_marked_at ASC`;
  const rows = all(query, req.user.id);
  const pending = rows.map((r) => {
    const group = VACCINE_SCHEDULE.find((g) => g.key === r.group_key);
    return { ...r, ageLabel: group?.ageLabel, vaccines: group?.vaccines || [] };
  });
  res.json({ pending });
});

export default router;
