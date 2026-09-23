// عقل المساعد: مطابقة أسئلة الأم بذكاء على موسوعة طبية واسعة،
// وإذا كان السؤال خارج التغطية يبني إجابة تفكيرية (تعاطف + مبدأ + نقاط + سؤال توضيحي + تحذير).
// ملاحظة: هذه إجابات توعوية ولا تغني عن استشارة الطبيب.

import {
  DOMAIN_GUIDE,
  ENCYCLOPEDIA,
  stemAr,
  tokenizeStem,
} from '../data/medicalEncyclopedia.js';

// كلمات مفتاحية لتصنيف المجال (تفكير عام).
const DOMAIN_KEYWORDS = {
  pregnancy: ['حمل', 'حامل', 'جنين', 'اسبوع الحمل', 'مخاض', 'ولاده', 'طلق', 'وحام', 'شهور الحمل'],
  postpartum: ['نفاس', 'بعد الولاده', 'قيصري', 'طبيعى', 'خياطه', 'جرح الولاده', 'اربعين', 'رباط'],
  breastfeeding: ['رضاعه', 'ترضع', 'حلمه', 'ثدى', 'ثدي', 'لبن', 'حليب', 'شفط', 'فطام', 'مضخه'],
  nutrition: ['اكل', 'غذاء', 'تغذيه', 'فيتامين', 'حديد', 'كالسيوم', 'بروتين', 'سعرات', 'دايت', 'مسموح', 'ممنوع', 'سمك', 'كحول', 'كافيين'],
  child_nutrition: ['اكل الطفل', 'طعام تكميلي', 'وجبات الطفل', 'فطام', 'وصفات', 'عصير', 'حلوى'],
  child_symptom: ['حراره', 'سخونه', 'كحه', 'برد', 'زكام', 'رشح', 'اسهال', 'قيء', 'ترجيع', 'مغص', 'طفح', 'حبوب', 'تنفس', 'اذن', 'تشنج', 'جفاف', 'شرقه'],
  child_development: ['نمو', 'مشي', 'كلام', 'جلوس', 'معالم', 'زحف', 'تسنين', 'اسنان', 'وزن', 'طول', 'محيط', 'راس', 'صدر', 'تطور'],
  sleep: ['نوم', 'ينام', 'سهر', 'ارق', 'موت المهد', 'وساده'],
  vaccines: ['تطعيم', 'تطعيمات', 'لقاح', 'جرعه', 'تحصين'],
  medication: ['دواء', 'علاج', 'مسكن', 'مضاد حيوي', 'باراسيتامول', 'بروفين', 'تحاميل', 'قطره', 'كريم'],
  mother_health: ['تعب', 'صداع', 'دوخه', 'الم', 'انيميا', 'ضغط', 'سكر', 'غده', 'شحوب', 'تورم', 'خفقان'],
  mental_health: ['اكتئاب', 'قلق', 'نفسيه', 'حزن', 'تعب نفسي', 'توتر'],
  hygiene: ['نظافه', 'حمام', 'حفاض', 'بشره', 'جلد', 'حبل سري', 'فطار', 'صفار', 'قشره'],
  child_behavior: ['سلوك', 'عناد', 'عصبيه', 'شاشات', 'زعل', 'خوف', 'نومه', 'هدوء', 'موبايل', 'تابلت', 'تليفون', 'عض', 'بيضرب', 'عدوان', 'صراخ', 'نوبات غضب'],
};

