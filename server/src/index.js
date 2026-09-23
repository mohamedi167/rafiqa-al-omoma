import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './db.js';
import { seed } from './seed.js';
import { get } from './db.js';
import {
  BODY_LIMIT,
  CORS_ORIGINS,
  DEV_ORIGIN_PATTERNS,
  SSL_KEY_PATH,
  SSL_CERT_PATH,
  TRUST_PROXY,
} from './config.js';
import { logger, requestLogger } from './logger.js';
import { securityHeaders, blockSensitivePaths, forceHttps } from './middleware/security.js';
import { sanitizeBody } from './middleware/validate.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { requestId, errorHandler, notFoundHandler, registerProcessHandlers } from './middleware/errorHandler.js';
import { startMedicationScheduler } from './services/medicationService.js';
import { llmProvider } from './services/aiService.js';

import authRoutes from './routes/auth.js';
import motherRoutes from './routes/mothers.js';
import childRoutes from './routes/children.js';
import symptomRoutes from './routes/symptoms.js';
import vaccinationRoutes from './routes/vaccinations.js';
import growthRoutes from './routes/growth.js';
import aiRoutes from './routes/ai.js';
import notificationRoutes from './routes/notifications.js';
import doctorRoutes from './routes/doctor.js';
import healthUnitRoutes from './routes/healthUnit.js';
import medicationRoutes from './routes/medications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
if (TRUST_PROXY) app.set('trust proxy', 1);

app.use(requestId);
app.use(securityHeaders);
app.use(blockSensitivePaths);
app.use(forceHttps);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // طلبات نفس الأصل أو أدوات سطر الأوامر
    if (CORS_ORIGINS.includes(origin)) return callback(null, true);
    if (DEV_ORIGIN_PATTERNS.some((re) => re.test(origin))) return callback(null, true);
    return callback(null, false); // نرفض المنشأ بدون كسر الطلب
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'Retry-After'],
  credentials: false,
  maxAge: 600,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: BODY_LIMIT, strict: true }));
app.use(sanitizeBody);
app.use(requestLogger);

const allowSeed = process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO === 'true';
if (allowSeed && get('SELECT COUNT(*) AS c FROM users').c === 0) {
  seed();
  logger.info('تم تهيئة قاعدة البيانات ببيانات تجريبية.');
} else if (!allowSeed) {
  logger.info('تم تخطي البيانات التجريبية في بيئة الإنتاج (SEED_DEMO غير مفعّل).');
}

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, app: 'رفيقة الأمومة', ai: llmProvider(), engine: 'encyclopedia+reasoning' }),
);

app.use('/api', generalLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/mothers', motherRoutes);
app.use('/api/children', childRoutes);
app.use('/api/symptoms', symptomRoutes);
app.use('/api/vaccinations', vaccinationRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/health-units', healthUnitRoutes);
app.use('/api/medications', medicationRoutes);

app.use('/api', notFoundHandler);

const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  // تقديم ملفات الواجهة بدون عرض محتويات المجلدات أو ملفات النقطة.
  app.use(
    express.static(clientDist, {
      dotfiles: 'deny',
      index: false,
      fallthrough: true,
      etag: true,
      setHeaders(res, filePath) {
        if (/[.-][0-9a-f]{8,}\.(js|css)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => (err ? next(err) : undefined));
  });
}

app.use(errorHandler);

registerProcessHandlers();

function start() {
  const hasTls = SSL_KEY_PATH && SSL_CERT_PATH && fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH);
  if (hasTls) {
    const credentials = { key: fs.readFileSync(SSL_KEY_PATH), cert: fs.readFileSync(SSL_CERT_PATH) };
    https.createServer(credentials, app).listen(PORT, () => {
      logger.info(`رفيقة الأمومة تعمل عبر HTTPS على المنفذ ${PORT}`);
      startMedicationScheduler();
    });
  } else {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('HTTPS غير مُفعّل: لم يتم العثور على شهادة SSL. يُوصى بضبط SSL_KEY_PATH و SSL_CERT_PATH.');
    }
    http.createServer(app).listen(PORT, () => {
      logger.info(`رفيقة الأمومة تعمل على المنفذ ${PORT}`);
      startMedicationScheduler();
    });
  }
}

start();
