import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api';

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5c2.5-1 5-1 7 0v13c-2-1-4.5-1-7 0v-13Z" />
      <path d="M21 5.5c-2.5-1-5-1-7 0v13c2-1 4.5-1 7 0v-13Z" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c1 3-3 4-3 7.5A3.5 3.5 0 0 0 12 14a3.5 3.5 0 0 0 3-5c1.5 1 2 3 2 4.5A5 5 0 0 1 12 21a5 5 0 0 1-5-5.5C7 11 9 8 12 3Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      <path d="M15 16l4-4-4-4" />
      <path d="M19 12H9" />
    </svg>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(() => setChecked(true))
      .catch(() => navigate('/login'));
  }, [navigate]);

  async function onLogout() {
    await api.logout();
    navigate('/login');
  }

  if (!checked) {
    return (
      <div className="page">
        <div className="loading">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand-mark">Carnet des proclamations</div>
        <nav>
          <NavLink to="/admin/cultes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon"><BookIcon /></span>
            Cultes
          </NavLink>
          <NavLink to="/admin/croisades" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon"><FlameIcon /></span>
            Semaines de croisade
          </NavLink>
        </nav>
        <button className="nav-item" onClick={onLogout}>
          <span className="nav-icon"><LogoutIcon /></span>
          Se déconnecter
        </button>
      </aside>

      <header className="admin-topbar">
        <span className="brand-mark">Carnet des proclamations</span>
        <button className="icon-btn" aria-label="Se déconnecter" onClick={onLogout}>
          <LogoutIcon />
        </button>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>

      <nav className="admin-bottomnav">
        <NavLink to="/admin/cultes" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
          <BookIcon />
          <span>Cultes</span>
        </NavLink>
        <NavLink to="/admin/croisades" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
          <FlameIcon />
          <span>Croisades</span>
        </NavLink>
      </nav>
    </div>
  );
}
