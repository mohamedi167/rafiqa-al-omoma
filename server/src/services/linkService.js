import { get, all, run } from '../db.js';
import { createNotification } from './notificationService.js';

const ROLE_META = {
  doctor: {
    profileField: 'doctor_id',
    relation: 'طبيبتك المتابعة',
    requestType: 'doctor_link_request',
    acceptedType: 'doctor_link_accepted',
    rejectedType: 'doctor_link_rejected',
    acceptedTitle: 'تم قبول ربط حسابك بالطبيبة',
    rejectedTitle: 'تم رفض طلب ربط الطبيبة',
    requestMessage: (name, code) => `أدخلت الأم ${name} كود الطبيبة (${code}) وطلبت ربط حسابها.`,
  },
  health_unit: {
    profileField: 'health_unit_id',
    relation: 'وحدتك الصحية المتابعة',
    requestType: 'unit_link_request',
    acceptedType: 'unit_link_accepted',
    rejectedType: 'unit_link_rejected',
    acceptedTitle: 'تم قبول ربط حسابك بالوحدة الصحية',
    rejectedTitle: 'تم رفض طلب الربط بالوحدة الصحية',
    requestMessage: (name, code) => `أدخلت الأم ${name} كود الوحدة (${code}) وطلبت ربط حسابها.`,
  },
};

export const linkMeta = ROLE_META;

export function findLinkTarget(targetRole, code) {
  return get('SELECT id, name, organization, code FROM users WHERE role = ? AND code = ?', targetRole, code);
}

// إنشاء طلب ربط من الأم إلى طبيبة/وحدة صحية مع إشعار الطرف الآخر
export function createLinkRequest({ motherId, motherName, targetRole, targetId, code }) {
  const meta = ROLE_META[targetRole];
  const result = run(
    "INSERT INTO link_requests (mother_id, target_role, target_id, code_used, status) VALUES (?, ?, ?, ?, 'pending')",
    motherId,
    targetRole,
    targetId,
    code,
  );
  const id = Number(result.lastInsertRowid);
  createNotification(
    targetId,
    meta.requestType,
    `طلب ربط جديد من الأم ${motherName}`,
    `${meta.requestMessage(motherName, code)} اقبلي الطلب لتأكيد الارتباط.`,
    id,
  );
  return get('SELECT * FROM link_requests WHERE id = ?', id);
}

export function countPending(targetRole, targetId) {
  return get(
    "SELECT COUNT(*) AS c FROM link_requests WHERE target_role = ? AND target_id = ? AND status = 'pending'",
    targetRole,
    targetId,
  ).c;
}

export function listRequests(targetRole, targetId, status = 'pending') {
  const rows = all(
    `SELECT r.*, u.name AS mother_name, u.phone AS mother_phone, u.email AS mother_email
     FROM link_requests r
     JOIN users u ON u.id = r.mother_id
     WHERE r.target_role = ? AND r.target_id = ? AND r.status = ?
     ORDER BY r.id DESC`,
    targetRole,
    targetId,
    status,
  );
  return rows.map((r) => ({
    ...r,
    childrenCount: get('SELECT COUNT(*) AS c FROM children WHERE mother_id = ?', r.mother_id).c,
  }));
}

export function respondToRequest(targetRole, targetId, responderName, requestId, status) {
  const row = get(
    'SELECT * FROM link_requests WHERE id = ? AND target_role = ? AND target_id = ?',
    requestId,
    targetRole,
    targetId,
  );
  if (!row) return { error: 'الطلب غير موجود', code: 404 };
  if (row.status !== 'pending') return { error: 'تمت معالجة هذا الطلب بالفعل', code: 400 };

  run("UPDATE link_requests SET status = ?, responded_at = datetime('now') WHERE id = ?", status, row.id);

  const meta = ROLE_META[targetRole];
  if (status === 'accepted') {
    run(`UPDATE mother_profiles SET ${meta.profileField} = ? WHERE user_id = ?`, targetId, row.mother_id);
    createNotification(
      row.mother_id,
      meta.acceptedType,
      meta.acceptedTitle,
      `وافقت ${responderName} على ربط حسابك، وأصبحت ${meta.relation}.`,
      row.id,
    );
  } else {
    createNotification(
      row.mother_id,
      meta.rejectedType,
      meta.rejectedTitle,
      `لم توافق ${responderName} على طلب الربط. يمكنك إدخال كود آخر.`,
      row.id,
    );
  }
  return { row };
}
