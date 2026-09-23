import { all, get, run } from '../db.js';
import { buildTimeline } from './vaccineService.js';

export function createNotification(userId, type, title, body, relatedId = null) {
  const res = run(
    'INSERT INTO notifications (user_id, type, title, body, related_id) VALUES (?, ?, ?, ?, ?)',
    userId,
    type,
    title,
    body || null,
    relatedId,
  );
  return get('SELECT * FROM notifications WHERE id = ?', Number(res.lastInsertRowid));
}

export function listNotifications(userId, limit = 50) {
  return all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?', userId, limit);
}

export function unreadCount(userId) {
  const row = get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', userId);
  return row ? row.c : 0;
}

export function markRead(userId, id) {
  run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', id, userId);
}

export function markAllRead(userId) {
  run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', userId);
}

function recentlyNotified(userId, type, title) {
  const row = get(
    "SELECT id FROM notifications WHERE user_id = ? AND type = ? AND title = ? AND created_at > datetime('now','-1 day') LIMIT 1",
    userId,
    type,
    title,
  );
  return Boolean(row);
}

// إنشاء تذكيرات التطعيمات قبل الموعد بيوم/يومين دون تكرار
export function ensureVaccineReminders(child) {
  const timeline = buildTimeline(child);
  const created = [];
  for (const item of timeline) {
    if (item.status === 'confirmed') continue;
    if (item.status === 'due' || (item.daysUntil >= 0 && item.daysUntil <= 2)) {
      const title =
        item.daysUntil <= 0
          ? `موعد تطعيم ${child.name}: ${item.ageLabel} (مستحق الآن)`
          : `تذكير: تطعيم ${child.name} بعد ${item.daysUntil} يوم`;
      if (!recentlyNotified(child.mother_id, 'vaccine_reminder', title)) {
        created.push(
          createNotification(
            child.mother_id,
            'vaccine_reminder',
            title,
            `التطعيمات: ${item.vaccines.map((v) => v.name).join('، ')}. يُفضّل التوجه للوحدة الصحية في الموعد.`,
          ),
        );
      }
    }
    if (item.status === 'pending') {
      const title = `التطعيم ${item.ageLabel} بانتظار تأكيد الوحدة الصحية`;
      if (!recentlyNotified(child.mother_id, 'vaccine_pending', title)) {
        created.push(
          createNotification(child.mother_id, 'vaccine_pending', title, 'سجّلتِ إتمام التطعيم، وننتظر تأكيد الوحدة الصحية لاعتماده.'),
        );
      }
    }
  }
  return created;
}
