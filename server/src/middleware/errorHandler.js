import crypto from 'node:crypto';
import { logger } from '../logger.js';
import { isProduction } from '../config.js';

export function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

// يلتقط أخطاء الدوال غير المتزامنة ويمرّرها لمعالج الأخطاء.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'المسار غير موجود' });
}

export function errorHandler(err, req, res, _next) {
  const status = Number(err?.status || err?.statusCode) || 500;

  // أخطاء معروفة من محلّل الجسم
  let clientStatus = status;
  let clientError = 'حدث خطأ غير متوقع في الخادم، حاولي مرة أخرى.';
  if (err?.type === 'entity.too.large') {
    clientStatus = 413;
    clientError = 'حجم البيانات كبير جدًا.';
  } else if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    clientStatus = 400;
    clientError = 'صيغة الطلب غير صحيحة.';
  } else if (status === 403) {
    clientStatus = 403;
    clientError = 'لا تملك صلاحية تنفيذ هذا الإجراء.';
  }

  logger.error('unhandled_error', {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    status: clientStatus,
    err: { name: err?.name, message: err?.message, stack: err?.stack },
  });

  res.status(clientStatus).json({
    error: clientError,
    requestId: req.id,
    ...(isProduction ? {} : {}),
  });
}

export function registerProcessHandlers() {
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled_rejection', reason instanceof Error ? reason : { reason });
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaught_exception', err);
    // لا نُسقط العملية في التطوير؛ في الإنتاج يُفضّل إعادة التشغيل المُدار.
  });
}