// نقاط تفكير عامة لكل مجال تُستخدم لو مفيش مدخل مطابق بثقة كافية.
const DOMAIN_REASONING = {
  pregnancy: [
    'قوليلي الأسبوع وقولي الأعراض بالتفصيل (النوع، الشدة، من إمتى).',
    'اشربي سوائل كافية وارتاحي، وابعدي عن أي دواء من غير استشارة.',
    'أي نزيف أو نزول ماء أو ألم شديد = طوارئ فورًا.',
  ],
  postpartum: [
    'مهم: الراحة والتغذية والسوائل ومتابعة النزيف والحرارة.',
    'العناية بالجرح نظافة وجفاف، والمشي البسيط يساعد الدورة الدموية.',
    'أي حرارة أو احمرار بالجرح أو نزيف غزير يحتاج تقييم.',
  ],
  breastfeeding: [
    'أهم حاجة: الالتصاق الصحيح والرضاعة عند الطلب ليل ونهار.',
    'لو ألم أو كتلة: كمادات وتفريغ الصدر، وانتظمي.',
    'حرارة مع احمرار وكتلة = احتمال التهاب ثدي يحتاج طبيبة.',
  ],
  nutrition: [
    'التوازن أهم من المنع: بروتين وخضار وفواكه وحبوب كاملة وسوائل.',
    'المصادر الخطرة بس اللي تنمنع (نيء/غير مبستر/عالية الزئبق/كحول).',
    'أي مكمل بجرعة الطبيبة حسب حالتك وتحاليلك.',
  ],
  child_nutrition: [
    'اللبن الأساس لحد 6 شهور، وبعدها طعام تكميلي تدريجي.',
    'صنف جديد كل 3-4 أيام لمتابعة الحساسية، وبدون ملح/سكر/عسل قبل السنة.',
    'رفض الأكل مع نقص الوزن أو شرقة متكررة = تقييم طبيب.',
  ],
  child_symptom: [
    'المهم أراجع 4 حاجات: الرضاعة، البول، النشاط/اليقظة، والتنفس.',
    'العمر مهم جدًا: أقل من 3 شهور أي عرض يحتاج تقييم أسرع.',
    'بدون أدوية من نفسك، خصوصًا مضادات حيوية أو أدوية كحة للأطفال الصغار.',
  ],
  child_development: [
    'كل طفل يختلف، وثبات المهارة واستمرار تطورها مهم.',
    'شجعي اللعب والحركة والكلام والتفاعل اليومي.',
    'فقدان مهارة سابقة أو تأخر واضح = تقييم نمو.',
  ],
  sleep: [
    'الأمان أهم من المدة: على الظهر، سطح ثابت، بدون وسائد.',
    'روتين ثابت قبل النوم وفرق واضح بين الليل والنهار.',
    'اضطراب تنفس أو خمول شديد = تقييم.',
  ],
  vaccines: [
    'الالتزام بالمواعيد بيحقق أقصى حماية، والتأخير مش يعني البدء من الأول غالبًا.',
    'حرارة/بكاء/تورم بسيط بعد التطعيم متوقع ويزول.',
    'لو حرارة عالية أو تورم واسع أو بكاء غير طبيعي: راجعي.',
  ],
  medication: [
    'الجرعة حسب الوزن والعمر، ويفضّل بوصفة طبيب—خصوصًا الحمل والرضاعة.',
    'ممنوع مشاركة أدوية الأطفال أو استخدام مضاد حيوي قديم.',
    'أي جرعة زائدة أو طفح/صعوبة تنفس = طوارئ فورًا.',
  ],
  mother_health: [
    'الأعراض المستمرة أو المتكررة محتاجة تحليل وتقييم مش مجرد صبر.',
    'سوائل وتغذية ونوم قدر الإمكان لحين التقييم.',
    'ألم صدر/ضيق نفس/صداع مفاجئ شديد = طوارئ.',
  ],
  mental_health: [
    'مش ضعف إرادة: ده حالة قابلة للعلاج، والمهم طلب دعم.',
    'تكلمي مع شخص تثقين فيه، ونامي واتغذي قدر الإمكان.',
    'أفكار إيذاء نفسك أو طفلك = مساعدة فورية.',
  ],
  hygiene: [
    'نظافة لطيفة وتجفيف كويس وتغيير الحفاض بسرعة.',
    'لبس قطني وتجنب المستحضرات المعطرة بكثرة.',
    'صديد أو رائحة أو تورم أو حرارة = تقييم.',
  ],
  child_behavior: [
    'السلوك غالبًا إشارة لاحتياج: نوم، جوع، اهتمام، انزعاج.',
    'الهدوء والحسم الرقيق والروتين أفضل من الصراع والعنف.',
    'تراجع بالمهارات أو عدوانية شديدة = تقييم.',
  ],
  general: [
    'قوليلي: مين المعني بالأمر وعمره، والأعراض/السؤال بالظبط، ومن إمتى.',
    'وأي تفاصيل تانية زي الحرارة، الرضاعة، البول، النشاط، أو أي دواء بياخده.',
    'كل ما توصفيلي أدق، أقدر أساعدك أدق.',
  ],
};

function scoreEntry(entry, textStem, tokens) {
  let score = 0;
  for (const kw of entry.keywords || []) {
    const k = stemAr(kw.trim());
    if (k.length < 3) continue;
    if (textStem.includes(k)) score += k.length >= 9 ? 5 : k.length >= 6 ? 4 : 3;
  }
  const kwTokens = new Set((entry.keywords || []).flatMap((k) => tokenizeStem(k)));
  let overlap = 0;
  for (const tok of tokens) {
    if (kwTokens.has(tok)) overlap += 1;
  }
  score += overlap * 1.5;
  return score;
}

export function detectDomain(message) {
  const t = stemAr(message);
  let best = 'general';
  let bestScore = 0;
  for (const [domain, words] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const w of words) {
      const n = stemAr(w);
      if (n.length >= 3 && t.includes(n)) score += n.length >= 6 ? 3 : 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  }
  return { domain: best, score: bestScore };
}

