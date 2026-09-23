// محرّك المساعد الطبي التوعوي: يفهم وصف الأم، يحدد إن كان الموضوع لها أم لطفلها،
// يطرح أسئلة توضيحية متابعة عند نقص المعلومات، ثم يعطي تقييمًا ونصيحة عملية.
// تنبيه: محتوى توعوي لا يغني عن استشارة الطبيب.

import {
  CATEGORIES,
  GLOBAL_RED_FLAGS,
  INTENSIFIERS,
  MILD_HINTS,
  SUBJECT_HINTS,
  normalize,
} from '../data/medicalKnowledge.js';
import { searchEncyclopedia } from './assistantBrain.js';

const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

const MARKER_RE = /\s*\[\[MS:[\s\S]*?\]\]\s*/g;

export function stripMarkers(text) {
  return String(text || '').replace(MARKER_RE, ' ').trim();
}

export function buildMarker(state) {
  return `[[MS:${JSON.stringify(state)}]]`;
}

function parseTs(value) {
  if (!value) return null;
  const s = String(value);
  const iso = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function lastMarker(history) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const m = history[i];
    if (m.role !== 'assistant') continue;
    const match = String(m.content).match(/\[\[MS:([\s\S]*?)\]\]/);
    if (match) {
      try {
        const state = JSON.parse(match[1]);
        const ts = parseTs(m.created_at);
        if (ts !== null) state._ts = ts;
        return state;
      } catch {
        return null;
      }
    }
  }
  return null;
}

// صلاحية استكمال المحادثة: 45 دقيقة. بعدها نتعامل مع الرسالة كموضوع جديد
// حتى لا "تخطف" حالة قديمة متروكة أي استشارة جديدة.
const CONTINUATION_TTL_MS = 45 * 60 * 1000;

function isFreshMarker(marker) {
  if (!marker) return false;
  if (!marker._ts) return true;
  return Date.now() - marker._ts <= CONTINUATION_TTL_MS;
}

function hasAny(t, list) {
  return list.some((k) => t.includes(normalize(k)));
}

// إزالة النفي حتى لا تُحتسب أعراض منفوّة (مثال: "مفيش نزيف" أو "مفيش حرارة")
function stripNegations(text) {
  return String(text || '')
    .replace(
      /(مفيش|مافيش|ما فيش|مش فيه|مش عندي|لا يوجد|من غير|بدون)(?:\s+(?!لكن|بس|بعدين|وفيه|ومعاه|معاه|عندي|كمان)[^\s.,،!؟]+)+/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function contextChild(text, context) {
  const children = context?.children || [];
  if (!children.length) return null;
  const t = normalize(text);
  return children.find((c) => t.includes(normalize(c.name))) || null;
}

// للعرض فقط: لو الطفل مذكور باسمه، أو فيه طفل واحد مسجّل
function labelChild(text, context) {
  const named = contextChild(text, context);
  if (named) return named;
  const children = context?.children || [];
  return children.length === 1 ? children[0] : null;
}

export function detectSubject(text, context) {
  const t = normalize(text);
  if (hasAny(t, SUBJECT_HINTS.child)) return 'child';
  if (contextChild(text, context)) return 'child';
  if (hasAny(t, ['بيعيط', 'بتعيط', 'بيرضع', 'بيتبول', 'بيتغوط', 'بيرجع', 'بيكح', 'بينام', 'بيشد', 'بيسيل', 'بيعمل', 'بيحط'])) {
    return 'child';
  }
  if (hasAny(t, SUBJECT_HINTS.mother)) return 'mother';
  return null;
}

function detectCategory(text, subject) {
  const t = normalize(text);
  let best = null;
  let bestScore = 0;
  let bestMatchLen = 0;
  let bestSubject = null;
  let rivalDifferentSubject = null;
  for (const cat of CATEGORIES) {
    if (subject && cat.subject !== subject) continue;
    let score = 0;
    let matchLen = 0;
    for (const kw of cat.keywords) {
      const n = normalize(kw);
      if (t.includes(n)) {
        score += n.length > 3 ? 2 : 1;
        matchLen += n.length;
      }
    }
    if (score <= 0) continue;
    if (score > bestScore || (score === bestScore && matchLen > bestMatchLen)) {
      bestScore = score;
      bestMatchLen = matchLen;
      best = cat;
      bestSubject = cat.subject;
      rivalDifferentSubject = null;
    } else if (score === bestScore && cat.subject !== bestSubject) {
      rivalDifferentSubject = cat;
    }
  }
  return { best, bestScore, rivalDifferentSubject };
}

const ARABIC_NUM = {
  واحد: 1, واحدة: 1, اثنين: 2, اتنين: 2, ثلاث: 3, ثلاثة: 3, تلاتة: 3, تلاته: 3,
  اربع: 4, اربعة: 4, اربعه: 4, خمس: 5, خمسة: 5, خمسه: 5, ست: 6, ستة: 6,
  سبع: 7, سبعة: 7, سبعه: 7, ثمان: 8, تمان: 8, تمانية: 8, تسع: 9, تسعة: 9,
  عشر: 10, عشرة: 10, عشرين: 20, شهرين: 2, سنتين: 2, اسبوعين: 2,
};

function parseAgeMonths(text) {
  const t = normalize(text);
  const unitRe = /(\d+|واحد|واحدة|اثنين|اتنين|ثلاث|ثلاثة|تلاتة|تلاته|اربع|اربعة|اربعه|خمس|خمسة|خمسه|ست|ستة|سبع|سبعة|سبعه|ثمان|تمان|تمانية|تسع|تسعة|عشر|عشرة|عشرين|شهرين|سنتين|اسبوعين)\s*(شهور|شهر|سنه|سنة|سنين|اسبوع|اسابيع|اكمن شهر|اكمن اسبوع)?/;
  const match = t.match(unitRe);
  if (!match) return null;
  const rawNum = match[1];
  const num = /^\d+$/.test(rawNum) ? Number(rawNum) : ARABIC_NUM[rawNum];
  if (!num) return null;
  const rest = t.slice(match.index);
  if (/(سنه|سنة|سنين|سنتين)/.test(rest) || rawNum === 'سنتين') return num * 12;
  if (/(اسبوع|اسابيع|اسبوعين)/.test(rest) || rawNum === 'اسبوعين') return Math.round((num / 4.345) * 10) / 10;
  if (/(شهور|شهر|شهرين)/.test(rest) || rawNum === 'شهرين') return num;
  return num; // افتراضيًا شهور
}

function ageFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()) + (now.getDate() - birth.getDate()) / 30.4375;
}

