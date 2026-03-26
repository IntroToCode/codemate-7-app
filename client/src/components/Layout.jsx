import { NavLink } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import RecentHits from './RecentHits';

export default function Layout({ children, spinRefresh }) {
  const { userName, logout, isAdmin } = useUser();

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-emoji">🍽️</span>
          <span className="brand-name">Lunch Roulette</span>
        </div>
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>🎰 Spin</NavLink>
          <NavLink to="/restaurants" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>🗂️ Restaurants</NavLink>
          {isAdmin && (
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>⚙️ Admin</NavLink>
          )}
          <NavLink to="/log" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>📜 Log</NavLink>
        </nav>
        <div className="header-user">
          <span className="user-chip">👤 {userName}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={logout}
            title="Change name"
          >✏️</button>
        </div>
      </header>

      <div className="app-body">
        <main className="app-main">{children}</main>
        <aside className="app-sidebar">
          <RecentHits refresh={spinRefresh} />
        </aside>
      </div>
    </div>
  );
}
