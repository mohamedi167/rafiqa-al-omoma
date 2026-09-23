import { useState } from 'react';
import Modal from './Modal.jsx';

const GUIDES = {
  weight: {
    title: 'طريقة قياس الوزن',
    caption: 'الطفل مستلقي في منتصف الميزان، وبدون حركة لحد ما الرقم يثبت.',
    steps: [
      'استخدمي ميزانًا رقميًا وثبّتيه على سطح مستوٍ صلب (مش سرير).',
      'اضبطي الميزان على صفر قبل القياس، ويفضّل بدون حفاض.',
      'ضعي الطفل مستلقيًا في منتصف الميزان، وايديك قريبة للأمان بدون ما تشيلي وزنه.',
      'استني لحد ما الرقم يثبت، وسجّلي الوزن لأقرب 0.1 كجم.',
    ],
  },
  height: {
    title: 'طريقة قياس الطول',
    caption: 'لوح القدم يتحرك لحد ما يلامس كعب الطفل والرجل مفرودة.',
    steps: [
      'لطفل أقل من سنتين: ضعيه مستلقيًا على سطح مستوٍ والرأس لاصقة بلوحة ثابتة.',
      'افردي رجليه وخلّي الركبة مفرودة والقدم بزاوية قائمة.',
      'حرّكي لوح القدم لحد ما يلامس كعبيه، واقرئي الطول لأقرب 0.1 سم.',
      'لطفل أكبر: قيسيه واقفًا لاصقًا للحائط وبدون حذاء ورأسه مستقيم.',
    ],
  },
  head: {
    title: 'طريقة قياس محيط الرأس',
    caption: 'الشريط مستوي حول الرأس: من منتصف الجبهة (فوق الحاجب) وحول أعلى نقطة في العظمة القذالية بمؤخرة الرأس، مش فوق الرأس ولا تحت الدقن.',
    steps: [
      'ابدئي الشريط من منتصف الجبهة فوق الحاجبين مباشرة.',
      'لُفّيه حول الرأس بحيث يمرّ من أعلى نقطة في العظمة القذالية (مؤخرة الرأس) ومن فوق الأذنين من الجانبين.',
      'تأكدي إن الشريط مستوي وغير مائل لفوق أو نازل تحت الدقن، والضغط خفيف يلامس الشعر بدون شد.',
      'اقرئي القياس عند التقاء الطرفين في الجبهة لأقرب 0.1 سم، وكرّري القياس للتأكد.',
    ],
  },
  chest: {
    title: 'طريقة قياس محيط الصدر',
    caption: 'الشريط حول الصدر عند مستوى حلمة الصدر والطفل هادي.',
    steps: [
      'مرّري شريط القياس حول الصدر عند مستوى حلمة الصدر.',
      'خلّي الشريط مستويًا حول الجسم والطفل مرتاح أو بيرضع بهدوء.',
      'قيسي في نهاية الشهيق لطفل هادي (بعد ما ياخد نفسه).',
      'سجّلي القراءة لأقرب 0.1 سم وخدي القياس في نفس الوقت كل مرة.',
    ],
  },
};

function WeightArt() {
  return (
    <svg viewBox="0 0 320 170" className="mg-art" role="img" aria-label="رسم توضيحي لقياس الوزن">
      <line x1="24" y1="150" x2="296" y2="150" className="mg-ground" />
      <rect x="82" y="96" width="156" height="52" rx="12" className="mg-scale" />
      <rect x="126" y="108" width="68" height="26" rx="6" className="mg-display" />
      <text x="160" y="127" textAnchor="middle" className="mg-digits">
        00.0
      </text>
      <g className="mg-bob">
        <ellipse cx="168" cy="80" rx="42" ry="13" className="mg-skin" />
        <circle cx="120" cy="76" r="18" className="mg-skin" />
        <path d="M120 76 C 138 68, 150 68, 158 72" className="mg-line" />
        <line x1="196" y1="74" x2="214" y2="66" className="mg-line" />
        <line x1="196" y1="86" x2="214" y2="92" className="mg-line" />
        <circle cx="113" cy="74" r="2.4" className="mg-eye" />
      </g>
      <path d="M160 96 l0 -10" className="mg-arrow" />
    </svg>
  );
}

