import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Menu, X, Moon, Sun, LogOut, GraduationCap, ChevronRight } from 'lucide-react';
import { api, downloadFile, label, money, schoolDate, request } from './api';
import type { Row, Tokens } from './api';
import { useAuth, useTheme, useToast } from './context';
import {
  Badge,
  Brand,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Spinner,
} from './components';
import { PasswordInput } from './PasswordInput';
import { AttendancePage } from './AttendancePage';
import { ResultsPage } from './ResultsPage';
import { ResourceSelect } from './Records';
import { StudentPhoto } from './ProfileImages';
import { UserManualPage } from './UserManualPage';

const teacherPages = [
  'dashboard',
  'classes',
  'students',
  'subjects',
  'timetable',
  'attendance',
  'results',
  'performance',
  'calendar',
  'announcements',
  'notifications',
  'profile',
  'security',
  'manual',
];
const parentPages = [
  'dashboard',
  'children',
  'timetable',
  'attendance',
  'results',
  'report-cards',
  'fees',
  'payments',
  'receipts',
  'announcements',
  'calendar',
  'notifications',
  'profile',
  'security',
  'manual',
];
const pageNames: Record<string, string> = {
  classes: 'My classes',
  students: 'My students',
  subjects: 'My subjects',
  children: 'My children',
  performance: 'Class performance',
  fees: 'Fees & balances',
  profile: 'My profile',
  'report-cards': 'Report cards',
};
const ChildContext = createContext<{ children: Row[]; child?: Row; select: (id: string) => void }>({
  children: [],
  select: () => {},
});

