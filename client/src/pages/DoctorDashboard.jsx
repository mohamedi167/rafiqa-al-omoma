import { useCallback, useEffect, useState } from 'react';
import { doctorApi, notificationApi } from '../api/endpoints.js';
import { apiError } from '../api/client.js';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';

const severityCls = { normal: 'green', moderate: 'orange', critical: 'red' };
const severityLabel = { normal: 'عادي', moderate: 'متابعة', critical: 'خطير' };
const growthCls = { normal: 'green', warning: 'orange', severe: 'red' };

function PatientDetail({ id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    doctorApi
      .patient(id)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loader label="جارٍ تحميل الحالة..." />;
  if (!data) return <div className="empty">تعذّر تحميل بيانات الحالة.</div>;

  const { patient } = data;
  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">
          <h3>{patient.name}</h3>
          {patient.criticalAlerts > 0 && <span className="badge red">{patient.criticalAlerts} تنبيه خطير</span>}
        </div>
        <div className="info-row">
          <span className="k">الهاتف</span>
          <span className="v">{patient.phone || '—'}</span>
        </div>
        {patient.pregnancy && (
          <>
            <div className="info-row">
              <span className="k">أسبوع الحمل</span>
              <span className="v">{patient.pregnancy.week} (الشهر {patient.pregnancy.month})</span>
            </div>
            <div className="info-row">
              <span className="k">موعد الولادة المتوقع</span>
              <span className="v">{patient.pregnancy.dueDate}</span>
            </div>
          </>
        )}
        {!patient.pregnancy && (
          <div className="info-row">
            <span className="k">الحالة</span>
            <span className="v">فترة ما بعد الولادة</span>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h3>سجل الأعراض</h3>
          <span className="badge gray">{patient.symptoms?.length || 0}</span>
        </div>
        <div className="list">
          {patient.symptoms?.map((s) => (
            <div key={s.id} className="list-item" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="name">{s.text}</div>
                <div className="muted small">{s.advice}</div>
                <div className="muted small">سبب التقييم: {s.reasoning}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span className={`badge ${severityCls[s.severity]}`}>{severityLabel[s.severity]}</span>
                <div className="muted small">{s.created_at?.slice(0, 10)}</div>
              </div>
            </div>
          ))}
          {(!patient.symptoms || patient.symptoms.length === 0) && <div className="empty small">لا أعراض مسجّلة.</div>}
        </div>
      </div>

      {patient.children?.map((c) => (
        <div key={c.id} className="card">
          <div className="card-title">
            <h3>الطفل {c.name}</h3>
            <span className="badge teal">
              تطعيمات {c.overview.confirmedCount}/{c.overview.totalCount}
            </span>
          </div>
          <div className="info-row">
            <span className="k">العمر</span>
            <span className="v">{c.overview.ageLabel}</span>
          </div>
          <div className="info-row">
            <span className="k">التطعيم المستحق</span>
            <span className="v">{c.overview.currentDue?.ageLabel || 'لا يوجد'}</span>
          </div>

          {c.growth?.length > 0 && (
            <>
              <h4 style={{ marginTop: '0.7rem' }}>سجل النمو</h4>
              {c.growth.map((g) => (
                <div key={g.id} className="info-row">
                  <span className="k">عمر {g.age_months_at_record} شهر</span>
                  <span className="v">
                    {[
                      g.weight ? `${g.weight} كجم` : null,
                      g.height ? `${g.height} سم` : null,
                      g.head ? `رأس ${g.head} سم` : null,
                      g.chest ? `صدر ${g.chest} سم` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    <span className={`badge ${growthCls[g.assessment?.overall] || 'gray'}`} style={{ marginInlineStart: '0.4rem' }}>
                      {g.assessment?.overallLabel}
                    </span>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default function DoctorDashboard() {
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [messages, setMessages] = useState([]);
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAll = useCallback(() => {
    return Promise.all([doctorApi.stats(), doctorApi.patients(), notificationApi.list(), doctorApi.profile(), doctorApi.requests()])
      .then(([s, p, n, prof, r]) => {
        setStats(s);
        setPatients(p.patients);
        setMessages(n.notifications.filter((x) => x.type === 'mother_message'));
        setProfile(prof);
        setRequests(r.requests);
        setSelected((prev) => prev || p.patients[0]?.id || null);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const copyCode = async () => {
    if (!profile?.doctor?.code) return;
    try {
      await navigator.clipboard.writeText(profile.doctor.code);
      setNotice('تم نسخ كود الطبيبة.');
    } catch {
      setNotice('انسخي الكود يدويًا.');
    }
  };

  const respond = async (id, action) => {
    setError('');
    setNotice('');
    try {
      await (action === 'accept' ? doctorApi.acceptRequest(id) : doctorApi.rejectRequest(id));
      setNotice(action === 'accept' ? 'تم قبول طلب الربط.' : 'تم رفض طلب الربط.');
      loadAll();
    } catch (err) {
      setError(apiError(err));
    }
  };

  if (loading) return <Loader full label="جارٍ تحميل الحالات..." />;

  const visible = onlyAlerts ? patients.filter((p) => p.criticalAlerts > 0 || p.pendingVaccines > 0) : patients;

  return (
    <Layout title="لوحة الطبيبة" subtitle="الحالات المرتبطة بحسابك والتنبيهات الفورية">
      {error && <div className="alert critical">{error}</div>}
      {notice && <div className="alert normal">{notice}</div>}

      {profile?.doctor?.code && (
        <div className="card">
          <div className="card-title">
            <h3>كود الطبيبة</h3>
            <span className="badge teal">شاركيه مع أمهاتك</span>
          </div>
          <p className="small muted">
            أعطي هذا الكود للأمهات ليُرسلن طلب ربط بحسابك، ثم اقبلي الطلب من طلبات الربط أدناه.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <code style={{ fontSize: '1.4rem', letterSpacing: '0.25rem', fontWeight: 700 }}>{profile.doctor.code}</code>
            <button className="btn btn-ghost btn-sm" onClick={copyCode}>
              نسخ الكود
            </button>
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <div className="card">
          <div className="card-title">
            <h3>طلبات الربط</h3>
            <span className="badge orange">{requests.length}</span>
          </div>
          <div className="list">
            {requests.map((r) => (
              <div key={r.id} className="list-item" style={{ cursor: 'default' }}>
                <div className="avatar">{r.mother_name?.slice(0, 1)}</div>
                <div className="grow">
                  <div className="name">{r.mother_name}</div>
                  <div className="muted small">
                    {r.mother_phone || r.mother_email}
                    {r.childrenCount ? ` · ${r.childrenCount} طفل` : ''}
                  </div>
                  <div className="muted small">الكود: {r.code_used}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-teal btn-sm" onClick={() => respond(r.id, 'accept')}>
                    قبول
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => respond(r.id, 'reject')}>
                    رفض
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats && (
        <div className="stat-grid">
          <div className="stat">
            <div className="value">{stats.patients}</div>
            <div className="label">الأمهات المرتبطات</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: 'var(--red)' }}>
              {stats.criticalAlerts}
            </div>
            <div className="label">تنبيهات خطيرة</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: 'var(--amber)' }}>
              {stats.pendingVaccines}
            </div>
            <div className="label">تطعيمات قيد التأكيد</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: 'var(--teal)' }}>
              {stats.growthAlerts}
            </div>
            <div className="label">تنبيهات نمو</div>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="card">
          <div className="card-title">
            <h3>رسائل الأمهات</h3>
            <span className="badge orange">{messages.length}</span>
          </div>
          <div className="list">
            {messages.slice(0, 5).map((msg) => (
              <div key={msg.id} className="list-item" style={{ cursor: 'default' }}>
                <div className="grow">
                  <div className="name">{msg.title}</div>
                  <div className="muted small">{msg.body}</div>
                </div>
                <span className="muted small">{msg.created_at?.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cols">
        <div>
          <div className="card">
            <div className="card-title">
              <h3>الحالات</h3>
              <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} />
                الأكثر احتياجًا فقط
              </label>
            </div>
            <div className="list">
              {visible.map((p) => (
                <div
                  key={p.id}
                  className="list-item"
                  style={{ borderColor: selected === p.id ? 'var(--terracotta)' : undefined }}
                  onClick={() => setSelected(p.id)}
                >
                  <div className="avatar">{p.name?.slice(0, 1)}</div>
                  <div className="grow">
                    <div className="name">{p.name}</div>
                    <div className="muted small">
                      {p.pregnancy ? `حمل · أسبوع ${p.pregnancy.week}` : 'بعد الولادة'}
                      {p.children?.length ? ` · ${p.children.length} طفل` : ''}
                    </div>
                    <div className="muted small">{p.lastSymptom?.text}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
                    {p.criticalAlerts > 0 && <span className="badge red">{p.criticalAlerts} خطير</span>}
                    {p.pendingVaccines > 0 && <span className="badge orange">{p.pendingVaccines} تطعيم</span>}
                  </div>
                </div>
              ))}
              {visible.length === 0 && <div className="empty small">لا حالات مطابقة.</div>}
            </div>
          </div>
        </div>
        <div>{selected ? <PatientDetail id={selected} /> : <div className="empty">اختاري حالة لعرض التفاصيل.</div>}</div>
      </div>
    </Layout>
  );
}
