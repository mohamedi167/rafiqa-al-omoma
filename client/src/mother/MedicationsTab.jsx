import { useCallback, useEffect, useState } from 'react';
import { medicationApi } from '../api/endpoints.js';
import { apiError } from '../api/client.js';

const emptyForm = {
  forWhom: '',
  name: '',
  dose: '',
  form: 'أقراص',
  times: ['08:00'],
  startDate: '',
  endDate: '',
  notes: '',
};

const statusMeta = {
  pending: { label: 'بانتظار', cls: 'orange' },
  taken: { label: 'تم الأخذ', cls: 'green' },
  skipped: { label: 'تم تخطيها', cls: 'gray' },
};

export default function MedicationsTab({ data, reload }) {
  const children = data?.children || [];
  const [meds, setMeds] = useState([]);
  const [forms, setForms] = useState(['أقراص']);
  const [doses, setDoses] = useState([]);
  const [date, setDate] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadMeds = useCallback(() => {
    return medicationApi
      .list()
      .then((res) => {
        setMeds(res.medications || []);
        if (res.forms?.length) setForms(res.forms);
      })
      .catch((err) => setError(apiError(err)));
  }, []);

  const loadToday = useCallback(() => {
    return medicationApi
      .today()
      .then((res) => {
        setDoses(res.doses || []);
        setDate(res.date);
      })
      .catch(() => {});
  }, []);

  const refresh = useCallback(() => {
    loadMeds();
    loadToday();
    window.dispatchEvent(new Event('rafiqa:medications:refresh'));
  }, [loadMeds, loadToday]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setTime = (index, value) => {
    setForm((prev) => ({ ...prev, times: prev.times.map((t, i) => (i === index ? value : t)) }));
  };
  const addTime = () => setForm((prev) => ({ ...prev, times: [...prev.times, '12:00'] }));
  const removeTime = (index) =>
    setForm((prev) => ({ ...prev, times: prev.times.filter((_, i) => i !== index) }));

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const payload = {
      name: form.name,
      dose: form.dose,
      form: form.form,
      times: form.times,
      childId: form.forWhom || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      notes: form.notes,
    };
    try {
      if (editingId) {
        await medicationApi.update(editingId, payload);
        setNotice('تم تحديث الدواء.');
      } else {
        await medicationApi.create(payload);
        setNotice('تمت إضافة الدواء وضبط المنبّه على أوقاته.');
      }
      resetForm();
      refresh();
      reload?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (med) => {
    setEditingId(med.id);
    setForm({
      forWhom: med.child_id ? String(med.child_id) : '',
      name: med.name,
      dose: med.dose || '',
      form: med.form || 'أقراص',
      times: med.times?.length ? med.times : ['08:00'],
      startDate: med.start_date || '',
      endDate: med.end_date || '',
      notes: med.notes || '',
    });
    setError('');
    setNotice('');
  };

  const toggleMed = async (med) => {
    try {
      await medicationApi.toggle(med.id);
      refresh();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const removeMed = async (med) => {
    if (!window.confirm(`حذف دواء "${med.name}" وكل سجلاته؟`)) return;
    try {
      await medicationApi.remove(med.id);
      if (editingId === med.id) resetForm();
      refresh();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const markDose = async (dose, status) => {
    try {
      const res = await medicationApi.log(dose.medicationId, { time: dose.time, status });
      setDoses(res.doses || []);
      loadMeds();
      window.dispatchEvent(new Event('rafiqa:medications:refresh'));
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">
          <h3>جدول اليوم</h3>
          <span className="badge teal">{date}</span>
        </div>
        <div className="list">
          {doses.map((dose) => {
            const meta = statusMeta[dose.status] || statusMeta.pending;
            return (
              <div key={`${dose.medicationId}-${dose.time}`} className="list-item" style={{ cursor: 'default' }}>
                <div className="dose-time">{dose.time}</div>
                <div className="grow">
                  <div className="name">
                    {dose.name}
                    {dose.dose ? ` · ${dose.dose}` : ''}
                  </div>
                  <div className="muted small">
                    {dose.forWhom}
                    {dose.form ? ` · ${dose.form}` : ''}
                  </div>
                </div>
                <span className={`badge ${meta.cls}`}>{meta.label}</span>
                {dose.status === 'pending' && (
                  <button className="btn btn-teal btn-sm" onClick={() => markDose(dose, 'taken')}>
                    تم الأخذ
                  </button>
                )}
              </div>
            );
          })}
          {doses.length === 0 && <div className="empty small">لا توجد جرعات مجدولة اليوم. أضيفي دواءً من الأسفل.</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>{editingId ? 'تعديل الدواء' : 'إضافة دواء'}</h3>
          {editingId && (
            <button className="btn btn-ghost btn-sm" onClick={resetForm}>
              إلغاء التعديل
            </button>
          )}
        </div>
        {notice && <div className="alert normal">{notice}</div>}
        {error && <div className="alert critical">{error}</div>}
        <form onSubmit={submit}>
          <div className="grid-3">
            <div className="field">
              <label>لمن الدواء؟</label>
              <select value={form.forWhom} onChange={(e) => setForm({ ...form, forWhom: e.target.value })}>
                <option value="">أنا (الأم)</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>اسم الدواء</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="مثال: باراسيتامول" />
            </div>
            <div className="field">
              <label>الجرعة</label>
              <input value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="مثال: 5 مل / قرص" />
            </div>
          </div>

          <div className="grid-3">
            <div className="field">
              <label>الشكل</label>
              <select value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })}>
                {forms.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>من تاريخ (اختياري)</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="field">
              <label>إلى تاريخ (اختياري)</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>

          <div className="field">
            <label>أوقات الجرعات (رنّة المنبّه)</label>
            {form.times.map((t, i) => (
              <div key={i} className="time-row">
                <input type="time" value={t} onChange={(e) => setTime(i, e.target.value)} required />
                {form.times.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeTime(i)}>
                    حذف
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addTime}>
              + إضافة وقت آخر
            </button>
          </div>

          <div className="field">
            <label>ملاحظات (اختياري)</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="مثال: بعد الأكل" />
          </div>

          <button className="btn btn-primary" disabled={busy || !form.name.trim()}>
            {busy ? 'جارٍ الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة الدواء وتفعيل المنبّه'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>أدويتي وأدوية أطفالي</h3>
          <span className="badge gray">{meds.length}</span>
        </div>
        <div className="list">
          {meds.map((med) => (
            <div key={med.id} className="list-item" style={{ cursor: 'default', opacity: med.is_active ? 1 : 0.6 }}>
              <div className="avatar">{med.name?.slice(0, 1)}</div>
              <div className="grow">
                <div className="name">
                  {med.name}
                  {med.dose ? ` · ${med.dose}` : ''}
                </div>
                <div className="muted small">
                  {med.child_id ? med.child_name : 'أنا'}
                  {med.form ? ` · ${med.form}` : ''}
                  {med.is_active ? '' : ' · موقوف'}
                </div>
                <div className="chips">
                  {med.times?.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
                {(med.start_date || med.end_date) && (
                  <div className="muted small">
                    من {med.start_date || 'البداية'} إلى {med.end_date || 'استمرار'}
                  </div>
                )}
                {med.notes && <div className="muted small">{med.notes}</div>}
              </div>
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(med)}>
                  تعديل
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleMed(med)}>
                  {med.is_active ? 'إيقاف' : 'تشغيل'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => removeMed(med)}>
                  حذف
                </button>
              </div>
            </div>
          ))}
          {meds.length === 0 && <div className="empty small">لم تضيفي أي دواء بعد.</div>}
        </div>
      </div>
    </div>
  );
}
