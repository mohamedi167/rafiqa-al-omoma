import { Router } from 'express';
import { get, all } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { getVaccinationOverview } from '../services/vaccineService.js';
import { ageInMonths, formatAge } from '../services/growthService.js';
import { countPending, listRequests, respondToRequest } from '../services/linkService.js';

const router = Router();
router.use(authRequired, requireRole('health_unit'));

router.get('/profile', (req, res) => {
  const unit = get('SELECT id, name, organization, phone, code FROM users WHERE id = ?', req.user.id);
  res.json({ unit, pendingRequests: countPending('health_unit', req.user.id) });
});

router.get('/requests', (req, res) => {
  const status = ['pending', 'accepted', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  res.json({ requests: listRequests('health_unit', req.user.id, status) });
});

function respond(req, res, status) {
  const result = respondToRequest('health_unit', req.user.id, req.user.name, req.params.id, status);
  if (result.error) return res.status(result.code).json({ error: result.error });
  res.json({ ok: true, status });
}

router.post('/requests/:id/accept', (req, res) => respond(req, res, 'accepted'));
router.post('/requests/:id/reject', (req, res) => respond(req, res, 'rejected'));

router.get('/stats', (req, res) => {
  const linkedChildren = all(
    `SELECT c.id FROM children c JOIN mother_profiles mp ON mp.user_id = c.mother_id WHERE mp.health_unit_id = ?`,
    req.user.id,
  );
  const ids = linkedChildren.map((c) => c.id);
  const pending = ids.length
    ? get(
        `SELECT COUNT(*) AS c FROM child_vaccinations WHERE status='pending' AND child_id IN (${ids.map(() => '?').join(',')})`,
        ...ids,
      ).c
    : 0;
  const confirmed = ids.length
    ? get(
        `SELECT COUNT(*) AS c FROM child_vaccinations WHERE status='confirmed' AND child_id IN (${ids.map(() => '?').join(',')})`,
        ...ids,
      ).c
    : 0;
  res.json({ children: ids.length, pendingVaccines: pending, confirmedVaccines: confirmed });
});

router.get('/children', (req, res) => {
  const children = all(
    `SELECT c.*, u.name AS mother_name, u.phone AS mother_phone
     FROM children c
     JOIN users u ON u.id = c.mother_id
     JOIN mother_profiles mp ON mp.user_id = c.mother_id
     WHERE mp.health_unit_id = ?
     ORDER BY c.id`,
    req.user.id,
  );
  res.json({
    children: children.map((c) => {
      const overview = getVaccinationOverview(c);
      return {
        ...c,
        ageLabel: overview.ageLabel,
        ageMonths: overview.ageMonths,
        vaccineProgress: `${overview.confirmedCount}/${overview.totalCount}`,
        currentDue: overview.currentDue,
        pendingCount: overview.pending.length,
      };
    }),
  });
});

router.get('/child/:childId', (req, res) => {
  const child = get(
    `SELECT c.*, u.name AS mother_name, u.phone AS mother_phone
     FROM children c JOIN users u ON u.id = c.mother_id
     JOIN mother_profiles mp ON mp.user_id = c.mother_id
     WHERE c.id = ? AND mp.health_unit_id = ?`,
    req.params.childId,
    req.user.id,
  );
  if (!child) return res.status(404).json({ error: 'الطفل غير مرتبط بوحدتك الصحية' });
  res.json({
    child: { ...child, ageLabel: formatAge(ageInMonths(child.birth_date)) },
    overview: getVaccinationOverview(child),
    growth: all('SELECT * FROM growth_records WHERE child_id = ? ORDER BY id ASC', child.id).map((r) => ({
      ...r,
      assessment: r.assessment ? JSON.parse(r.assessment) : null,
    })),
  });
});

export default router;
