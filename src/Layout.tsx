import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  ChartNoAxesCombined,
  Wallet,
  CalendarDays,
  Megaphone,
  Files,
  Settings,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  ArrowUpRight,
  CircleHelp,
} from 'lucide-react';
import { useAuth, useTheme } from './context';
import { Brand, Loading, ErrorState } from './components';
import { SchoolLogo } from './ProfileImages';

const navigation = [
  { label: 'Overview', to: '/', icon: LayoutDashboard, permission: '' },
  { label: 'User manual', to: '/manual', icon: CircleHelp, permission: '' },
  { label: 'Students', to: '/students', icon: GraduationCap, permission: 'students.view' },
  { label: 'Parents & guardians', to: '/parents', icon: Users, permission: 'parents.view' },
  { label: 'Staff & teachers', to: '/staff', icon: Users, permission: 'staff.view' },
  { label: 'Academics', to: '/academics', icon: BookOpen, permission: 'academics.view' },
  { label: 'Attendance', to: '/attendance', icon: ClipboardCheck, permission: 'attendance.view' },
  {
    label: 'Results & grading',
    to: '/results',
    icon: ChartNoAxesCombined,
    permission: 'results.view',
  },
  { label: 'Fees & payments', to: '/finance', icon: Wallet, permission: 'finance.view' },
  { label: 'Timetable', to: '/timetable', icon: CalendarDays, permission: 'academics.view' },
  {
    label: 'Communication',
    to: '/communication',
    icon: Megaphone,
    permission: 'notifications.view',
  },
  { label: 'Documents & reports', to: '/reports', icon: Files, permission: 'reports.view' },
  { label: 'Audit trail', to: '/audit', icon: ShieldCheck, permission: 'audit.view' },
  {
    label: 'School settings',
    to: '/settings',
    icon: Settings,
    permission: 'school.manage_settings',
  },
];

const platformNavigation = [
  { label: 'Platform analytics', to: '/platform', icon: ChartNoAxesCombined },
  { label: 'School access control', to: '/platform/access', icon: ShieldCheck },
];

export function Layout() {
  const auth = useAuth();
  const theme = useTheme();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  if (!auth.signedIn)
    return (
      <Navigate
        to={
          '/login' +
          (location.pathname.startsWith('/attendance/qr')
            ? '?returnTo=' + encodeURIComponent(location.pathname + location.search)
            : '')
        }
        replace
      />
    );
  if (auth.loading) return <Loading />;
  if (auth.error || !auth.session)
    return (
      <div className="standalone-error">
        <ErrorState
          error={auth.error || new Error('Could not load your account.')}
          retry={auth.refresh}
        />
        <button className="btn" onClick={() => void auth.signOut()}>
          Return to sign in
        </button>
      </div>
    );
  const { school, user } = auth.session;
  const isPlatformAdmin = user.role === 'PLATFORM_SUPER_ADMIN';
  if (user.must_change_password) return <Navigate to="/change-password" replace />;
  if (user.role === 'TEACHER' || user.role === 'PARENT') {
    const prefix = user.role === 'TEACHER' ? '/teacher' : '/parent';
    const page = location.pathname.startsWith('/attendance')
      ? '/attendance'
      : location.pathname === '/results'
        ? '/results'
        : '/dashboard';
    return <Navigate to={prefix + page + location.search} replace />;
  }
  const title = isPlatformAdmin
    ? location.pathname.startsWith('/platform/access')
      ? 'School access control'
      : 'Platform analytics'
    : navigation.find((n) => n.to !== '/' && location.pathname.startsWith(n.to))?.label ||
      'Overview';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={'sidebar ' + (mobile ? 'sidebar-open' : '')}>
        <div className="sidebar-brand">
          <Link to={isPlatformAdmin ? '/platform' : '/'} aria-label="ile-iwe home">
            <Brand />
          </Link>
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="school-switch">
          <span className="school-avatar">
            <SchoolLogo />
          </span>
          <div>
            <strong>{school.name}</strong>
            <small>{isPlatformAdmin ? 'Platform workspace' : 'School workspace'}</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(isPlatformAdmin
            ? platformNavigation
            : navigation.filter((n) => !n.permission || auth.can(n.permission))
          ).map((n) => (
            <NavLink key={n.to} end={n.to === '/'} to={n.to} onClick={() => setMobile(false)}>
              <n.icon size={18} strokeWidth={1.8} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={'sidebar-bottom ' + (isPlatformAdmin ? 'platform-sidebar-bottom' : '')}>
          <div className="school-note">
            <span className="note-spark">✦</span>
            <strong>A little more time to teach.</strong>
            <p>Your school day, all in one place.</p>
            <Link to="/">
              Back to your overview <ArrowUpRight size={14} />
            </Link>
          </div>
          <button className="profile-button" onClick={() => void auth.signOut()} title="Sign out">
            <span className="user-avatar">
              {user.name
                .split(' ')
                .map((n: string) => n[0])
                .slice(0, 2)
                .join('')}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.role.replaceAll('_', ' ').toLowerCase()}</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="workspace-status">
              <i />{' '}
              {school.school_type === 'COMBINED'
                ? 'Primary & secondary'
                : school.school_type.toLowerCase()}
            </span>
            <button
              className="icon-button theme-button"
              aria-label={theme.dark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={theme.toggle}
            >
              {theme.dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <span className="topbar-avatar">{user.name[0]}</span>
          </div>
        </header>
        <main id="main-content" className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>ile-iwe · Your school, connected.</span>
          <span>Made for a better school day</span>
        </footer>
      </div>
    </div>
  );
}
