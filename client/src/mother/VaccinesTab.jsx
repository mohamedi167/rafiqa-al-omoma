import { useCallback, useEffect, useState } from 'react';
import { vaccineApi, childApi } from '../api/endpoints.js';
import { apiError } from '../api/client.js';
import Loader from '../components/Loader.jsx';

export default function VaccinesTab({ data, childId, onSelectChild, reload }) {
  const children = data?.children || [];
  const [overview, setOverview] = useState(null);
  const [content, setContent] = useState(null);
  const [selfManaged, setSelfManaged] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const [ov, detail] = await Promise.all([vaccineApi.overview(id), childApi.detail(id)]);
      setOverview(ov.overview);
      setSelfManaged(Boolean(ov.selfManaged));
      setContent(detail.content);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!childId && children[0] && onSelectChild) onSelectChild(children[0].id);
  }, [children, childId, onSelectChild]);

  useEffect(() => {
    load(childId);
  }, [childId, load]);

  const mark = async (groupKey) => {
    setBusyKey(groupKey);
    setError('');
    try {
      const res = await vaccineApi.mark(childId, groupKey);
      setOverview(res.overview);
      if (res.selfManaged !== undefined) setSelfManaged(Boolean(res.selfManaged));
      window.dispatchEvent(new Event('rafiqa:notifications:refresh'));
      reload?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyKey('');
    }
  };

  if (children.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <h3>لا يوجد طفل مسجّل بعد</h3>
          <p className="muted">أضيفي طفلك من تبويب "ملفي" بتاريخ ميلاده، وسيبدأ جدول التطعيمات تلقائيًا.</p>
        </div>
      </div>
    );
  }

  const selected = children.find((c) => c.id === childId) || children[0];

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">
          <h3>متابعة التطعيمات</h3>
          {children.length > 1 && (
            <select value={childId} onChange={(e) => onSelectChild(Number(e.target.value))} style={{ padding: '0.4rem', borderRadius: 10 }}>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="info-row">
          <span className="k">الطفل</span>
          <span className="v">{selected?.name}</span>
        </div>
        <div className="info-row">
          <span className="k">العمر</span>
          <span className="v">{selected?.ageLabel}</span>
        </div>
        <div className="info-row">
          <span className="k">التطعيمات المكتملة</span>
          <span className="v">{selected?.vaccineProgress}</span>
        </div>
      </div>

      {content && (
        <div className="card">
          <div className="card-title">
            <h3>توعية حسب عمر طفلك</h3>
            <span className="badge rose">{content.title}</span>
          </div>
          <div className="two-col">
            <div>
              <h4 style={{ color: 'var(--teal)' }}>معالم النمو</h4>
              <ul>
                {content.milestones.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 style={{ color: 'var(--amber)' }}>مشاكل شائعة وحلولها</h4>
              {content.commonIssues.map((c) => (
                <div key={c.issue} className="advice" style={{ marginBottom: '0.4rem' }}>
                  <strong>{c.issue}: </strong>
                  {c.advice}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert critical">{error}</div>}

      {loading && <Loader label="جارٍ تجهيز جدول التطعيمات..." />}

      {overview && !loading && (
        <>
          <div className="alert info">
            {selfManaged
              ? 'أنتِ غير مرتبطة بوحدة صحية، لذلك تسجيلك للتطعيم يُعتمد مباشرة دون انتظار تأكيد. يمكنك ربط وحدة صحية لاحقًا من تبويب "ملفي".'
              : 'جدول التطعيمات محسوب تلقائيًا من تاريخ ميلاد طفلك، والتأكيد النهائي يتم مع الوحدة الصحية.'}
          </div>
          <div className="track">
            {overview.timeline.map((item) => (
              <div key={item.groupKey} className={`vax-card status-${item.status}`}>
                <div className="vax-head">
                  <div>
                    <div className="vax-name">
                      {item.ageLabel}
                      {item.groupKey === overview.currentDue?.groupKey && item.status !== 'confirmed' && (
                        <span className="badge red" style={{ marginInlineStart: '0.5rem' }}>
                          المستحق الآن
                        </span>
                      )}
                    </div>
                    <div className="vax-meta">
                      الموعد: {item.dueDate}
                      {item.daysUntil > 0 && item.status !== 'confirmed' ? ` · بعد ${item.daysUntil} يوم` : ''}
                    </div>
                  </div>
                  <span className={`badge ${item.color}`}>{item.statusLabel}</span>
                </div>

                <div className="vax-vaccines">
                  {item.vaccines.map((v) => (
                    <span key={v.code} className="pill" title={v.protectsFrom}>
                      {v.name}
                    </span>
                  ))}
                </div>

                {/* شرح قبل الميعاد */}
                {item.status !== 'confirmed' && (
                  <div className="vax-section">
                    <h4>بيحمي من إيه؟</h4>
                    <ul>
                      {item.vaccines.map((v) => (
                        <li key={v.code}>
                          <strong>{v.name}:</strong> {v.protectsFrom}
                        </li>
                      ))}
                    </ul>
                    <p className="small muted" style={{ marginTop: '0.35rem' }}>
                      خطر تأخير هذا التطعيم: يزيد احتمال الإصابة بالمرض ويقلل فاعلية السلسلة الأساسية، خاصة في
                      أول عامين.
                    </p>
                  </div>
                )}

                {(item.status === 'due' || item.status === 'soon' || item.status === 'upcoming') && (
                  <button className="btn btn-primary btn-sm" style={{ marginTop: '0.7rem' }} disabled={busyKey === item.groupKey} onClick={() => mark(item.groupKey)}>
                    {busyKey === item.groupKey ? 'جارٍ التسجيل...' : 'تم التطعيم'}
                  </button>
                )}

                {item.status === 'pending' && (
                  <div className="alert moderate" style={{ marginTop: '0.7rem', marginBottom: 0 }}>
                    سجّلتِ إتمام التطعيم، وبانتظار تأكيد الوحدة الصحية (تأكيد مزدوج لدقة البيانات).
                  </div>
                )}

                {/* بعد التأكيد تظهر الأعراض الجانبية والعلاج المنزلي */}
                {item.status === 'confirmed' && (
                  <div className="vax-section">
                    <h4>الأعراض الجانبية المتوقعة</h4>
                    <ul>
                      {item.generalSideEffects.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    <h4 style={{ marginTop: '0.5rem' }}>إزاي تتعاملي معاها في البيت</h4>
                    <ul>
                      {item.homeCare.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                    <h4 style={{ marginTop: '0.5rem', color: 'var(--red)' }}>امتى تتصلين بالطبيب</h4>
                    <ul>
                      {item.callDoctorIf.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
