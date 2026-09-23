import { Router } from 'express';
import { get, all, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { getVaccinationOverview } from '../services/vaccineService.js';
import { ensureVaccineReminders } from '../services/notificationService.js';
import { getChildContentForAge } from '../data/childContent.js';
import { ageInMonths, formatAge } from '../services/growthService.js';

const router = Router();
router.use(authRequired, requireRole('mother'));

function childSummary(child) {
  const overview = getVaccinationOverview(child);
  const lastGrowth = get('SELECT * FROM growth_records WHERE child_id = ? ORDER BY id DESC LIMIT 1', child.id);
  let assessment = null;
  if (lastGrowth?.assessment) {
    try {
      assessment = JSON.parse(lastGrowth.assessment);
    } catch {
      assessment = null;
    }
  }
  return {
    ...child,
    ageLabel: overview.ageLabel,
    ageMonths: overview.ageMonths,
    vaccineProgress: `${overview.confirmedCount}/${overview.totalCount}`,
    currentDue: overview.currentDue,
    nextVaccination: overview.nextVaccination,
    lastGrowth: lastGrowth || null,
    assessment,
  };
}

router.get('/', (req, res) => {
  const children = all('SELECT * FROM children WHERE mother_id = ? ORDER BY id', req.user.id);
  children.forEach((c) => ensureVaccineReminders(c));
  res.json({ children: children.map(childSummary) });
});

router.post('/', (req, res) => {
  const { name, birthDate, gender } = req.body || {};
  if (!name || !birthDate) return res.status(400).json({ error: 'اسم الطفل وتاريخ الميلاد مطلوبان' });
  if (Number.isNaN(new Date(birthDate).getTime())) return res.status(400).json({ error: 'تاريخ الميلاد غير صالح' });
  const result = run(
    'INSERT INTO children (mother_id, name, birth_date, gender) VALUES (?, ?, ?, ?)',
    req.user.id,
    name,
    birthDate,
    gender === 'female' ? 'female' : 'male',
  );
  const child = get('SELECT * FROM children WHERE id = ?', Number(result.lastInsertRowid));
  run('UPDATE mother_profiles SET pregnancy_status = ? WHERE user_id = ?', 'postpartum', req.user.id);
  ensureVaccineReminders(child);
  res.status(201).json({ child: childSummary(child) });
});

router.get('/:id', (req, res) => {
  const child = get('SELECT * FROM children WHERE id = ? AND mother_id = ?', req.params.id, req.user.id);
  if (!child) return res.status(404).json({ error: 'الطفل غير موجود' });
  ensureVaccineReminders(child);
  const age = ageInMonths(child.birth_date) || 0;
  const growthRecords = all('SELECT * FROM growth_records WHERE child_id = ? ORDER BY id ASC', child.id).map((r) => ({
    ...r,
    assessment: r.assessment ? JSON.parse(r.assessment) : null,
  }));
  res.json({
    child: childSummary(child),
    overview: getVaccinationOverview(child),
    ageLabel: formatAge(age),
    content: getChildContentForAge(Math.floor(age)),
    growthRecords,
  });
});

router.get('/:id/content', (req, res) => {
  const child = get('SELECT * FROM children WHERE id = ? AND mother_id = ?', req.params.id, req.user.id);
  if (!child) return res.status(404).json({ error: 'الطفل غير موجود' });
  const age = ageInMonths(child.birth_date) || 0;
  res.json({ content: getChildContentForAge(Math.floor(age)), ageMonths: Number(age.toFixed(1)) });
});

export default router;
