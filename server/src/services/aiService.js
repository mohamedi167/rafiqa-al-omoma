// خدمة الذكاء الاصطناعي: تحليل أعراض الأم عبر Claude API، مع محرّك تحليل محلي
// يعمل تلقائيًا عند عدم توفر مفتاح ANTHROPIC_API_KEY حتى لا تتعطل الميزة.

import { answerFromKnowledge } from '../data/knowledgeBase.js';
import {
  buildMarker,
  detectSubject,
  isInfoQuestion,
  medicalReply,
  stripMarkers,
  triageSymptom,
} from './medicalAssistant.js';
import { answerFromEncyclopedia } from './assistantBrain.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
const SYSTEM_PROMPT = `أنت "رفيقة الأمومة"، مساعد طبي توعوي متخصص في متابعة الحمل وصحة الأم والطفل.
مهمتك تحليل وصف الأم لإحساسها بالعربية وتحديد درجة الخطورة.
أعد ردًا بصيغة JSON فقط دون أي نص إضافي بالشكل التالي:
{"severity":"normal|moderate|critical","advice":"نصيحة عملية بالعربية الفصحى المبسطة","reasoning":"سبب التصنيف باختصار"}
القواعد:
- critical: أي علامة خطر كالنزيف، فقدان الوعي، تشنجات، صعوبة تنفس، ألم صدر، تورم مفاجئ بالوجه/اليدين، صداع شديد مع زغللة، انقطاع حركة الجنين، نزول ماء، تقلصات منتظمة قبل موعدها، حرارة عالية جدًا.
- moderate: أعراض تستحق المتابعة كالحرارة المتوسطة، القيء المستمر، الإسهال، الدوخة المتكررة، ألم بطن أو ظهر متوسط.
- normal: أعراض الحمل الشائعة البسيطة كالغثيان، التعب، حرقة المعدة، الإمساك، دوخة خفيفة عابرة.
تنبيه إلزامي: لا تقدم تشخيصًا نهائيًا ولا وصفات دواء، واذكري عند الحاجة ضرورة مراجعة الطبيبة.`;

const SEVERITY_LABELS = {
  normal: 'عادي',
  moderate: 'يستدعي المتابعة',
  critical: 'خطير',
};

// ------- مزوّدو الذكاء الاصطناعي (مفتاح يوفّره المستخدم عبر .env) -------
// ندعم Anthropic و أي مزوّد متوافق مع OpenAI. لا نقرأ أي مفاتيح من بيئة التشغيل.
function llmConfig() {
  const anthKey = process.env.ANTHROPIC_API_KEY;
  const userKey = process.env.USER_LLM_API_KEY;
  const base = (process.env.USER_LLM_BASE_URL || '').replace(/\/+$/, '');
  const provider = (process.env.USER_LLM_PROVIDER || '').toLowerCase();

  if (userKey) {
    const isAnthropic = provider === 'anthropic' || /anthropic/i.test(base);
    if (isAnthropic) {
      return {
        provider: 'anthropic',
        key: userKey,
        model: process.env.USER_LLM_MODEL || MODEL,
        base: base || 'https://api.anthropic.com',
      };
    }
    return {
      provider: 'openai',
      key: userKey,
      model: process.env.USER_LLM_MODEL || 'gpt-4o-mini',
      base: base || 'https://api.openai.com/v1',
    };
  }
  if (anthKey) {
    return { provider: 'anthropic', key: anthKey, model: MODEL, base: 'https://api.anthropic.com' };
  }
  return null;
}

export function llmProvider() {
  const cfg = llmConfig();
  return cfg ? cfg.provider : 'local';
}

