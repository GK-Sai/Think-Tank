import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MenuIcon, BellIcon } from '../../lib/icons';
import { initialsOf, displayName } from '../../lib/format';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';

export default function AppBar({ onToggleNav, navOpen }) {
  const { user, isChair } = useAuth();
  const { unreadCount } = useApp();
  const navigate = useNavigate();
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <header className="appbar">
      <button
        className="ab-btn hamburger"
        onClick={onToggleNav}
        aria-label="Open menu"
        aria-expanded={navOpen}
        aria-controls="sidebar"
      >
        <MenuIcon />
      </button>

      <div className="appbar-brand">
        <span className={`brand-tile${logoFailed ? ' no-image' : ''}`}>
          <img src="/logo-mark.png" alt="" onError={() => setLogoFailed(true)} />
          <span className="fallback">TT</span>
        </span>
        <span className="brand-text">
          <strong>Think Tank</strong>
          <span>Ideas · Insights · Impact</span>
        </span>
      </div>

      <div className="appbar-right">
        <button className="ab-btn" onClick={() => navigate('/notifications')} aria-label="Notifications">
          <BellIcon />
          {unreadCount > 0 && <span className="dot" />}
        </button>
        <div className="ab-user">
          <span className="circle">{initialsOf(displayName(user?.name, user?.role)) || 'TT'}</span>
          <span className="who">
            <strong>{displayName(user?.name, user?.role) || 'User'}</strong>
            <span>{user?.title || (isChair ? 'Chairman' : 'Team Member')}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
