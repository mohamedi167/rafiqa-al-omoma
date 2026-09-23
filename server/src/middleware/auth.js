import jwt from 'jsonwebtoken';
import { get } from '../db.js';
import { JWT_SECRET, JWT_TTL } from '../config.js';

export { JWT_SECRET };

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, {
    expiresIn: JWT_TTL,
    algorithm: 'HS256',
  });
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const user = get('SELECT id, name, email, role, phone, organization, speciality, code FROM users WHERE id = ?', payload.id);
    if (!user) return res.status(401).json({ error: 'المستخدم غير موجود' });
    if (payload.role && payload.role !== user.role) {
      return res.status(401).json({ error: 'جلسة غير صالحة، سجّلي الدخول من جديد' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'جلسة غير صالحة، سجّلي الدخول من جديد' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول لهذا الإجراء' });
    }
    next();
  };
}
