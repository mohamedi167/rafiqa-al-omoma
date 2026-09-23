import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { analyzeSymptoms, chatReply } from '../services/aiService.js';
import { stripMarkers } from '../services/medicalAssistant.js';
import { computePregnancy } from '../services/pregnancyService.js';
import { all, get, run } from '../db.js';

const router = Router();
router.use(authRequired);

router.post('/analyze', asyncHandler(async (req, res) => {
  const { text } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'النص مطلوب' });
  if (String(text).trim().length > 2000) return res.status(400).json({ error: 'النص طويل جدًا، اختصري الوصف.' });
  const result = await analyzeSymptoms(String(text).trim());
  res.json(result);
}));

router.get('/chat', (req, res) => {
  const messages = all('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 30', req.user.id)
    .reverse()
    .map((m) => ({ ...m, content: stripMarkers(m.content) }));
  res.json({ messages });
});

function buildContext(userId) {
  const children = all('SELECT id, name, gender, birth_date FROM children WHERE mother_id = ?', userId).map((c) => ({
    ...c,
    ageLabel: ageLabel(c.birth_date),
  }));
  const profile = get('SELECT lmp_date FROM mother_profiles WHERE user_id = ?', userId);
  const pregnancy = profile?.lmp_date ? computePregnancy(profile.lmp_date) : null;
  return { children, pregnancyWeek: pregnancy?.week || null };
}

function ageLabel(birthDate) {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '';
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 1) {
    const days = Math.max(0, Math.floor((now - birth) / (1000 * 60 * 60 * 24)));
    return `${days} يوم`;
  }
  if (months < 24) return `${months} شهر`;
  return `${Math.floor(months / 12)} سنة`;
}

router.post('/chat', asyncHandler(async (req, res) => {
  const { message } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'الرسالة مطلوبة' });
  const text = String(message).trim();
  if (text.length > 2000) return res.status(400).json({ error: 'الرسالة طويلة جدًا، اختصريها.' });
  const history = all('SELECT role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 8', req.user.id).reverse();
  run("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'user', ?)", req.user.id, text);
  const context = buildContext(req.user.id);
  const result = await chatReply(text, history, context);
  const stored = result.marker ? `${result.reply}\n${result.marker}` : result.reply;
  run("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'assistant', ?)", req.user.id, stored);
  res.json({
    reply: result.reply,
    source: result.source,
    severity: result.severity || null,
    kind: result.kind || null,
  });
}));

export default router;
