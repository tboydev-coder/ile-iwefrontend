import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, clearTokens, hasSession, saveTokens } from './api';
import type { Row, Tokens } from './api';
import { brandTokens } from './theme';

type Auth = { user: Row; school: Row; permissions: string[] };
const AuthContext = createContext<{
  session?: Auth;
  loading: boolean;
  error: Error | null;
  signedIn: boolean;
  signIn: (t: Tokens) => void;
  signOut: () => Promise<void>;
  can: (p: string) => boolean;
  refresh: () => void;
}>({} as never);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [signedIn, setSignedIn] = useState(hasSession());
  const query = useQuery({
    queryKey: ['session'],
    queryFn: () => api<Auth>('/auth/me'),
    enabled: signedIn,
    retry: false,
  });
  useEffect(() => {
    const clear = () => {
      setSignedIn(false);
      client.clear();
    };
    window.addEventListener('ile-iwe:signed-out', clear);
    return () => window.removeEventListener('ile-iwe:signed-out', clear);
  }, [client]);
  return (
    <AuthContext.Provider
      value={{
        session: query.data,
        loading: signedIn && query.isPending,
        error: query.error,
        signedIn,
        signIn: (tokens) => {
          clearTokens();
          saveTokens(tokens);
          if (signedIn) {
            client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
            void client.invalidateQueries({ queryKey: ['session'] });
          } else client.clear();
          setSignedIn(true);
        },
        signOut: async () => {
          try {
            await api('/auth/logout', 'POST');
          } finally {
            clearTokens();
            setSignedIn(false);
            client.clear();
          }
        },
        can: (p) => Boolean(query.data?.permissions.includes(p)),
        refresh: () => void client.invalidateQueries({ queryKey: ['session'] }),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);

const ThemeContext = createContext({ dark: false, toggle: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [dark, setDark] = useState(localStorage.getItem('ile-iwe.theme') === 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('ile-iwe.theme', dark ? 'dark' : 'light');
    const tokens = brandTokens(session?.school.primary_color || '#156b55', dark);
    for (const [key, value] of Object.entries(tokens))
      document.documentElement.style.setProperty('--brand-' + key, value);
    for (const [name, fallback] of [
      ['secondary', '#d4a843'],
      ['accent', '#5279b8'],
    ]) {
      const palette = brandTokens(session?.school[name + '_color'] || fallback, dark);
      for (const [key, value] of Object.entries(palette))
        document.documentElement.style.setProperty(`--${name}-${key}`, value);
    }
  }, [
    dark,
    session?.school.primary_color,
    session?.school.secondary_color,
    session?.school.accent_color,
  ]);
  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(!dark) }}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);

const ToastContext = createContext<(message: string, error?: boolean) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; error?: boolean }>();
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(undefined), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  return (
    <ToastContext.Provider value={(message, error) => setToast({ message, error })}>
      {children}
      {toast && (
        <div
          role={toast.error ? 'alert' : 'status'}
          className={'toast ' + (toast.error ? 'toast-error' : '')}
        >
          {toast.message}
          <button onClick={() => setToast(undefined)} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