function severityFromText(combined, category) {
  const redFlags = [...GLOBAL_RED_FLAGS, ...(category?.redFlags || [])];
  const moderate = [...(category?.moderate || []), 'حرارة', 'سخونة', 'قيء', 'ترجيع', 'اسهال', 'مش بيرضع', 'رفض الرضاعه', 'جفاف', 'قله بول', 'خمول', 'طفح'];
  const mild = [...(category?.mild || [])];
  const strong = /لا يطاق|مش محتمل|مش قادر|مش قادرة|طول اليوم|بلا توقف|من امبارح/.test(combined);
  if (hasAny(combined, redFlags)) return 'critical';
  const intense = hasAny(combined, INTENSIFIERS);
  if (hasAny(combined, moderate)) return strong ? 'critical' : 'moderate';
  if (hasAny(combined, mild)) return intense ? 'moderate' : 'normal';
  if (hasAny(combined, MILD_HINTS)) return 'normal';
  return intense ? 'moderate' : 'normal';
}

const SEV_LABEL = {
  normal: 'بسيطة — تطمني بالعافية',
  moderate: 'تحتاج متابعة وانتباه',
  critical: 'علامة تحتاج تدخلًا طبيًا عاجلًا',
};

function bulletList(items) {
  return items.map((x, i) => `${i + 1}) ${x}`).join('\n');
}

function finalAdvice({ category, severity, personLabel, ageMonths, weekNote }) {
  const parts = [];
  parts.push(category.empathy);
  if (weekNote) parts.push(weekNote);
  parts.push(`التقييم: ${SEV_LABEL[severity]}.`);
  parts.push(category.explanation);
  if (category.homeCare?.length) {
    const header = personLabel ? `اللي تعمليه لـ ${personLabel} دلوقتي:` : 'اللي تعمليه دلوقتي:';
    parts.push(`${header}\n${bulletList(category.homeCare)}`);
  }
  if (category.watchFor?.length) {
    parts.push(`خلي بالك من العلامات دي وحالًا للطبيب لو ظهرت:\n${category.watchFor.map((x) => `- ${x}`).join('\n')}`);
  }
  if (severity === 'critical') {
    parts.push(`مهم جدًا: ${category.seeDoctor}`);
  } else if (severity === 'moderate') {
    parts.push(`متى تراجعي الطبيب: ${category.seeDoctor}`);
  } else {
    parts.push(`لو استمرت أو زادت: ${category.seeDoctor}`);
  }
  if (ageMonths !== null && ageMonths < 3 && category.subject === 'child') {
    parts.push('تنبيه مهم: عمر طفلك أقل من 3 شهور، وأي عرض بسيط في العمر ده يُفضّل عرضه على طبيب الأطفال.');
  }
  parts.push('إحنا معاكي، ومش لوحدك. دي معلومات توعوية، ولو حابة أطمنك أكتر راجعي طبيبتك المتابعة.');
  return parts.join('\n\n');
}

