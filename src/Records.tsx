import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Download,
  Pencil,
  QrCode,
  ArrowRight,
  SlidersHorizontal,
  Check,
  RotateCcw,
} from 'lucide-react';
import { api, allRecords, label, money, downloadFile, request } from './api';
import type { Row, Page } from './api';
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
import { StudentPhoto } from './ProfileImages';
import { PasswordInput } from './PasswordInput';

export type FieldSpec = {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  resource?: string;
  options?: string[];
  curriculum_options?: { name: string; level: string }[];
  max_length?: number;
};
export type Catalog = Record<
  string,
  { fields: FieldSpec[]; can_create: boolean; can_edit: boolean }
>;
export const titles: Record<string, string> = {
  students: 'Students',
  parents: 'Parents & guardians',
  'student-parents': 'Guardian relationships',
  staff: 'Staff profiles',
  users: 'User accounts',
  sessions: 'Academic sessions',
  terms: 'Terms',
  'class-levels': 'Class levels',
  classes: 'Class arms',
  subjects: 'Subjects',
  assignments: 'Teacher assignments',
  assessments: 'Assessment components',
  'grading-scales': 'Grading scales',
  grades: 'Grade ranges',
  timetable: 'Timetable',
  'fee-structures': 'Fee structures',
  'fee-items': 'Fee items',
  charges: 'Student charges',
  payments: 'Payments',
  templates: 'Message templates',
  announcements: 'Announcements',
  notifications: 'Delivery history',
  documents: 'Documents',
  audit: 'Audit trail',
  results: 'Results',
  attendance: 'Attendance history',
  calendar: 'School calendar',
};
const columns: Record<string, string[]> = {
  students: ['name', 'student_code', 'admission_no', 'class_id', 'status'],
  parents: ['name', 'phone', 'email', 'notify_email'],
  'student-parents': ['student_id', 'parent_id', 'relationship', 'primary_contact'],
  staff: ['name', 'job_title', 'phone', 'employment_date', 'active'],
  users: ['name', 'email', 'role', 'active'],
  sessions: ['name', 'start_date', 'end_date', 'active'],
  terms: ['name', 'session_id', 'start_date', 'end_date', 'active'],
  'class-levels': ['name', 'sort_order'],
  classes: ['name', 'level_id', 'teacher_id'],
  subjects: ['school_level', 'name', 'code', 'category', 'compulsory', 'active'],
  assignments: ['class_id', 'subject_id', 'teacher_id'],
  assessments: ['name', 'weight', 'max_score', 'active'],
  'grading-scales': ['name', 'active'],
  grades: ['label', 'min_score', 'max_score', 'remark', 'passing'],
  timetable: [
    'weekday',
    'class_id',
    'subject_id',
    'teacher_id',
    'room',
    'start_time',
    'end_time',
    'published',
  ],
  'fee-structures': ['name', 'term_id', 'class_id'],
  'fee-items': ['name', 'structure_id', 'amount'],
  charges: ['student_id', 'description', 'term_id', 'amount', 'discount'],
  payments: ['student_id', 'receipt_number', 'amount', 'method', 'payment_date', 'reversed'],
  attendance: ['student_id', 'class_id', 'attendance_date', 'status', 'source'],
  calendar: ['title', 'start_date', 'end_date', 'audience', 'class_id'],
  results: ['student_id', 'subject_id', 'term_id', 'total', 'grade', 'status'],
  templates: ['name', 'event', 'channel', 'body'],
  announcements: ['title', 'body', 'created_at'],
  notifications: ['recipient', 'channel', 'subject', 'status', 'attempts'],
  documents: ['student_id', 'kind', 'format', 'status', 'created_at'],
  audit: ['action', 'entity', 'actor_id', 'created_at'],
};
const relationResources: Record<string, string> = {
  class_id: 'classes',
  level_id: 'class-levels',
  student_id: 'students',
  parent_id: 'parents',
  teacher_id: 'users',
  user_id: 'users',
  actor_id: 'users',
  subject_id: 'subjects',
  term_id: 'terms',
  session_id: 'sessions',
  structure_id: 'fee-structures',
  scale_id: 'grading-scales',
};
export const fieldLabel = (key: string) =>
  ({
    class_id: 'Class arm',
    level_id: 'Class level',
    student_id: 'Student',
    parent_id: 'Parent / guardian',
    teacher_id: 'Teacher',
    user_id: 'User account',
    actor_id: 'Team member',
    subject_id: 'Subject',
    term_id: 'Term',
    session_id: 'Session',
    structure_id: 'Fee structure',
    scale_id: 'Grading scale',
    admission_no: 'Admission number',
    student_code: 'Student ID',
    notify_email: 'Email updates',
    primary_contact: 'Primary contact',
  })[key] || label(key);
