import { WHO_GROWTH, METRIC_LABELS, METRIC_UNITS } from '../data/whoGrowth.js';

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.4375;

export function ageInMonths(birthDate, at = new Date()) {
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  return Math.max(0, (at.getTime() - b.getTime()) / MS_PER_MONTH);
}

export function formatAge(months) {
  if (months == null) return '';
  const total = Math.floor(months);
  const years = Math.floor(total / 12);
  const rest = total % 12;
  if (years === 0) return `${rest} شهر`;
  if (rest === 0) return `${years} سنة`;
  return `${years} سنة و${rest} شهر`;
}

function interpolate(table, age) {
  const months = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  if (age <= months[0]) return table[months[0]];
  if (age >= months[months.length - 1]) return table[months[months.length - 1]];
  let lo = months[0];
  let hi = months[months.length - 1];
  for (let i = 0; i < months.length - 1; i += 1) {
    if (age >= months[i] && age <= months[i + 1]) {
      lo = months[i];
      hi = months[i + 1];
      break;
    }
  }
  const [m0, s0] = table[lo];
  const [m1, s1] = table[hi];
  const t = (age - lo) / (hi - lo);
  return [m0 + (m1 - m0) * t, s0 + (s1 - s0) * t];
}

const DIRECTION = {
  weight: { low: 'الوزن أقل من المتوقع لعمره ويحتاج تقييم تغذية.', high: 'الوزن أعلى من المتوقع لعمره؛ يُنصح بمراجعة التغذية.' },
  height: { low: 'الطول أقل من المتوقع لعمره؛ يُفضّل متابعة النمو.', high: 'الطول أعلى من المتوقع، وغالبًا لا يستدعي قلقًا.' },
  head: { low: 'محيط الرأس أقل من المتوقع؛ يحتاج مراجعة الطبيبة.', high: 'محيط الرأس أكبر من المتوقع؛ يُفضّل التقييم الطبي.' },
};

function classify(z) {
  if (z < -3 || z > 3) return 'severe';
  if (z < -2 || z > 2) return 'warning';
  return 'normal';
}

const STATUS_LABELS = { normal: 'طبيعي', warning: 'يحتاج متابعة', severe: 'يحتاج مراجعة عاجلة' };

export function assessGrowth(gender, ageMonths, values) {
  const sex = gender === 'female' ? 'female' : 'male';
  const metrics = [];
  for (const metric of ['weight', 'height', 'head']) {
    const value = values[metric];
    if (value == null || value === '' || Number.isNaN(Number(value))) continue;
    const table = WHO_GROWTH[sex][metric];
    const [median, sd] = interpolate(table, ageMonths);
    const z = (Number(value) - median) / sd;
    const status = classify(z);
    let message = 'القياس داخل النطاق الطبيعي وفق منحنيات منظمة الصحة العالمية.';
    if (status !== 'normal') {
      message = z < 0 ? DIRECTION[metric].low : DIRECTION[metric].high;
    }
    metrics.push({
      metric,
      metricLabel: METRIC_LABELS[metric],
      unit: METRIC_UNITS[metric],
      value: Number(value),
      median: Number(median.toFixed(2)),
      z: Number(z.toFixed(2)),
      status,
      statusLabel: STATUS_LABELS[status],
      message,
    });
  }
  const order = { normal: 0, warning: 1, severe: 2 };
  const overall = metrics.reduce((acc, m) => (order[m.status] > order[acc] ? m.status : acc), 'normal');
  const summary =
    overall === 'normal'
      ? 'النمو يبدو طبيعيًا'
      : overall === 'warning'
        ? 'هناك مؤشر يحتاج متابعة'
        : 'هناك مؤشر يحتاج مراجعة عاجلة';
  return {
    ageMonths: Number(ageMonths.toFixed(1)),
    metrics,
    overall,
    overallLabel: STATUS_LABELS[overall],
    summary,
  };
}
