import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { listNotifications, unreadCount, markRead, markAllRead } from '../services/notificationService.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  res.json({ notifications: listNotifications(req.user.id), unread: unreadCount(req.user.id) });
});

router.post('/read-all', (req, res) => {
  markAllRead(req.user.id);
  res.json({ ok: true, unread: 0 });
});

router.post('/:id/read', (req, res) => {
  markRead(req.user.id, req.params.id);
  res.json({ ok: true, unread: unreadCount(req.user.id) });
});

export default router;
