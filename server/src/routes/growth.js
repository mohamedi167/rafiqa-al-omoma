import { Router } from 'express';
import { get, all, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { toFiniteNumber, inRange } from '../middleware/validate.js';
import { getChildOr404, canAccessChild } from '../services/accessService.js';
import { assessGrowth, ageInMonths, formatAge } from '../services/growthService.js';
import { explainGrowth } from '../services/aiService.js';
import { createNotification } from '../services/notificationService.js';
import { WHO_GROWTH } from '../data/whoGrowth.js';

const router = Router();
router.use(authRequired);

const RANGES = {
  weight: [0.5, 60],
  height: [20, 150],
  head: [20, 70],
  chest: [20, 90],
};

function parseMeasure(raw, key) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = toFiniteNumber(raw);
  if (!Number.isFinite(n) || !inRange(n, RANGES[key][0], RANGES[key][1])) return NaN;
  return n;
}

function referenceCurves(gender) {
  const sex = gender === 'female' ? 'female' : 'male';
  const months = Object.keys(WHO_GROWTH[sex].weight).map(Number).sort((a, b) => a - b);
  return months.map((month) => ({
    month,
    weightMedian: WHO_GROWTH[sex].weight[month][0],
    heightMedian: WHO_GROWTH[sex].height[month][0],
    headMedian: WHO_GROWTH[sex].head[month][0],
  }));
}

router.post('/child/:childId', requireRole('mother'), asyncHandler(async (req, res) => {
  const child = getChildOr404(req.params.childId);
  if (!child || child.mother_id !== req.user.id) return res.status(404).json({ error: 'الطفل غير موجود' });
  const { recordedAt } = req.body || {};
  if (req.body?.weight == null && req.body?.height == null && req.body?.head == null && req.body?.chest == null) {
    return res.status(400).json({ error: 'أدخلي قياسًا واحدًا على الأقل (وزن أو طول أو محيط رأس أو محيط صدر)' });
  }
  const weight = parseMeasure(req.body?.weight, 'weight');
  const height = parseMeasure(req.body?.height, 'height');
  const head = parseMeasure(req.body?.head, 'head');
  const chest = parseMeasure(req.body?.chest, 'chest');
  for (const [key, value] of Object.entries({ weight, height, head, chest })) {
    if (Number.isNaN(value)) {
      return res.status(400).json({ error: `قيمة غير صالحة للقياس: ${key}` });
    }
  }

  let at = new Date();
  if (recordedAt) {
    at = new Date(recordedAt);
    if (Number.isNaN(at.getTime())) return res.status(400).json({ error: 'تاريخ القياس غير صالح' });
    if (at.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'تاريخ القياس لا يمكن أن يكون في المستقبل' });
    }
  }
  const age = ageInMonths(child.birth_date, at) || 0;
  const assessment = assessGrowth(child.gender, age, { weight, height, head });

  const result = run(
    'INSERT INTO growth_records (child_id, weight, height, head, chest, age_months_at_record, assessment, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    child.id,
    weight,
    height,
    head,
    chest,
    Number(age.toFixed(1)),
    JSON.stringify(assessment),
    at.toISOString(),
  );
  const record = get('SELECT * FROM growth_records WHERE id = ?', Number(result.lastInsertRowid));

  if (assessment.overall !== 'normal') {
    const profile = get('SELECT doctor_id, health_unit_id FROM mother_profiles WHERE user_id = ?', child.mother_id);
    const title = `${assessment.overall === 'severe' ? 'تنبيه' : 'متابعة'}: نمو ${child.name}`;
    const body = assessment.metrics
      .filter((m) => m.status !== 'normal')
      .map((m) => `${m.metricLabel} ${m.value} ${m.unit} (${m.statusLabel})`)
      .join('، ');
    if (profile?.doctor_id) createNotification(profile.doctor_id, 'growth_alert', title, body, record.id);
    if (profile?.health_unit_id) createNotification(profile.health_unit_id, 'growth_alert', title, body, record.id);
  }

  let aiExplanation = null;
  try {
    aiExplanation = await explainGrowth({
      childName: child.name,
      ageMonths: Number(age.toFixed(1)),
      metrics: assessment.metrics,
      summary: assessment.summary,
    });
  } catch {
    aiExplanation = null;
  }

  res.status(201).json({ record: { ...record, assessment }, aiExplanation });
}));

router.get('/child/:childId', (req, res) => {
  const child = getChildOr404(req.params.childId);
  if (!child || !canAccessChild(req.user, child)) return res.status(404).json({ error: 'الطفل غير موجود' });
  const records = all('SELECT * FROM growth_records WHERE child_id = ? ORDER BY id ASC', child.id).map((r) => ({
    ...r,
    assessment: r.assessment ? JSON.parse(r.assessment) : null,
  }));
  res.json({
    records,
    reference: referenceCurves(child.gender),
    ageLabel: formatAge(ageInMonths(child.birth_date)),
    gender: child.gender,
  });
});

export default router;
