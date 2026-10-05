import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Eye,
  Download,
  Upload,
  Check,
  FileText,
  ShieldCheck,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { api, allRecords, downloadFile, request, label } from './api';
import type { Row } from './api';
import { useAuth, useToast } from './context';
import {
  Empty,
  ErrorState,
  Loading,
  PageHeader,
  Spinner,
  Badge,
  Modal,
  Pagination,
} from './components';
import { money } from './api';
import { Records, ResourceSelect, titles, useOptions } from './Records';
import { ReportForm } from './ResultsPage';

export function CommunicationPage() {
  const { can } = useAuth(),
    client = useQueryClient(),
    toast = useToast();
  const canSend = can('notifications.send_email');
  const [tab, setTab] = useState(canSend ? 'compose' : 'announcements');
  const [channel, setChannel] = useState('EMAIL'),
    [audience, setAudience] = useState('school'),
    [classId, setClassId] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [subject, setSubject] = useState('School update'),
    [body, setBody] = useState(''),
    [preview, setPreview] = useState<Row>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const students = useOptions('students'),
    parents = useOptions('parents');
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: () => allRecords('templates'),
    enabled: canSend,
  });
  const payload = {
    channel,
    audience,
    class_id: classId || null,
    student_ids: audience === 'selected' ? selected : [],
    parent_ids: audience === 'parents' ? selected : [],
    subject,
    body,
  };
  const update = (fn: () => void) => {
    fn();
    setPreview(undefined);
  };
  const act = async (send: boolean) => {
    setBusy(true);
    setError('');
    try {
      const result = await api('/messages/' + (send ? 'send' : 'preview'), 'POST', payload);
      if (send) {
        await client.invalidateQueries();
        toast(`${result.queued} messages queued for delivery.`);
        setBody('');
        setPreview(undefined);
        setTab('notifications');
      } else setPreview(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="KEEP YOUR COMMUNITY CLOSE"
        title="Communication"
        description="Thoughtful updates, timely reminders, and a connected school community."
      />
      <div className="tabs" role="tablist">
        {[...(canSend ? ['compose'] : []), 'announcements', 'notifications', 'templates'].map(
          (t) => (
            <button role="tab" aria-selected={tab === t} key={t} onClick={() => setTab(t)}>
              {t === 'compose' ? 'Compose message' : titles[t]}
            </button>
          ),
        )}
      </div>
      {tab !== 'compose' ? (
        <Records key={tab} resource={tab} embedded />
      ) : (
        <div className="compose-grid">
          <section className="panel compose-panel">
            <div className="panel-heading">
              <div>
                <h2>A message that matters</h2>
                <p>Choose your audience, write your update, and preview before sending.</p>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(false);
              }}
            >
              <div className="form-grid">
                <label className="field">
                  <span>Delivery channel</span>
                  <select
                    value={channel}
                    onChange={(e) => update(() => setChannel(e.target.value))}
                  >
                    {can('notifications.send_email') && <option value="EMAIL">Email</option>}
                    {can('notifications.send_email') && (
                      <option value="IN_APP">In-app notification</option>
                    )}
                  </select>
                </label>
                <label className="field">
                  <span>Who’s it for?</span>
                  <select
                    value={audience}
                    onChange={(e) =>
                      update(() => {
                        setAudience(e.target.value);
                        setSelected([]);
                      })
                    }
                  >
                    <option value="school">All eligible guardians</option>
                    <option value="class">Guardians in a class</option>
                    <option value="selected">Selected students’ guardians</option>
                    <option value="parents">Selected guardians</option>
                  </select>
                </label>
              </div>
              {audience === 'class' && (
                <ResourceSelect
                  resource="classes"
                  title="Class arm"
                  value={classId}
                  onChange={(v) => update(() => setClassId(v))}
                  required
                />
              )}
              {['selected', 'parents'].includes(audience) && (
                <label className="field">
                  <span>
                    {audience === 'selected' ? 'Select students' : 'Select guardians'} (hold Ctrl /
                    Cmd for multiple)
                  </span>
                  <select
                    multiple
                    required
                    value={selected}
                    onChange={(e) =>
                      update(() =>
                        setSelected(Array.from(e.target.selectedOptions, (o) => o.value)),
                      )
                    }
                  >
                    {(audience === 'selected' ? students.data : parents.data)?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="field">
                <span>Start from a template (optional)</span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const t = templates.data?.find((t) => t.id === e.target.value);
                    if (t) update(() => setBody(t.body));
                  }}
                >
                  <option value="">Write your own message</option>
                  {templates.data
                    ?.filter((t) => t.channel === channel)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                <span>Subject</span>
                <input
                  value={subject}
                  onChange={(e) => update(() => setSubject(e.target.value))}
                  required
                  maxLength={200}
                />
              </label>
              <label className="field">
                <span>Your message</span>
                <textarea
                  rows={7}
                  value={body}
                  onChange={(e) => update(() => setBody(e.target.value))}
                  required
                  maxLength={5000}
                  placeholder="Hello {{parent_name}}, here’s an update from {{school_name}}…"
                />
                <small>
                  Personalize with {'{{parent_name}}'} and {'{{school_name}}'}.
                </small>
              </label>
              {error && <p className="form-error">{error}</p>}
              <button className="btn btn-secondary" disabled={busy}>
                <Eye size={16} />
                Preview message
              </button>
            </form>
          </section>
          <aside className="panel message-preview">
            <div className="panel-heading">
              <div>
                <h2>Message preview</h2>
                <p>A final look before you send.</p>
              </div>
            </div>
            {preview ? (
              <>
                <div className="preview-channel">
                  <Badge value={channel} />
                  <span>{preview.recipient_count} eligible recipients</span>
                </div>
                <h3>{subject}</h3>
                <p className="preserve-lines">{preview.preview}</p>
                <button
                  className="btn"
                  disabled={busy || !preview.recipient_count}
                  onClick={() => void act(true)}
                >
                  {busy ? <Spinner /> : <Send size={16} />}Send to {preview.recipient_count}{' '}
                  recipients
                </button>
              </>
            ) : (
              <Empty
                title="Ready when you are"
                description="Write your message and select Preview to check the audience and wording."
              />
            )}
          </aside>
        </div>
      )}
    </>
  );
}

export function SettingsPage() {
  const client = useQueryClient();
  const { session, refresh } = useAuth(),
    toast = useToast();
  const school = session!.school;
  const [values, setValues] = useState<Row>({
    name: school.name,
    email: school.email,
    phone: school.phone,
    address: school.address,
    website: school.website,
    registration_number: school.registration_number,
    school_type: school.school_type,
    primary_color: school.primary_color,
    secondary_color: school.secondary_color || '#d4a843',
    accent_color: school.accent_color || '#5279b8',
    timezone: school.timezone,
    mandatory_notifications: school.mandatory_notifications || {},
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [logo, setLogo] = useState('');
  useEffect(() => {
    if (!school.has_logo) return;
    let url = '';
    let gone = false;
    request('/school/logo')
      .then((r) => r.blob())
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (gone) URL.revokeObjectURL(url);
        else setLogo(url);
      })
      .catch(() => {});
    return () => {
      gone = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [school.has_logo, school.updated_at]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await api('/school', 'PATCH', values);
      client.setQueryData(['session'], (previous: Row) => ({ ...previous, school: updated }));
      refresh();
      toast('School settings saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="MAKE IT FEEL LIKE YOUR SCHOOL"
        title="School settings"
        description="Your identity, your colors, and the details that bring it all together."
      />
      <div className="settings-grid">
        <section className="panel settings-main">
          <div className="panel-heading">
            <div>
              <h2>School profile</h2>
              <p>Used across your workspace, report cards, and receipts.</p>
            </div>
          </div>
          <form onSubmit={save}>
            <div className="form-grid">
              {['name', 'email', 'phone', 'registration_number', 'website', 'timezone'].map(
                (key) => (
                  <label className="field" key={key}>
                    <span>
                      {key === 'registration_number'
                        ? 'CAC / registration number (optional)'
                        : label(key)}
                    </span>
                    <input
                      type={key === 'email' ? 'email' : key === 'website' ? 'url' : 'text'}
                      value={values[key]}
                      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                      required={['name', 'email', 'timezone'].includes(key)}
                    />
                  </label>
                ),
              )}
            </div>
            <label className="field">
              <span>School address</span>
              <textarea
                rows={3}
                value={values.address}
                onChange={(e) => setValues({ ...values, address: e.target.value })}
              />
            </label>
            <label className="field">
              <span>School type</span>
              <select
                value={values.school_type}
                onChange={(e) => setValues({ ...values, school_type: e.target.value })}
              >
                <option value="COMBINED">Primary & secondary</option>
                <option value="PRIMARY">Primary</option>
                <option value="SECONDARY">Secondary</option>
              </select>
            </label>
            <h2>Interface colors</h2>
            <p>Use your school palette across buttons, highlights, and portal cards.</p>
            {['primary', 'secondary', 'accent'].map((color) => (
              <label className="field" key={color}>
                <span>{label(color)} brand color</span>
                <div className="color-picker">
                  <input
                    type="color"
                    aria-label={`${label(color)} brand color`}
                    value={values[color + '_color']}
                    onChange={(e) => setValues({ ...values, [color + '_color']: e.target.value })}
                  />
                  <input
                    aria-label={`${label(color)} color hex`}
                    value={values[color + '_color']}
                    pattern="#[0-9a-fA-F]{6}"
                    onChange={(e) => setValues({ ...values, [color + '_color']: e.target.value })}
                  />
                </div>
                <small>
                  Accessible text colors are generated automatically for light and dark mode.
                </small>
              </label>
            ))}
            {error && <p className="form-error">{error}</p>}
            <button className="btn" disabled={busy}>
              {busy ? <Spinner /> : <Check size={16} />}Save school settings
            </button>
            <fieldset>
              <legend>Required parent notifications</legend>
              <p>Parents can manage optional updates. Required categories remain enabled.</p>
              {['email', 'attendance', 'results', 'finance', 'announcements'].map((key) => (
                <label className="check-field" key={key}>
                  <input
                    type="checkbox"
                    checked={values.mandatory_notifications[key] || false}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        mandatory_notifications: {
                          ...values.mandatory_notifications,
                          [key]: e.target.checked,
                        },
                      })
                    }
                  />
                  {label(key)}
                </label>
              ))}
            </fieldset>
          </form>
        </section>
        <aside>
          <section className="panel branding-card">
            <h2>Your school logo</h2>
            <div className="logo-preview">
              {logo ? (
                <img src={logo} alt={`${school.name} logo`} />
              ) : (
                <span>{school.name[0]}</span>
              )}
            </div>
            <p>Use a clear PNG, JPEG, or WebP image, up to 2 MB.</p>
            <label className="btn btn-secondary upload-button">
              <Upload size={16} />
              Upload logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const data = new FormData();
                  data.append('file', file);
                  try {
                    await request('/school/logo', { method: 'POST', body: data });
                    refresh();
                    toast('School logo updated.');
                  } catch (e) {
                    toast((e as Error).message, true);
                  }
                }}
              />
            </label>
          </section>
          <section className="panel settings-note">
            <ShieldCheck size={23} />
            <h3>Your school’s own space</h3>
            <p>
              Your team’s permissions control access to students, academics, and finances. Manage
              accounts and roles under Staff & teachers.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}

