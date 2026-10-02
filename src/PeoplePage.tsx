import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, label, request } from './api';
import type { Row } from './api';
import { useAuth, useToast } from './context';
import { ErrorState, Loading, Modal, PageHeader, Spinner } from './components';
import { Records, ResourceSelect, titles, useOptions } from './Records';
import { StaffPhotoEditor } from './Portals';

export function PeoplePage({ kind }: { kind: 'staff' | 'parents' }) {
  const { can } = useAuth(),
    toast = useToast(),
    client = useQueryClient();
  const [tab, setTab] = useState<string>(kind),
    [create, setCreate] = useState(false),
    [assign, setAssign] = useState(''),
    [photo, setPhoto] = useState<Row>(),
    [confirm, setConfirm] = useState<Row>(),
    [busy, setBusy] = useState(false);
  const items =
    kind === 'staff'
      ? ['staff', 'users', 'assignments', 'classes']
      : ['parents', 'student-parents'];
  return (
    <>
      <PageHeader
        title={kind === 'staff' ? 'Staff & teachers' : 'Parents & guardians'}
        description={
          kind === 'staff'
            ? 'Manage accounts, positions, and teaching responsibilities.'
            : 'Connect families, create parent accounts, and link their children.'
        }
        actions={
          can('users.manage') && can(kind + '.manage') ? (
            <button className="btn" onClick={() => setCreate(true)}>
              Create {kind === 'staff' ? 'staff' : 'parent'} account
            </button>
          ) : undefined
        }
      />
      <div className="tabs">
        {items.map((item) => (
          <button key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>
            {titles[item]}
          </button>
        ))}
      </div>
      <Records
        key={tab}
        resource={tab}
        embedded
        onRowAction={(row) => (
          <>
            {tab === 'staff' && can('staff.manage') && (
              <button className="btn btn-secondary btn-small" onClick={() => setPhoto(row)}>
                Profile photo
              </button>
            )}
            {can('users.manage') && ['staff', 'users', 'parents'].includes(tab) && (
              <button
                className="btn btn-secondary btn-small"
                onClick={() =>
                  setConfirm({
                    ...row,
                    action: tab === 'parents' && !row.user_id ? 'activate' : 'invite',
                    accountId: tab === 'users' ? row.id : row.user_id,
                  })
                }
              >
                {tab === 'parents' && !row.user_id ? 'Create login' : 'Reset / resend invitation'}
              </button>
            )}
            {can('staff.manage') &&
              (tab === 'staff' || (tab === 'users' && row.role === 'TEACHER')) && (
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => setAssign(tab === 'staff' ? row.user_id : row.id)}
                >
                  Assignments
                </button>
              )}
            {tab === 'student-parents' && can('parents.manage') && (
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setConfirm({ ...row, action: 'unlink' })}
              >
                Unlink
              </button>
            )}
          </>
        )}
      />
      {create && <AccountForm kind={kind} close={() => setCreate(false)} />}
      {assign && <AssignmentEditor userId={assign} close={() => setAssign('')} />}
      {photo && (
        <Modal title={`Profile photo: ${photo.name}`} onClose={() => setPhoto(undefined)}>
          <StaffPhotoEditor profile={photo} />
        </Modal>
      )}
      {confirm && (
        <Modal
          title={
            confirm.action === 'unlink'
              ? 'Remove guardian relationship'
              : confirm.action === 'activate'
                ? 'Create parent login'
                : 'Send a new invitation'
          }
          onClose={() => setConfirm(undefined)}
        >
          <p>
            {confirm.action === 'unlink'
              ? 'This parent will lose access to this child’s records.'
              : confirm.action === 'activate'
                ? `Create and email login credentials for ${confirm.name}.`
                : `Generate new credentials for ${confirm.name}. This invalidates their current password and signs out their sessions.`}
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(
                  confirm.action === 'unlink'
                    ? `/accounts/relationships/${confirm.id}/unlink`
                    : confirm.action === 'activate'
                      ? `/accounts/parents/${confirm.id}/activate`
                      : `/accounts/${confirm.accountId}/invite`,
                  'POST',
                );
                await client.invalidateQueries();
                toast(
                  confirm.action === 'unlink'
                    ? 'Relationship removed.'
                    : 'Invitation queued for delivery.',
                );
                setConfirm(undefined);
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />}
            {confirm.action === 'unlink' ? 'Remove relationship' : 'Queue invitation'}
          </button>
        </Modal>
      )}
    </>
  );
}

