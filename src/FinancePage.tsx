import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Wallet, Check, ArrowRight, RotateCcw } from 'lucide-react';
import { api, money, schoolDate } from './api';
import type { Row } from './api';
import { useAuth, useToast } from './context';
import { Modal, PageHeader, Spinner } from './components';
import { Records, ResourceSelect, titles } from './Records';

export function FinancePage() {
  const { can } = useAuth(),
    client = useQueryClient(),
    toast = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('payments'),
    [payment, setPayment] = useState(params.has('payment'));
  const [reverse, setReverse] = useState<Row>(),
    [apply, setApply] = useState<Row>();
  const stats = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/dashboard') });
  const close = () => {
    setPayment(false);
    if (params.has('payment')) {
      params.delete('payment');
      setParams(params, { replace: true });
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="A CLEARER PICTURE OF SCHOOL FINANCES"
        title="Fees & payments"
        description="School fees, family balances, and every payment accounted for."
        actions={
          can('finance.record_payment') && (
            <button className="btn" onClick={() => setPayment(true)}>
              <Plus size={17} />
              Record payment
            </button>
          )
        }
      />
      <div className="finance-summary">
        {[
          { name: 'Total collections', value: stats.data?.stats?.collected },
          { name: 'Outstanding balance', value: stats.data?.stats?.outstanding },
          { name: 'Collected today', value: stats.data?.stats?.today_collected },
        ].map((s) => (
          <div className="panel" key={s.name}>
            <span>{s.name}</span>
            <strong>{stats.isPending ? '…' : money(s.value)}</strong>
          </div>
        ))}
      </div>
      <div className="tabs" role="tablist">
        {['payments', 'fee-structures', 'fee-items', 'charges'].map((t) => (
          <button role="tab" aria-selected={tab === t} key={t} onClick={() => setTab(t)}>
            {titles[t]}
          </button>
        ))}
      </div>
      {tab === 'fee-structures' && (
        <div className="info-strip">
          Create a fee structure for a class and term, add its fee items, then apply it to create
          student charges.
        </div>
      )}
      <Records
        key={tab}
        resource={tab}
        embedded
        onRowAction={(row) => (
          <>
            {tab === 'fee-structures' && can('finance.manage_fees') && (
              <button className="text-link" onClick={() => setApply(row)}>
                Apply to class <ArrowRight size={14} />
              </button>
            )}
            {tab === 'payments' && !row.reversed && can('finance.manage_fees') && (
              <button
                className="icon-button"
                aria-label="Reverse payment"
                title="Reverse payment"
                onClick={() => setReverse(row)}
              >
                <RotateCcw size={15} />
              </button>
            )}
          </>
        )}
      />
      {payment && <PaymentForm onClose={close} />}
      {reverse && (
        <ReasonDialog
          title="Reverse this payment?"
          description={`${money(reverse.amount)} · ${reverse.receipt_number}. This preserves the original payment and restores the student's outstanding balance.`}
          onClose={() => setReverse(undefined)}
          onSave={async (reason) => {
            await api(`/payments/${reverse.id}/reverse`, 'POST', { reason });
            await client.invalidateQueries();
            toast('Payment reversed and recorded in the audit trail.');
            setReverse(undefined);
          }}
        />
      )}
      {apply && (
        <Modal title="Apply fees to this class?" onClose={() => setApply(undefined)}>
          <div className="modal-fields">
            <p>
              Every active student in this class will receive the fee items in{' '}
              <strong>{apply.name}</strong>. Charges already applied will be skipped.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setApply(undefined)}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={async () => {
                try {
                  const r = await api(`/fees/${apply.id}/apply`, 'POST');
                  await client.invalidateQueries();
                  toast(`${r.charges_created} student charges created.`);
                  setApply(undefined);
                } catch (e) {
                  toast((e as Error).message, true);
                }
              }}
            >
              Apply fees
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function PaymentForm({ onClose }: { onClose: () => void }) {
  const { session } = useAuth(),
    client = useQueryClient(),
    toast = useToast();
  const [studentId, setStudentId] = useState(''),
    [termId, setTermId] = useState(''),
    [amount, setAmount] = useState(''),
    [date, setDate] = useState(schoolDate(session?.school.timezone)),
    [method, setMethod] = useState('BANK_TRANSFER'),
    [reference, setReference] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [requestKey] = useState(() => crypto.randomUUID());
  const balance = useQuery({
    queryKey: ['ledger', studentId, termId],
    queryFn: () => api(`/students/${studentId}/ledger?term_id=${termId}`),
    enabled: Boolean(studentId && termId),
  });
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/payments', 'POST', {
        student_id: studentId,
        term_id: termId,
        amount,
        payment_date: date,
        method,
        reference,
        idempotency_key: requestKey,
      });
      await client.invalidateQueries();
      toast('Payment recorded. Receipt generation and parent updates queued.');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Record a payment" onClose={onClose}>
      <form onSubmit={save}>
        <div className="modal-fields">
          <ResourceSelect
            resource="students"
            title="Student"
            value={studentId}
            onChange={setStudentId}
            required
          />
          <ResourceSelect
            resource="terms"
            title="Term"
            value={termId}
            onChange={setTermId}
            required
          />
          {balance.data && (
            <div className="balance-banner">
              <Wallet size={20} />
              <span>
                Outstanding balance<strong>{money(balance.data.balance)}</strong>
              </span>
            </div>
          )}
          {balance.error && <p className="form-error">{balance.error.message}</p>}
          <div className="form-grid">
            <label className="field">
              <span>Amount received (NGN)</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={balance.data?.balance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Payment date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={schoolDate(session?.school.timezone)}
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Payment method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {['BANK_TRANSFER', 'CASH', 'POS', 'CHEQUE', 'OTHER'].map((m) => (
                <option key={m} value={m}>
                  {m.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Bank or payment reference (optional)</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="form-hint">
            Record money your school has already received. The receipt will appear in Documents &
            reports.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy || !balance.data}>
            {busy ? <Spinner /> : <Check size={17} />}Record payment
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ReasonDialog({
  title,
  description,
  onClose,
  onSave,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onSave: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave(reason);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-fields">
          <p>{description}</p>
          <label className="field">
            <span>Reason for this change</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={5}
              maxLength={500}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {busy ? <Spinner /> : 'Confirm change'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
