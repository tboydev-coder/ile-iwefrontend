import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Check, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from './api';
import type { Tokens } from './api';
import { useAuth } from './context';
import { Brand, Spinner } from './components';
import { PasswordInput } from './PasswordInput';

export const loginSchema = z.object({
  email: z.string().min(1, 'Enter your email address or username.'),
  password: z.string().min(1, 'Enter your password.'),
});
const onboardingSchema = loginSchema.extend({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(12, 'Use at least 12 characters.'),
  name: z.string().min(2, 'Enter your full name.'),
  school_name: z.string().min(2, 'Enter your school name.'),
  school_email: z.email('Enter a valid school email address.'),
  phone: z.string(),
  address: z.string(),
  website: z.string(),
  registration_number: z.string(),
  school_type: z.enum(['PRIMARY', 'SECONDARY', 'COMBINED']),
  primary_color: z.string().regex(/^#[0-9a-f]{6}$/i),
  session_name: z.string().min(2, 'Enter an academic session.'),
  term_name: z.string().min(2, 'Enter the current term.'),
});
type OnboardingData = z.infer<typeof onboardingSchema>;

export function AuthPage({ mode = 'login' }: { mode?: 'login' | 'onboard' | 'forgot' | 'reset' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(0);
  const pending = useRef(false);
  const [advancing, setAdvancing] = useState(false);
  const register = mode === 'onboard';
  const schema = register
    ? onboardingSchema
    : mode === 'forgot'
      ? z.object({ email: z.email('Enter a valid email address.') })
      : mode === 'reset'
        ? z.object({ password: z.string().min(12, 'Use at least 12 characters.') })
        : loginSchema;
  const form = useForm<OnboardingData>({
    resolver: zodResolver(schema) as never,
    mode: 'onTouched',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      school_name: '',
      school_email: '',
      phone: '',
      address: '',
      website: '',
      registration_number: '',
      school_type: 'COMBINED',
      primary_color: '#156b55',
      session_name: '2026/2027',
      term_name: 'First term',
    },
  });
  if (auth.signedIn && auth.session) return <Navigate to="/" replace />;
  const busy = form.formState.isSubmitting || advancing;
  const missingResetToken = mode === 'reset' && !params.get('token')?.trim();
  const input = (name: keyof OnboardingData, title: string, type = 'text', placeholder = '') => {
    const Input = type === 'password' ? PasswordInput : 'input';
    return (
      <div className="field" key={name}>
        <label id={`label-${name}`} htmlFor={`input-${name}`}>
          {title}
        </label>
        <Input
          {...(type === 'password' ? {} : { type })}
          id={`input-${name}`}
          placeholder={placeholder}
          aria-labelledby={`label-${name}`}
          aria-describedby={
            form.formState.errors[name]
              ? `error-${name}`
              : name === 'password' && mode !== 'login'
                ? 'password-hint'
                : undefined
          }
          autoComplete={
            name === 'password'
              ? mode === 'login'
                ? 'current-password'
                : 'new-password'
              : name === 'email'
                ? 'email'
                : 'off'
          }
          {...form.register(name)}
          aria-invalid={Boolean(form.formState.errors[name])}
        />
        {form.formState.errors[name] && (
          <small id={`error-${name}`} className="field-error" role="alert">
            {form.formState.errors[name]?.message}
          </small>
        )}
      </div>
    );
  };
  const submit = form.handleSubmit(async (data) => {
    setError('');
    try {
      if (mode === 'forgot') {
        const result = await api('/auth/forgot-password', 'POST', { email: data.email });
        setSuccess(result.message);
        return;
      }
      if (mode === 'reset') {
        if (missingResetToken) return;
        await api('/auth/reset-password', 'POST', {
          token: params.get('token'),
          password: data.password,
        });
        setSuccess('Password updated. You can now sign in.');
        return;
      }
      const result = await api<Tokens & { school_status?: string }>(
        '/auth/' + (register ? 'onboard' : 'login'),
        'POST',
        register ? data : { email: data.email, password: data.password },
      );
      if (result.school_status === 'PENDING') {
        setSuccess(
          'Your school has been registered and is awaiting platform approval. You can sign in once approved.',
        );
        return;
      }
      auth.signIn(result);
      const destination = params.get('returnTo');
      navigate(destination?.startsWith('/attendance/qr?') ? destination : '/');
    } catch (e) {
      setError((e as Error).message);
    }
  });
  const next = async () => {
    setAdvancing(true);
    const fields: (keyof OnboardingData)[] =
      step === 0
        ? ['school_name', 'school_email', 'school_type']
        : ['session_name', 'term_name', 'primary_color'];
    if (await form.trigger(fields, { shouldFocus: true })) {
      form.clearErrors();
      setStep(step + 1);
    }
    setAdvancing(false);
  };
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand />
        <div className="auth-story-copy">
          <span className="pill">
            <Sparkles size={14} /> A little less admin. A lot more learning.
          </span>
          <h1>
            Great school days
            <br />
            start with
            <br />
            <em>everything connected.</em>
          </h1>
          <p>
            Bring your students, teachers, families, and school operations together in one
            thoughtful workspace.
          </p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="illustration-orbit" />
            <div className="illustration-school">
              <GraduationCap size={56} strokeWidth={1.2} />
              <span>A place to grow.</span>
              <small>Students · Learning · Community</small>
            </div>
            <span className="illustration-note note-one">
              <Check size={15} /> Attendance, taken.
            </span>
            <span className="illustration-note note-two">
              <Check size={15} /> Parents, connected.
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          <ShieldCheck size={17} /> Built around your school. Protected by design.
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-top">
          <span>{register ? 'Already part of ile-iwe?' : 'New to ile-iwe?'}</span>
          <Link to={register ? '/login' : '/onboard'}>
            {register ? 'Sign in' : 'Set up your school'} <ArrowRight size={15} />
          </Link>
        </div>
        <div className="auth-form-wrap">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="eyebrow">{register ? 'YOUR NEXT CHAPTER' : 'YOUR SCHOOL WORKSPACE'}</div>
          <h2>
            {register
              ? 'Make room for a better school day.'
              : mode === 'forgot'
                ? 'Forgot your password?'
                : mode === 'reset'
                  ? 'Choose a new password.'
                  : 'Welcome back.'}
          </h2>
          <p className="muted">
            {register
              ? 'A few details, and your school is ready to get started.'
              : mode === 'login'
                ? 'Sign in to pick up where you left off.'
                : 'We’ll help you get back to your school workspace.'}
          </p>
          {register && (
            <div className="setup-steps">
              {['Your school', 'Academics', 'Your account'].map((title, i) => (
                <span key={title} className={i <= step ? 'active' : ''}>
                  <b>{i < step ? <Check size={12} /> : i + 1}</b>
                  {title}
                </span>
              ))}
            </div>
          )}
          {success ? (
            <div className="success-panel" role="status">
              <Check />
              <p>{success}</p>
              <Link className="btn" to="/login">
                Go to sign in
              </Link>
            </div>
          ) : (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (pending.current || busy || missingResetToken) return;
                pending.current = true;
                try {
                  if (register && step < 2) await next();
                  else await submit(event);
                } finally {
                  pending.current = false;
                }
              }}
              noValidate
              aria-busy={busy}
            >
              <fieldset className="form-fieldset" disabled={busy || missingResetToken}>
                {register ? (
                  <>
                    {step === 0 && (
                      <>
                        {input('school_name', 'School name', 'text', 'e.g. Meadowfield Academy')}
                        {input('school_email', 'School email', 'email', 'office@yourschool.com')}
                        <div className="form-grid">
                          {input('phone', 'Phone number', 'tel', '+234')}
                          {input('registration_number', 'CAC / registration number (optional)')}
                        </div>
                        {input('address', 'School address')}
                        {input('website', 'Website (optional)', 'url', 'https://yourschool.com')}
                        <label className="field">
                          <span>School type</span>
                          <select {...form.register('school_type')}>
                            <option value="COMBINED">Primary & secondary</option>
                            <option value="PRIMARY">Primary</option>
                            <option value="SECONDARY">Secondary</option>
                          </select>
                        </label>
                      </>
                    )}
                    {step === 1 && (
                      <>
                        {input('session_name', 'Academic session', 'text', '2026/2027')}
                        {input('term_name', 'Current term')}
                        <label className="field">
                          <span>Your school’s primary color</span>
                          <div className="color-picker">
                            <input type="color" {...form.register('primary_color')} />
                            <span>{form.watch('primary_color')}</span>
                          </div>
                          <small>
                            We’ll create accessible light and dark themes from your color. You can
                            upload your logo in school settings.
                          </small>
                        </label>
                      </>
                    )}
                    {step === 2 && (
                      <>
                        {input('name', 'Your full name')}
                        {input('email', 'Your work email', 'email', 'you@yourschool.com')}
                        {input('password', 'Create a password', 'password')}
                        <p className="form-hint" id="password-hint">
                          Use at least 12 characters. This will be your school owner account.
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {mode !== 'reset' &&
                      input(
                        'email',
                        mode === 'login' ? 'Email address or username' : 'Email address',
                        mode === 'login' ? 'text' : 'email',
                        'you@yourschool.com',
                      )}
                    {mode !== 'forgot' &&
                      input('password', mode === 'reset' ? 'New password' : 'Password', 'password')}
                    {mode === 'reset' && (
                      <p className="form-hint" id="password-hint">
                        Use at least 12 characters.
                      </p>
                    )}
                    {mode === 'login' && (
                      <div className="form-links">
                        <span className="muted">Your school, at your fingertips.</span>
                        <Link to="/forgot-password">Forgot password?</Link>
                      </div>
                    )}
                  </>
                )}
                {missingResetToken && (
                  <div className="form-error" role="alert">
                    This reset link is incomplete.{' '}
                    <Link to="/forgot-password">Request a new reset link</Link>.
                  </div>
                )}
                {error && (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                )}
                <div className="form-actions">
                  {register && step > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setStep(step - 1)}
                    >
                      Back
                    </button>
                  )}
                  {register && step < 2 ? (
                    <button type="submit" className="btn btn-grow">
                      Continue <ArrowRight size={17} />
                    </button>
                  ) : (
                    <button
                      disabled={form.formState.isSubmitting}
                      className="btn btn-grow"
                      type="submit"
                    >
                      {form.formState.isSubmitting ? (
                        <>
                          <Spinner />
                          <span role="status">
                            {register
                              ? 'Creating workspace…'
                              : mode === 'forgot'
                                ? 'Sending reset link…'
                                : mode === 'reset'
                                  ? 'Updating password…'
                                  : 'Signing in…'}
                          </span>
                        </>
                      ) : (
                        <>
                          {register
                            ? 'Create school workspace'
                            : mode === 'forgot'
                              ? 'Send reset link'
                              : mode === 'reset'
                                ? 'Update password'
                                : 'Sign in'}{' '}
                          <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
          )}
          <div className="auth-caption">Thoughtfully made for the way schools work.</div>
        </div>
        <footer className="auth-footer">
          © {new Date().getFullYear()} ile-iwe <span>Your school, connected.</span>
        </footer>
      </main>
    </div>
  );
}
