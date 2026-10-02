import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap,
  Users,
  ClipboardCheck,
  Wallet,
  ArrowUpRight,
  Plus,
  ArrowRight,
  CalendarDays,
  BookOpen,
  Check,
} from 'lucide-react';
import { api, label, money, downloadFile } from './api';
import type { Row } from './api';
import { useAuth, useToast } from './context';
import { Loading, ErrorState, PageHeader, Empty, Badge } from './components';

export function Dashboard() {
  const { session, can } = useAuth();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/dashboard') });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  if (session?.user.role === 'PARENT') return <ParentDashboard data={query.data} />;
  const data = query.data,
    stats = data.stats;
  const metrics = [
    {
      title: 'Total students',
      value: stats.students,
      icon: GraduationCap,
      detail: 'Active learners in your school',
      className: 'green',
    },
    ...(stats.staff !== undefined
      ? [
          {
            title: 'Teachers & staff',
            value: stats.staff,
            icon: Users,
            detail: 'The people behind the progress',
            className: 'blue',
          },
        ]
      : [
          {
            title: 'Your classes',
            value: stats.classes,
            icon: BookOpen,
            detail: 'Classes in your workspace',
            className: 'blue',
          },
        ]),
    ...(stats.present !== undefined
      ? [
          {
            title: 'Present today',
            value: stats.present,
            icon: ClipboardCheck,
            detail: `${stats.attendance_marked} attendance records · ${stats.absent} absent`,
            className: 'amber',
          },
        ]
      : []),
    ...(stats.collected !== undefined
      ? [
          {
            title: 'Fees collected',
            value: money(stats.collected),
            icon: Wallet,
            detail: `${money(stats.outstanding)} outstanding`,
            className: 'violet',
          },
        ]
      : []),
  ];
  const chartMax = Math.max(1, ...data.attendance_trend.map((d: Row) => d.present + d.absent));
  return (
    <>
      <PageHeader
        eyebrow="A GOOD DAY TO MAKE A DIFFERENCE"
        title={`Hello, ${session?.user.name.split(' ')[0]}.`}
        description="Here’s what’s happening across your school today."
        actions={
          <>
            <span className="date-chip">
              <CalendarDays size={16} />
              {new Date(data.date + 'T12:00:00').toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            {can('students.create') && (
              <Link className="btn" to="/students?create=1">
                <Plus size={17} />
                Add student
              </Link>
            )}
          </>
        }
      />
      <div className="welcome-banner">
        <div>
          <span className="banner-tag">
            <span /> YOUR SCHOOL, IN SYNC
          </span>
          <h2>More learning. Less paperwork.</h2>
          <p>A clear view of your school, so you can focus on what comes next.</p>
          <Link to={can('attendance.mark') ? '/attendance' : '/academics'}>
            Let’s make today count <ArrowRight size={16} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="art-grid" />
          <div className="art-book book-back" />
          <div className="art-book book-front">
            <BookOpen size={42} strokeWidth={1} />
            <span>room to grow</span>
          </div>
          <span className="art-star star-one">✦</span>
          <span className="art-star star-two">✧</span>
          <span className="art-circle" />
        </div>
      </div>
      <div className="metrics-grid">
        {metrics.map((m) => (
          <div className="metric-card" key={m.title}>
            <div className="metric-top">
              <span>{m.title}</span>
              <span className={'metric-icon ' + m.className}>
                <m.icon size={19} />
              </span>
            </div>
            <strong>{m.value}</strong>
            <small>{m.detail}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel attendance-panel">
          <div className="panel-heading">
            <div>
              <h2>Attendance at a glance</h2>
              <p>A little consistency goes a long way.</p>
            </div>
            {can('attendance.view') && (
              <Link className="text-link" to="/attendance">
                View attendance <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
          {data.attendance_trend.length ? (
            <>
              <div className="chart-legend">
                <span>
                  <i className="legend-present" />
                  Present & late
                </span>
                <span>
                  <i className="legend-absent" />
                  Absent
                </span>
                <small>Last 7 days</small>
              </div>
              <div
                className="bar-chart"
                role="img"
                aria-label={
                  'Attendance for the last seven days: ' +
                  data.attendance_trend
                    .map((d: Row) => `${d.date}, ${d.present} present, ${d.absent} absent`)
                    .join('; ')
                }
              >
                <div className="chart-grid-lines">
                  <span>{chartMax}</span>
                  <span>{Math.round(chartMax / 2)}</span>
                  <span>0</span>
                </div>
                {data.attendance_trend.map((d: Row) => (
                  <div className="bar-group" key={d.date}>
                    <div className="bar-track">
                      <div
                        className="bar-present"
                        style={{
                          height: `${(d.present / chartMax) * 100}%`,
                          minHeight: d.present ? 4 : 0,
                        }}
                        title={`${d.present} present`}
                      />
                      <div
                        className="bar-absent"
                        style={{
                          height: `${(d.absent / chartMax) * 100}%`,
                          minHeight: d.absent ? 4 : 0,
                        }}
                        title={`${d.absent} absent`}
                      />
                    </div>
                    <span>
                      {new Date(d.date + 'T12:00:00').toLocaleDateString('en-GB', {
                        weekday: 'short',
                      })}
                    </span>
                  </div>
                ))}
              </div>
              {!data.attendance_trend.some((d: Row) => d.present || d.absent) && (
                <p className="chart-empty-note">
                  Your attendance trend will appear as you mark your first classes.
                </p>
              )}
            </>
          ) : (
            <Empty
              title="Your school, organized"
              description="Explore your classes, fees, and school records from the sidebar."
            />
          )}
        </section>
        <section className="panel quick-actions">
          <div className="panel-heading">
            <div>
              <h2>Make it a productive day</h2>
              <p>Your everyday tasks, a tap away.</p>
            </div>
          </div>
          {[
            {
              name: 'Take attendance',
              sub: 'Start the day with your class',
              to: '/attendance',
              icon: ClipboardCheck,
              permission: 'attendance.mark',
            },
            {
              name: 'Record a payment',
              sub: 'Keep your school ledger up to date',
              to: '/finance?payment=1',
              icon: Wallet,
              permission: 'finance.record_payment',
            },
            {
              name: 'Enter results',
              sub: 'Celebrate every bit of progress',
              to: '/results?enter=1',
              icon: BookOpen,
              permission: 'results.enter',
            },
            {
              name: 'Send a message',
              sub: 'Keep your school community close',
              to: '/communication',
              icon: Users,
              permission: 'notifications.send_email',
            },
          ]
            .filter((a) => can(a.permission))
            .map((a) => (
              <Link className="quick-action" to={a.to} key={a.to}>
                <span className="quick-action-icon">
                  <a.icon size={19} />
                </span>
                <span>
                  <strong>{a.name}</strong>
                  <small>{a.sub}</small>
                </span>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          <div className="quick-footer">
            <Check size={16} />
            <span>Small tasks. A big difference.</span>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>The latest updates in your workspace.</p>
            </div>
            {can('audit.view') && (
              <Link className="text-link" to="/audit">
                View all <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
          {data.recent_activity.length ? (
            <div className="activity-list">
              {data.recent_activity.map((r: Row) => (
                <div className="activity-row" key={r.id}>
                  <span className="activity-dot">
                    <Check size={13} />
                  </span>
                  <div>
                    <strong>{label(r.action.replaceAll('.', ' '))}</strong>
                    <small>{label(r.entity)}</small>
                  </div>
                  <time>
                    {new Date(r.created_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="A fresh page"
              description="School activity will appear here as your team gets started."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>School noticeboard</h2>
              <p>Good to know, all in one place.</p>
            </div>
            <MegaphoneIcon />
          </div>
          {data.announcements.length ? (
            <div className="notice-list">
              {data.announcements.map((r: Row) => (
                <article key={r.id}>
                  <span className="notice-date">
                    {new Date(r.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <h3>{r.title}</h3>
                  <p>{r.body}</p>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="Keep everyone in the loop"
              description="School announcements will appear on your noticeboard."
              action={
                can('notifications.send_email') && (
                  <Link className="text-link" to="/communication">
                    Write an announcement <ArrowRight size={15} />
                  </Link>
                )
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
function MegaphoneIcon() {
  return <span className="notice-pin">✦</span>;
}
function ParentDashboard({ data }: { data: Row }) {
  const toast = useToast();
  return (
    <>
      <PageHeader
        eyebrow="FAMILY WORKSPACE"
        title="A closer look at their school day."
        description="Attendance, published results, and fees for your linked children."
      />
      {!data.children.length && (
        <Empty
          title="No children linked yet"
          description="Ask your school administrator to connect your parent account to your children."
        />
      )}
      {data.children.map((child: Row) => (
        <section className="panel parent-child" key={child.student.id}>
          <div className="panel-heading">
            <div>
              <h2>{child.student.name}</h2>
              <p>{child.student.student_code}</p>
            </div>
            <Badge value={child.student.status} />
          </div>
          <div className="parent-ledger">
            <span>
              Charged <b>{money(child.ledger.charged)}</b>
            </span>
            <span>
              Paid <b>{money(child.ledger.paid)}</b>
            </span>
            <span>
              Outstanding <b>{money(child.ledger.balance)}</b>
            </span>
          </div>
          <h3>Recent attendance</h3>
          <div className="attendance-pills">
            {child.attendance.slice(0, 10).map((r: Row) => (
              <span key={r.id}>
                {r.attendance_date}
                <Badge value={r.status} />
              </span>
            ))}
          </div>
          <h3>Published results</h3>
          <div className="attendance-pills">
            {child.results.map((r: Row) => (
              <span key={r.id}>
                <strong>{r.subject_name}</strong>
                <small>{r.term_name}</small>
                {r.total}%<Badge value={r.grade} />
              </span>
            ))}
          </div>
          <h3>Report cards & receipts</h3>
          <div className="button-wrap">
            {child.documents.map((d: Row) => (
              <button
                className="btn btn-secondary"
                key={d.id}
                onClick={() =>
                  void downloadFile(
                    `/documents/${d.id}/download`,
                    `${d.kind.toLowerCase()}.${d.format}`,
                  ).catch((e) => toast(e.message, true))
                }
              >
                {label(d.kind)} · {d.format.toUpperCase()}
              </button>
            ))}
          </div>
        </section>
      ))}
      {data.announcements.map((r: Row) => (
        <article className="panel notice-article" key={r.id}>
          <h2>{r.title}</h2>
          <p>{r.body}</p>
        </article>
      ))}
    </>
  );
}