async function callAnthropic(cfg, messages, { maxTokens = 700, system = SYSTEM_PROMPT } = {}) {
  try {
    const res = await fetch(`${cfg.base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system, messages }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      console.error('[ai] Anthropic error', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const text = (data.content || []).map((b) => b.text || '').join('').trim();
    return text || null;
  } catch (err) {
    console.error('[ai] Anthropic call failed:', err.message);
    return null;
  }
}

async function callOpenAICompatible(cfg, messages, { maxTokens = 700, system = SYSTEM_PROMPT } = {}) {
  try {
    const body = {
      model: cfg.model,
      max_tokens: maxTokens,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
    };
    const res = await fetch(`${cfg.base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      console.error('[ai] LLM error', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[ai] LLM call failed:', err.message);
    return null;
  }
}

async function callClaude(messages, opts) {
  const cfg = llmConfig();
  if (!cfg) return null;
  return cfg.provider === 'anthropic' ? callAnthropic(cfg, messages, opts) : callOpenAICompatible(cfg, messages, opts);
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// ------- محرّك التحليل المحلي (Fallback) -------
const CRITICAL = [
  'نزيف', 'دم', 'تشنج', 'صرع', 'فقدان الوعي', 'مغمى', 'اغمى', 'إغماء', 'صعوبة تنفس', 'مش قادر أتنفس',
  'ألم صدر', 'ألم في الصدر', 'تورم مفاجئ', 'زغللة', 'زغلله', 'صداع شديد جدا', 'انقطاع حركة الجنين',
  'مش حاسة بحركة الجنين', 'نزول ماء', 'تقلصات منتظمة', 'ولادة مبكرة', 'حرارة 40', 'حرارة 39', 'تشنجات',
];
const MODERATE = [
  'قيء مستمر', 'استفراغ مستمر', 'إسهال', 'اسهال', 'دوخة متكررة', 'دوخه متكرره', 'ألم بطن', 'ألم في البطن',
  'ألم ظهر', 'حرارة', 'سخونة', 'التهابات', 'حرقان بول', 'تورم القدمين', 'خفقان', 'إمساك شديد',
];
const NORMAL = [
  'غثيان', 'تعب', 'إرهاق', 'نعاس', 'حرقة', 'حرقان بالمعدة', 'إمساك', 'دوخة خفيفة', 'دوخه خفيفه',
  'صداع خفيف', 'وحام', 'تقلب مزاج', 'آلام خفيفة', 'مغص',
];
const INTENSIFIERS = ['شديد', 'شديدة', 'قوي', 'كتير', 'مستمر', 'مستمرة', 'فظيع', 'لا يطاق', 'مش محتمل'];

export function analyzeSymptomsLocal(text) {
  const t = (text || '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
  const has = (list) => list.some((k) => t.includes(normalize(k)));
  const intense = INTENSIFIERS.some((k) => t.includes(normalize(k)));

  let severity = 'normal';
  let reasoning = 'وصف يتوافق مع أعراض حمل شائعة وبسيطة.';

  if (has(CRITICAL)) {
    severity = 'critical';
    reasoning = 'الوصف يحتوي على علامة خطر تستدعي تقييمًا طبيًا فوريًا.';
  } else if (has(MODERATE)) {
    severity = intense ? 'critical' : 'moderate';
    reasoning = intense
      ? 'عرض متوسط الشدة مع وصف يدل على شدة عالية.'
      : 'عرض يستدعي المتابعة ومراقبة التطور.';
  } else if (has(NORMAL)) {
    severity = intense ? 'moderate' : 'normal';
    reasoning = intense ? 'عرض حمل شائع لكن بشدة أعلى من المعتاد.' : 'عرض حمل شائع وبسيط.';
  } else {
    severity = intense ? 'moderate' : 'normal';
    reasoning = 'لا يوجد وصف واضح لعلامة خطر؛ يُنصح بالمراقبة.';
  }

  const adviceMap = {
    critical: 'هذه علامة تستدعي التدخل السريع. توجهي فورًا إلى أقرب وحدة صحية أو اتصلي بالإسعاف/طبيبتك. تم تنبيه الطبيبة المتابعة لحالتك.',
    moderate: 'راقبي الأعراض، وارتاحي واشربي سوائل كافية. إذا استمرت أو ساءت خلال 24 ساعة تواصلي مع طبيبتك.',
    normal: 'غالبًا هذا عرض طبيعي في الحمل. ارتاحي واشربي ماء كافيًا وتابعي أي تغير. راجعي طبيبتك في المتابعة القادمة إن استمر.',
  };

  return {
    severity,
    advice: adviceMap[severity],
    reasoning,
    source: 'local',
  };
}

function normalize(s) {
  return (s || '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
}

export async function analyzeSymptoms(text) {
  const aiText = await callClaude([
    { role: 'user', content: `وصف الأم: "${text}"` },
  ]);
  const parsed = parseJson(aiText);
  if (parsed && ['normal', 'moderate', 'critical'].includes(parsed.severity)) {
    return {
      severity: parsed.severity,
      advice: parsed.advice || '',
      reasoning: parsed.reasoning || '',
      source: 'claude',
    };
  }
  return triageSymptom(text);
}

export async function explainGrowth(payload) {
  const { childName, ageMonths, metrics, summary } = payload;
  const fallback = {
    explanation: `${summary}. الطول والوزن ومحيط الرأس تتم مقارنتها بمنحنيات منظمة الصحة العالمية. ${
      metrics.some((m) => m.status !== 'normal')
        ? 'لوحظ انحراف بسيط في أحد القياسات، لذا يُفضّل مراجعة الطبيبة أو وحدة الصحة لتقييم أدق.'
        : 'جميع المؤشرات داخل النطاق الطبيعي، استمري في المتابعة الدورية.'
    }`,
    source: 'local',
  };
  const prompt = `قياسات الطفل ${childName} عند عمر ${ageMonths} شهر: ${metrics
    .map((m) => `${m.metricLabel} = ${m.value} (${m.statusLabel})`)
    .join('، ')}. اشرحي للأم بالعامية المصرية البسيطة ماذا يعني ذلك وهل تحتاج مراجعة طبيب، في 3 أسطر كحد أقصى وبنبرة مطمئنة.`;
  const aiText = await callClaude([{ role: 'user', content: prompt }], { maxTokens: 400 });
  if (aiText) return { explanation: aiText, source: 'claude' };
  return fallback;
}

export async function chatReply(message, history = [], context = {}) {
  const cleanHistory = history.map((m) => ({ role: m.role, content: stripMarkers(m.content) }));
  const infoQuestion = isInfoQuestion(message);

  const enrichedContext = {
    ...context,
    subject: detectSubject(message, context),
    personLabel:
      context.personLabel ||
      ((context.children || []).length === 1 ? context.children[0].name : null),
  };

  // 1) المحرّك الطبي المحلي يقدّم ردودًا حقيقية مع أسئلة متابعة وتقييم للخطورة
  if (!infoQuestion) {
    const local = medicalReply({ message, history, context: enrichedContext });
    if (local) {
      return {
        reply: local.reply,
        source: local.source,
        severity: local.severity,
        kind: local.kind,
        category: local.category,
        marker: local.state ? buildMarker(local.state) : null,
      };
    }
  }

  // 2) مزوّد الذكاء الاصطناعي (لو المفتاح متوفّر في .env) — يجيب أي سؤال بتفكير
  if (llmProvider() !== 'local') {
    const sys = buildSystemPrompt(enrichedContext);
    const messages = [
      ...cleanHistory.slice(-8).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content),
      })),
      { role: 'user', content: message },
    ];
    const aiText = await callClaude(messages, { maxTokens: 900, system: sys });
    if (aiText) return { reply: aiText, source: llmProvider(), marker: null };
  }

  // 3) موسوعة رفيقة الواسعة + محرّك التفكير (تعمل محليًا بدون مفتاح)
  const enc = answerFromEncyclopedia(message, enrichedContext);
  if (enc) {
    return { reply: enc.answer, source: enc.source, entryId: enc.entryId || null, marker: null };
  }

  // 4) قاعدة المعرفة القديمة كخطة احتياطية
  const knowledgeable = answerFromKnowledge(message);
  if (knowledgeable) {
    return {
      reply: `${knowledgeable}\n\nملاحظة: هذه معلومات توعوية، ولأي عرض مقلق راجعي طبيبتك المتابعة.`,
      source: 'knowledge',
      marker: null,
    };
  }

  return {
    reply:
      'يمكنني مساعدتك في الحمل، الأعراض، التطعيمات، الرضاعة، الأدوية، التغذية، نمو الطفل، والسلوك.\n\nجرّبي تكتبيلي بالتفصيل إيه اللي بيحصل ومع مين (إنتِ ولا طفلك) وعمره ومن إمتى، وأنا هفهم معاكي خطوة بخطوة.\n\nلو عندك عرض مقلق دلوقتي (نزيف، صعوبة تنفس، ألم صدر، انقطاع حركة الجنين، أو طفلك بيتنفس بصعوبة)، توجهي فورًا لطبيبتك أو أقرب وحدة صحية. المعلومات توعوية ولا تغني عن استشارة الطبيبة.',
    source: 'fallback',
    marker: null,
  };
}

function buildSystemPrompt(context = {}) {
  const children = context.children || [];
  const childInfo = children.length
    ? children
        .map((c) => {
          const age = c.ageLabel || '';
          return `${c.name} (${c.gender === 'female' ? 'بنت' : 'ولد'}${age ? `، ${age}` : ''})`;
        })
        .join('، ')
    : 'لا يوجد أطفال مسجّلون';
  const week = context.pregnancyWeek ? `الأم في الأسبوع ${context.pregnancyWeek} من الحمل.` : '';
  return `أنت "رفيقة الأمومة"، مساعدة طبية توعوية دافئة للأمهات في مصر، متخصصة في الحمل والولادة والتطعيمات ونمو الطفل والرضاعة والأدوية والتغذية والنوم والصحة النفسية وسلوك الطفل.
معلومات عن الحالة: أطفالها: ${childInfo}. ${week}
أسلوبك:
- عامية مصرية بسيطة ومطمئنة، وكلّميها كأنك أخت/طبيبة بتسمعها ومش سايباها لوحدها.
- جاوبي على أي سؤال يخص الأم أو الطفل (حتى لو موسوعي)، وافهمي وصفها، وحدّدي إن كان العرض ليها ولا لطفلها، واسألي أسئلة توضيحية قصيرة لو المعلومات ناقصة (من إمتى، الشدة، فيه حرارة، بيرضع ولا لأ، العمر).
- صنّفي الحالة: بسيطة (نصيحة منزلية)، تستدعي متابعة، أو خطيرة (اطلبي طبيبًا فورًا).
- لأي علامة خطر (نزيف، صعوبة تنفس، ألم صدر، تشنجات، انقطاع حركة الجنين، أفكار إيذاء النفس، حرارة رضيع أقل من 3 شهور) اطلبي التوجه للطبيب فورًا.
- رتّبي الرد في نقاط عملية قصيرة، ولا تصفي دواءً بجرعة من نفسك.
- لا تستخدمي أي إيموجي في الرد.
- اختمي دائمًا بأنها معلومات توعوية ولا تغني عن استشارة الطبيبة.`;
}

export { SEVERITY_LABELS };
