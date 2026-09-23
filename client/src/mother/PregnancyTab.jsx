import { useEffect, useState } from 'react';
import { motherApi } from '../api/endpoints.js';
import { apiError } from '../api/client.js';

const trimesterLabel = { 1: 'الثلث الأول', 2: 'الثلث الثاني', 3: 'الثلث الثالث' };

export default function PregnancyTab({ data }) {
  const pregnancy = data?.pregnancy;
  const [week, setWeek] = useState(pregnancy?.week || 1);
  const [content, setContent] = useState(null);
  const [logs, setLogs] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    motherApi
      .pregnancyContent(week)
      .then((res) => setContent(res.content))
      .catch(() => {});
  }, [week]);

  useEffect(() => {
    motherApi
      .pregnancyLogs()
      .then((res) => setLogs(res.logs))
      .catch(() => {});
  }, [data]);

  const saveLog = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      const res = await motherApi.addPregnancyLog({ month: content?.month, week, notes: note.trim() });
      setLogs((prev) => [res.log, ...prev]);
      setNote('');
      setMessage('تم حفظ ملاحظتك.');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setMessage(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (!pregnancy) {
    return (
      <div className="card">
        <div className="empty">
          <h3>لم يتم تحديد بيانات الحمل بعد</h3>
          <p className="muted">أدخلي تاريخ أول يوم من آخر دورة من تبويب "ملفي" لنحسب أسبوع حملك ومحتواك الأسبوعي.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">
          <h3>تقدّم الحمل</h3>
          <span className="badge rose">{trimesterLabel[pregnancy.trimester]}</span>
        </div>
        <div className="stat-grid" style={{ marginBottom: '0.8rem' }}>
          <div className="stat">
            <div className="value">{pregnancy.week}</div>
            <div className="label">الأسبوع الحالي</div>
          </div>
          <div className="stat">
            <div className="value">{pregnancy.month}</div>
            <div className="label">الشهر</div>
          </div>
          <div className="stat">
            <div className="value">{pregnancy.daysLeft}</div>
            <div className="label">يومًا متبقيًا</div>
          </div>
          <div className="stat">
            <div className="value" style={{ fontSize: '1.05rem' }}>{pregnancy.dueDate}</div>
            <div className="label">موعد الولادة المتوقع</div>
          </div>
        </div>
        <div className="progress">
          <span style={{ width: `${pregnancy.progress}%` }} />
        </div>
        <div className="small muted center" style={{ marginTop: '0.3rem' }}>
          {pregnancy.progress}% من رحلة الحمل
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>محتواك الأسبوعي</h3>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeek((w) => Math.max(1, w - 1))}>
              الأسبوع السابق
            </button>
            <span className="badge teal">الأسبوع {week}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeek((w) => Math.min(40, w + 1))}>
              الأسبوع التالي
            </button>
          </div>
        </div>
        {content && (
          <>
            <div className="alert brand">{content.weekTip || content.tip}</div>
            <h4>{content.title}</h4>
            <p>
              <strong>تطور الجنين: </strong>
              {content.babyDevelopment}
            </p>
            <p>
              <strong>تغيّرات جسمك: </strong>
              {content.bodyChanges}
            </p>
            <div className="two-col" style={{ marginTop: '0.6rem' }}>
              <div>
                <h4 style={{ color: 'var(--green)' }}>أكل مسموح</h4>
                <ul>
                  {content.foodAllowed.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ color: 'var(--red)' }}>يُفضّل تجنّبه</h4>
                <ul>
                  {content.foodAvoid.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="advice" style={{ marginTop: '0.6rem' }}>
              نصيحة الأسبوع: {content.tip}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h3>ملاحظاتي</h3>
        </div>
        {message && <div className="alert info">{message}</div>}
        <div className="field">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="اكتبي أي ملاحظة أو إحساس تريدين تذكّره لطبيبتك..."
          />
        </div>
        <button className="btn btn-primary" onClick={saveLog} disabled={busy}>
          {busy ? 'جارٍ الحفظ...' : 'حفظ الملاحظة'}
        </button>
        <div className="list" style={{ marginTop: '0.8rem' }}>
          {logs.map((l) => (
            <div key={l.id} className="list-item" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="name">
                  الشهر {l.month}
                  {l.gestational_week ? ` · الأسبوع ${l.gestational_week}` : ''}
                </div>
                <div className="muted small">{l.notes}</div>
              </div>
              <span className="muted small">{l.created_at?.slice(0, 10)}</span>
            </div>
          ))}
          {logs.length === 0 && <div className="empty small">لا ملاحظات بعد.</div>}
        </div>
      </div>
    </div>
  );
}
