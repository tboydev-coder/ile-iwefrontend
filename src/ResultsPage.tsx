import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, FileDown, Pencil, ArrowRight } from 'lucide-react';
import { api, allRecords, label } from './api';
import type { Row } from './api';
import { useAuth, useToast } from './context';
import { Empty, ErrorState, Loading, Modal, PageHeader, Spinner } from './components';
import { Records, ResourceSelect, titles } from './Records';
import { ReasonDialog } from './FinancePage';

export function ResultsPage({ teacher = false }: { teacher?: boolean }) {
  const { can, session } = useAuth(),
    client = useQueryClient(),
    toast = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('results'),
    [entry, setEntry] = useState<Row | null | undefined>(params.has('enter') ? null : undefined),
    [report, setReport] = useState(false),
    [reopen, setReopen] = useState<Row>(),
    [publish, setPublish] = useState<Row>();
  const transition = async (row: Row, action: string) => {
    try {
      await api(`/results/${row.id}/transition`, 'POST', { action });
      await client.invalidateQueries();
      toast(
        `Result ${action === 'publish' ? 'published' : action === 'approve' ? 'approved' : 'submitted'}.`,
      );
      setPublish(undefined);
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const closeEntry = () => {
    setEntry(undefined);
    if (params.has('enter')) {
      params.delete('enter');
      setParams(params, { replace: true });
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="EVERY LEARNER’S PROGRESS"
        title="Results & grading"
        description="From the first assessment to a report card worth sharing."
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setReport(true)}>
              <FileDown size={17} />
              Generate report card
            </button>
            {can('results.enter') && (
              <button className="btn" onClick={() => setEntry(null)}>
                <Plus size={17} />
                Enter results
              </button>
            )}
          </>
        }
      />
      <div className="workflow-strip">
        {['Draft', 'Submitted', 'Under review', 'Approved', 'Published'].map((s, i) => (
          <span key={s}>
            <b>{i + 1}</b>
            {s}
            {i < 4 && <ArrowRight size={14} />}
          </span>
        ))}
      </div>
      <div className="tabs" role="tablist">
        {(teacher ? ['results'] : ['results', 'assessments', 'grading-scales', 'grades']).map(
          (t) => (
            <button role="tab" aria-selected={tab === t} key={t} onClick={() => setTab(t)}>
              {titles[t]}
            </button>
          ),
        )}
      </div>
      {tab === 'assessments' && (
        <div className="info-strip">
          Active assessment weights must total 100%. Components with existing scores keep their
          original weights; deactivate them to introduce a new assessment structure.
        </div>
      )}
      <Records
        key={tab}
        resource={tab}
        embedded
        onRowAction={(row) =>
          tab === 'results' && (
            <>
              {row.status === 'DRAFT' &&
                can('results.enter') &&
                (!teacher || row.entered_by === session!.user.id) && (
                  <>
                    <button
                      className="icon-button"
                      title="Edit scores"
                      aria-label="Edit scores"
                      onClick={() => setEntry(row)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button className="text-link" onClick={() => void transition(row, 'submit')}>
                      Submit
                    </button>
                  </>
                )}
              {row.status === 'SUBMITTED' && can('results.review') && (
                <button className="text-link" onClick={() => void transition(row, 'review')}>
                  Start review
                </button>
              )}
              {row.status === 'UNDER_REVIEW' && can('results.review') && (
                <button className="text-link" onClick={() => void transition(row, 'approve')}>
                  Approve
                </button>
              )}
              {row.status === 'APPROVED' && can('results.publish') && (
                <button className="text-link" onClick={() => setPublish(row)}>
                  Publish
                </button>
              )}
              {row.status !== 'DRAFT' && can('results.publish') && (
                <button className="text-link" onClick={() => setReopen(row)}>
                  Reopen
                </button>
              )}
            </>
          )
        }
      />
      {entry !== undefined && <ResultForm record={entry || undefined} onClose={closeEntry} />}
      {report && <ReportForm onClose={() => setReport(false)} />}
      {reopen && (
        <ReasonDialog
          title="Reopen result for correction"
          description="This returns the result to draft. Previously generated report cards for this student and term will be superseded."
          onClose={() => setReopen(undefined)}
          onSave={async (reason) => {
            await api(`/results/${reopen.id}/transition`, 'POST', { action: 'reopen', reason });
            await client.invalidateQueries();
            setReopen(undefined);
            toast('Result reopened with an audit record.');
          }}
        />
      )}
      {publish && (
        <Modal title="Publish this result?" onClose={() => setPublish(undefined)}>
          <div className="modal-fields">
            <p>
              The result will be locked and parent notifications will be queued. Future changes
              require an authorized correction.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setPublish(undefined)}>
              Cancel
            </button>
            <button className="btn" onClick={() => void transition(publish, 'publish')}>
              Publish result
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ResultForm({ record, onClose }: { record?: Row; onClose: () => void }) {
  const client = useQueryClient(),
    toast = useToast();
  const [student, setStudent] = useState(record?.student_id || ''),
    [subject, setSubject] = useState(record?.subject_id || ''),
    [term, setTerm] = useState(record?.term_id || ''),
    [scores, setScores] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const components = useQuery({
    queryKey: ['assessments'],
    queryFn: () => allRecords('assessments'),
  });
  const prior = useQuery({
    queryKey: ['scores', record?.id],
    queryFn: () => api<Row[]>(`/results/${record?.id}/scores`),
    enabled: Boolean(record),
  });
  useEffect(() => {
    if (prior.data) setScores(Object.fromEntries(prior.data.map((s) => [s.component_id, s.score])));
  }, [prior.data]);
  const active = components.data?.filter((c) => c.active) || [];
  return (
    <Modal title={record ? 'Edit draft result' : 'Enter student results'} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const result = await api('/results', 'POST', {
              student_id: student,
              subject_id: subject,
              term_id: term,
              scores: active.map((c) => ({ component_id: c.id, score: scores[c.id] })),
            });
            await client.invalidateQueries();
            toast(`Result saved: ${result.total}% · Grade ${result.grade}.`);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-fields">
          <ResourceSelect
            resource="students"
            title="Student"
            value={student}
            onChange={setStudent}
            required
            disabled={Boolean(record)}
          />
          <div className="form-grid">
            <ResourceSelect
              resource="subjects"
              title="Subject"
              value={subject}
              onChange={setSubject}
              required
              disabled={Boolean(record)}
            />
            <ResourceSelect
              resource="terms"
              title="Term"
              value={term}
              onChange={setTerm}
              required
              disabled={Boolean(record)}
            />
          </div>
          <h3>Assessment scores</h3>
          {components.isPending ? (
            <Loading />
          ) : components.error ? (
            <ErrorState error={components.error} />
          ) : active.length ? (
            <div className="assessment-inputs">
              {active.map((c) => (
                <label className="field" key={c.id}>
                  <span>
                    {c.name}
                    <small>{c.weight}% of total</small>
                  </span>
                  <div className="score-input">
                    <input
                      type="number"
                      min="0"
                      max={c.max_score}
                      step="0.01"
                      value={scores[c.id] || ''}
                      onChange={(e) => setScores({ ...scores, [c.id]: e.target.value })}
                      required
                    />
                    <span>/ {Number(c.max_score)}</span>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <Empty
              title="Configure assessments first"
              description="Add assessment components and weights before entering results."
            />
          )}
          <p className="form-hint">
            The server calculates the weighted total and grade using your school’s active grading
            scale.
          </p>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy || !active.length}>
            {busy ? <Spinner /> : 'Save draft result'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ReportForm({ onClose }: { onClose: () => void }) {
  const { can } = useAuth(),
    toast = useToast(),
    client = useQueryClient();
  const [student, setStudent] = useState(''),
    [term, setTerm] = useState(''),
    [format, setFormat] = useState('pdf'),
    [email, setEmail] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title="Generate a report card" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/results/report-cards/generate', 'POST', {
              student_id: student,
              term_id: term,
              format,
              email_parents: email,
            });
            await client.invalidateQueries();
            toast('Report card queued. Download it from Documents & reports when ready.');
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-fields">
          <ResourceSelect
            resource="students"
            title="Student"
            value={student}
            onChange={setStudent}
            required
          />
          <ResourceSelect resource="terms" title="Term" value={term} onChange={setTerm} required />
          <label className="field">
            <span>Document format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="pdf">PDF · ready to print</option>
              <option value="docx">DOCX · Word document</option>
            </select>
          </label>
          {can('notifications.send_email') && (
            <label className="checkbox-field">
              <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
              <span>Email the document to eligible guardians</span>
            </label>
          )}
          <p className="form-hint">
            All entered results for this student and term must be published before generation.
          </p>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {busy ? <Spinner /> : 'Generate report card'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
