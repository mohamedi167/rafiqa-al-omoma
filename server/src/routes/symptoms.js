import { Router } from 'express';
import { get, all, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { analyzeSymptoms } from '../services/aiService.js';
import { createNotification } from '../services/notificationService.js';

const router = Router();
router.use(authRequired, requireRole('mother'));

router.post('/', asyncHandler(async (req, res) => {
  const { text } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'اكتبي وصف إحساسك أولاً' });
  if (String(text).trim().length > 2000) return res.status(400).json({ error: 'الوصف طويل جدًا، اختصري الأعراض.' });

  const analysis = await analyzeSymptoms(String(text).trim());
  const result = run(
    'INSERT INTO symptoms (mother_id, text, severity, advice, reasoning, doctor_notified) VALUES (?, ?, ?, ?, ?, ?)',
    req.user.id,
    String(text).trim(),
    analysis.severity,
    analysis.advice,
    analysis.reasoning,
    0,
  );
  const symptomId = Number(result.lastInsertRowid);

  let doctorNotified = false;
  if (analysis.severity === 'critical') {
    const profile = get('SELECT doctor_id, health_unit_id FROM mother_profiles WHERE user_id = ?', req.user.id);
    const title = `تنبيه عاجل: عرض خطير للأم ${req.user.name}`;
    const body = `الوصف: "${String(text).trim()}" — ${analysis.reasoning}`;
    if (profile?.doctor_id) {
      createNotification(profile.doctor_id, 'critical_symptom', title, body, symptomId);
      doctorNotified = true;
    }
    if (profile?.health_unit_id) {
      createNotification(profile.health_unit_id, 'critical_symptom', title, body, symptomId);
    }
    run('UPDATE symptoms SET doctor_notified = ? WHERE id = ?', doctorNotified ? 1 : 0, symptomId);
  }

  res.status(201).json({
    symptom: get('SELECT * FROM symptoms WHERE id = ?', symptomId),
    doctorNotified,
  });
}));

router.get('/', (req, res) => {
  res.json({ symptoms: all('SELECT * FROM symptoms WHERE mother_id = ? ORDER BY id DESC', req.user.id) });
});

export default router;
