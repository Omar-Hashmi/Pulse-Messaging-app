import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import NotificationBell from './NotificationBell.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import { useTheme } from '../hooks/useTheme.js';

export default function NavBar() {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="top-nav">
      <div className="nav-left">
        <button
          type="button"
          className="nav-hamburger"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="pulse-wave" aria-hidden="true">
            <span style={{ '--i': 0 }} />
            <span style={{ '--i': 1 }} />
            <span style={{ '--i': 2 }} />
            <span style={{ '--i': 3 }} />
          </span>
        </button>
        <div className="pulse-brand">
          <span className="pulse-name">Pulse</span>
        </div>
      </div>

      <nav className={`nav-links ${mobileOpen ? 'nav-links-open' : ''}`} aria-label="Main navigation">
        <NavLink to="/chat" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobile}>
          Chats
        </NavLink>
        <NavLink to="/archive" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobile}>
          Archived
        </NavLink>
        <NavLink to="/hidden" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobile}>
          Hidden
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobile}>
          Profile
        </NavLink>
      </nav>

      {mobileOpen && <div className="nav-backdrop" onClick={closeMobile} />}

      <div className="nav-right">
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  );
}