export function ReportsPage() {
  const { can } = useAuth(),
    toast = useToast();
  const [report, setReport] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="THE BIG PICTURE, READY TO SHARE"
        title="Documents & reports"
        description="School records, report cards, and receipts — securely in one place."
        actions={
          can('results.view') && (
            <button className="btn" onClick={() => setReport(true)}>
              <Plus size={17} />
              Generate report card
            </button>
          )
        }
      />
      <div className="report-downloads">
        {[
          ['students', 'Student directory', 'students.view'],
          ['attendance', 'Attendance records', 'attendance.view'],
          ['results', 'Academic results', 'results.view'],
          ['payments', 'Payment records', 'finance.view'],
        ]
          .filter((r) => can(r[2]))
          .map(([resource, title]) => (
            <button
              className="panel report-download"
              key={resource}
              onClick={() =>
                void downloadFile(`/reports/${resource}.csv`, `${resource}.csv`).catch((e) =>
                  toast(e.message, true),
                )
              }
            >
              <FileText size={23} />
              <span>
                <strong>{title}</strong>
                <small>Download CSV</small>
              </span>
              <Download size={17} />
            </button>
          ))}
      </div>
      <Records resource="documents" embedded />
      {report && <ReportForm onClose={() => setReport(false)} />}
    </>
  );
}

