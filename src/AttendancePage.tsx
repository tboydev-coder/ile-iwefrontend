import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Camera, Check, ClipboardCheck, QrCode, Save, X } from 'lucide-react';
import { api, schoolDate } from './api';
import type { Page, Row } from './api';
import { useAuth, useToast } from './context';
import {
  Badge,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Spinner,
} from './components';
import { Records, ResourceSelect } from './Records';

export function AttendancePage() {
  const { can, session } = useAuth(),
    toast = useToast(),
    client = useQueryClient();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(can('attendance.mark') ? 'mark' : 'history');
  const [classId, setClassId] = useState(''),
    [termId, setTermId] = useState(''),
    [date, setDate] = useState(schoolDate(session?.school.timezone));
  const [page, setPage] = useState(1),
    [marks, setMarks] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(Boolean(params.get('token'))),
    [token, setToken] = useState(params.get('token') || '');
  const [correction, setCorrection] = useState<Row>();
  const query = useQuery({
    queryKey: ['roster', classId, page],
    queryFn: () =>
      api<Page>(
        `/records/students?class_id=${classId}&status=ACTIVE&page=${page}&page_size=50&sort=last_name&direction=asc`,
      ),
    enabled: Boolean(classId),
  });
  const existing = useQuery({
    queryKey: ['attendance-day', classId, termId, date, page],
    queryFn: async () => {
      const all: Row[] = [];
      for (let p = 1; ; p++) {
        const data = await api<Page>(
          `/records/attendance?class_id=${classId}&term_id=${termId}&attendance_date=${date}&page_size=100&page=${p}`,
        );
        all.push(...data.items);
        if (all.length >= data.total) break;
      }
      return all;
    },
    enabled: Boolean(classId && termId),
  });
  useEffect(() => {
    setMarks({});
    setPage(1);
  }, [classId, termId, date]);
  const saved = Object.fromEntries((existing.data || []).map((r) => [r.student_id, r]));
  const save = async () => {
    if (!termId) {
      toast('Select a term first.', true);
      return;
    }
    const records = (query.data?.items || [])
      .filter((s) => !saved[s.id] && marks[s.id])
      .map((s) => ({
        student_id: s.id,
        term_id: termId,
        attendance_date: date,
        status: marks[s.id],
      }));
    if (!records.length) {
      toast('Choose an attendance status for at least one student.', true);
      return;
    }
    setBusy(true);
    try {
      await api('/attendance/bulk', 'POST', { records });
      await client.invalidateQueries();
      setMarks({});
      toast(`Attendance saved for ${records.length} students.`);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const scan = async (value: string) => {
    if (!termId) {
      toast('Choose the current term before scanning.', true);
      return;
    }
    let raw = value;
    try {
      raw = new URL(value).searchParams.get('token') || value;
    } catch {
      /* A raw token is also accepted. */
    }
    setBusy(true);
    try {
      const result = await api('/attendance/scan', 'POST', { token: raw, term_id: termId });
      await client.invalidateQueries();
      toast(
        result.duplicate
          ? `Already marked ${result.record.status.toLowerCase()} today.`
          : 'Student marked present. Parent updates queued.',
      );
      setToken('');
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="EVERY SCHOOL DAY COUNTS"
        title="Attendance"
        description="A warm welcome, a quick check-in, and everyone accounted for."
        actions={
          can('attendance.mark') && (
            <button className="btn" onClick={() => setScanOpen(true)}>
              <QrCode size={17} />
              Scan student QR
            </button>
          )
        }
      />
      <div className="tabs" role="tablist">
        {can('attendance.mark') && (
          <button role="tab" aria-selected={tab === 'mark'} onClick={() => setTab('mark')}>
            Take attendance
          </button>
        )}
        <button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
          Attendance history
        </button>
      </div>
      {tab === 'history' ? (
        <Records
          resource="attendance"
          embedded
          onRowAction={(row) =>
            can('attendance.correct') && (
              <button className="text-link" onClick={() => setCorrection(row)}>
                Correct
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="panel attendance-filters">
            <ResourceSelect
              resource="classes"
              title="Class arm"
              value={classId}
              onChange={setClassId}
            />
            <ResourceSelect resource="terms" title="Term" value={termId} onChange={setTermId} />
            <label className="field">
              <span>School day</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={schoolDate(session?.school.timezone)}
                disabled={!can('attendance.correct')}
              />
            </label>
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Class roll call</h2>
                <p>Choose a status for each student, then save your attendance.</p>
              </div>
              <button
                className="btn btn-secondary btn-small"
                disabled={!query.data?.items.length}
                onClick={() =>
                  setMarks(
                    Object.fromEntries(
                      (query.data?.items || [])
                        .filter((s) => !saved[s.id])
                        .map((s) => [s.id, 'PRESENT']),
                    ),
                  )
                }
              >
                <Check size={15} />
                Mark this page present
              </button>
            </div>
            {!classId ? (
              <Empty
                title="Let’s start with a class"
                description="Select a class and term to see your students."
              />
            ) : query.isPending ? (
              <Loading />
            ) : query.error ? (
              <ErrorState error={query.error} />
            ) : !query.data.items.length ? (
              <Empty
                title="No active students in this class"
                description="Assign students to this class from student management."
              />
            ) : (
              <>
                <div className="attendance-roster">
                  {query.data.items.map((student) => (
                    <div className="roster-row" key={student.id}>
                      <div className="roster-student">
                        <span className="table-avatar">
                          {student.first_name[0]}
                          {student.last_name[0]}
                        </span>
                        <span>
                          <strong>{student.name}</strong>
                          <small>{student.student_code}</small>
                        </span>
                      </div>
                      {saved[student.id] ? (
                        <div className="saved-attendance">
                          <Badge value={saved[student.id].status} />
                          <small>Saved</small>
                        </div>
                      ) : (
                        <div
                          className="attendance-buttons"
                          role="group"
                          aria-label={`Attendance for ${student.name}`}
                        >
                          {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((status) => (
                            <button
                              className={
                                marks[student.id] === status
                                  ? 'selected status-' + status.toLowerCase()
                                  : ''
                              }
                              aria-pressed={marks[student.id] === status}
                              key={status}
                              onClick={() => setMarks({ ...marks, [student.id]: status })}
                            >
                              {status.charAt(0) + status.slice(1).toLowerCase()}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Pagination page={page} total={query.data.total} pageSize={50} onChange={setPage} />
                <div className="attendance-save">
                  <span>
                    <ClipboardCheck size={16} />
                    {Object.keys(marks).length} selected · save before switching pages
                  </span>
                  <button
                    className="btn"
                    disabled={busy || !termId || existing.isPending || Boolean(existing.error)}
                    onClick={() => void save()}
                  >
                    {busy ? <Spinner /> : <Save size={16} />}Save attendance
                  </button>
                </div>
                {existing.error && <p className="form-error">{existing.error.message}</p>}
              </>
            )}
          </section>
        </>
      )}
      {scanOpen && (
        <Modal title="Scan student attendance QR" onClose={() => setScanOpen(false)}>
          <div className="modal-fields">
            <ResourceSelect
              resource="terms"
              title="Current term"
              value={termId}
              onChange={setTermId}
            />
            <p className="form-hint">
              A signed-in teacher can scan a student’s printed QR card. Attendance is recorded for
              today in your school’s timezone.
            </p>
            {termId && <QRScanner onScan={(value) => void scan(value)} disabled={busy} />}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void scan(token);
              }}
            >
              <label className="field">
                <span>Or paste a QR link / token</span>
                <textarea
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  rows={3}
                />
              </label>
              <button className="btn" disabled={busy || !termId}>
                {busy ? <Spinner /> : <QrCode size={17} />}Mark present
              </button>
            </form>
          </div>
        </Modal>
      )}
      {correction && (
        <CorrectionForm record={correction} onClose={() => setCorrection(undefined)} />
      )}
    </>
  );
}

function QRScanner({ onScan, disabled }: { onScan: (value: string) => void; disabled: boolean }) {
  const video = useRef<HTMLVideoElement>(null),
    callback = useRef(onScan),
    busyRef = useRef(disabled);
  const [active, setActive] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    callback.current = onScan;
    busyRef.current = disabled;
  }, [onScan, disabled]);
  useEffect(() => {
    if (!active || !video.current) return;
    let controls: { stop: () => void } | undefined;
    let cancelled = false,
      lastValue = '',
      lastTime = 0;
    const target = video.current;
    import('@zxing/browser')
      .then(async ({ BrowserQRCodeReader }) => {
        if (cancelled) return;
        const reader = new BrowserQRCodeReader();
        controls = await reader.decodeFromVideoDevice(undefined, target, (result) => {
          if (result && !busyRef.current) {
            const text = result.getText();
            if (text !== lastValue || Date.now() - lastTime > 5000) {
              lastValue = text;
              lastTime = Date.now();
              callback.current(text);
            }
          }
        });
        if (cancelled) controls.stop();
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'Camera unavailable. Allow camera access over HTTPS, or paste the QR link below.',
          );
          setActive(false);
        }
      });
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [active]);
  return (
    <div className="scanner">
      <video ref={video} className={active ? 'scanner-video' : 'hidden'} muted playsInline />
      {error && <p className="form-error">{error}</p>}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setError('');
          setActive(!active);
        }}
      >
        {active ? <X size={16} /> : <Camera size={16} />}
        {active ? 'Stop camera' : 'Open camera scanner'}
      </button>
    </div>
  );
}
function CorrectionForm({ record, onClose }: { record: Row; onClose: () => void }) {
  const [status, setStatus] = useState(record.status),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const client = useQueryClient(),
    toast = useToast();
  return (
    <Modal title="Correct attendance" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/attendance/${record.id}`, 'PATCH', { status, reason });
            await client.invalidateQueries();
            toast('Attendance corrected and logged.');
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-fields">
          <label className="field">
            <span>Correct status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Reason for correction</span>
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            Save correction
          </button>
        </div>
      </form>
    </Modal>
  );
}
