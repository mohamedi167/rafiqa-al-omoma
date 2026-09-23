import { useCallback, useEffect, useMemo, useState } from 'react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { growthApi } from '../api/endpoints.js';
import { apiError } from '../api/client.js';
import Loader from '../components/Loader.jsx';
import MeasurementGuide from '../components/MeasurementGuide.jsx';

const metricMeta = {
  weight: { label: 'الوزن', unit: 'كجم', medianKey: 'weightMedian', color: '#c96f5a' },
  height: { label: 'الطول', unit: 'سم', medianKey: 'heightMedian', color: '#3f8c80' },
  head: { label: 'محيط الرأس', unit: 'سم', medianKey: 'headMedian', color: '#e0a23b' },
};

const statusCls = { normal: 'green', warning: 'orange', severe: 'red' };

export default function GrowthTab({ data, childId, onSelectChild, reload }) {
  const children = data?.children || [];
  const [payload, setPayload] = useState(null);
  const [metric, setMetric] = useState('weight');
  const [form, setForm] = useState({ weight: '', height: '', head: '', chest: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      setPayload(await growthApi.list(id));
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

  const chartData = useMemo(() => {
    if (!payload) return [];
    const meta = metricMeta[metric];
    const points = payload.reference.map((r) => ({ month: r.month, median: r[meta.medianKey] }));
    for (const rec of payload.records) {
      const value = rec[metric];
      if (value == null) continue;
      points.push({ month: Number(rec.age_months_at_record), value });
    }
    return points.sort((a, b) => a.month - b.month);
  }, [payload, metric]);

  const submit = async () => {
    if (!form.weight && !form.height && !form.head && !form.chest) {
      setError('أدخلي قياسًا واحدًا على الأقل');
      return;
    }
    setBusy(true);
    setError('');
    setExplanation(null);
    try {
      const res = await growthApi.add(childId, form);
      setExplanation({ ...res.aiExplanation, assessment: res.record.assessment });
      setForm({ weight: '', height: '', head: '', chest: '' });
      await load(childId);
      reload?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (children.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <h3>لا يوجد طفل مسجّل بعد</h3>
          <p className="muted">أضيفي طفلك من تبويب "ملفي" لتبدئي متابعة الوزن والطول ومحيط الرأس ومحيط الصدر.</p>
        </div>
      </div>
    );
  }

  const selected = children.find((c) => c.id === childId) || children[0];

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">
          <h3>متابعة النمو</h3>
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
        <p className="muted small">
          {selected?.name} · العمر: {payload?.ageLabel || selected?.ageLabel} — نقارن القياسات بمنحنيات منظمة
          الصحة العالمية (WHO).
        </p>
        {payload?.records?.length > 0 &&
          (() => {
            const latest = payload.records[payload.records.length - 1];
            return (
              <div className="stat-grid" style={{ marginTop: '0.7rem', marginBottom: 0 }}>
                <div className="stat">
                  <div className="value">{latest.weight ?? '—'}</div>
                  <div className="label">الوزن (كجم)</div>
                </div>
                <div className="stat">
                  <div className="value">{latest.height ?? '—'}</div>
                  <div className="label">الطول (سم)</div>
                </div>
                <div className="stat" style={{ borderColor: 'var(--amber)' }}>
                  <div className="value" style={{ color: 'var(--amber)' }}>
                    {latest.head ?? '—'}
                  </div>
                  <div className="label">محيط الرأس (سم)</div>
                </div>
                <div className="stat">
                  <div className="value">{latest.chest ?? '—'}</div>
                  <div className="label">محيط الصدر (سم)</div>
                </div>
                <div className="stat">
                  <div className="value" style={{ fontSize: '1rem', paddingTop: '0.5rem' }}>
                    {latest.assessment?.overallLabel || '—'}
                  </div>
                  <div className="label">تقييم آخر قياس</div>
                </div>
              </div>
            );
          })()}
      </div>

      <div className="card">
        <div className="card-title">
          <h3>إضافة قياس جديد</h3>
        </div>
        {error && <div className="alert critical">{error}</div>}
        <MeasurementGuide />
        <div className="grid-3">
          <div className="field">
            <label>الوزن (كجم)</label>
            <input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
          </div>
          <div className="field">
            <label>الطول (سم)</label>
            <input type="number" step="0.1" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
          </div>
          <div className="field">
            <label>محيط الرأس (سم)</label>
            <input type="number" step="0.1" value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })} />
          </div>
          <div className="field">
            <label>محيط الصدر (سم)</label>
            <input type="number" step="0.1" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} />
            <div className="small muted">يُسجَّل كنمو إضافي (لا يوجد منحنى WHO له).</div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'جارٍ التحليل...' : 'حفظ القياس وتقييم النمو'}
        </button>

        {explanation && (
          <div className={`alert ${explanation.assessment?.overall === 'normal' ? 'normal' : explanation.assessment?.overall === 'warning' ? 'moderate' : 'critical'}`} style={{ marginTop: '0.9rem' }}>
            <strong>{explanation.assessment?.summary}</strong>
            <p style={{ margin: '0.3rem 0 0' }}>{explanation.assessment?.metrics?.map((m) => (
              <span key={m.metric} className="pill" style={{ background: 'rgba(255,255,255,0.6)' }}>
                {m.metricLabel}: {m.value} {m.unit} — {m.statusLabel}
              </span>
            ))}</p>
            {explanation.explanation && <p style={{ margin: '0.3rem 0 0' }}>{explanation.explanation}</p>}
          </div>
        )}
      </div>

      {loading && <Loader label="جارٍ تحميل المنحنى..." />}

      {payload && !loading && (
        <div className="card">
          <div className="card-title">
            <h3>منحنى النمو</h3>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {Object.entries(metricMeta).map(([key, m]) => (
                <button key={key} className={`btn btn-sm ${metric === key ? 'btn-teal' : 'btn-ghost'}`} onClick={() => setMetric(key)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#efdfd8" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} unit=" شهر" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v, n) => [v, n === 'median' ? 'المتوسط الطبيعي' : 'قياس طفلك']}
                  labelFormatter={(l) => `العمر: ${l} شهر`}
                />
                <Legend formatter={(v) => (v === 'median' ? 'منحنى WHO' : 'قياسات طفلك')} />
                <Line type="monotone" dataKey="median" stroke="#bfa79f" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={metricMeta[metric].color}
                  strokeWidth={2.5}
                  connectNulls
                  dot={{ r: 4, fill: metricMeta[metric].color }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {payload && payload.records.length > 0 && (
        <div className="card">
          <div className="card-title">
            <h3>سجل القياسات والتقييم</h3>
          </div>
          <div className="list">
            {[...payload.records].reverse().map((rec) => (
              <div key={rec.id} className="list-item" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>عمر {rec.age_months_at_record} شهر</strong>
                  <span className={`badge ${statusCls[rec.assessment?.overall] || 'gray'}`}>
                    {rec.assessment?.overallLabel || 'غير محدد'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                  {rec.weight != null && <span className="pill">وزن {rec.weight} كجم</span>}
                  {rec.height != null && <span className="pill">طول {rec.height} سم</span>}
                  {rec.head != null && <span className="pill">محيط رأس {rec.head} سم</span>}
                  {rec.chest != null && <span className="pill">محيط صدر {rec.chest} سم</span>}
                </div>
                {rec.assessment?.metrics
                  ?.filter((m) => m.status !== 'normal')
                  .map((m) => (
                    <div key={m.metric} className="small" style={{ color: 'var(--red)', marginTop: '0.2rem' }}>
                      {m.metricLabel}: {m.message}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {payload && payload.records.length === 0 && (
        <div className="card">
          <div className="empty">
            لا قياسات بعد. أضيفي أول قياس لمتابعة منحنى النمو.
          </div>
        </div>
      )}
    </div>
  );
}