export function searchEncyclopedia(message, context = {}) {
  const textStem = stemAr(message);
  const tokens = tokenizeStem(message);
  let best = null;
  let bestScore = 0;
  let secondScore = 0;

  for (const entry of ENCYCLOPEDIA) {
    let score = scoreEntry(entry, textStem, tokens);
    // تفضيل المدخل حسب المعني: الأم أم الطفل
    if (context.subject && entry.subject && entry.subject !== 'both') {
      if (context.subject === entry.subject) score += 1.5;
      else score -= 1.5;
    }
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      best = entry;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  const margin = bestScore - secondScore;
  let confidence = 'none';
  if (bestScore >= 12 && margin >= 2) confidence = 'high';
  else if (bestScore >= 7 && margin >= 1.5) confidence = 'medium';
  else if (bestScore >= 3) confidence = 'low';
  return { entry: best, score: bestScore, margin, confidence };
}

function renderEntry(entry, { personLabel } = {}) {
  const parts = [entry.intro];
  if (entry.points?.length) {
    parts.push(`الخطوات العملية:\n${entry.points.map((p, i) => `${i + 1}) ${p}`).join('\n')}`);
  }
  if (entry.avoid?.length) {
    parts.push(`تجنّبي:\n${entry.avoid.map((a) => `- ${a}`).join('\n')}`);
  }
  if (entry.whenToSee?.length) {
    const who = personLabel ? `لو ${personLabel} ` : '';
    parts.push(`راجعي الطبيب ${who}فورًا لو ظهر:\n${entry.whenToSee.map((w) => `- ${w}`).join('\n')}`);
  }
  parts.push('دي معلومات توعوية، ولا تغني عن استشارة طبيبتك.');
  return parts.join('\n\n');
}

const DOMAIN_SUBJECT = {
  pregnancy: 'mother',
  postpartum: 'mother',
  breastfeeding: 'mother',
  nutrition: 'mother',
  mother_health: 'mother',
  mental_health: 'mother',
  child_nutrition: 'child',
  child_symptom: 'child',
  child_development: 'child',
  child_behavior: 'child',
  sleep: 'child',
  hygiene: 'child',
};

// إجابة تفكيرية مركّبة لما السؤال يخرج عن التغطية أو تكون الثقة منخفضة.
export function reasonAbout({ message, context = {}, domainInfo, weakEntry = null }) {
  const domain = domainInfo?.domain && domainInfo.domain !== 'general' ? domainInfo.domain : 'general';
  const guide = DOMAIN_GUIDE[domain] || DOMAIN_GUIDE.general;
  const reasoning = DOMAIN_REASONING[domain] || DOMAIN_REASONING.general;
  const subject = context.subject || DOMAIN_SUBJECT[domain] || null;

  let who = 'سؤالك';
  if (subject === 'child') {
    who = context.personLabel ? `بخصوص ${context.personLabel}` : 'سؤالك عن طفلك';
  }

  const parts = [];
  parts.push(`${who} مهم، وخليني أفهمه معاكي خطوة خطوة.`);

  // نعرض مدخلًا قريبًا فقط لو فعلاً قريب من نفس الموضوع، وبلغة غير جازمة.
  const weakRelevant =
    weakEntry &&
    (weakEntry.domain === domain ||
      (subject && weakEntry.subject === subject)) &&
    weakEntry.domain !== 'general';

  if (weakRelevant) {
    parts.push(renderEntry(weakEntry));
  } else {
    parts.push(`في موضوع ${guide.label}: ${guide.principle}`);
    parts.push(`نقاط تساعدك دلوقتي:\n${reasoning.map((p, i) => `${i + 1}) ${p}`).join('\n')}`);
  }

  parts.push(`عشان أقدر أجاوبك بدقة أكتر: ${guide.ask}`);

  const flags = guide.redFlags || [];
  if (flags.length) {
    parts.push(`خلي بالك، أي حاجة من دي تحتاج طبيب فورًا:\n${flags.map((f) => `- ${f}`).join('\n')}`);
  }
  parts.push('معلومة توعوية مش تشخيص، ولو عايزة تأكيد كلمي طبيبتك المتابعة.');
  return parts.join('\n\n');
}

// الواجهة الرئيسية: ترجع نص الإجابة أو null.
export function answerFromEncyclopedia(message, context = {}) {
  const result = searchEncyclopedia(message, context);
  const domainInfo = detectDomain(message);

  if (result.entry && (result.confidence === 'high' || result.confidence === 'medium')) {
    return { answer: renderEntry(result.entry, { personLabel: context.personLabel }), source: 'encyclopedia', entryId: result.entry.id };
  }

  // ثقة منخفضة أو مفيش مطابقة: نبني إجابة تفكيرية بدل ما نقول مش عارف.
  return {
    answer: reasonAbout({ message, context, domainInfo, weakEntry: result.confidence === 'low' ? result.entry : null }),
    source: result.confidence === 'low' ? 'encyclopedia-reasoned' : 'reasoned',
    entryId: result.entry?.id || null,
  };
}

export { ENCYCLOPEDIA };
