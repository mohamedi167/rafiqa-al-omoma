import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';

const roleLabel = { mother: 'أم', doctor: 'طبيبة', health_unit: 'وحدة صحية' };

export default function Layout({ title, subtitle, actions, children }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-badge" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
              </svg>
            </span>
            <span>
              رفيقة الأمومة
              <div className="small muted" style={{ fontWeight: 600 }}>
                رعاية الأم والطفل
              </div>
            </span>
          </div>
          <div className="topbar-actions">
            <span className="role-chip">
              {roleLabel[user?.role]} · {user?.name}
            </span>
            <NotificationBell />
            <button className="btn btn-outline btn-sm" onClick={logout}>
              خروج
            </button>
          </div>
        </div>
      </header>
      <main className="main">
        {(title || actions) && (
          <div className="page-head">
            <div className="page-title">
              {title && <h1>{title}</h1>}
              {subtitle && <div className="muted">{subtitle}</div>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
