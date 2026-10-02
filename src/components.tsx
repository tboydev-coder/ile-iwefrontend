import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  Inbox,
  LoaderCircle,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { label } from './api';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <BookOpen size={23} strokeWidth={1.8} />
      </span>
      {!compact && (
        <span>
          ile-iwe<span className="brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
export function Spinner() {
  return <LoaderCircle size={18} className="spin" aria-label="Loading" />;
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <div className="skeleton skeleton-title" />
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
      <div className="skeleton skeleton-table" />
      <span className="sr-only">Loading your school data</span>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <AlertCircle />
      <h3>We couldn’t load this</h3>
      <p>{error.message}</p>
      {retry && (
        <button className="btn" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Empty({
  title = 'A fresh start',
  description = 'Add your first record to get started.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={27} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Badge({ value }: { value: unknown }) {
  const text = String(value ?? '');
  return (
    <span className={'badge badge-' + text.toLowerCase()}>
      <span />
      {label(text)}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={'modal ' + (wide ? 'modal-wide' : '')}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Pagination({
  page,
  total,
  pageSize = 25,
  onChange,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
          : '0 records'}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <button
          className="icon-button"
          aria-label="Next page"
          disabled={page * pageSize >= total}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
