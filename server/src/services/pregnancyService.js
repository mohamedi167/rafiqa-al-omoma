import { PREGNANCY_MONTHS, PREGNANCY_WEEK_TIPS, getMonthForWeek } from '../data/pregnancyContent.js';

const DAY = 1000 * 60 * 60 * 24;

export function computePregnancy(lmpDate, now = new Date()) {
  if (!lmpDate) return null;
  const lmp = new Date(lmpDate);
  if (Number.isNaN(lmp.getTime())) return null;
  const due = new Date(lmp.getTime() + 280 * DAY);
  const daysPregnant = Math.floor((now.getTime() - lmp.getTime()) / DAY);
  const week = Math.min(40, Math.max(1, Math.floor(daysPregnant / 7) + 1));
  const month = getMonthForWeek(week);
  const daysLeft = Math.max(0, Math.ceil((due.getTime() - now.getTime()) / DAY));
  const trimester = week <= 13 ? 1 : week <= 27 ? 2 : 3;
  return {
    week,
    month,
    trimester,
    dueDate: due.toISOString().slice(0, 10),
    daysLeft,
    progress: Math.min(100, Math.round((daysPregnant / 280) * 100)),
  };
}

export function getWeeklyPregnancyContent(week) {
  const month = getMonthForWeek(week);
  const monthData = PREGNANCY_MONTHS.find((m) => m.month === month) || PREGNANCY_MONTHS[0];
  return {
    ...monthData,
    week,
    weekTip: PREGNANCY_WEEK_TIPS[week] || '',
  };
}

export { PREGNANCY_MONTHS, PREGNANCY_WEEK_TIPS };
