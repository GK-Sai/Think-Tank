import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppBar from './AppBar';
import Sidebar from './Sidebar';
import NotificationPopups from './NotificationPopups';
import { safeLocal } from '../../lib/storage';

const NAV_KEY = 'thinktank.nav.closed';

export default function DashboardLayout() {
  const [navOpen, setNavOpen] = useState(false);          // the phone drawer
  const [collapsed, setCollapsed] = useState(
    () => safeLocal.get(NAV_KEY) === '1'                  // the desktop menu
  );
  const { pathname } = useLocation();

  // Close the drawer and jump to the top whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* Whether the menu is open is a preference, not a per-page state: it is
     still the way you left it the next time you open the app. */
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      safeLocal.set(NAV_KEY, v ? '0' : '1');
      return !v;
    });
  };

  return (
    <>
      <AppBar navOpen={navOpen} onToggleNav={() => setNavOpen((v) => !v)} />

      {/* Lives above the layout so a new idea reaches you on any page. */}
      <NotificationPopups />

      <div className={`layout${collapsed ? ' nav-closed' : ''}`}>
        <Sidebar
          open={navOpen}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onNavigate={() => setNavOpen(false)}
        />
        <div className={`scrim${navOpen ? ' show' : ''}`} onClick={() => setNavOpen(false)} />

        <div className="shell">
          <main className="content">
            <section className="panel active">
              <Outlet />
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
