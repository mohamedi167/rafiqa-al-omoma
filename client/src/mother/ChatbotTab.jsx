import { useEffect, useRef, useState } from 'react';
import { aiApi } from '../api/endpoints.js';

const QUICK = [
  'بطني وجعاني',
  'ابني بيعيط كتير من الصبح',
  'ابني عنده حرارة',
  'حاسة بحركة الجنين أقل من المعتاد',
  'ابني مش بيرضع كويس',
];

const severityMeta = {
  normal: { label: 'بسيط', cls: 'green' },
  moderate: { label: 'يحتاج متابعة', cls: 'orange' },
  critical: { label: 'خطير — تدخلي فورًا', cls: 'red' },
};

export default function ChatbotTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    aiApi
      .history()
      .then((r) => setMessages(r.messages))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }]);
    setInput('');
    setBusy(true);
    try {
      const res = await aiApi.chat(text);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: res.reply, severity: res.severity, kind: res.kind },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'assistant', content: 'تعذّر الاتصال حاليًا، حاولي مرة أخرى.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        <h3>اسألي رفيقة الأمومة</h3>
        <span className="badge teal">مساعد توعوي ذكي</span>
      </div>
      <p className="small muted">
        احكيلي إيه اللي بيحصل ومع مين (إنتِ ولا طفلك) وأنا هفهم معاكي خطوة بخطوة. معلومات توعوية فقط ولا
        تغني عن استشارة الطبيبة.
      </p>

      <div className="chat-box">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="msg assistant">
              أهلاً بك يا حبيبتي، أنا رفيقتك. مش هسيبك لوحدك. اكتبيلي إيه اللي مقلقك، ولو مش عارفة تبدأي
              منين اختاري من الأمثلة اللي تحت.
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.role === 'user' ? 'user' : 'assistant'}`}>
              {m.role === 'assistant' && severityMeta[m.severity] && (
                <div style={{ marginBottom: '0.35rem' }}>
                  <span className={`badge ${severityMeta[m.severity].cls}`}>{severityMeta[m.severity].label}</span>
                </div>
              )}
              {m.content}
            </div>
          ))}
          {busy && <div className="msg assistant">...بسمعك وبفكر</div>}
          <div ref={bottomRef} />
        </div>

        <div className="chat-quick">
          {QUICK.map((q) => (
            <button key={q} className="chip chip-btn" onClick={() => send(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>

        <div className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="اكتبي سؤالك أو وصف الأعراض..."
          />
          <button className="btn btn-primary" onClick={() => send()} disabled={busy || !input.trim()}>
            إرسال
          </button>
        </div>
      </div>
    </div>
  );
}
