import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { authApi } from '../api/endpoints.js';

// تحقق أمان (كابتشا) قابل لإعادة الاستخدام. لا يظهر إلا إذا كان مفعّلًا من الخادم.
const Captcha = forwardRef(function Captcha({ onChange }, ref) {
  const [challenge, setChallenge] = useState({ enabled: false, captchaId: '', question: '' });
  const [answer, setAnswer] = useState('');

  const emit = (next) => onChange?.(next);

  const refresh = async () => {
    try {
      const data = await authApi.captcha();
      const enabled = Boolean(data.enabled && data.captchaId);
      setChallenge({ enabled, captchaId: data.captchaId || '', question: data.question || '' });
      setAnswer('');
      emit({ enabled, captchaId: data.captchaId || '', captchaAnswer: '' });
    } catch {
      setChallenge({ enabled: false, captchaId: '', question: '' });
      emit({ enabled: false, captchaId: '', captchaAnswer: '' });
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({ refresh }));

  const handleChange = (value) => {
    setAnswer(value);
    emit({ enabled: challenge.enabled, captchaId: challenge.captchaId, captchaAnswer: value });
  };

  if (!challenge.enabled) return null;

  return (
    <div className="field">
      <label>تحقق الأمان: {challenge.question}</label>
      <input
        inputMode="numeric"
        value={answer}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="اكتبي الناتج بالأرقام"
        required
      />
      <div className="small muted">سؤال بسيط للتأكد أنك إنسان وليس طلبًا آليًا.</div>
    </div>
  );
});

export default Captcha;