function greetingReply() {
  return 'وعليكم السلام ورحمة الله. أنا معاكي يا حبيبتي، اسأليني عن أي حاجة تخص حملك أو صحتك أو صحة طفلك، وأنا هسمعك وأفهم معاكي خطوة بخطوة.';
}

function isSmallTalk(t) {
  const words = ['سلام عليكم', 'السلام عليكم', 'اهلا', 'هاي', 'صباح الخير', 'مساء الخير', 'ازيك', 'عامله ايه', 'شكرا', 'متشكره', 'تسلمي', 'تمام', 'ماشي', 'طيب'];
  return words.some((w) => t.trim() === normalize(w) || (t.length <= 25 && t.includes(normalize(w))));
}

// أسئلة معلوماتية عامة (مش وصف عرض) نوجّهها لقاعدة المعرفة
export function isInfoQuestion(text) {
  const t = normalize(text);
  const question = ['ايه', 'ماهي', 'ما هي', 'ازاي', 'ليه', 'لماذا', 'هل ', 'ممكن', 'علامات', 'نصائح', 'افضل', 'أفضل', 'معلومات', 'معنى', 'تطعيم', 'لقاح', 'مواعيد', 'جدول', 'فوايد', 'فوائد', 'اهميه', 'أهمية', 'مميزات'];
  const personal = ['عندي', 'عندى', 'حاسس', 'حاسه', 'وجعاني', 'بيوجعني', 'بيعيط', 'بيرضع', 'بطني', 'طفلي', 'ابني', 'بنتي', 'عايزه', 'مش قادره', 'بحس'];
  return question.some((w) => t.includes(normalize(w))) && !personal.some((w) => t.includes(normalize(w)));
}

