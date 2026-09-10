import { NavLink, useNavigate } from 'react-router-dom';
import {
  HomeIcon, BulbIcon, TaskIcon, TeamIcon, LogIcon, BellIcon, SignOutIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '../../lib/icons';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { useToast } from '../../store/ToastContext';

/**
 * The left-hand menu.
 *
 * It closes down to a strip of icons and opens again — the button at the top
 * does it, and the choice is remembered, so someone who wants the full width
 * for a flowchart or a calendar keeps it that way. Closed, every row still
 * works: the label becomes the tooltip.
 *
 * On a phone the sidebar is a drawer opened from the hamburger in the app bar,
 * so the close button is not shown there.
 */
export default function Sidebar({ open, collapsed, onToggleCollapsed, onNavigate }) {
  const { isChair, signOut } = useAuth();
  const { unreadCount } = useApp();
  const toast = useToast();
  const navigate = useNavigate();

  // The only difference between the two roles is this label: the chairman
  // sees the whole organisation's tasks, a member sees only their own.
  const tasksLabel = isChair ? 'Tasks Overview' : 'My Tasks';

  const items = [
    { to: '/', end: true, icon: <HomeIcon />, label: 'Dashboard' },
    { to: '/ideas', icon: <BulbIcon />, label: 'Ideas' },
    { to: '/tasks', icon: <TaskIcon />, label: tasksLabel },
    { to: '/team', icon: <TeamIcon />, label: 'Team' },
    { to: '/think-log', icon: <LogIcon />, label: 'Think Log' },
    { to: '/notifications', icon: <BellIcon />, label: 'Notifications', badge: unreadCount },
  ];

  const handleSignOut = async () => {
    toast('Signing out…');
    await signOut();                       // clears the cookie server-side
    navigate('/login', { replace: true });
  };

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} id="sidebar">
      <button
        type="button"
        className="nav-collapse"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Open the menu' : 'Close the menu'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Open the menu' : 'Close the menu'}
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        <span>Close menu</span>
      </button>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 9 }} aria-label="Main">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={onNavigate}
            title={it.label}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {it.icon}
            <span>{it.label}</span>
            {it.badge > 0 && <span className="badge">{it.badge}</span>}
          </NavLink>
        ))}
      </nav>

      <span className="nav-spacer" />

      <button className="nav-item signout" onClick={handleSignOut} title="Sign Out">
        <SignOutIcon />
        <span>Sign Out</span>
      </button>
    </aside>
  );
}
