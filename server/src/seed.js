import bcrypt from 'bcryptjs';
import { db, get, run, uniqueUserCode } from './db.js';
import { ensureVaccinationRows } from './services/vaccineService.js';
import { assessGrowth } from './services/growthService.js';
import { computePregnancy } from './services/pregnancyService.js';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export function seed({ force = false } = {}) {
  const existing = get('SELECT COUNT(*) AS c FROM users').c;
  if (existing > 0 && !force) return false;
  if (force) {
    for (const table of ['chat_messages', 'notifications', 'growth_records', 'child_vaccinations', 'symptoms', 'pregnancy_logs', 'children', 'mother_profiles', 'users']) {
      db.exec(`DELETE FROM ${table};`);
    }
  }

  const hash = (p) => bcrypt.hashSync(p, 10);

  const doctorId = Number(
    run(
      "INSERT INTO users (name, email, password_hash, role, phone, organization, speciality, code) VALUES (?, ?, ?, 'doctor', ?, ?, ?, ?)",
      'د. هالة محمود',
      'doctor@rafiqa.com',
      hash('123456'),
      '01000000001',
      'مركز صحة الأم والطفل',
      'أخصائية نساء وتوليد',
      uniqueUserCode('DOC'),
    ).lastInsertRowid,
  );
  const unitId = Number(
    run(
      "INSERT INTO users (name, email, password_hash, role, phone, organization, code) VALUES (?, ?, ?, 'health_unit', ?, ?, ?)",
      'وحدة صحة الأسرة - المنيب',
      'unit@rafiqa.com',
      hash('123456'),
      '01000000002',
      'وزارة الصحة والسكان',
      uniqueUserCode('UNIT'),
    ).lastInsertRowid,
  );

  // أم حامل
  const pregnantId = Number(
    run(
      "INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, 'mother', ?)",
      'سارة أحمد',
      'pregnant@rafiqa.com',
      hash('123456'),
      '01000000003',
    ).lastInsertRowid,
  );
  const lmp = daysAgo(154); // ~22 أسبوع
  run(
    "INSERT INTO mother_profiles (user_id, doctor_id, health_unit_id, lmp_date, due_date, pregnancy_status) VALUES (?, ?, ?, ?, ?, 'pregnant')",
    pregnantId,
    doctorId,
    unitId,
    lmp,
    computePregnancy(lmp)?.dueDate || null,
  );
  run(
    'INSERT INTO pregnancy_logs (mother_id, month, gestational_week, notes) VALUES (?, ?, ?, ?)',
    pregnantId,
    5,
    22,
    'أشعر بتحسن في الغثيان وحركة الجنين بدأت تظهر.',
  );
  run(
    'INSERT INTO symptoms (mother_id, text, severity, advice, reasoning, doctor_notified, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
    pregnantId,
    'حاسة بدوخة خفيفة الصبح',
    'normal',
    'غالبًا هذا عرض طبيعي في الحمل. ارتاحي واشربي ماء كافيًا وتابعي أي تغير.',
    'عرض حمل شائع وبسيط.',
    isoDaysAgo(3),
  );

  // أم لديها طفل
  const motherId = Number(
    run(
      "INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, 'mother', ?)",
      'منى إبراهيم',
      'mother@rafiqa.com',
      hash('123456'),
      '01000000004',
    ).lastInsertRowid,
  );
  run(
    "INSERT INTO mother_profiles (user_id, doctor_id, health_unit_id, pregnancy_status) VALUES (?, ?, ?, 'postpartum')",
    motherId,
    doctorId,
    unitId,
  );
  const childId = Number(
    run(
      'INSERT INTO children (mother_id, name, birth_date, gender) VALUES (?, ?, ?, ?)',
      motherId,
      'يوسف',
      daysAgo(95),
      'male',
    ).lastInsertRowid,
  );
  ensureVaccinationRows(childId);

  // الطفل عمره ~3 شهور: تطعيم الولادة مؤكد، والشهرين قيد التأكيد
  run(
    "UPDATE child_vaccinations SET status='confirmed', mother_marked_at=?, confirmed_at=?, confirmed_by=? WHERE child_id=? AND group_key='birth'",
    isoDaysAgo(95),
    isoDaysAgo(94),
    unitId,
    childId,
  );
  run(
    "UPDATE child_vaccinations SET status='pending', mother_marked_at=? WHERE child_id=? AND group_key='2m'",
    isoDaysAgo(2),
    childId,
  );

  const growthSamples = [
    { age: 0.5, w: 3.6, h: 50.5, hc: 35.0 },
    { age: 1.5, w: 4.8, h: 54.8, hc: 37.5 },
    { age: 2.5, w: 5.9, h: 58.6, hc: 39.2 },
  ];
  for (const s of growthSamples) {
    const birth = new Date(daysAgo(95));
    const at = new Date(birth.getTime() + s.age * 30.4375 * 24 * 60 * 60 * 1000);
    const assessment = assessGrowth('male', s.age, { weight: s.w, height: s.h, head: s.hc });
    run(
      'INSERT INTO growth_records (child_id, weight, height, head, age_months_at_record, assessment, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      childId,
      s.w,
      s.h,
      s.hc,
      s.age,
      JSON.stringify(assessment),
      at.toISOString(),
    );
  }

  return { doctorId, unitId, pregnantId, motherId, childId };
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isDirectRun) {
  const force = process.argv.includes('--force');
  const result = seed({ force });
  console.log(result ? 'تم إنشاء بيانات التجربة بنجاح' : 'البيانات موجودة بالفعل (استخدم --force لإعادة الإنشاء)');
  if (result) {
    console.log('حسابات التجربة:');
    console.log('  طبيبة: doctor@rafiqa.com / 123456');
    console.log('  وحدة صحية: unit@rafiqa.com / 123456');
    console.log('  أم حامل: pregnant@rafiqa.com / 123456');
    console.log('  أم لديها طفل: mother@rafiqa.com / 123456');
  }
}
