import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationApi } from '../api/endpoints.js';

const typeClass = (type) => {
  if (type === 'critical_symptom') return 'red';
  if (type === 'growth_alert') return 'red';
  if (type === 'vaccine_confirmed') return 'green';
  if (type === 'vaccine_reminder') return 'amber';
  if (type === 'vaccine_pending') return 'orange';
  if (type === 'vaccine_next') return 'teal';
  if (type === 'mother_message') return 'orange';
  if (type === 'medication_reminder') return 'amber';
  if (type === 'unit_link_request') return 'amber';
  if (type === 'unit_link_accepted') return 'green';
  if (type === 'unit_link_rejected') return 'red';
  if (type === 'doctor_link_request') return 'amber';
  if (type === 'doctor_link_accepted') return 'green';
  if (type === 'doctor_link_rejected') return 'red';
  return 'gray';
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const wrapRef = useRef(null);

  const load = useCallback(() => {
    notificationApi
      .list()
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    const refresh = () => load();
    window.addEventListener('rafiqa:notifications:refresh', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('rafiqa:notifications:refresh', refresh);
    };
  }, [load]);

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markRead = async (id) => {
    await notificationApi.read(id);
    load();
  };

  const markAll = async () => {
    await notificationApi.readAll();
    load();
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button className="bell" onClick={() => setOpen((v) => !v)} aria-label="الإشعارات">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {data.unread > 0 && <span className="count">{data.unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.9rem' }}>
            <strong>الإشعارات</strong>
            {data.unread > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={markAll}>
                تعليم الكل كمقروء
              </button>
            )}
          </div>
          {data.notifications.length === 0 && <div className="empty">لا توجد إشعارات بعد</div>}
          {data.notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.is_read ? '' : 'unread'}`}
              onClick={() => !n.is_read && markRead(n.id)}
            >
              <div className="t">
                <span className={`notif-dot ${typeClass(n.type)}`} /> {n.title}
              </div>
              {n.body && <div className="b">{n.body}</div>}
              <div className="d">{n.created_at?.replace('T', ' ').slice(0, 16)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
