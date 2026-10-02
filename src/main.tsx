import { Component, StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, ThemeProvider, ToastProvider, useAuth } from './context';
import { AuthPage } from './AuthPages';
import { Layout } from './Layout';
import { Dashboard } from './Dashboard';
import { Records, ResourceTabs } from './Records';
import { AttendancePage } from './AttendancePage';
import { FinancePage } from './FinancePage';
import { ResultsPage } from './ResultsPage';
import { CommunicationPage, SettingsPage, ReportsPage, PlatformPage } from './OperationsPages';
import { TimetablePage } from './TimetablePage';
import { Empty } from './components';
import { PortalLayout, PortalPage, ChangePasswordPage } from './Portals';
import { PeoplePage } from './PeoplePage';
import { UserManualPage } from './UserManualPage';
import './styles.css';

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: true } },
});
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="standalone-error">
        <h1>Something didn’t load correctly.</h1>
        <p>Your saved school records are safe. Reload to try again.</p>
        <button className="btn" onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Guard({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? (
    children
  ) : (
    <Empty
      title="This area is restricted"
      description="Your school administrator can help if you need access."
    />
  );
}
function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage key="login" />} />
      <Route path="/onboard" element={<AuthPage key="onboard" mode="onboard" />} />
      <Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
      <Route path="/reset-password" element={<AuthPage key="reset" mode="reset" />} />
      <Route path="/change-password" element={<ChangePasswordPage forced />} />
      <Route path="/teacher" element={<PortalLayout role="TEACHER" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path=":page" element={<PortalPage />} />
      </Route>
      <Route path="/parent" element={<PortalLayout role="PARENT" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path=":page" element={<PortalPage />} />
      </Route>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="manual" element={<UserManualPage />} />
        <Route
          path="students"
          element={
            <Guard permission="students.view">
              <Records
                resource="students"
                description="Every learner, their story, and the details that matter."
              />
            </Guard>
          }
        />
        <Route path="parents" element={<PeoplePage kind="parents" />} />
        <Route path="staff" element={<PeoplePage kind="staff" />} />
        <Route
          path="academics"
          element={
            <ResourceTabs
              items={[
                'sessions',
                'terms',
                'class-levels',
                'classes',
                'subjects',
                'assignments',
                'calendar',
              ]}
              title="Academic structure"
              description="Give every school year a well-organized start."
            />
          }
        />
        <Route
          path="attendance"
          element={
            <Guard permission="attendance.view">
              <AttendancePage />
            </Guard>
          }
        />
        <Route
          path="attendance/qr"
          element={
            <Guard permission="attendance.mark">
              <AttendancePage />
            </Guard>
          }
        />
        <Route
          path="results"
          element={
            <Guard permission="results.view">
              <ResultsPage />
            </Guard>
          }
        />
        <Route
          path="finance"
          element={
            <Guard permission="finance.view">
              <FinancePage />
            </Guard>
          }
        />
        <Route
          path="timetable"
          element={
            <Guard permission="academics.view">
              <TimetablePage />
            </Guard>
          }
        />
        <Route
          path="communication"
          element={
            <Guard permission="notifications.view">
              <CommunicationPage />
            </Guard>
          }
        />
        <Route
          path="reports"
          element={
            <Guard permission="reports.view">
              <ReportsPage />
            </Guard>
          }
        />
        <Route
          path="audit"
          element={
            <Guard permission="audit.view">
              <Records
                resource="audit"
                description="A reliable record of important changes across your school."
              />
            </Guard>
          }
        />
        <Route
          path="settings"
          element={
            <Guard permission="school.manage_settings">
              <SettingsPage />
            </Guard>
          }
        />
        <Route path="platform" element={<PlatformPage />} />
        <Route
          path="*"
          element={
            <Empty
              title="This page isn’t in your timetable"
              description="Choose a workspace area from the sidebar to continue."
            />
          }
        />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <AuthProvider>
            <ThemeProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