function AssignmentFields({ values, change }: { values: Row; change: (v: Row) => void }) {
  const classes = useOptions('classes');
  return (
    <fieldset>
      <legend>Teaching assignments</legend>
      <p>Assign each subject to a class. Class-teacher responsibilities are selected separately.</p>
      {(values.subjects || []).map((s: Row, i: number) => (
        <div className="portal-filters" key={i}>
          <ResourceSelect
            resource="classes"
            title={`Class ${i + 1}`}
            value={s.class_id}
            onChange={(v) =>
              change({
                ...values,
                subjects: values.subjects.map((a: Row, n: number) =>
                  n === i ? { ...a, class_id: v } : a,
                ),
              })
            }
            required
          />
          <ResourceSelect
            resource="subjects"
            title={`Subject ${i + 1}`}
            value={s.subject_id}
            onChange={(v) =>
              change({
                ...values,
                subjects: values.subjects.map((a: Row, n: number) =>
                  n === i ? { ...a, subject_id: v } : a,
                ),
              })
            }
            required
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              change({
                ...values,
                subjects: values.subjects.filter((_: Row, n: number) => i !== n),
              })
            }
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() =>
          change({
            ...values,
            subjects: [...(values.subjects || []), { class_id: '', subject_id: '' }],
          })
        }
      >
        Add subject and class
      </button>
      <h3>Class teacher for</h3>
      {classes.error && <ErrorState error={classes.error} />}
      {classes.data?.map((c) => (
        <label className="check-field" key={c.id}>
          <input
            type="checkbox"
            checked={values.class_teacher_ids?.includes(c.id) || false}
            onChange={(e) =>
              change({
                ...values,
                class_teacher_ids: e.target.checked
                  ? [...values.class_teacher_ids, c.id]
                  : values.class_teacher_ids.filter((id: string) => id !== c.id),
              })
            }
          />
          {c.label}
        </label>
      ))}
    </fieldset>
  );
}

function AssignmentEditor({ userId, close }: { userId: string; close: () => void }) {
  const query = useQuery({
    queryKey: ['account-assignments', userId],
    queryFn: () => api(`/accounts/${userId}/assignments`),
  });
  return (
    <Modal title="Teacher assignments" onClose={close} wide>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <AssignmentForm userId={userId} initial={query.data} close={close} />
      )}
    </Modal>
  );
}

function AssignmentForm({
  userId,
  initial,
  close,
}: {
  userId: string;
  initial: Row;
  close: () => void;
}) {
  const [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const client = useQueryClient(),
    toast = useToast();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api(`/accounts/${userId}/assignments`, 'POST', values);
          await client.invalidateQueries();
          toast('Teacher assignments saved.');
          close();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <AssignmentFields values={values} change={setValues} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn" disabled={busy}>
        Save assignments
      </button>
    </form>
  );
}