export function PortalLayout({ role }: { role: 'TEACHER' | 'PARENT' }) {
  const auth = useAuth(),
    theme = useTheme(),
    location = useLocation();
  const [mobile, setMobile] = useState(false),
    [selected, setSelected] = useState('');
  const parent = role === 'PARENT',
    prefix = parent ? '/parent' : '/teacher';
  const children = useQuery({
    queryKey: ['portal-children', auth.session?.user.id],
    queryFn: () => api<Row[]>('/parent/children'),
    enabled:
      parent && auth.session?.user.role === 'PARENT' && !auth.session?.user.must_change_password,
  });
  if (!auth.signedIn) return <Navigate to="/login" replace />;
  if (auth.loading) return <Loading />;
  if (auth.error || !auth.session)
    return (
      <ErrorState error={auth.error || new Error('Account unavailable.')} retry={auth.refresh} />
    );
  if (auth.session.user.must_change_password) return <Navigate to="/change-password" replace />;
  if (auth.session.user.role !== role) return <Navigate to="/" replace />;
  const child = children.data?.find((c) => c.id === selected) || children.data?.[0];
  const pages = parent ? parentPages : teacherPages;
  const title =
    pageNames[location.pathname.split('/')[2]] ||
    label(location.pathname.split('/')[2] || 'dashboard');
  return (
    <ChildContext.Provider value={{ children: children.data || [], child, select: setSelected }}>
      <div className="app-shell portal-shell">
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
            <Link to={prefix}>
              <Brand />
            </Link>
            <button
              className="icon-button mobile-only"
              aria-label="Close navigation"
              onClick={() => setMobile(false)}
            >
              <X />
            </button>
          </div>
          <div className="school-switch">
            <GraduationCap />
            <div>
              <strong>{auth.session.school.name}</strong>
              <small>{parent ? 'Parent portal' : 'Teacher portal'}</small>
            </div>
          </div>
          <nav aria-label="Portal navigation">
            {pages.map((page) => (
              <NavLink end key={page} to={`${prefix}/${page}`} onClick={() => setMobile(false)}>
                <span>{pageNames[page] || label(page)}</span>
                <ChevronRight size={14} />
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button className="profile-button" onClick={() => void auth.signOut()}>
              <LogOut size={18} />
              <span>
                <strong>{auth.session.user.name}</strong>
                <small>Sign out on all devices</small>
              </span>
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
                <Menu />
              </button>
              <strong>{title}</strong>
            </div>
            <div className="topbar-actions">
              {parent && children.data?.length ? (
                <label className="child-switch">
                  <span>Selected child</span>
                  <select
                    aria-label="Selected child"
                    value={child?.id || ''}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {children.data.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.class_name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                className="icon-button"
                aria-label={theme.dark ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={theme.toggle}
              >
                {theme.dark ? <Sun size={19} /> : <Moon size={19} />}
              </button>
            </div>
          </header>
          <main className="page-content" id="main-content">
            {parent && children.isPending ? (
              <Loading />
            ) : children.error ? (
              <ErrorState error={children.error} retry={() => void children.refetch()} />
            ) : (
              <Outlet key={child?.id} />
            )}
          </main>
        </div>
      </div>
    </ChildContext.Provider>
  );
}

export function ChangePasswordPage({ forced = false }: { forced?: boolean }) {
  const auth = useAuth(),
    toast = useToast();
  const [current, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!auth.signedIn) return <Navigate to="/login" replace />;
  if (auth.loading) return <Loading />;
  if (!auth.session) return <ErrorState error={auth.error || new Error('Account unavailable.')} />;
  if (forced && !auth.session.user.must_change_password) return <Navigate to="/" replace />;
  return (
    <section className={'panel portal-form ' + (forced ? 'password-gate' : '')}>
      <PageHeader
        title={forced ? 'Choose your own password' : 'Security'}
        description={
          forced
            ? 'Before your first school day online, replace your temporary password.'
            : 'Update your password and sign out other sessions.'
        }
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          if (password !== confirm) {
            setError('The new passwords do not match.');
            return;
          }
          setBusy(true);
          try {
            const tokens = await api<Tokens>('/auth/change-password', 'POST', {
              current_password: current,
              password,
            });
            auth.signIn(tokens);
            toast('Password changed. Other sessions have been signed out.');
            setCurrent('');
            setPassword('');
            setConfirm('');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Current password</span>
          <PasswordInput
            aria-label="Current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <label className="field">
          <span>New password</span>
          <PasswordInput
            aria-label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
          />
          <small>Use at least 12 characters.</small>
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <PasswordInput
            aria-label="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="btn" disabled={busy}>
          {busy && <Spinner />}Change password
        </button>
      </form>
      <button className="btn btn-secondary" onClick={() => void auth.signOut()}>
        Sign out on all devices
      </button>
    </section>
  );
}

function Cards({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="portal-stats">
      {Object.entries(values).map(([key, value]) => (
        <section className="panel portal-stat" key={key}>
          <span>{label(key)}</span>
          <strong>{value == null ? '—' : String(value)}</strong>
        </section>
      ))}
    </div>
  );
}

function Notices({ rows, events = false }: { rows: Row[]; events?: boolean }) {
  return rows.length ? (
    <div className="portal-cards">
      {rows.map((r) => (
        <article className="panel portal-card" key={r.id}>
          <h3>{r.title}</h3>
          {events && (
            <p>
              {r.start_date} – {r.end_date}
            </p>
          )}
          <p className="preserve-lines">{r.body}</p>
        </article>
      ))}
    </div>
  ) : (
    <Empty
      title={events ? 'No events scheduled' : 'You’re all caught up'}
      description={
        events
          ? 'School events will appear here when they are scheduled.'
          : 'Updates from your school will appear here.'
      }
    />
  );
}

function DataTable({
  rows,
  fields,
  action,
}: {
  rows: Row[];
  fields: string[];
  action?: (r: Row) => React.ReactNode;
}) {
  return rows.length ? (
    <div className="panel table-scroll">
      <table>
        <thead>
          <tr>
            {fields.map((f) => (
              <th key={f}>{label(f)}</th>
            ))}
            {action && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i}>
              {fields.map((f) => (
                <td key={f}>
                  {f === 'status' ? (
                    <Badge value={r[f]} />
                  ) : f === 'scores' ? (
                    r.scores?.map((s: Row) => `${s.name}: ${s.score}/${s.maximum}`).join(' · ')
                  ) : typeof r[f] === 'boolean' ? (
                    r[f] ? (
                      'Yes'
                    ) : (
                      'No'
                    )
                  ) : r[f] == null ? (
                    '—'
                  ) : Array.isArray(r[f]) ? (
                    r[f].join(', ')
                  ) : (
                    String(r[f])
                  )}
                </td>
              ))}
              {action && <td>{action(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="No records yet"
      description="Records will appear here when your school adds them."
    />
  );
}

export function PortalPage() {
  const { page = 'dashboard' } = useParams(),
    { session } = useAuth();
  const parent = session!.user.role === 'PARENT';
  const { child, children, select } = useContext(ChildContext);
  if (page === 'security') return <ChangePasswordPage />;
  if (page === 'manual') return <UserManualPage />;
  if (page === 'profile') return <ProfilePage />;
  if (parent && page === 'children')
    return (
      <>
        <PageHeader title="My children" description="Choose a child to follow their school day." />
        <div className="portal-cards">
          {children.map((c) => (
            <article className="panel portal-card" key={c.id}>
              <StudentPhoto student={c} />
              <h2>{c.name}</h2>
              <p>
                {c.class_name} · {c.student_code}
              </p>
              <Link className="btn" to="/parent/dashboard" onClick={() => select(c.id)}>
                View school day
              </Link>
            </article>
          ))}
        </div>
        {!children.length && (
          <Empty
            title="No children linked yet"
            description="Ask your school administrator to link your children to this account."
          />
        )}
      </>
    );
  if (parent && !child && !['calendar', 'announcements', 'notifications'].includes(page))
    return (
      <Empty
        title="Your family’s school day starts here"
        description="Ask your school to link your children to this account."
      />
    );
  if (page === 'dashboard') return <PortalHome parent={parent} child={child} />;
  if (['calendar', 'announcements', 'notifications'].includes(page))
    return <UpdatesPage page={page} childId={parent ? child?.id : undefined} />;
  if (!parent && page === 'attendance') return <AttendancePage />;
  if (!parent && page === 'results') return <ResultsPage teacher />;
  if (!parent && page === 'classes') return <TeacherClasses />;
  if (!parent && page === 'students') return <TeacherStudents />;
  if (!parent && page === 'subjects') return <TeacherSubjects />;
  if (!parent && page === 'performance') return <PerformancePage />;
  if (page === 'timetable') return <PortalTimetable parent={parent} childId={child?.id} />;
  if (
    parent &&
    ['attendance', 'results', 'report-cards', 'fees', 'payments', 'receipts'].includes(page)
  )
    return <ChildRecords page={page} child={child!} />;
  return <Empty title="Page not found" description="Choose a page from your portal navigation." />;
}

function PortalHome({ parent, child }: { parent: boolean; child?: Row }) {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['portal-home', session!.user.id, child?.id],
    queryFn: () => api(parent ? `/parent/children/${child!.id}/dashboard` : '/teacher/dashboard'),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  return (
    <>
      <PageHeader
        eyebrow={data.date}
        title={`Hello, ${session!.user.name.split(' ')[0]}`}
        description={
          parent
            ? `${child!.name} · ${child!.class_name}`
            : 'Your classes, lessons, and priorities for today.'
        }
      />
      {parent ? (
        <Cards
          values={{
            attendance_rate: data.attendance_rate == null ? '—' : `${data.attendance_rate}%`,
            outstanding: money(data.ledger.balance),
            published_results: data.published_results,
            announcements: data.announcements.length,
          }}
        />
      ) : (
        <Cards values={data.stats} />
      )}
      {parent ? (
        <section className="panel portal-card">
          <h2>Attendance summary</h2>
          <Cards
            values={Object.fromEntries(
              ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((s) => [s, data.attendance[s] || 0]),
            )}
          />
          <Link to="/parent/attendance">View attendance history</Link>
        </section>
      ) : (
        <>
          <h2>Today’s lessons</h2>
          <DataTable
            rows={data.timetable}
            fields={['start_time', 'end_time', 'subject_name', 'class_name', 'room']}
          />
          <div className="portal-quick">
            <Link className="btn" to="/teacher/attendance">
              Mark attendance
            </Link>
            <Link className="btn btn-secondary" to="/teacher/results?enter">
              Enter results
            </Link>
          </div>
        </>
      )}
      <h2>School announcements</h2>
      <Notices rows={data.announcements} />
      <h2>Coming up</h2>
      <Notices rows={data.events} events />
    </>
  );
}

function TeacherClasses() {
  const query = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => api<Row[]>('/teacher/classes'),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <>
      <PageHeader
        title="My classes"
        description="Your subject assignments and class-teacher responsibilities."
      />
      <div className="portal-cards">
        {query.data.map((c) => (
          <article className="panel portal-card" key={c.id}>
            <Badge value={c.is_class_teacher ? 'CLASS TEACHER' : 'SUBJECT ASSIGNMENT'} />
            <h2>{c.class_name}</h2>
            <p>
              {c.student_count} students · {c.attendance_marked} attendance records today
            </p>
            <p>{c.subjects.join(', ') || 'Class supervision'}</p>
            <p>Average recorded score: {c.average == null ? '—' : Number(c.average).toFixed(1)}</p>
            <Link className="btn btn-secondary" to={`/teacher/students?class_id=${c.id}`}>
              View students
            </Link>
          </article>
        ))}
      </div>
      {!query.data.length && (
        <Empty
          title="No assignments yet"
          description="Your administrator can assign your classes and subjects."
        />
      )}
    </>
  );
}

function TeacherStudents() {
  const location = useLocation();
  const [classId, setClassId] = useState(
      new URLSearchParams(location.search).get('class_id') || '',
    ),
    [subjectId, setSubjectId] = useState(''),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [gender, setGender] = useState(''),
    [attendanceStatus, setAttendanceStatus] = useState(''),
    [academicStatus, setAcademicStatus] = useState(''),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState('');
  const query = useQuery({
    queryKey: [
      'teacher-students',
      classId,
      subjectId,
      search,
      status,
      gender,
      attendanceStatus,
      academicStatus,
      page,
    ],
    queryFn: () =>
      api(
        `/teacher/students?${new URLSearchParams({ class_id: classId, subject_id: subjectId, search, status, gender, attendance_status: attendanceStatus, academic_status: academicStatus, page: String(page) })}`,
      ),
  });
  return (
    <>
      <PageHeader
        title="My students"
        description="Find learners in your assigned classes and subjects."
      />
      <div className="portal-filters">
        <label className="field">
          <span>Search students</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name, ID or admission number"
          />
        </label>
        <ResourceSelect
          resource="classes"
          title="Class"
          value={classId}
          onChange={(v) => {
            setClassId(v);
            setPage(1);
          }}
        />
        <ResourceSelect
          resource="subjects"
          title="Subject"
          value={subjectId}
          onChange={(v) => {
            setSubjectId(v);
            setPage(1);
          }}
        />
        <label className="field">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {['ACTIVE', 'INACTIVE', 'WITHDRAWN', 'GRADUATED', 'TRANSFERRED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Gender</span>
          <select
            value={gender}
            onChange={(e) => {
              setGender(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All genders</option>
            <option>Female</option>
            <option>Male</option>
          </select>
        </label>
        <label className="field">
          <span>Attendance today</span>
          <select
            value={attendanceStatus}
            onChange={(e) => {
              setAttendanceStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All attendance</option>
            {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'UNMARKED'].map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Academic performance</span>
          <select
            value={academicStatus}
            onChange={(e) => {
              setAcademicStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All performance</option>
            <option value="NEEDS_SUPPORT">Needs support</option>
            <option value="PASSING">Passing all recorded subjects</option>
          </select>
        </label>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <>
          <DataTable
            rows={query.data.items}
            fields={['name', 'student_code', 'admission_no', 'status']}
            action={(r) => (
              <button className="btn btn-small btn-secondary" onClick={() => setSelected(r.id)}>
                View profile
              </button>
            )}
          />
          <Pagination page={page} total={query.data.total} pageSize={25} onChange={setPage} />
        </>
      )}
      {selected && <StudentDetail id={selected} close={() => setSelected('')} />}
    </>
  );
}

function StudentDetail({ id, close }: { id: string; close: () => void }) {
  const query = useQuery({
    queryKey: ['teacher-student', id],
    queryFn: () => api(`/teacher/students/${id}`),
  });
  return (
    <Modal title="Student profile" onClose={close}>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <>
          <StudentPhoto student={query.data.student} />
          <h2>{query.data.student.name}</h2>
          <p>
            {query.data.student.student_code} · {query.data.student.admission_no}
          </p>
          <p>{query.data.student.status}</p>
          {query.data.is_class_teacher && (
            <>
              <p>{query.data.student.emergency_info}</p>
              <h3>Parents & guardians</h3>
              <DataTable
                rows={query.data.guardians}
                fields={['name', 'relationship', 'phone', 'email', 'primary_contact']}
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function TeacherSubjects() {
  const query = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => api<Row[]>('/teacher/classes'),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <>
      <PageHeader
        title="My subjects"
        description="The subjects you teach and the classes where you teach them."
      />
      <DataTable
        rows={query.data.flatMap((c) =>
          c.subjects.map((s: string) => ({ class_name: c.class_name, subject: s })),
        )}
        fields={['subject', 'class_name']}
      />
    </>
  );
}

function PerformancePage() {
  const [classId, setClassId] = useState(''),
    [termId, setTermId] = useState('');
  const query = useQuery({
    queryKey: ['performance', classId, termId],
    queryFn: () =>
      api<Row[]>(
        `/teacher/performance?${new URLSearchParams({ ...(classId ? { class_id: classId } : {}), ...(termId ? { term_id: termId } : {}) })}`,
      ),
  });
  const insights = useQuery({
    queryKey: ['performance-insights', classId, termId],
    queryFn: () =>
      api(
        `/teacher/insights?${new URLSearchParams({ ...(classId ? { class_id: classId } : {}), ...(termId ? { term_id: termId } : {}) })}`,
      ),
  });
  return (
    <>
      <PageHeader
        title="Class performance"
        description="Academic summaries for your authorized classes and subjects."
      />
      <div className="portal-filters">
        <ResourceSelect resource="classes" value={classId} onChange={setClassId} title="Class" />
        <ResourceSelect
          resource="terms"
          value={termId}
          onChange={setTermId}
          title="Session / term"
        />
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={query.data.map((r) => ({ ...r, average: Number(r.average).toFixed(1) }))}
          fields={[
            'class_name',
            'subject_name',
            'term_name',
            'average',
            'highest',
            'lowest',
            'pass_rate',
            'fail_rate',
            'results',
          ]}
        />
      )}
      {insights.isPending ? (
        <Loading />
      ) : insights.error ? (
        <ErrorState error={insights.error} />
      ) : (
        <>
          <h2>Top performing students</h2>
          <DataTable rows={insights.data.top_students} fields={['name', 'average']} />
          <h2>Students needing support</h2>
          <DataTable
            rows={insights.data.needs_support}
            fields={['name', 'average', 'failed_subjects']}
          />
          <h2>Grade distribution</h2>
          <DataTable rows={insights.data.grade_distribution} fields={['grade', 'results']} />
          <h2>Performance by term</h2>
          <DataTable rows={insights.data.trends} fields={['session', 'term', 'average']} />
        </>
      )}
    </>
  );
}

function PortalTimetable({ parent, childId }: { parent: boolean; childId?: string }) {
  const { session } = useAuth();
  const [view, setView] = useState('week');
  const query = useQuery({
    queryKey: ['portal-timetable', parent, childId],
    queryFn: async () => {
      const result = await api(
        parent ? `/parent/children/${childId}/timetable` : '/teacher/timetable',
      );
      return (parent ? result.items : result) as Row[];
    },
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  const day = (new Date(schoolDate(session!.school.timezone) + 'T12:00:00').getDay() + 6) % 7;
  const rows = view === 'today' ? query.data.filter((r) => r.weekday === day) : query.data;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return (
    <>
      <PageHeader title="Timetable" description="Published lessons for your school week." />
      <div className="tabs">
        {['today', 'week', 'list'].map((v) => (
          <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
            {label(v)}
          </button>
        ))}
      </div>
      {view === 'week' ? (
        <div className="timetable-week">
          {days.map((d, i) => (
            <section className="panel portal-card" key={d}>
              <h3>{d}</h3>
              {rows
                .filter((r) => r.weekday === i)
                .map((r) => (
                  <article className="lesson-card" key={r.id}>
                    <strong>
                      {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                    </strong>
                    <p>{r.subject_name}</p>
                    <small>
                      {r.class_name} · {r.room}
                    </small>
                    <p>{r.teacher_name}</p>
                  </article>
                ))}
              {!rows.some((r) => r.weekday === i) && <small>No lessons</small>}
            </section>
          ))}
        </div>
      ) : (
        <DataTable
          rows={rows.map((r) => ({ ...r, day: days[r.weekday] }))}
          fields={[
            'day',
            'start_time',
            'end_time',
            'subject_name',
            'class_name',
            'teacher_name',
            'room',
          ]}
        />
      )}
    </>
  );
}

function ChildRecords({ page: resource, child }: { page: string; child: Row }) {
  const toast = useToast();
  const [page, setPage] = useState(1),
    [term, setTerm] = useState('');
  const terms = useQuery({
    queryKey: ['portal-terms'],
    queryFn: () => api<Row[]>('/portal/terms'),
  });
  const query = useQuery({
    queryKey: ['child-records', child.id, resource, term, page],
    queryFn: () =>
      api(`/parent/children/${child.id}/${resource}?page=${page}${term ? '&term_id=' + term : ''}`),
  });
  const fields: Record<string, string[]> = {
    attendance: ['attendance_date', 'status', 'term_name', 'note'],
    results: ['subject_name', 'term_name', 'scores', 'total', 'grade', 'remark'],
    'report-cards': ['term_name', 'format', 'created_at'],
    fees: ['description', 'amount', 'discount'],
    payments: [
      'receipt_number',
      'term_name',
      'amount',
      'payment_date',
      'method',
      'reference',
      'reversed',
    ],
    receipts: ['receipt_number', 'amount', 'payment_date', 'method', 'reference', 'term_name'],
  };
  return (
    <>
      <PageHeader
        title={pageNames[resource] || label(resource)}
        description={`${child.name} · ${child.class_name}`}
      />
      <label className="field portal-term">
        <span>Academic session / term</span>
        <select
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All terms</option>
          {terms.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.session_name} · {t.name}
            </option>
          ))}
        </select>
      </label>
      {terms.error && <ErrorState error={terms.error} />}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {resource === 'fees' && (
            <Cards
              values={{
                total_charges: money(query.data.charged),
                paid: money(query.data.paid),
                outstanding: money(query.data.balance),
              }}
            />
          )}
          <DataTable
            rows={query.data.items}
            fields={fields[resource]}
            action={
              ['report-cards', 'receipts'].includes(resource)
                ? (r) => (
                    <button
                      className="btn btn-small"
                      onClick={() =>
                        void downloadFile(
                          `/documents/${r.id}/download`,
                          `${resource}-${child.student_code}.${r.format}`,
                        ).catch((e) => toast(e.message, true))
                      }
                    >
                      Download {r.format.toUpperCase()}
                    </button>
                  )
                : undefined
            }
          />
          <Pagination page={page} pageSize={25} total={query.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}

function UpdatesPage({ page: resource, childId }: { page: string; childId?: string }) {
  const { session } = useAuth(),
    client = useQueryClient(),
    toast = useToast();
  const [page, setPage] = useState(1),
    [compose, setCompose] = useState(false);
  const query = useQuery({
    queryKey: ['portal-updates', resource, childId, page],
    queryFn: () =>
      api(`/portal/${resource}?page=${page}${childId ? '&student_id=' + childId : ''}`),
  });
  return (
    <>
      <PageHeader
        title={label(resource)}
        description="Stay connected with your school community."
        actions={
          resource === 'announcements' && session!.user.role === 'TEACHER' ? (
            <button className="btn" onClick={() => setCompose(true)}>
              Post class announcement
            </button>
          ) : undefined
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <>
          {resource === 'notifications' ? (
            <div className="portal-cards">
              {query.data.items.map((r: Row) => (
                <article className="panel portal-card" key={r.id}>
                  <Badge value={r.read_at ? 'READ' : 'UNREAD'} />
                  <h3>{r.title}</h3>
                  <p className="preserve-lines">{r.body}</p>
                  <small>{new Date(r.created_at).toLocaleString()}</small>
                  {!r.read_at && (
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={async () => {
                        try {
                          await api(`/portal/notifications/${r.id}/read`, 'POST');
                          await client.invalidateQueries({ queryKey: ['portal-updates'] });
                        } catch (e) {
                          toast((e as Error).message, true);
                        }
                      }}
                    >
                      Mark read
                    </button>
                  )}
                </article>
              ))}
              {!query.data.items.length && (
                <Empty
                  title="You’re all caught up"
                  description="New school notifications will appear here."
                />
              )}
            </div>
          ) : (
            <Notices rows={query.data.items} events={resource === 'calendar'} />
          )}
          <Pagination page={page} pageSize={25} total={query.data.total} onChange={setPage} />
        </>
      )}
      {compose && <AnnouncementForm close={() => setCompose(false)} />}
    </>
  );
}

function AnnouncementForm({ close }: { close: () => void }) {
  const [classId, setClassId] = useState(''),
    [title, setTitle] = useState(''),
    [body, setBody] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const client = useQueryClient();
  return (
    <Modal title="Class announcement" onClose={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/teacher/announcements', 'POST', { class_id: classId, title, body });
            await client.invalidateQueries();
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ResourceSelect
          resource="classes"
          title="Your class-teacher class"
          value={classId}
          onChange={setClassId}
          required
        />
        <label className="field">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={180}
          />
        </label>
        <label className="field">
          <span>Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={5000}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="btn" disabled={busy}>
          Post announcement
        </button>
      </form>
    </Modal>
  );
}

function ProfilePage() {
  const query = useQuery({ queryKey: ['profile'], queryFn: () => api('/profile') });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return <ProfileForm data={query.data} />;
}

function ProfileForm({ data }: { data: Row }) {
  const toast = useToast(),
    client = useQueryClient();
  const parent = data.user.role === 'PARENT';
  const [values, setValues] = useState<Row>({
      phone: data.profile.phone || '',
      address: data.profile.address || '',
      ...(parent
        ? {
            notify_email: data.profile.notify_email ?? true,
            notification_preferences: data.profile.notification_preferences || {},
          }
        : { emergency_contact: data.profile.emergency_contact || '' }),
    }),
    [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader
        title="My profile"
        description="Your contact information and school relationships."
      />
      <section className="panel portal-form">
        <h2>{data.user.name}</h2>
        <p>
          {data.user.email} · {data.user.username}
        </p>
        {!parent && (
          <>
            <p>
              {data.profile.job_title} · {data.profile.department} · {data.profile.staff_code}
            </p>
            <StaffPhotoEditor profile={data.profile} />
            <p>Employed: {data.profile.employment_date || 'Not recorded'}</p>
            <DataTable
              rows={data.classes}
              fields={['class_name', 'is_class_teacher', 'subjects']}
            />
          </>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api('/profile', 'PATCH', values);
              await client.invalidateQueries({ queryKey: ['profile'] });
              toast('Profile saved.');
            } catch (e) {
              toast((e as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {['phone', 'address', ...(!parent ? ['emergency_contact'] : [])].map((f) => (
            <label className="field" key={f}>
              <span>{label(f)}</span>
              <input
                value={values[f]}
                onChange={(e) => setValues({ ...values, [f]: e.target.value })}
              />
            </label>
          ))}
          {parent && (
            <fieldset>
              <legend>Notification preferences</legend>
              {['email', 'attendance', 'results', 'finance', 'announcements'].map((f) => {
                const channel = ['email'].includes(f),
                  required = data.mandatory_notifications?.[f];
                return (
                  <label className="check-field" key={f}>
                    <input
                      type="checkbox"
                      checked={
                        required ||
                        (channel
                          ? values['notify_' + f]
                          : (values.notification_preferences[f] ?? true))
                      }
                      disabled={required}
                      onChange={(e) =>
                        setValues(
                          channel
                            ? { ...values, ['notify_' + f]: e.target.checked }
                            : {
                                ...values,
                                notification_preferences: {
                                  ...values.notification_preferences,
                                  [f]: e.target.checked,
                                },
                              },
                        )
                      }
                    />
                    {label(f)}
                    {required && ' (required by school)'}
                  </label>
                );
              })}
            </fieldset>
          )}
          <button className="btn" disabled={busy}>
            {busy && <Spinner />}Save profile
          </button>
        </form>
      </section>
    </>
  );
}

export function StaffPhotoEditor({ profile }: { profile: Row }) {
  const toast = useToast(),
    client = useQueryClient();
  const [image, setImage] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true,
      url = '';
    if (profile.has_photo || revision)
      request(`/staff/${profile.id}/photo`)
        .then((r) => r.blob())
        .then((b) => {
          url = URL.createObjectURL(b);
          if (active) setImage(url);
          else URL.revokeObjectURL(url);
        })
        .catch((e) => toast(e.message, true));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [profile.id, profile.updated_at, revision]);
  return (
    <div>
      {image && (
        <img
          src={image}
          alt="Staff profile"
          width={100}
          height={100}
          style={{ objectFit: 'cover', borderRadius: 16 }}
        />
      )}
      <label className="field">
        <span>Profile photo</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const data = new FormData();
            data.append('file', file);
            try {
              await request(`/staff/${profile.id}/photo`, { method: 'POST', body: data });
              setRevision((value) => value + 1);
              await client.invalidateQueries();
              toast('Photo saved.');
            } catch (e) {
              toast((e as Error).message, true);
            }
          }}
        />
      </label>
    </div>
  );
}