function HeightArt() {
  return (
    <svg viewBox="0 0 320 170" className="mg-art" role="img" aria-label="رسم توضيحي لقياس الطول">
      <rect x="34" y="112" width="252" height="14" rx="6" className="mg-board" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <line key={i} x1={64 + i * 26} y1="112" x2={64 + i * 26} y2="122" className="mg-tick" />
      ))}
      <rect x="34" y="70" width="12" height="56" rx="4" className="mg-board" />
      <circle cx="72" cy="100" r="15" className="mg-skin" />
      <ellipse cx="146" cy="104" rx="66" ry="11" className="mg-skin" />
      <line x1="86" y1="92" x2="120" y2="86" className="mg-line" />
      <line x1="86" y1="108" x2="120" y2="112" className="mg-line" />
      <g className="mg-slide">
        <rect x="196" y="80" width="12" height="44" rx="4" className="mg-foot" />
      </g>
      <path d="M150 62 h44" className="mg-arrow" />
      <path d="M194 62 l-8 -5 v10 z" className="mg-arrow-head" />
    </svg>
  );
}

function HeadArt() {
  return (
    <svg viewBox="0 0 320 170" className="mg-art" role="img" aria-label="رسم توضيحي لقياس محيط الرأس">
      <path
        d="M168 30 C142 30 126 48 124 68 C121 74 123 78 119 82 C114 87 117 93 123 95 C123 103 129 113 141 118 C150 124 166 128 184 124 C205 119 218 106 219 88 C220 62 202 34 168 30 Z"
        className="mg-skin"
      />
      <path d="M150 82 q11 -7 13 5 q-2 13 -11 11 q-6 -6 -2 -16 z" className="mg-skin" />
      <circle cx="140" cy="72" r="2.4" className="mg-eye" />
      <path d="M126 100 q8 6 16 2" className="mg-line" />
      <ellipse
        cx="170"
        cy="82"
        rx="50"
        ry="17"
        className="mg-tape mg-anim-draw"
        transform="rotate(8 170 82)"
      />
      <circle cx="121" cy="75" r="5" className="mg-tape-knot" />
      <text x="66" y="56" className="mg-tag">
        الجبهة
      </text>
      <path d="M102 60 L120 72" className="mg-arrow" />
      <text x="222" y="132" textAnchor="end" className="mg-tag">
        العظمة القذالية
      </text>
      <path d="M222 122 L219 95" className="mg-arrow" />
    </svg>
  );
}

function ChestArt() {
  return (
    <svg viewBox="0 0 320 170" className="mg-art" role="img" aria-label="رسم توضيحي لقياس محيط الصدر">
      <circle cx="160" cy="34" r="20" className="mg-skin" />
      <circle cx="153" cy="32" r="2.2" className="mg-eye" />
      <circle cx="167" cy="32" r="2.2" className="mg-eye" />
      <rect x="118" y="54" width="84" height="86" rx="26" className="mg-skin" />
      <line x1="118" y1="78" x2="94" y2="98" className="mg-line" />
      <line x1="202" y1="78" x2="226" y2="98" className="mg-line" />
      <ellipse cx="160" cy="96" rx="50" ry="24" className="mg-tape mg-anim-draw" />
      <circle cx="160" cy="120" r="5" className="mg-tape-knot" />
      <path d="M212 130 q22 8 14 28" className="mg-arrow" />
      <path d="M226 158 l-6 -9 h12 z" className="mg-arrow-head" />
    </svg>
  );
}

const ART = { weight: WeightArt, height: HeightArt, head: HeadArt, chest: ChestArt };

export default function MeasurementGuide() {
  const [type, setType] = useState(null);
  const guide = type ? GUIDES[type] : null;
  const Art = type ? ART[type] : null;

  return (
    <div className="measure-guide">
      <span className="measure-guide-label">شاهدي طريقة القياس:</span>
      <div className="measure-guide-btns">
        {Object.entries(GUIDES).map(([key, g]) => (
          <button key={key} type="button" className="btn btn-ghost btn-sm guide-btn" onClick={() => setType(key)}>
            {g.title.replace('طريقة قياس ', '')}
          </button>
        ))}
      </div>

      {guide && (
        <Modal title={guide.title} onClose={() => setType(null)}>
          <div className="measure-guide-body">
            <Art />
            <p className="small muted" style={{ margin: '0.2rem 0 0.7rem' }}>
              {guide.caption}
            </p>
            <ol className="measure-steps">
              {guide.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </Modal>
      )}
    </div>
  );
}
