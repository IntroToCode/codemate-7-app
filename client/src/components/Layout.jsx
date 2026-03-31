import { NavLink } from 'react-router-dom';
import RecentHits from './RecentHits';
import ProfileSwitcher from './ProfileSwitcher';

export default function Layout({ children, spinRefresh }) {
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
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>⚙️ Admin</NavLink>
          <NavLink to="/log" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>📜 Log</NavLink>
          <NavLink to="/activity" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>📋 Activity</NavLink>
        </nav>
        <div className="header-user">
          <ProfileSwitcher />
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
