import { get } from '../db.js';

export function canAccessChild(user, child) {
  if (!user || !child) return false;
  if (user.role === 'mother') return child.mother_id === user.id;
  const profile = get('SELECT doctor_id, health_unit_id FROM mother_profiles WHERE user_id = ?', child.mother_id);
  if (!profile) return false;
  if (user.role === 'doctor') return profile.doctor_id === user.id;
  if (user.role === 'health_unit') return profile.health_unit_id === user.id;
  return false;
}

export function getChildOr404(childId) {
  return get('SELECT * FROM children WHERE id = ?', childId);
}