export function medicalReply({ message, history = [], context = {} }) {
  const rawText = stripMarkers(message);
  const text = stripNegations(rawText);
  const t = normalize(rawText);
  const marker = lastMarker(history);
  const midQuestion = Boolean(marker && isFreshMarker(marker) && typeof marker.f === 'number');

  if (isSmallTalk(t) && !detectCategory(text, detectSubject(text, context)).best) {
    return { reply: greetingReply(), severity: 'normal', kind: 'smalltalk', source: 'local', state: null };
  }

  let category = null;
  let asked = 0;

  // 1) أثناء استكمال أسئلة المتابعة: نبقى على نفس الموضوع،
  //    إلا لو ظهرت علامة خطر جديدة أو اتضح إن ده موضوع مختلف تمامًا.
  if (midQuestion && CATEGORY_BY_ID.has(marker.c)) {
    const markerCat = CATEGORY_BY_ID.get(marker.c);
    const normText = normalize(text);
    const markerOverlap = markerCat.keywords.some((kw) => normText.includes(normalize(kw)));
    const subj = detectSubject(text, context);
    const det = detectCategory(text, subj);
    const subjectChanged = Boolean(subj && subj !== markerCat.subject);

    const switchedTopic =
      subjectChanged &&
      det.best &&
      det.best.id !== markerCat.id &&
      det.best.subject === subj;

    let abandoned = false;
    if (!switchedTopic && !det.best && !markerOverlap && subjectChanged) {
      // مفيش أي تقاطع مع موضوع المتابعة، وفي نفس الوقت سؤال واضح لموسوعة تانية
      const enc = searchEncyclopedia(text, { subject: subj });
      if (enc.score >= 4 && enc.entry?.subject === subj) abandoned = true;
    }

    if (abandoned) return null;

    if (switchedTopic) {
      category = det.best;
      asked = 0;
    } else {
      const hasNewRedFlag = hasAny(normText, GLOBAL_RED_FLAGS);
      if (hasNewRedFlag && det.best) category = det.best;
      if (!category) {
        category = markerCat;
        asked = marker.f + 1;
      }
    }
  }

  // 2) بعد سؤال التوضيح (ليكِ ولا لطفلك؟)
  if (!category && marker?.c === 'clarify' && marker.q && isFreshMarker(marker)) {
    const combinedText = `${marker.q} ${text}`;
    const det = detectCategory(combinedText, detectSubject(combinedText, context));
    if (det.best) {
      category = det.best;
      asked = 0;
    }
  }

  // 3) موضوع جديد
  if (!category) {
    const subjectHint = detectSubject(text, context);
    const det = detectCategory(text, subjectHint);
    if (det.best) {
      if (!subjectHint && det.rivalDifferentSubject) {
        const q = 'عايزة أطمنك صح: الأعراض دي ليكِ إنتِ ولا لطفلك؟ وكمان قولي عمره أو عمرها كام لو لطفلك.';
        return {
          reply: `${det.best.empathy} ${q}`,
          severity: 'normal',
          kind: 'clarify',
          category: det.best.id,
          source: 'local',
          state: { c: 'clarify', f: 0, q: det.best.keywords[0] || '' },
        };
      }
      category = det.best;
      asked = 0;
    }
  }

  if (!category) return null;

  // جمع النصوص ذات الصلة لتقدير الشدة (رسائل الأم الأخيرة + الحالية)
  const recentUser = history
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => stripNegations(stripMarkers(m.content)));
  const combined = normalize([...recentUser, text].join(' '));

  const matchedChild = category.subject === 'child' ? labelChild(rawText, context) : null;
  let ageMonths = null;
  if (category.subject === 'child') {
    ageMonths = parseAgeMonths(rawText);
    if (ageMonths === null && matchedChild) ageMonths = ageFromBirthDate(matchedChild.birth_date);
  }

  let severity = severityFromText(combined, category);

  const weekNote =
    category.subject === 'mother' && context.pregnancyWeek
      ? `إنتِ حاليًا في الأسبوع ${context.pregnancyWeek} من الحمل، وده يساعدنا نقيّم الوضع بدقة أكتر.`
      : null;

  // حرارة الرضيع أقل من 3 شهور تعد علامة خطورة
  if (category.id === 'child_fever' && ageMonths !== null && ageMonths < 3 && severity !== 'critical') {
    severity = 'critical';
  }

  // العلامات الخطيرة: رد فوري بدون أسئلة
  if (severity === 'critical') {
    const personLabel = category.subject === 'child' ? matchedChild?.name : null;
    return {
      reply: finalAdvice({ category, severity, personLabel, ageMonths, weekNote }),
      severity,
      kind: 'advice',
      category: category.id,
      source: 'local',
      state: { c: category.id, f: 'final' },
    };
  }

  // طرح الأسئلة التوضيحية بالترتيب
  const followups = category.followups || [];
  if (asked < followups.length) {
    const intro = asked === 0
      ? `${category.empathy} هسألك كام سؤال بسيط عشان أفهم الموضوع صح:`
      : 'تمام، شكرًا لتوضيحك.';
    return {
      reply: `${intro}\n\n${followups[asked]}`,
      severity,
      kind: 'question',
      category: category.id,
      source: 'local',
      state: { c: category.id, f: asked },
    };
  }

  const personLabel = category.subject === 'child' ? matchedChild?.name : null;
  return {
    reply: finalAdvice({ category, severity, personLabel, ageMonths, weekNote }),
    severity,
    kind: 'advice',
    category: category.id,
    source: 'local',
    state: { c: category.id, f: 'final' },
  };
}

// يستخدمها مسار تسجيل الأعراض: يرجع شدة + نصيحة مختصرة
export function triageSymptom(text, context = {}) {
  const result = medicalReply({ message: text, history: [], context });
  if (!result) {
    return {
      severity: 'normal',
      advice: 'سجّلتِ العرض، وننصح بالمراقبة. لو زاد أو ظهرت علامات مقلقة راجعي طبيبتك.',
      reasoning: 'لا يوجد وصف واضح لعلامة خطر؛ يُنصح بالمراقبة.',
      source: 'local',
    };
  }
  const severity = result.severity;
  const adviceMap = {
    critical: 'هذه علامة تستدعي التدخل السريع. توجهي فورًا إلى أقرب وحدة صحية أو اتصلي بالإسعاف/طبيبتك.',
    moderate: 'راقبي الأعراض، وارتاحي واشربي سوائل كافية. إذا استمرت أو ساءت خلال 24 ساعة تواصلي مع طبيبتك.',
    normal: 'غالبًا هذا عرض بسيط. ارتاحي واشربي ماء كافيًا وتابعي أي تغير، وراجعي طبيبتك في المتابعة القادمة إن استمر.',
  };
  return {
    severity,
    advice: adviceMap[severity],
    reasoning: `تم تصنيف الوصف ضمن "${result.category || 'عرض عام'}" بدرجة ${severity}.`,
    source: result.source,
    category: result.category,
  };
}
