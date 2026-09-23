import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, roleHome } from '../context/AuthContext.jsx';
import { apiError } from '../api/client.js';
import Captcha from '../components/Captcha.jsx';

const demos = [
  { label: 'أم حامل', email: 'pregnant@rafiqa.com' },
  { label: 'أم لديها طفل', email: 'mother@rafiqa.com' },
  { label: 'طبيبة', email: 'doctor@rafiqa.com' },
  { label: 'وحدة صحية', email: 'unit@rafiqa.com' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState({ enabled: false, captchaId: '', captchaAnswer: '' });
  const captchaRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = captcha.enabled
        ? { ...form, captchaId: captcha.captchaId, captchaAnswer: captcha.captchaAnswer }
        : form;
      const user = await login(payload);
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
        <h1>رفيقة الأمومة</h1>
        <p>
          رحلة واحدة تجمع الأم والطبيبة والوحدة الصحية: من الحمل، إلى تطعيمات طفلك، وحتى متابعة نموه
          خطوة بخطوة.
        </p>
        <div className="hero-points">
          <div className="hero-point">
            <span className="dot" />
            <span>محتوى توعوي أسبوعي حسب عمر الحمل ومرحلة الطفل.</span>
          </div>
          <div className="hero-point">
            <span className="dot" />
            <span>تحليل ذكي لأعراضك وتنبيه فوري لطبيبتك عند الخطر.</span>
          </div>
          <div className="hero-point">
            <span className="dot" />
            <span>حساب موعد التطعيم تلقائيًا وتأكيد مزدوج مع الوحدة الصحية.</span>
          </div>
          <div className="hero-point">
            <span className="dot" />
            <span>متابعة الوزن والطول ومحيط الرأس مقارنة بمنحنيات WHO.</span>
          </div>
        </div>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-card" onSubmit={submit}>
          <h2>تسجيل الدخول</h2>
          <p className="muted small">أدخلي بياناتك للمتابعة.</p>
          {error && <div className="alert critical">{error}</div>}
          <div className="field">
            <label>البريد الإلكتروني</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@example.com"
              required
            />
          </div>
          <div className="field">
            <label>كلمة المرور</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••"
              required
            />
          </div>
          <Captcha ref={captchaRef} onChange={setCaptcha} />
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'جارٍ الدخول...' : 'دخول'}
          </button>
          <p className="center small" style={{ marginTop: '0.8rem' }}>
            ليس لديك حساب؟ <Link to="/register">أنشئي حسابًا</Link>
          </p>
          <div className="alert brand small" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
            <strong>حسابات تجريبية (كلمة المرور 123456):</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.45rem' }}>
              {demos.map((d) => (
                <button
                  type="button"
                  key={d.email}
                  className="btn btn-ghost btn-sm"
                  onClick={() => setForm({ email: d.email, password: '123456' })}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
