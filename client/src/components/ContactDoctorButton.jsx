import { useState } from 'react';
import { motherApi } from '../api/endpoints.js';
import { apiError } from '../api/client.js';
import Modal from './Modal.jsx';

const toIntl = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('20')) return digits;
  if (digits.startsWith('0')) return `20${digits.slice(1)}`;
  return digits;
};

export default function ContactDoctorButton({ doctor }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    setBusy(true);
    setStatus({});
    try {
      await motherApi.contactDoctor(message.trim());
      setStatus({ type: 'normal', text: 'تم إرسال رسالتك لطبيبتك، وستراها في تنبيهاتها.' });
      setMessage('');
    } catch (err) {
      setStatus({ type: 'critical', text: apiError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
        </svg>
        تواصلي مع طبيبتك
      </button>

      {open && (
        <Modal title="التواصل مع طبيبتك المتابعة" onClose={() => setOpen(false)}>
          {!doctor ? (
            <div className="alert brand">
              لم يتم ربط طبيبة بحسابك بعد. اذهبي إلى تبويب "ملفي" واختاري الطبيبة المتابعة ثم اضغطي حفظ.
            </div>
          ) : (
            <>
              <div className="card" style={{ boxShadow: 'none', marginBottom: '0.9rem' }}>
                <div className="card-title" style={{ marginBottom: '0.4rem' }}>
                  <h3 style={{ margin: 0 }}>{doctor.name}</h3>
                  <span className="badge teal">طبيبتك المتابعة</span>
                </div>
                {doctor.speciality && <div className="info-row"><span className="k">التخصص</span><span className="v">{doctor.speciality}</span></div>}
                {doctor.organization && <div className="info-row"><span className="k">الجهة</span><span className="v">{doctor.organization}</span></div>}
                {doctor.phone && <div className="info-row"><span className="k">الهاتف</span><span className="v">{doctor.phone}</span></div>}
              </div>

              {doctor.phone && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                  <a className="btn btn-teal btn-sm" href={`tel:${doctor.phone}`}>
                    اتصال هاتفي
                  </a>
                  <a
                    className="btn btn-outline btn-sm"
                    href={`https://wa.me/${toIntl(doctor.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    محادثة واتساب
                  </a>
                </div>
              )}

              <p className="small muted">
                يمكنك أيضًا إرسال رسالة مباشرة تظهر لطبيبتك في التنبيهات داخل التطبيق.
              </p>
              {status.text && <div className={`alert ${status.type}`}>{status.text}</div>}
              <div className="field">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتبي سؤالك أو العرض الذي تريدين استشارة الطبيبة فيه..."
                />
              </div>
              <button className="btn btn-primary" onClick={send} disabled={busy || !message.trim()}>
                {busy ? 'جارٍ الإرسال...' : 'إرسال الرسالة للطبيبة'}
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