function AccountForm({ kind, close }: { kind: 'staff' | 'parents'; close: () => void }) {
  const staff = kind === 'staff';
  const [photo, setPhoto] = useState<File>();
  const [values, setValues] = useState<Row>(
    staff
      ? {
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          staff_code: '',
          gender: '',
          date_of_birth: '',
          employment_date: '',
          department: '',
          job_title: 'Teacher',
          staff_type: 'Teaching',
          role: 'TEACHER',
          active: true,
          subjects: [],
          class_teacher_ids: [],
        }
      : {
          name: '',
          email: '',
          phone: '',
          address: '',
          notify_email: true,
          children: [{ student_id: '', relationship: 'Guardian', primary_contact: true }],
        },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const client = useQueryClient(),
    toast = useToast();
  return (
    <Modal title={`Create ${staff ? 'staff' : 'parent'} account`} onClose={close} wide>
      <div className="modal-fields">
        <p>
          A username and temporary password will be emailed. First sign-in requires a new password.
        </p>
        <form
          onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const payload = { ...values };
            if (staff) {
              for (const f of ['staff_code', 'date_of_birth', 'employment_date'])
                payload[f] ||= null;
              if (payload.role !== 'TEACHER') {
                payload.subjects = [];
                payload.class_teacher_ids = [];
              }
            }
            const account = await api(`/accounts/${kind}`, 'POST', payload);
            if (staff && photo) {
              const data = new FormData();
              data.append('file', photo);
              try {
                await request(`/staff/${account.staff.id}/photo`, { method: 'POST', body: data });
              } catch (e) {
                toast(
                  `Account created, but the photo could not be saved. Use Profile photo to retry. ${(e as Error).message}`,
                  true,
                );
              }
            }
            await client.invalidateQueries();
            toast(
              values.active === false
                ? 'Inactive staff account created.'
                : 'Account created. Invitation queued for delivery.',
            );
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
          }}
        >
        <div className="form-grid">
          {(staff
            ? [
                'first_name',
                'last_name',
                'email',
                'phone',
                'staff_code',
                'date_of_birth',
                'employment_date',
                'department',
                'job_title',
                'staff_type',
              ]
            : ['name', 'email', 'phone', 'address']
          ).map((f) => (
            <label className="field" key={f}>
              <span>{f === 'job_title' ? 'Position' : label(f)}</span>
              <input
                type={
                  f === 'email'
                    ? 'email'
                    : f.endsWith('date') || f === 'date_of_birth'
                      ? 'date'
                      : 'text'
                }
                value={values[f]}
                required={['first_name', 'last_name', 'email', 'name'].includes(f)}
                onChange={(e) => setValues({ ...values, [f]: e.target.value })}
              />
            </label>
          ))}
        </div>
        {staff ? (
          <>
            <label className="field">
              <span>Profile photo</span>
              <input
                type="file"
                aria-label="Profile photo"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setPhoto(e.target.files?.[0])}
              />
              <small>PNG, JPEG or WebP, up to 2 MB.</small>
            </label>
            <label className="field">
              <span>System role</span>
              <select
                value={values.role}
                onChange={(e) => setValues({ ...values, role: e.target.value })}
              >
                {['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'STAFF'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <small>
                Position and system role are independent. A principal can be assigned School Admin.
              </small>
            </label>
            <label className="field">
              <span>Gender</span>
              <select
                value={values.gender}
                onChange={(e) => setValues({ ...values, gender: e.target.value })}
              >
                <option value="">Not recorded</option>
                <option>Female</option>
                <option>Male</option>
                <option>Prefer not to say</option>
              </select>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={values.active}
                onChange={(e) => setValues({ ...values, active: e.target.checked })}
              />
              Active account
            </label>
            {values.role === 'TEACHER' && <AssignmentFields values={values} change={setValues} />}
          </>
        ) : (
          <fieldset>
            <legend>Children and communication</legend>
            {values.children.map((c: Row, i: number) => (
              <div className="panel portal-card" key={i}>
                <ResourceSelect
                  resource="students"
                  title={`Child ${i + 1}`}
                  value={c.student_id}
                  onChange={(v) =>
                    setValues({
                      ...values,
                      children: values.children.map((r: Row, n: number) =>
                        i === n ? { ...r, student_id: v } : r,
                      ),
                    })
                  }
                  required
                />
                <label className="field">
                  <span>Relationship</span>
                  <input
                    value={c.relationship}
                    required
                    onChange={(e) =>
                      setValues({
                        ...values,
                        children: values.children.map((r: Row, n: number) =>
                          i === n ? { ...r, relationship: e.target.value } : r,
                        ),
                      })
                    }
                  />
                </label>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={c.primary_contact}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        children: values.children.map((r: Row, n: number) =>
                          i === n ? { ...r, primary_contact: e.target.checked } : r,
                        ),
                      })
                    }
                  />
                  Primary contact
                </label>
                {values.children.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      setValues({
                        ...values,
                        children: values.children.filter((_: Row, n: number) => n !== i),
                      })
                    }
                  >
                    Remove child
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setValues({
                  ...values,
                  children: [
                    ...values.children,
                    { student_id: '', relationship: 'Guardian', primary_contact: false },
                  ],
                })
              }
            >
              Link another child
            </button>
            {['email'].map((c) => (
              <label className="check-field" key={c}>
                <input
                  type="checkbox"
                  checked={values['notify_' + c]}
                  onChange={(e) => setValues({ ...values, ['notify_' + c]: e.target.checked })}
                />
                {label(c)} updates
              </label>
            ))}
          </fieldset>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
          <button className="btn" disabled={busy}>
            {busy && <Spinner />}Create account
          </button>
        </form>
      </div>
    </Modal>
  );
}
