import { useCallback, useEffect, useState } from 'react';
import { vaccineApi, unitApi } from '../api/endpoints.js';
import { apiError } from '../api/client.js';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import Modal from '../components/Modal.jsx';

export default function HealthUnitDashboard() {
  const [tab, setTab] = useState('requests');
  const [unit, setUnit] = useState(null);
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [pending, setPending] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [toast, setToast] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [prof, s, reqs, p, c] = await Promise.all([
        unitApi.profile(),
        unitApi.stats(),
        unitApi.requests('pending'),
        vaccineApi.pending(),
        unitApi.children(),
      ]);
      setUnit(prof.unit);
      setStats(s);
      setRequests(reqs.requests);
      setPending(p.pending);
      setChildren(c.children);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 3500);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(unit?.code || '');
      flash('تم نسخ كود الوحدة. شاركيه مع الأمهات للربط.');
    } catch {
      flash(`كود الوحدة: ${unit?.code}`);
    }
  };

  const respond = async (row, action) => {
    const key = `req-${row.id}`;
    setBusyKey(key);
    setError('');
    try {
      if (action === 'accept') {
        await unitApi.acceptRequest(row.id);
        flash(`تم قبول ربط ${row.mother_name} بالوحدة وإخطارها.`);
      } else {
        await unitApi.rejectRequest(row.id);
        flash(`تم رفض طلب ${row.mother_name}.`);
      }
      window.dispatchEvent(new Event('rafiqa:notifications:refresh'));
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyKey('');
    }
  };

  const confirm = async (row) => {
    const key = `${row.child_id}-${row.group_key}`;
    setBusyKey(key);
    setError('');
    try {
      await vaccineApi.confirm(row.child_id, row.group_key);
      flash(`تم تأكيد تطعيم ${row.child_name} وإرسال الأعراض الجانبية للأم.`);
      window.dispatchEvent(new Event('rafiqa:notifications:refresh'));
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyKey('');
    }
  };

  const openChild = async (id) => {
    try {
      const res = await unitApi.child(id);
      setDetail(res);
    } catch (err) {
      setError(apiError(err));
    }
  };

  if (loading) return <Loader full label="جارٍ تحميل بيانات الوحدة..." />;

  return (
    <Layout title="لوحة الوحدة الصحية" subtitle="ربط الأمهات، وتأكيد التطعيمات، ومتابعة الأطفال">
      {error && <div className="alert critical">{error}</div>}
      {toast && <div className="alert normal">{toast}</div>}

      <div className="card">
        <div className="card-title">
          <h3>كود الوحدة الصحية</h3>
          <span className="badge teal">شاركيه مع الأمهات</span>
        </div>
        <p className="small muted">
          هذا الكود تعطيه الأم قبل الولادة، وتدخله في حسابها لترسل طلب ربط، ثم تقبلين الطلب لتأكيد الارتباط.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              letterSpacing: '0.3em',
              color: 'var(--terracotta-dark)',
              background: 'var(--rose-soft)',
              padding: '0.4rem 1rem',
              borderRadius: 12,
            }}
          >
            {unit?.code || '——'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={copyCode}>
            نسخ الكود
          </button>
        </div>
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat">
            <div className="value">{stats.children}</div>
            <div className="label">أطفال مسجّلون</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: 'var(--amber)' }}>
              {stats.pendingVaccines}
            </div>
            <div className="label">قيد التأكيد</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: 'var(--green)' }}>
              {stats.confirmedVaccines}
            </div>
            <div className="label">مؤكدة</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: 'var(--terracotta)' }}>
              {requests.length}
            </div>
            <div className="label">طلبات ربط</div>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          طلبات الربط ({requests.length})
        </button>
        <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          قيد التأكيد ({pending.length})
        </button>
        <button className={`tab ${tab === 'children' ? 'active' : ''}`} onClick={() => setTab('children')}>
          الأطفال ({children.length})
        </button>
      </div>

      {tab === 'requests' && (
        <div className="card">
          <div className="card-title">
            <h3>طلبات ربط الأمهات</h3>
            <span className="badge orange">تحتاج موافقة</span>
          </div>
          <p className="small muted">
            الأم أدخلت كود وحدتك وطلبت الربط. بالضغط على "قبول" يتم ربط حسابها وتظهر لك تطعيمات أطفالها.
          </p>
          <div className="list">
            {requests.map((row) => (
              <div key={row.id} className="list-item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <div className="avatar">{row.mother_name?.slice(0, 1)}</div>
                <div className="grow">
                  <div className="name">{row.mother_name}</div>
                  <div className="muted small">
                    {row.mother_phone ? `${row.mother_phone} · ` : ''}
                    {row.mother_email || ''}
                  </div>
                  <div className="muted small">
                    عدد الأطفال المسجّلين: {row.childrenCount} · الكود: {row.code_used}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-teal btn-sm" disabled={busyKey === `req-${row.id}`} onClick={() => respond(row, 'accept')}>
                    قبول
                  </button>
                  <button className="btn btn-outline btn-sm" disabled={busyKey === `req-${row.id}`} onClick={() => respond(row, 'reject')}>
                    رفض
                  </button>
                </div>
              </div>
            ))}
            {requests.length === 0 && (
              <div className="empty">لا توجد طلبات ربط جديدة حاليًا.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'pending' && (
        <div className="card">
          <div className="card-title">
            <h3>تطعيمات بانتظار التأكيد</h3>
            <span className="badge orange">تأكيد مزدوج</span>
          </div>
          <p className="small muted">
            الأم سجّلت إتمام التطعيم، راجعي البيانات وأكديها لاعتمادها وإظهار الأعراض الجانبية لها.
          </p>
          <div className="list">
            {pending.map((row) => {
              const key = `${row.child_id}-${row.group_key}`;
              return (
                <div key={key} className="list-item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                  <div className="avatar">{row.child_name?.slice(0, 1)}</div>
                  <div className="grow">
                    <div className="name">
                      {row.child_name} <span className="muted small">· {row.ageLabel}</span>
                    </div>
                    <div className="muted small">
                      الأم: {row.mother_name} {row.mother_phone ? `· ${row.mother_phone}` : ''}
                    </div>
                    <div style={{ marginTop: '0.3rem' }}>
                      {row.vaccines?.map((v) => (
                        <span key={v.code} className="pill">
                          {v.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-teal btn-sm" disabled={busyKey === key} onClick={() => confirm(row)}>
                    {busyKey === key ? '...' : 'تأكيد'}
                  </button>
                </div>
              );
            })}
            {pending.length === 0 && (
              <div className="empty">لا يوجد تطعيمات بانتظار التأكيد حاليًا.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'children' && (
        <div className="card">
          <div className="card-title">
            <h3>الأطفال المسجّلون</h3>
          </div>
          <div className="list">
            {children.map((c) => (
              <div key={c.id} className="list-item" onClick={() => openChild(c.id)}>
                <div className="avatar">{c.name?.slice(0, 1)}</div>
                <div className="grow">
                  <div className="name">
                    {c.name} <span className="muted small">· {c.ageLabel}</span>
                  </div>
                  <div className="muted small">
                    الأم: {c.mother_name} · تطعيمات {c.vaccineProgress}
                    {c.pendingCount > 0 ? ` · ${c.pendingCount} قيد التأكيد` : ''}
                  </div>
                </div>
                <span className="badge teal">تفاصيل</span>
              </div>
            ))}
            {children.length === 0 && <div className="empty small">لا أطفال مرتبطون بوحدتك بعد.</div>}
          </div>
        </div>
      )}

      {detail && (
        <Modal title={`ملف الطفل ${detail.child?.name}`} onClose={() => setDetail(null)}>
          <div className="info-row">
            <span className="k">الأم</span>
            <span className="v">{detail.child?.mother_name}</span>
          </div>
          <div className="info-row">
            <span className="k">العمر</span>
            <span className="v">{detail.child?.ageLabel}</span>
          </div>
          <div className="info-row">
            <span className="k">التطعيمات المكتملة</span>
            <span className="v">
              {detail.overview?.confirmedCount}/{detail.overview?.totalCount}
            </span>
          </div>
          <h4 style={{ marginTop: '0.8rem' }}>سجل النمو</h4>
          {detail.growth?.length ? (
            detail.growth.map((g) => (
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
                    .join(' · ')}{' '}
                  · {g.assessment?.overallLabel}
                </span>
              </div>
            ))
          ) : (
            <div className="muted small">لا قياسات نمو مسجّلة.</div>
          )}
        </Modal>
      )}
    </Layout>
  );
}
