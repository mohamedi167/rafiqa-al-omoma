import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, roleHome } from '../context/AuthContext.jsx';
import { apiError } from '../api/client.js';
import Captcha from '../components/Captcha.jsx';

const roles = [
  { value: 'mother', label: 'أم' },
  { value: 'doctor', label: 'طبيبة' },
  { value: 'health_unit', label: 'وحدة صحية' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'mother',
    phone: '',
    organization: '',
    speciality: '',
    lmpDate: '',
    hasHealthUnit: 'no',
    unitCode: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState({ enabled: false, captchaId: '', captchaAnswer: '' });
  const captchaRef = useRef(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.role === 'mother' && form.hasHealthUnit === 'yes' && !form.unitCode.trim()) {
      setError('أدخلي كود الوحدة الصحية، أو اختاري "بدون وحدة صحية".');
      return;
    }
    setLoading(true);
    try {
      const base = form.role === 'mother'
        ? { ...form, hasHealthUnit: form.hasHealthUnit === 'yes' }
        : form;
      const payload = captcha.enabled
        ? { ...base, captchaId: captcha.captchaId, captchaAnswer: captcha.captchaAnswer }
        : base;
      const user = await register(payload);
      navigate(roleHome(user.role), { replace: true });
    } catch (err) {
      setError(apiError(err));
      if (err?.response?.data?.captchaRequired) captchaRef.current?.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <h1>انضمي إلى رفيقة الأمومة</h1>
        <p>
          حساب واحد لكل طرف: الأم تتابع حملها وطفلها، الطبيبة تتابع الحالات والتنبيهات، والوحدة الصحية
          تؤكد التطعيمات لضمان دقة البيانات.
        </p>
        <div className="hero-points">
          <div className="hero-point">
            <span className="dot" />
            <span>بياناتك محفوظة بشكل دائم وآمن.</span>
          </div>
          <div className="hero-point">
            <span className="dot" />
            <span>تنبيهات فورية عند الأعراض الخطيرة أو انحراف النمو.</span>
          </div>
        </div>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-card" onSubmit={submit}>
          <h2>إنشاء حساب</h2>
          {error && <div className="alert critical">{error}</div>}
          <div className="field">
            <label>الاسم الكامل</label>
            <input value={form.name} onChange={set('name')} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>البريد الإلكتروني</label>
              <input type="email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="field">
              <label>كلمة المرور</label>
              <input type="password" value={form.password} onChange={set('password')} minLength={6} required />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>نوع الحساب</label>
              <select value={form.role} onChange={set('role')}>
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>رقم الهاتف</label>
              <input value={form.phone} onChange={set('phone')} placeholder="01xxxxxxxxx" />
            </div>
          </div>

          {form.role === 'mother' && (
            <>
              <div className="field">
                <label>هل أنتِ مرتبطة بوحدة صحية على رفيقة الأمومة؟</label>
                <div className="choice-row">
                  <button
                    type="button"
                    className={`choice-opt ${form.hasHealthUnit === 'yes' ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, hasHealthUnit: 'yes' })}
                  >
                    <span className="t">نعم، لديّ وحدة صحية</span>
                    <span className="d">سأدخل كود الوحدة، وتؤكد الوحدة تطعيمات طفلي للتأكيد المزدوج.</span>
                  </button>
                  <button
                    type="button"
                    className={`choice-opt ${form.hasHealthUnit === 'no' ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, hasHealthUnit: 'no', unitCode: '' })}
                  >
                    <span className="t">لا، بدون وحدة صحية</span>
                    <span className="d">سأسجّل تطعيمات طفلي بنفسي دون انتظار تأكيد أي جهة.</span>
                  </button>
                </div>
              </div>

              {form.hasHealthUnit === 'yes' && (
                <div className="field">
                  <label>كود الوحدة الصحية</label>
                  <input
                    value={form.unitCode}
                    onChange={set('unitCode')}
                    placeholder="UNIT-XXXXX"
                    required
                  />
                  <div className="small muted">
                    تحصلي على الكود من الوحدة الصحية. سنرسل طلب ربط، وتُفعّل المتابعة بعد موافقة الوحدة.
                  </div>
                </div>
              )}

              {form.hasHealthUnit === 'no' && (
                <div className="alert info">
                  بدون وحدة صحية: تقدرين تسجّلين تطعيمات طفلك بنفسك مباشرة، وتغيير الاختيار متاح لاحقًا من
                  تبويب "ملفي".
                </div>
              )}

              <div className="field">
                <label>تاريخ أول يوم من آخر دورة (اختياري)</label>
                <input type="date" value={form.lmpDate} onChange={set('lmpDate')} />
                <div className="small muted">نحسب منه أسبوع الحمل وموعد الولادة المتوقع.</div>
              </div>
            </>
          )}

          {form.role === 'doctor' && (
            <div className="grid-2">
              <div className="field">
                <label>التخصص</label>
                <input value={form.speciality} onChange={set('speciality')} placeholder="نساء وتوليد" />
              </div>
              <div className="field">
                <label>الجهة / العيادة</label>
                <input value={form.organization} onChange={set('organization')} />
              </div>
            </div>
          )}

          {form.role === 'health_unit' && (
            <div className="field">
              <label>اسم الوحدة الصحية / الجهة</label>
              <input value={form.organization} onChange={set('organization')} />
            </div>
          )}

          <Captcha ref={captchaRef} onChange={setCaptcha} />
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
          </button>
          <p className="center small" style={{ marginTop: '0.8rem' }}>
            لديك حساب؟ <Link to="/login">تسجيل الدخول</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
