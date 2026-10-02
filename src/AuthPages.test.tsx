import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { AuthPage } from './AuthPages';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

vi.mock('./context', () => ({
  useAuth: () => ({ signedIn: false, session: undefined, signIn: vi.fn() }),
}));

describe('school onboarding', () => {
  it('moves between steps without submitting an unfinished account', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter>
        <AuthPage mode="onboard" />
      </MemoryRouter>,
    );
    await user.click(screen.getByLabelText('School name', { exact: true }));
    await user.paste('My School');
    await user.click(screen.getByLabelText('School email', { exact: true }));
    await user.paste('office@example.com');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Academic session', { exact: true })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Your full name', { exact: true })).toBeVisible();
    expect(screen.queryByText('Enter your full name.')).not.toBeInTheDocument();
    expect(screen.queryByText('Use at least 12 characters.')).not.toBeInTheDocument();
    const password = screen.getByLabelText('Create a password', { exact: true });
    await user.type(password, 'School-password-2026!');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveValue('School-password-2026!');
    expect(api).not.toHaveBeenCalled();
  });
  it('keeps labels stable when validation messages appear', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByLabelText('Email address or username', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAccessibleDescription(
      'Enter your password.',
    );
  });
});

describe('authentication interaction', () => {
  it.each(['login', 'reset'] as const)(
    'toggles %s passwords with the keyboard without submitting',
    async (mode) => {
      const user = userEvent.setup({ delay: null });
      render(
        <MemoryRouter initialEntries={['/reset-password?token=test-token']}>
          <AuthPage mode={mode} />
        </MemoryRouter>,
      );
      const password = screen.getByLabelText(mode === 'login' ? 'Password' : 'New password', {
        exact: true,
      });
      await user.type(password, 'Private-password-2026!');
      await user.tab();
      expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(password).toHaveAttribute('type', 'text');
      expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await user.keyboard(' ');
      expect(password).toHaveAttribute('type', 'password');
      expect(password).toHaveValue('Private-password-2026!');
      expect(api).not.toHaveBeenCalled();
    },
  );

  it('prevents duplicate submissions while pending and allows retry after failure', async () => {
    let rejectRequest!: (reason: Error) => void;
    vi.mocked(api).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('Email address or username'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'Private-password-2026!');
    await user.dblClick(screen.getByRole('button', { name: 'Sign in' }));
    expect(api).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Signing in/ })).toBeDisabled();
    expect(screen.getByLabelText('Email address or username')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
    await act(async () => rejectRequest(new Error('Incorrect email or password.')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue(
      'Private-password-2026!',
    );
  });

  it('advances onboarding with Enter without calling the API', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter>
        <AuthPage mode="onboard" />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('School name', { exact: true }), 'My School');
    await user.type(
      screen.getByLabelText('School email', { exact: true }),
      'office@example.com{Enter}',
    );
    expect(await screen.findByLabelText('Academic session', { exact: true })).toBeVisible();
    expect(api).not.toHaveBeenCalled();
  });

  it('explains incomplete reset links and prevents unusable requests', () => {
    render(
      <MemoryRouter>
        <AuthPage mode="reset" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('This reset link is incomplete.');
    expect(screen.getByRole('button', { name: 'Update password' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(api).not.toHaveBeenCalled();
  });

  it('validates reset passwords and submits the token with the new password', async () => {
    vi.mocked(api).mockResolvedValueOnce({});
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter initialEntries={['/reset-password?token=reset-token']}>
        <AuthPage mode="reset" />
      </MemoryRouter>,
    );
    const password = screen.getByLabelText('New password');
    await user.type(password, 'short');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(api).not.toHaveBeenCalled();
    expect(password).toHaveAccessibleDescription('Use at least 12 characters.');
    await user.clear(password);
    await user.type(password, 'New-password-2026!');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/auth/reset-password', 'POST', {
        token: 'reset-token',
        password: 'New-password-2026!',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Password updated.');
  });

  it('shows a confirmation after requesting a reset email', async () => {
    vi.mocked(api).mockResolvedValueOnce({
      message: 'If the account exists, a reset link has been sent.',
    });
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter>
        <AuthPage mode="forgot" />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('Email address'), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('status')).toHaveTextContent('If the account exists');
    expect(api).toHaveBeenCalledWith('/auth/forgot-password', 'POST', {
      email: 'owner@example.com',
    });
  });
});
