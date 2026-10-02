import { useId, useState } from 'react';
import type { ComponentPropsWithRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function PasswordInput({
  id,
  disabled,
  ...props
}: Omit<ComponentPropsWithRef<'input'>, 'type'>) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input">
      <input {...props} id={inputId} type={visible ? 'text' : 'password'} disabled={disabled} />
      <button
        className="password-toggle"
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-controls={inputId}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        {visible ? 'Hide' : 'Show'}
      </button>
    </span>
  );
}