export const recordName = (row: Row) =>
  row.label ||
  row.name ||
  row.title ||
  row.receipt_number ||
  row.description ||
  row.student_code ||
  row.id.slice(0, 8);

export function useOptions(resource: string) {
  return useQuery({
    queryKey: ['options', resource],
    queryFn: async () => {
      const first = await api<Page>(`/lookups/${resource}?page_size=100`);
      const rows = [...first.items];
      for (let page = 2; rows.length < first.total; page++) {
        const next = await api<Page>(`/lookups/${resource}?page_size=100&page=${page}`);
        rows.push(...next.items);
        if (!next.items.length) break;
      }
      return rows;
    },
    staleTime: 60_000,
  });
}
export function ResourceSelect({
  resource,
  value,
  onChange,
  title,
  required = false,
  teacherOnly = false,
  disabled = false,
}: {
  resource: string;
  value: string;
  onChange: (value: string) => void;
  title?: string;
  required?: boolean;
  teacherOnly?: boolean;
  disabled?: boolean;
}) {
  const query = useOptions(resource);
  const rows = query.data?.filter((row) => !teacherOnly || row.role === 'TEACHER') || [];
  return (
    <label className="field">
      <span>{title || titles[resource]}</span>
      <select
        aria-label={title || titles[resource]}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled || query.isPending}
      >
        <option value="">
          {query.isPending ? 'Loading…' : `Select ${title?.toLowerCase() || 'an option'}`}
        </option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {recordName(row)}
          </option>
        ))}
      </select>
      {query.error && <small className="field-error">{query.error.message}</small>}
      {!query.isPending && !query.error && !rows.length && (
        <small>Create {titles[resource]?.toLowerCase()} first.</small>
      )}
    </label>
  );
}
function RelationCell({ field, value }: { field: string; value: string }) {
  const query = useOptions(relationResources[field]);
  const row = query.data?.find((r) => r.id === value);
  return <span>{row ? recordName(row) : '—'}</span>;
}
export function Cell({ field, value }: { field: string; value: unknown }) {
  if (value === null || value === undefined || value === '')
    return <span className="muted">—</span>;
  if (field in relationResources) return <RelationCell field={field} value={String(value)} />;
  if (field === 'status') return <Badge value={value} />;
  if (typeof value === 'boolean') return <Badge value={value ? 'YES' : 'NO'} />;
  if (['amount', 'discount', 'previous_balance', 'new_balance'].includes(field))
    return <span className="numeric">{money(value)}</span>;
  if (field.endsWith('_at'))
    return (
      <span>
        {new Date(String(value)).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    );
  if (field === 'weekday')
    return (
      <span>
        {
          ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
            Number(value)
          ]
        }
      </span>
    );
  if (field === 'role') return <span className="role-text">{label(String(value))}</span>;
  return (
    <span
      className={field === 'name' || field === 'title' ? 'cell-name' : ''}
      title={String(value)}
    >
      {String(value)}
    </span>
  );
}

