import { Router } from 'express';
import { get, all } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { computePregnancy } from '../services/pregnancyService.js';
import { getVaccinationOverview } from '../services/vaccineService.js';
import { ageInMonths, formatAge } from '../services/growthService.js';
import { countPending, listRequests, respondToRequest } from '../services/linkService.js';

const router = Router();
router.use(authRequired, requireRole('doctor'));

// أعمدة آمنة للأم: بدون كلمة المرور أو أي حقل حساس.
const MOTHER_COLUMNS = 'u.id, u.name, u.email, u.phone, u.role, u.created_at';

router.get('/profile', (req, res) => {
  const doctor = get('SELECT id, name, speciality, organization, phone, code FROM users WHERE id = ?', req.user.id);
  res.json({ doctor, pendingRequests: countPending('doctor', req.user.id) });
});

router.get('/requests', (req, res) => {
  const status = ['pending', 'accepted', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  res.json({ requests: listRequests('doctor', req.user.id, status) });
});

function respond(req, res, status) {
  const result = respondToRequest('doctor', req.user.id, req.user.name, req.params.id, status);
  if (result.error) return res.status(result.code).json({ error: result.error });
  res.json({ ok: true, status });
}

router.post('/requests/:id/accept', (req, res) => respond(req, res, 'accepted'));
router.post('/requests/:id/reject', (req, res) => respond(req, res, 'rejected'));

function patientSummary(mother) {
  const profile = get('SELECT * FROM mother_profiles WHERE user_id = ?', mother.id);
  const children = all('SELECT * FROM children WHERE mother_id = ? ORDER BY id', mother.id);
  const criticalAlerts = get(
    "SELECT COUNT(*) AS c FROM symptoms WHERE mother_id = ? AND severity = 'critical'",
    mother.id,
  ).c;
  const pendingVaccines = get(
    `SELECT COUNT(*) AS c FROM child_vaccinations cv
     JOIN children c ON c.id = cv.child_id
     WHERE c.mother_id = ? AND cv.status = 'pending'`,
    mother.id,
  ).c;
  const lastSymptom = get('SELECT * FROM symptoms WHERE mother_id = ? ORDER BY id DESC LIMIT 1', mother.id);
  return {
    ...mother,
    profile,
    pregnancy: profile?.lmp_date ? computePregnancy(profile.lmp_date) : null,
    children: children.map((c) => ({
      id: c.id,
      name: c.name,
      birth_date: c.birth_date,
      gender: c.gender,
      ageLabel: formatAge(ageInMonths(c.birth_date)),
    })),
    criticalAlerts,
    pendingVaccines,
    lastSymptom: lastSymptom || null,
  };
}

router.get('/stats', (req, res) => {
  const mothers = all(
    'SELECT u.id FROM users u JOIN mother_profiles mp ON mp.user_id = u.id WHERE u.role = ? AND mp.doctor_id = ?',
    'mother',
    req.user.id,
  );
  const critical = get(
    `SELECT COUNT(*) AS c FROM symptoms s JOIN mother_profiles mp ON mp.user_id = s.mother_id
     WHERE mp.doctor_id = ? AND s.severity = 'critical'`,
    req.user.id,
  ).c;
  const pending = get(
    `SELECT COUNT(*) AS c FROM child_vaccinations cv JOIN children c ON c.id = cv.child_id
     JOIN mother_profiles mp ON mp.user_id = c.mother_id
     WHERE mp.doctor_id = ? AND cv.status = 'pending'`,
    req.user.id,
  ).c;
  const alerts = get(
    `SELECT COUNT(*) AS c FROM growth_records gr JOIN children c ON c.id = gr.child_id
     JOIN mother_profiles mp ON mp.user_id = c.mother_id
     WHERE mp.doctor_id = ? AND gr.assessment LIKE '%"overall":"%' AND (gr.assessment LIKE '%"warning"%' OR gr.assessment LIKE '%"severe"%')`,
    req.user.id,
  ).c;
  res.json({ patients: mothers.length, criticalAlerts: critical, pendingVaccines: pending, growthAlerts: alerts });
});

router.get('/patients', (req, res) => {
  const mothers = all(
    `SELECT ${MOTHER_COLUMNS} FROM users u JOIN mother_profiles mp ON mp.user_id = u.id WHERE u.role = ? AND mp.doctor_id = ? ORDER BY u.id`,
    'mother',
    req.user.id,
  );
  res.json({ patients: mothers.map(patientSummary) });
});

router.get('/patients/:motherId', (req, res) => {
  const mother = get(
    `SELECT ${MOTHER_COLUMNS} FROM users u JOIN mother_profiles mp ON mp.user_id = u.id WHERE u.id = ? AND mp.doctor_id = ?`,
    req.params.motherId,
    req.user.id,
  );
  if (!mother) return res.status(404).json({ error: 'الأم غير موجودة أو غير مرتبطة بحسابك' });
  const symptoms = all('SELECT * FROM symptoms WHERE mother_id = ? ORDER BY id DESC', mother.id);
  const children = all('SELECT * FROM children WHERE mother_id = ? ORDER BY id', mother.id).map((c) => ({
    ...c,
    overview: getVaccinationOverview(c),
    growth: all('SELECT * FROM growth_records WHERE child_id = ? ORDER BY id ASC', c.id).map((r) => ({
      ...r,
      assessment: r.assessment ? JSON.parse(r.assessment) : null,
    })),
  }));
  res.json({ patient: { ...patientSummary(mother), symptoms, children } });
});

export default router;