export function PlatformPage() {
  const client = useQueryClient(),
    toast = useToast(),
    { session } = useAuth();
  if (session?.user.role !== 'PLATFORM_SUPER_ADMIN') {
    return (
      <Empty
        title="This area is restricted"
        description="Only the platform CEO or system administrator can view this dashboard."
      />
    );
  }
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [sort, setSort] = useState('name'),
    [direction, setDirection] = useState('asc'),
    [fromDate, setFromDate] = useState(''),
    [toDate, setToDate] = useState(''),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Row>(),
    [action, setAction] = useState<'revoke' | 'restore'>(),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState('');
  const params = new URLSearchParams({
    search,
    status,
    sort,
    direction,
    page: String(page),
    page_size: '10',
  });
  if (fromDate) params.set('from_date', fromDate);
  if (toDate) params.set('to_date', toDate);
  const dashboard = useQuery({
    queryKey: ['ceo-dashboard', fromDate, toDate],
    queryFn: () =>
      api<Row>(
        `/ceo/dashboard?${new URLSearchParams({ ...(fromDate ? { from_date: fromDate } : {}), ...(toDate ? { to_date: toDate } : {}) })}`,
      ),
  });
  const query = useQuery({
    queryKey: ['ceo-schools', search, status, sort, direction, page, fromDate, toDate],
    queryFn: () => api<Row>(`/ceo/schools?${params}`),
  });
  const detail = useQuery({
    queryKey: ['ceo-school', selected?.id],
    queryFn: () => api<Row>(`/ceo/schools/${selected!.id}`),
    enabled: Boolean(selected),
  });
  const metrics = dashboard.data?.metrics || {};
  const cards = [
    ['Schools', metrics.schools],
    ['Active schools', metrics.active_schools],
    ['Pending schools', metrics.pending_schools],
    ['Revoked / suspended', (metrics.revoked_schools || 0) + (metrics.suspended_schools || 0)],
    ['Students', metrics.students],
    ['Teachers', metrics.teachers],
    ['Staff', metrics.staff],
    ['Parents', metrics.parents],
    ['Active users', metrics.active_users],
    ['Inactive users', metrics.inactive_users],
    ['Classes', metrics.classes],
    ['Subjects', metrics.subjects],
    ['Attendance rate', `${metrics.attendance_rate || 0}%`],
    ['Fees collected', money(metrics.fees_collected)],
    ['Outstanding fees', money(metrics.outstanding_fees)],
    ['Pending jobs', metrics.pending_jobs],
    ['Failed jobs', metrics.failed_jobs],
    ['Current session', dashboard.data?.current_sessions?.join(', ') || 'Not set'],
    ['Current term', dashboard.data?.current_terms?.join(', ') || 'Not set'],
  ];
  const closeAction = () => {
    setAction(undefined);
    setConfirmed(false);
    setReason('');
  };
  const submitAction = async () => {
    if (!selected || !action || !confirmed) return;
    try {
      await api(`/ceo/schools/${selected.id}/${action}`, 'POST', { confirmation: true, reason });
      toast(
        action === 'revoke'
          ? 'School access revoked.'
          : 'School access restored. Users must sign in again.',
      );
      closeAction();
      await client.invalidateQueries({ queryKey: ['ceo-schools'] });
      await client.invalidateQueries({ queryKey: ['ceo-dashboard'] });
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const updateAccount = async (account: Row, active: boolean) => {
    if (!selected) return;
    try {
      await api(`/ceo/schools/${selected.id}/users/${account.id}`, 'PATCH', { active });
      toast(`${account.name} is now ${active ? 'active' : 'inactive'}.`);
      await detail.refetch();
      await client.invalidateQueries({ queryKey: ['ceo-schools'] });
      await client.invalidateQueries({ queryKey: ['ceo-dashboard'] });
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="CEO DASHBOARD"
        title="Platform overview"
        description="Compare school health, activity, and access across the Ile-Iwe platform."
        actions={
          <button
            className="btn btn-secondary"
            onClick={() => {
              void dashboard.refetch();
              void query.refetch();
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />
      {dashboard.isPending ? (
        <Loading />
      ) : dashboard.error ? (
        <ErrorState error={dashboard.error} retry={() => void dashboard.refetch()} />
      ) : (
        <>
          <div className="metrics-grid ceo-metrics">
            {cards.map(([title, value]) => (
              <div className="metric-card" key={title}>
                <div className="metric-top">
                  <span>{title}</span>
                </div>
                <strong>{value ?? 0}</strong>
                <small>Platform-wide</small>
              </div>
            ))}
          </div>
          <section className="panel ceo-panel">
            <div className="panel-heading">
              <div>
                <h2>School overview</h2>
                <p>Search, filter, inspect, and manage access without loading every record.</p>
              </div>
            </div>
            <div className="ceo-filters">
              <input
                aria-label="Search schools"
                placeholder="Search school name or ID"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <label className="ceo-date">
                <span>From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="ceo-date">
                <span>To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <select
                aria-label="Filter school status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="REVOKED">Revoked</option>
              </select>
              <select
                aria-label="Sort schools"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="name">Name</option>
                <option value="students">Students</option>
                <option value="attendance">Attendance</option>
                <option value="fees_collected">Fees collected</option>
                <option value="last_activity">Last activity</option>
              </select>
              <button
                className="btn btn-secondary"
                onClick={() => setDirection(direction === 'asc' ? 'desc' : 'asc')}
              >
                {direction === 'asc' ? 'Ascending' : 'Descending'}
              </button>
            </div>
            {query.isPending ? (
              <Loading />
            ) : query.error ? (
              <ErrorState error={query.error} retry={() => void query.refetch()} />
            ) : query.data.items?.length ? (
              <>
                <div className="panel table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>School</th>
                        <th>Students</th>
                        <th>Users</th>
                        <th>Staff</th>
                        <th>Attendance</th>
                        <th>Fees</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.items.map((s: Row) => (
                        <tr key={s.id}>
                          <td>
                            <button className="text-link" onClick={() => setSelected(s)}>
                              {s.name}
                            </button>
                            <small className="table-subtext">{s.id}</small>
                          </td>
                          <td>{s.students}</td>
                          <td>{s.users}</td>
                          <td>{s.staff}</td>
                          <td>{Number(s.attendance_rate || 0).toFixed(1)}%</td>
                          <td>{money(s.fees_collected)}</td>
                          <td>
                            <Badge value={s.access_status} />
                          </td>
                          <td>
                            <button
                              className="btn btn-secondary btn-small"
                              onClick={() => {
                                setSelected(s);
                                setAction(s.access_status === 'revoked' ? 'restore' : 'revoke');
                              }}
                            >
                              {s.access_status === 'revoked' ? 'Restore' : 'Revoke'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={query.data.page}
                  total={query.data.total}
                  pageSize={query.data.page_size}
                  onChange={setPage}
                />
              </>
            ) : (
              <Empty
                title="No schools found"
                description="Try a different search or status filter."
              />
            )}
          </section>
          <section className="dashboard-grid ceo-lower">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>School comparison</h2>
                  <p>Student enrollment, attendance, and fees for the largest schools.</p>
                </div>
              </div>
              <div className="ceo-chart-list">
                {dashboard.data.school_breakdown?.map((school: Row) => (
                  <div className="ceo-chart-row" key={school.name}>
                    <div className="ceo-chart-label">
                      <strong>{school.name}</strong>
                      <span>
                        {school.students} students ·{' '}
                        {Number(school.attendance_rate || 0).toFixed(1)}% attendance
                      </span>
                    </div>
                    <div className="ceo-bar">
                      <i
                        style={{
                          width: `${Math.min(100, (Number(school.students || 0) / Math.max(1, Number(dashboard.data.school_breakdown?.[0]?.students || 1))) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Recent activity</h2>
                  <p>Latest events across all schools.</p>
                </div>
              </div>
              <div className="activity-list">
                {dashboard.data.recent_activity?.map((event: Row) => (
                  <div className="activity-row" key={event.id}>
                    <span className="activity-dot" />
                    <div>
                      <strong>{event.action}</strong>
                      <small>
                        {event.school_name} · {new Date(event.created_at).toLocaleString()}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>System health</h2>
                  <p>Signals from the API and durable worker queue.</p>
                </div>
              </div>
              <div className="health-list">
                <div>
                  <span>API</span>
                  <Badge value={dashboard.data.health?.api || 'UNKNOWN'} />
                </div>
                <div>
                  <span>Database</span>
                  <Badge value={dashboard.data.health?.database || 'UNKNOWN'} />
                </div>
                <div>
                  <span>Worker</span>
                  <Badge value={dashboard.data.health?.worker || 'UNKNOWN'} />
                </div>
                <div>
                  <span>Pending jobs</span>
                  <strong>{metrics.pending_jobs || 0}</strong>
                </div>
                <div>
                  <span>Failed jobs</span>
                  <strong>{metrics.failed_jobs || 0}</strong>
                </div>
              </div>
            </section>
          </section>
        </>
      )}
      {selected && !action && (
        <Modal
          title={detail.data?.school?.name || selected.name}
          onClose={() => setSelected(undefined)}
        >
          <div className="modal-body">
            {detail.isPending ? (
              <Loading />
            ) : detail.error ? (
              <ErrorState error={detail.error} />
            ) : (
              <>
                <p>{detail.data?.school?.address || 'No address recorded.'}</p>
                <div className="metrics-grid">
                  <div className="metric-card"><strong>{detail.data?.counts?.users || 0}</strong><small>Users</small></div>
                  <div className="metric-card"><strong>{detail.data?.counts?.students || 0}</strong><small>Students</small></div>
                  <div className="metric-card"><strong>{detail.data?.counts?.staff || 0}</strong><small>Staff</small></div>
                </div>
                <h3>Associated users ({detail.data?.counts?.users || 0})</h3>
                <div className="user-status-list">
                  {detail.data?.users?.map((account: Row) => (
                    <div key={account.id}>
                      <span>
                        {account.name}
                        <small>
                          {account.email} · {label(account.role)}
                        </small>
                      </span>
                      <label className="field">
                        <span className="sr-only">Account status for {account.name}</span>
                        <select
                          aria-label={`Account status for ${account.name}`}
                          value={account.active ? 'active' : 'inactive'}
                          disabled={selected.access_status === 'revoked'}
                          onChange={(e) => void updateAccount(account, e.target.value === 'active')}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    setAction(selected.access_status === 'revoked' ? 'restore' : 'revoke')
                  }
                >
                  {selected.access_status === 'revoked' ? 'Restore access' : 'Revoke access'}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
      {selected && action && (
        <Modal
          title={action === 'revoke' ? 'Revoke school access' : 'Restore school access'}
          onClose={closeAction}
        >
          <div className="modal-body">
            <p>
              {action === 'revoke'
                ? `This will deactivate every account associated with ${selected.name}, invalidate sessions, and cancel queued jobs. Historical data will be preserved.`
                : `Restore ${selected.name} to active status and reactivate its accounts.`}
            </p>
            <label className="check-field">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I understand the access change
            </label>
            <label className="field">
              <span>Reason (optional)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </label>
            <button className="btn" disabled={!confirmed} onClick={() => void submitAction()}>
              {action === 'revoke' ? 'Revoke access' : 'Restore school'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