export function RecordForm({
  resource,
  fields,
  record,
  onClose,
  schoolType,
}: {
  resource: string;
  fields: FieldSpec[];
  record?: Row;
  onClose: () => void;
  schoolType?: string;
}) {
  const client = useQueryClient(),
    toast = useToast();
  const [error, setError] = useState('');
  const initial = Object.fromEntries(
    fields.map((f) => [
      f.name,
      record?.[f.name] ??
        (resource === 'subjects' && f.name === 'school_level'
          ? schoolType === 'SECONDARY'
            ? 'SECONDARY'
            : 'PRIMARY'
          : f.default ?? (f.type === 'boolean' ? false : '')),
    ]),
  );
  const form = useForm<Row>({ defaultValues: initial });
  const submit = form.handleSubmit(async (values) => {
    setError('');
    const data: Row = {};
    for (const f of fields) {
      const value = values[f.name];
      if (f.name === 'password' && record && !value) continue;
      if (record && value === initial[f.name]) continue;
      data[f.name] =
        value === '' && (f.resource || f.type === 'date' || f.type === 'number')
          ? null
          : f.type === 'number'
            ? Number(value)
            : value;
    }
    try {
      await api(
        `/records/${resource}${record ? '/' + record.id : ''}`,
        record ? 'PATCH' : 'POST',
        data,
      );
      await client.invalidateQueries();
      toast(record ? 'Changes saved.' : 'Record created.');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  });
  return (
    <Modal
      title={`${record ? 'Edit' : 'Add'} ${titles[resource]?.toLowerCase() || resource}`}
      onClose={() => {
        if (!form.formState.isSubmitting) onClose();
      }}
      wide={fields.length > 8}
    >
      <form onSubmit={submit} aria-busy={form.formState.isSubmitting}>
        <fieldset className="form-fieldset" disabled={form.formState.isSubmitting}>
          <div className={fields.length > 6 ? 'form-grid modal-fields' : 'modal-fields'}>
            {fields.map((f) =>
              f.resource ? (
                <ResourceSelect
                  key={f.name}
                  resource={f.resource}
                  title={fieldLabel(f.name)}
                  value={form.watch(f.name) || ''}
                  onChange={(v) => form.setValue(f.name, v)}
                  required={f.required}
                  teacherOnly={f.name === 'teacher_id'}
                />
              ) : resource === 'subjects' && f.name === 'school_level' ? null : f.name === 'name' &&
                resource === 'subjects' &&
                f.curriculum_options ? (
                <SubjectNameField
                  key={f.name}
                  field={f}
                  form={form}
                  record={record}
                  schoolType={schoolType || 'COMBINED'}
                />
              ) : f.type === 'boolean' ? (
                <label className="checkbox-field" key={f.name}>
                  <input type="checkbox" {...form.register(f.name)} />
                  <span>{fieldLabel(f.name)}</span>
                </label>
              ) : (
                <div
                  className={
                    'field ' +
                    (['body', 'address', 'emergency_info'].includes(f.name) ? 'field-full' : '')
                  }
                  key={f.name}
                >
                  <label htmlFor={`record-field-${f.name}`}>
                    {fieldLabel(f.name)}
                    {!f.required && ' (optional)'}
                  </label>
                  {f.options ? (
                    <select
                      id={`record-field-${f.name}`}
                      {...form.register(f.name)}
                      required={f.required}
                    >
                      <option value="">Select an option</option>
                      {f.options.map((o) => (
                        <option value={o} key={o}>
                          {label(o)}
                        </option>
                      ))}
                    </select>
                  ) : f.name === 'weekday' ? (
                    <select id={`record-field-${f.name}`} {...form.register(f.name)}>
                      {[
                        'Monday',
                        'Tuesday',
                        'Wednesday',
                        'Thursday',
                        'Friday',
                        'Saturday',
                        'Sunday',
                      ].map((day, i) => (
                        <option key={day} value={i}>
                          {day}
                        </option>
                      ))}
                    </select>
                  ) : ['body', 'address', 'emergency_info'].includes(f.name) ? (
                    <textarea
                      id={`record-field-${f.name}`}
                      {...form.register(f.name)}
                      rows={3}
                      required={f.required}
                      maxLength={f.max_length || 10000}
                    />
                  ) : f.type === 'password' || f.name === 'password' ? (
                    <PasswordInput
                      id={`record-field-${f.name}`}
                      {...form.register(f.name)}
                      required={f.required && !record}
                      minLength={12}
                      maxLength={f.max_length || undefined}
                      autoComplete="new-password"
                      aria-label={fieldLabel(f.name)}
                    />
                  ) : (
                    <input
                      id={`record-field-${f.name}`}
                      {...form.register(f.name)}
                      type={f.type === 'text' && f.name === 'email' ? 'email' : f.type}
                      required={f.required && !(record && f.name === 'password')}
                      maxLength={f.max_length || undefined}
                      min={f.type === 'number' ? 0 : undefined}
                      step={f.type === 'number' ? '0.01' : undefined}
                      minLength={f.name === 'password' ? 12 : undefined}
                      autoComplete={f.name === 'password' ? 'new-password' : 'off'}
                    />
                  )}
                </div>
              ),
            )}
          </div>
          {resource === 'users' && (
            <p className="form-hint">
              Use at least 12 characters for passwords. Share new account credentials securely with
              the account holder.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner /> : <Check size={17} />}Save{' '}
              {record ? 'changes' : 'record'}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

function SubjectNameField({
  field,
  form,
  record,
  schoolType,
}: {
  field: FieldSpec;
  form: ReturnType<typeof useForm<Row>>;
  record?: Row;
  schoolType: string;
}) {
  const initialLevel =
    record?.school_level ||
    (schoolType === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY');
  const [level, setLevel] = useState(
    initialLevel,
  );
  useEffect(() => {
    if (schoolType !== 'COMBINED') {
      form.setValue('school_level', schoolType);
      setLevel(schoolType);
    } else if (!record) {
      form.setValue('school_level', level);
    }
  }, [form, level, record, schoolType]);
  const options =
    field.curriculum_options?.filter((option) => option.level === level) || [];
  const current = form.watch('name') || '';
  const isCustom = Boolean(current) && !options.some((option) => option.name === current);
  const [custom, setCustom] = useState(isCustom);
  return (
    <>
      {schoolType === 'COMBINED' && (
        <div className="field">
          <label htmlFor="record-field-school-level">Curriculum track</label>
          <select
            id="record-field-school-level"
            value={level}
            onChange={(event) => {
              const next = event.target.value;
              setLevel(next);
              form.setValue('school_level', next);
              form.setValue('name', '');
            }}
          >
            <option value="PRIMARY">Primary / Kindergarten</option>
            <option value="SECONDARY">Secondary (JSS / SSS)</option>
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="record-field-name">Subject name</label>
        <select
          id="record-field-name"
          value={custom ? '__custom__' : current}
          onChange={(event) => {
            const value = event.target.value;
            if (value === '__custom__') {
              setCustom(true);
              form.setValue('name', '');
            } else {
              setCustom(false);
              form.setValue('name', value);
            }
          }}
          required={!custom}
          disabled={Boolean(record)}
        >
          <option value="">Select an approved subject</option>
          {options.map((option) => (
            <option key={`${option.level}-${option.name}`} value={option.name}>
              {option.name}
            </option>
          ))}
          <option value="__custom__">Other subject (enter manually)</option>
        </select>
      </div>
      {custom && (
        <div className="field">
          <label htmlFor="record-field-custom-name">Custom subject name</label>
          <input
            id="record-field-custom-name"
            value={current}
            onChange={(event) => form.setValue('name', event.target.value)}
            required
            maxLength={field.max_length || 120}
          />
        </div>
      )}
    </>
  );
}

export function Records({
  resource,
  embedded = false,
  description,
  extraActions,
  onRowAction,
}: {
  resource: string;
  embedded?: boolean;
  description?: string;
  extraActions?: React.ReactNode;
  onRowAction?: (row: Row) => React.ReactNode;
}) {
  const auth = useAuth(),
    toast = useToast(),
    client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [debounced, setDebounced] = useState(''),
    [filter, setFilter] = useState('');
  const [edit, setEdit] = useState<Row | null | undefined>(
    params.get('create') === '1' ? null : undefined,
  );
  const [detail, setDetail] = useState<Row>();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<Catalog>('/catalog') });
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPage(1);
    setSearch('');
    setFilter('');
  }, [resource]);
  const query = useQuery({
    queryKey: ['records', resource, page, debounced, filter],
    queryFn: () =>
      api<Page>(
        `/records/${resource}?page=${page}&search=${encodeURIComponent(debounced)}${filter ? '&status=' + filter : ''}`,
      ),
    refetchInterval: ['documents', 'notifications'].includes(resource) ? 5000 : false,
  });
  const meta = catalog.data?.[resource];
  const close = () => {
    setEdit(undefined);
    if (params.has('create')) {
      params.delete('create');
      setParams(params, { replace: true });
    }
  };
  const exportCsv = () =>
    void downloadFile(`/reports/${resource}.csv`, `ile-iwe-${resource}.csv`).catch((e) =>
      toast(e.message, true),
    );
  const retryJob = async (row: Row) => {
    try {
      await api(`/jobs/${resource}/${row.id}/retry`, 'POST');
      await client.invalidateQueries();
      toast('Job queued for retry.');
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  return (
    <>
      {!embedded && (
        <PageHeader
          eyebrow="SCHOOL WORKSPACE"
          title={titles[resource] || label(resource)}
          description={description || 'Keep your school records organized and up to date.'}
          actions={
            <>
              {extraActions}
              {meta?.can_create && (
                <button className="btn" onClick={() => setEdit(null)}>
                  <Plus size={17} />
                  Add {resource === 'students' ? 'student' : 'record'}
                </button>
              )}
            </>
          }
        />
      )}
      <section className="panel records-panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label={`Search ${titles[resource]}`}
              placeholder={`Search ${titles[resource]?.toLowerCase() || 'records'}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="table-controls">
            {resource === 'students' && (
              <label className="filter-control">
                <SlidersHorizontal size={15} />
                <select
                  aria-label="Filter student status"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {['ACTIVE', 'INACTIVE', 'WITHDRAWN', 'GRADUATED', 'TRANSFERRED'].map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {auth.can('reports.view') &&
              ['students', 'parents', 'attendance', 'results', 'payments', 'charges'].includes(
                resource,
              ) && (
                <button className="btn btn-secondary btn-small" onClick={exportCsv}>
                  <Download size={15} />
                  Export
                </button>
              )}
            {embedded && (
              <>
                {extraActions}
                {meta?.can_create && (
                  <button className="btn btn-small" onClick={() => setEdit(null)}>
                    <Plus size={16} />
                    Add record
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : !query.data.items.length ? (
          <Empty
            title={
              search || filter
                ? 'No matching records'
                : `Your ${titles[resource]?.toLowerCase()} start here`
            }
            description={
              search || filter
                ? 'Try another search or change your filters.'
                : 'Add your first record and make this space your own.'
            }
            action={
              meta?.can_create && (
                <button className="btn btn-secondary" onClick={() => setEdit(null)}>
                  <Plus size={16} />
                  Add your first record
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {(columns[resource] || ['name', 'created_at']).map((field) => (
                      <th key={field}>{fieldLabel(field)}</th>
                    ))}
                    <th className="actions-heading">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((row) => (
                    <tr key={row.id}>
                      {(columns[resource] || ['name', 'created_at']).map((field, i) => (
                        <td key={field}>
                          {i === 0 && resource === 'students' ? (
                            <button className="student-name-button" onClick={() => setDetail(row)}>
                              <span className="table-avatar">
                                {row.first_name?.[0]}
                                {row.last_name?.[0]}
                              </span>
                              <span>
                                <strong>{row.name}</strong>
                                <small>{row.gender || 'Student'}</small>
                              </span>
                            </button>
                          ) : (
                            <Cell field={field} value={row[field]} />
                          )}
                        </td>
                      ))}
                      <td>
                        <div className="row-actions">
                          {onRowAction?.(row)}
                          {resource === 'students' && (
                            <button
                              className="icon-button"
                              title="Open student profile"
                              aria-label={`Open ${row.name}`}
                              onClick={() => setDetail(row)}
                            >
                              <ArrowRight size={16} />
                            </button>
                          )}
                          {meta?.can_edit && (
                            <button
                              className="icon-button"
                              title="Edit record"
                              aria-label={`Edit ${recordName(row)}`}
                              onClick={() => setEdit(row)}
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {resource === 'documents' && row.status === 'READY' && (
                            <button
                              className="icon-button"
                              title="Download document"
                              aria-label="Download document"
                              onClick={() =>
                                void downloadFile(
                                  `/documents/${row.id}/download`,
                                  `${row.kind.toLowerCase()}.${row.format}`,
                                ).catch((e) => toast(e.message, true))
                              }
                            >
                              <Download size={16} />
                            </button>
                          )}
                          {['documents', 'notifications'].includes(resource) &&
                            row.status === 'FAILED' &&
                            auth.can('school.manage_settings') && (
                              <button
                                className="icon-button"
                                title="Retry failed job"
                                onClick={() => void retryJob(row)}
                              >
                                <RotateCcw size={15} />
                              </button>
                            )}
                          {resource === 'audit' && (
                            <button className="text-link" onClick={() => setDetail(row)}>
                              Details
                            </button>
                          )}
                          {['notifications', 'announcements', 'templates'].includes(resource) && (
                            <button className="text-link" onClick={() => setDetail(row)}>
                              View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={query.data.total} onChange={setPage} />
          </>
        )}
      </section>
      {edit !== undefined && meta && (
        <RecordForm
          key={resource + (edit?.id || 'new')}
          resource={resource}
          fields={meta.fields}
          record={edit || undefined}
          onClose={close}
          schoolType={auth.session?.school.school_type}
        />
      )}
      {detail &&
        (resource === 'students' ? (
          <StudentDetail student={detail} onClose={() => setDetail(undefined)} />
        ) : (
          <Modal
            title={detail.title || detail.subject || detail.name || 'Record details'}
            onClose={() => setDetail(undefined)}
          >
            <div className="record-details">
              {resource === 'audit' ? (
                <pre>{JSON.stringify(detail.details, null, 2)}</pre>
              ) : (
                <p className="preserve-lines">{detail.body}</p>
              )}
              {detail.last_error && <p>{detail.last_error}</p>}
            </div>
          </Modal>
        ))}
    </>
  );
}

function StudentDetail({ student, onClose }: { student: Row; onClose: () => void }) {
  const { can } = useAuth(),
    toast = useToast();
  const [qr, setQr] = useState('');
  const balance = useQuery({
    queryKey: ['ledger', student.id],
    queryFn: () => api(`/students/${student.id}/ledger`),
    enabled: can('finance.view'),
  });
  const history = useQuery({
    queryKey: ['student-attendance', student.id],
    queryFn: () => api<Page>(`/records/attendance?student_id=${student.id}&page_size=10`),
    enabled: can('attendance.view'),
  });
  useEffect(() => {
    return () => {
      if (qr) URL.revokeObjectURL(qr);
    };
  }, [qr]);
  const showQr = async () => {
    try {
      const response = await request(`/students/${student.id}/qr?image=true`);
      setQr(URL.createObjectURL(await response.blob()));
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const rotate = async () => {
    try {
      await api(`/students/${student.id}/qr/rotate`, 'POST');
      setQr('');
      toast('Old QR code revoked. Generate and print a replacement.');
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  return (
    <Modal title={student.name} onClose={onClose} wide>
      <div className="student-profile">
        <div className="student-profile-top">
          <StudentPhoto student={student} />
          <div>
            <h3>{student.name}</h3>
            <p>{student.student_code}</p>
            <Badge value={student.status} />
          </div>
        </div>
        <div className="profile-grid">
          {['admission_no', 'class_id', 'date_of_birth', 'gender', 'address', 'emergency_info'].map(
            (f) => (
              <div key={f}>
                <small>{fieldLabel(f)}</small>
                <Cell field={f} value={student[f]} />
              </div>
            ),
          )}
        </div>
        {balance.data && (
          <div className="parent-ledger">
            <span>
              Charged <b>{money(balance.data.charged)}</b>
            </span>
            <span>
              Paid <b>{money(balance.data.paid)}</b>
            </span>
            <span>
              Balance <b>{money(balance.data.balance)}</b>
            </span>
          </div>
        )}
        {balance.error && <p className="form-error">{balance.error.message}</p>}
        <div className="button-wrap">
          {can('attendance.mark') && (
            <button className="btn btn-secondary" onClick={() => void showQr()}>
              <QrCode size={17} />
              Show attendance QR
            </button>
          )}
          {can('students.update') && (
            <button className="btn btn-secondary" onClick={() => void rotate()}>
              <RotateCcw size={16} />
              Rotate QR code
            </button>
          )}
          {can('finance.manage_fees') && (
            <button
              className="btn btn-secondary"
              onClick={() =>
                void api(`/students/${student.id}/balance-reminder`, 'POST')
                  .then(() => toast('Balance reminder queued.'))
                  .catch((e) => toast(e.message, true))
              }
            >
              Send balance reminder
            </button>
          )}
        </div>
        {qr && (
          <div className="qr-display">
            <img src={qr} alt={`Attendance QR code for ${student.name}`} />
            <a className="btn btn-secondary" href={qr} download={`${student.student_code}-qr.png`}>
              <Download size={15} />
              Download QR
            </a>
            <p>Valid for one year. Teachers must sign in before marking attendance.</p>
          </div>
        )}
        {history.data && (
          <>
            <h3>Recent attendance</h3>
            <div className="attendance-pills">
              {history.data.items.length ? (
                history.data.items.map((r) => (
                  <span key={r.id}>
                    {r.attendance_date}
                    <Badge value={r.status} />
                  </span>
                ))
              ) : (
                <p className="muted">No attendance marked yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function ResourceTabs({
  items,
  title,
  description,
  eyebrow = 'SCHOOL WORKSPACE',
}: {
  items: string[];
  title: string;
  description: string;
  eyebrow?: string;
}) {
  const [params, setParams] = useSearchParams();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<Catalog>('/catalog') });
  const available = items.filter((i) => catalog.data?.[i]);
  const selected = available.includes(params.get('tab') || '') ? params.get('tab')! : available[0];
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="tabs" role="tablist">
        {available.map((item) => (
          <button
            role="tab"
            aria-selected={selected === item}
            key={item}
            onClick={() => setParams({ tab: item })}
          >
            {titles[item]}
          </button>
        ))}
      </div>
      {catalog.isPending ? (
        <Loading />
      ) : catalog.error ? (
        <ErrorState error={catalog.error} />
      ) : selected ? (
        <Records key={selected} resource={selected} embedded />
      ) : (
        <Empty
          title="Access unavailable"
          description="Your role does not have permission to view these records."
        />
      )}
    </>
  );
}
