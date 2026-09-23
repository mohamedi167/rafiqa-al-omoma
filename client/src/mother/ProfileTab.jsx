import { useEffect, useState } from 'react';
import { motherApi, childApi } from '../api/endpoints.js';
import { apiError } from '../api/client.js';

export default function ProfileTab({ data, reload }) {
  const profile = data?.profile;
  const children = data?.children || [];
  const [doctorCode, setDoctorCode] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [lmpDate, setLmpDate] = useState(profile?.lmp_date || '');
  const [child, setChild] = useState({ name: '', birthDate: '', gender: 'male' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLmpDate(profile?.lmp_date || '');
  }, [profile]);

  const saveProfile = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await motherApi.updateProfile({ lmpDate: lmpDate || null });
      setMessage('تم تحديث بياناتك بنجاح.');
      reload?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const sendDoctorRequest = async () => {
    if (!doctorCode.trim()) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await motherApi.linkDoctor(doctorCode.trim());
      setMessage(res.message || 'تم إرسال طلب الربط للطبيبة.');
      setDoctorCode('');
      reload?.();
      window.dispatchEvent(new Event('rafiqa:notifications:refresh'));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const sendUnitRequest = async () => {
    if (!unitCode.trim()) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await motherApi.linkUnit(unitCode.trim());
      setMessage(res.message || 'تم إرسال طلب الربط للوحدة الصحية.');
      setUnitCode('');
      reload?.();
      window.dispatchEvent(new Event('rafiqa:notifications:refresh'));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const addChild = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await childApi.create(child);
      setChild({ name: '', birthDate: '', gender: 'male' });
      setMessage('تمت إضافة الطفل وبدأ جدول التطعيمات تلقائيًا.');
      reload?.();
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
          <h3>بياناتي</h3>
        </div>
        {message && <div className="alert normal">{message}</div>}
        {error && <div className="alert critical">{error}</div>}
        <div className="field">
          <label>تاريخ أول يوم من آخر دورة (لحساب الحمل)</label>
          <input type="date" value={lmpDate || ''} onChange={(e) => setLmpDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={saveProfile} disabled={busy}>
          {busy ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>الطبيبة المتابعة</h3>
          {data?.doctor ? (
            <span className="badge green">مرتبطة</span>
          ) : data?.doctorLinkRequest?.status === 'pending' ? (
            <span className="badge orange">بانتظار الموافقة</span>
          ) : (
            <span className="badge gray">غير مرتبطة</span>
          )}
        </div>

        {data?.doctor ? (
          <>
            <div className="info-row">
              <span className="k">الطبيبة</span>
              <span className="v">{data.doctor.name}</span>
            </div>
            {data.doctor.speciality && (
              <div className="info-row">
                <span className="k">التخصص</span>
                <span className="v">{data.doctor.speciality}</span>
              </div>
            )}
            <p className="small muted" style={{ marginTop: '0.5rem' }}>
              يمكنك التواصل مع طبيبتك مباشرة من تبويب "اسألي رفيقة".
            </p>
          </>
        ) : (
          <>
            {data?.doctorLinkRequest?.status === 'pending' && (
              <div className="alert moderate">
                أدخلتِ كود {data.doctorLinkRequest.code_used} وأرسلنا طلب ربط إلى
                {data.doctorLinkRequest.doctor ? ` "${data.doctorLinkRequest.doctor.name}"` : ' الطبيبة'}. بانتظار
                موافقتها. بمجرد الموافقة سيتم الربط تلقائيًا.
              </div>
            )}
            {data?.doctorLinkRequest?.status === 'rejected' && (
              <div className="alert critical">
                لم توافق الطبيبة على طلب الربط السابق. تأكدي من الكود معها ثم أرسلي طلبًا جديدًا.
              </div>
            )}
            <p className="small muted">
              احصلي على كود طبيبتك المتابعة، ثم أدخليه هنا لإرسال طلب الربط.
            </p>
            <div className="field">
              <label>كود الطبيبة</label>
              <input
                value={doctorCode}
                onChange={(e) => setDoctorCode(e.target.value.toUpperCase())}
                placeholder="DOC-XXXXX"
                maxLength={10}
              />
            </div>
            <button className="btn btn-teal" onClick={sendDoctorRequest} disabled={busy || !doctorCode.trim()}>
              {busy ? 'جارٍ الإرسال...' : 'إرسال طلب الربط للطبيبة'}
            </button>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h3>الوحدة الصحية</h3>
          {data?.healthUnit ? (
            <span className="badge green">مرتبطة</span>
          ) : data?.linkRequest?.status === 'pending' ? (
            <span className="badge orange">بانتظار الموافقة</span>
          ) : (
            <span className="badge gray">غير مرتبطة</span>
          )}
        </div>

        {data?.healthUnit ? (
          <>
            <div className="info-row">
              <span className="k">الوحدة الحالية</span>
              <span className="v">{data.healthUnit.name}</span>
            </div>
            {data.healthUnit.organization && (
              <div className="info-row">
                <span className="k">الجهة</span>
                <span className="v">{data.healthUnit.organization}</span>
              </div>
            )}
            {data.healthUnit.code && (
              <div className="info-row">
                <span className="k">كود الوحدة</span>
                <span className="v">{data.healthUnit.code}</span>
              </div>
            )}
            <p className="small muted" style={{ marginTop: '0.5rem' }}>
              تم تأكيد ارتباطك بالوحدة، وكل تطعيمات طفلك ستظهر للوحدة للتأكيد المزدوج.
            </p>
          </>
        ) : (
          <>
            {data?.linkRequest?.status === 'pending' && (
              <div className="alert moderate">
                أدخلتِ كود {data.linkRequest.code_used} وأرسلنا طلب ربط إلى
                {data.linkRequest.unit ? ` "${data.linkRequest.unit.name}"` : ' الوحدة'}. بانتظار موافقة الوحدة
                الصحية. بمجرد الموافقة سيتم الربط تلقائيًا.
              </div>
            )}
            {data?.linkRequest?.status === 'rejected' && (
              <div className="alert critical">
                لم توافق الوحدة على طلب الربط السابق. تأكدي من الكود مع الوحدة ثم أرسلي طلبًا جديدًا.
              </div>
            )}
            {(!data?.linkRequest || data?.linkRequest?.status === 'rejected') && (
              <div className="alert info">
                لا توجد وحدة صحية مرتبطة حاليًا، لذلك تسجّلين تطعيمات طفلك بنفسك مباشرة دون انتظار تأكيد. يمكنك
                إدخال كود وحدة صحية في أي وقت للتحويل إلى التأكيد المزدوج.
              </div>
            )}
            <p className="small muted">
              احصلي على كود وحدتك الصحية (من الوحدة قبل الولادة)، ثم أدخليه هنا لإرسال طلب الربط.
            </p>
            {error && <div className="alert critical">{error}</div>}
            {message && !data?.healthUnit && !data?.linkRequest?.status?.includes('pending') && (
              <div className="alert normal">{message}</div>
            )}
            <div className="field">
              <label>كود الوحدة الصحية</label>
              <input
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value.toUpperCase())}
                placeholder="UNIT-XXXXX"
                maxLength={10}
              />
            </div>
            <button className="btn btn-teal" onClick={sendUnitRequest} disabled={busy || !unitCode.trim()}>
              {busy ? 'جارٍ الإرسال...' : 'إرسال طلب الربط للوحدة'}
            </button>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h3>أطفالي</h3>
          <span className="badge teal">{children.length}</span>
        </div>
        <div className="list" style={{ marginBottom: '1rem' }}>
          {children.map((c) => (
            <div key={c.id} className="list-item" style={{ cursor: 'default' }}>
              <div className="avatar">{c.name?.slice(0, 1)}</div>
              <div className="grow">
                <div className="name">{c.name}</div>
                <div className="muted small">
                  {c.gender === 'female' ? 'أنثى' : 'ذكر'} · {c.ageLabel} · تطعيمات {c.vaccineProgress}
                </div>
              </div>
            </div>
          ))}
          {children.length === 0 && <div className="empty small">لا أطفال مسجّلون بعد.</div>}
        </div>

        <h4>إضافة طفل</h4>
        <form onSubmit={addChild}>
          <div className="grid-3">
            <div className="field">
              <label>اسم الطفل</label>
              <input value={child.name} onChange={(e) => setChild({ ...child, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>تاريخ الميلاد</label>
              <input type="date" value={child.birthDate} onChange={(e) => setChild({ ...child, birthDate: e.target.value })} required />
            </div>
            <div className="field">
              <label>النوع</label>
              <select value={child.gender} onChange={(e) => setChild({ ...child, gender: e.target.value })}>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
          </div>
          <button className="btn btn-teal" disabled={busy}>
            إضافة الطفل
          </button>
        </form>
      </div>
    </div>
  );
}
