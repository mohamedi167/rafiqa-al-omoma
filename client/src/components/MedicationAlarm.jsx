import { useCallback, useEffect, useRef, useState } from 'react';
import { medicationApi } from '../api/endpoints.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function minutesSince(hm, now) {
  const [h, m] = String(hm).split(':').map(Number);
  const t = new Date(now);
  t.setHours(h, m, 0, 0);
  return Math.round((now.getTime() - t.getTime()) / 60000);
}

export default function MedicationAlarm() {
  const [doses, setDoses] = useState([]);
  const [ringing, setRinging] = useState([]);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );
  const dosesRef = useRef([]);
  const firedRef = useRef(new Set());
  const audioRef = useRef(null);
  const ringTimerRef = useRef(null);

  const load = useCallback(() => {
    medicationApi
      .today()
      .then((res) => {
        dosesRef.current = res.doses || [];
        setDoses(res.doses || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    const refresh = () => load();
    window.addEventListener('rafiqa:medications:refresh', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('rafiqa:medications:refresh', refresh);
    };
  }, [load]);

  const ensureCtx = useCallback(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioRef.current) audioRef.current = new Ctx();
    if (audioRef.current.state === 'suspended') audioRef.current.resume().catch(() => {});
    return audioRef.current;
  }, []);

  const beep = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.28].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.32, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.24);
    });
  }, [ensureCtx]);

  const stopRing = useCallback(() => {
    if (ringTimerRef.current) {
      clearInterval(ringTimerRef.current);
      ringTimerRef.current = null;
    }
  }, []);

  const startRing = useCallback(() => {
    stopRing();
    beep();
    ringTimerRef.current = setInterval(beep, 1600);
  }, [beep, stopRing]);

  const fire = useCallback(
    (dose) => {
      setRinging((prev) => (prev.some((d) => d.medicationId === dose.medicationId && d.time === dose.time) ? prev : [...prev, dose]));
      startRing();
      try {
        navigator.vibrate?.([350, 180, 350, 180, 350]);
      } catch {
        /* ignore */
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const n = new Notification(`موعد دواء: ${dose.name}`, {
            body: `حان الآن وقت ${dose.name}${dose.dose ? ` (${dose.dose})` : ''}${dose.childId ? ` لـ ${dose.childName}` : ''}.`,
            tag: `med-${dose.medicationId}-${dose.time}`,
            renotify: true,
          });
          n.onclick = () => window.focus();
        } catch {
          /* ignore */
        }
      }
    },
    [startRing],
  );

  // فحص الأوقات كل 15 ثانية
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const date = localDate(now);
      for (const dose of dosesRef.current) {
        if (dose.status !== 'pending') continue;
        const since = minutesSince(dose.time, now);
        if (since < 0 || since > 1) continue;
        const key = `${dose.medicationId}|${date}|${dose.time}`;
        if (firedRef.current.has(key)) continue;
        firedRef.current.add(key);
        fire(dose);
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [doses, fire]);

  // إيقاف الصوت تلقائيًا لو مفيش تنبيهات شغالة
  useEffect(() => {
    if (ringing.length === 0) stopRing();
  }, [ringing.length, stopRing]);

  useEffect(() => () => stopRing(), [stopRing]);

  // تشغيل الصوت بعد أول تفاعل من المستخدم (سياسات المتصفح)
  useEffect(() => {
    const unlock = () => ensureCtx();
    document.addEventListener('pointerdown', unlock, { once: true });
    return () => document.removeEventListener('pointerdown', unlock);
  }, [ensureCtx]);

  const enableNotifications = async () => {
    ensureCtx();
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        new Notification('تم تفعيل المنبّه', { body: 'سنذكّرك بمواعيد الأدوية في وقتها بإذن الله.' });
      }
    } catch {
      /* ignore */
    }
  };

  const markTaken = async (dose) => {
    setRinging((prev) => prev.filter((d) => !(d.medicationId === dose.medicationId && d.time === dose.time)));
    try {
      await medicationApi.log(dose.medicationId, { time: dose.time, status: 'taken' });
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event('rafiqa:medications:refresh'));
    load();
  };

  const snooze = (dose) => {
    setRinging((prev) => prev.filter((d) => !(d.medicationId === dose.medicationId && d.time === dose.time)));
    setTimeout(() => fire(dose), 10 * 60 * 1000);
  };

  const dismiss = (dose) => {
    setRinging((prev) => prev.filter((d) => !(d.medicationId === dose.medicationId && d.time === dose.time)));
  };

  const showEnableBanner = permission === 'default' || permission === 'denied';

  return (
    <>
      {showEnableBanner && (
        <div className="alarm-banner">
          <div className="grow">
            <strong>فعّلي المنبّه</strong>
            <div className="small muted">
              {permission === 'denied'
                ? 'الإشعارات مرفوضة من إعدادات المتصفح. اسمحي بها من إعدادات الموقع ليصل صوت المنبّه.'
                : 'اسمحي بالإشعارات ليعمل منبّه الأدوية ويصلك الصوت في وقته.'}
            </div>
          </div>
          {permission !== 'denied' && (
            <button className="btn btn-primary btn-sm" onClick={enableNotifications}>
              تفعيل المنبّه
            </button>
          )}
        </div>
      )}

      {ringing.length > 0 && (
        <div className="alarm-overlay">
          <div className="alarm-box">
            <div className="alarm-icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
            </div>
            <h2>وقت الدواء</h2>
            {ringing.map((dose) => (
              <div key={`${dose.medicationId}-${dose.time}`} className="alarm-dose">
                <div className="name">
                  {dose.name}
                  {dose.dose ? ` · ${dose.dose}` : ''}
                </div>
                <div className="muted small">
                  الساعة {dose.time} · {dose.forWhom}
                </div>
                <div className="alarm-actions">
                  <button className="btn btn-primary" onClick={() => markTaken(dose)}>
                    أخذت الدواء
                  </button>
                  <button className="btn btn-ghost" onClick={() => snooze(dose)}>
                    ذكّريني بعد 10 دقائق
                  </button>
                  <button className="btn btn-ghost" onClick={() => dismiss(dose)}>
                    إغلاق
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
