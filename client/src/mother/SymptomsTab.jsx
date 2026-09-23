import { useEffect, useState } from 'react';
import { symptomApi } from '../api/endpoints.js';
import { apiError } from '../api/client.js';

const severityMeta = {
  normal: { label: 'عادي', cls: 'normal' },
  moderate: { label: 'يستدعي المتابعة', cls: 'moderate' },
  critical: { label: 'خطير', cls: 'critical' },
};

const examples = ['حاسة بدوخة', 'عندي صداع وحرقة معدة', 'نزيف خفيف وشعور بألم في البطن', 'تعب شديد وإمساك'];

export default function SymptomsTab() {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = () => symptomApi.list().then((r) => setHistory(r.symptoms)).catch(() => {});
  useEffect(() => {
    loadHistory();
  }, []);

  const analyze = async (value) => {
    const input = (value ?? text).trim();
    if (!input) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await symptomApi.analyze(input);
      setResult(res);
      setText('');
      loadHistory();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">
          <h3>كيف تشعرين الآن؟</h3>
          <span className="badge teal">تحليل ذكي</span>
        </div>
        <p className="muted small">
          اكتبي إحساسك بكلامك العادي، وسنحلله ونحدد إن كان يحتاج مراجعة الطبيبة فورًا.
        </p>
        <div className="field">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='مثال: "حاسة بدوخة" أو "عندي حرارة وبكاء مبطل"'
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.8rem' }}>
          {examples.map((ex) => (
            <button key={ex} className="pill" style={{ border: 'none', cursor: 'pointer' }} onClick={() => analyze(ex)}>
              {ex}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => analyze()} disabled={busy || !text.trim()}>
          {busy ? 'جارٍ التحليل...' : 'تحليل الأعراض'}
        </button>
        {error && <div className="alert critical" style={{ marginTop: '0.8rem' }}>{error}</div>}

        {result && (
          <div style={{ marginTop: '1rem' }}>
            <div className={`alert ${severityMeta[result.symptom.severity].cls}`}>
              <strong>
                التقييم: {severityMeta[result.symptom.severity].label}
              </strong>
              <p style={{ margin: '0.35rem 0 0' }}>{result.symptom.advice}</p>
              <p className="small" style={{ margin: '0.25rem 0 0', opacity: 0.85 }}>
                سبب التقييم: {result.symptom.reasoning}
              </p>
            </div>
            {result.symptom.severity === 'critical' && (
              <div className="alert critical">
                {result.doctorNotified ? 'تم إرسال تنبيه فوري لطبيبتك المتابعة.' : 'توجهي فورًا لأقرب وحدة صحية.'}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h3>سجل الأعراض</h3>
          <span className="badge gray">{history.length} تسجيل</span>
        </div>
        <div className="list">
          {history.map((s) => (
            <div key={s.id} className="list-item" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="name">{s.text}</div>
                <div className="muted small">{s.advice}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span className={`badge ${severityMeta[s.severity]?.cls || 'gray'}`}>
                  {severityMeta[s.severity]?.label || s.severity}
                </span>
                <div className="muted small">{s.created_at?.slice(0, 10)}</div>
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <div className="empty">
              لا يوجد سجل بعد. كل تحليل يُحفظ وتراجعه طبيبتك وقت الكشف.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
