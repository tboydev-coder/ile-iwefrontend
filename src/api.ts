// All JSON, upload, download, and token-refresh requests share this public backend URL.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1')
  .trim()
  .replace(/\/+$/, '');
export type Row = Record<string, any>; // Dynamic, server-described school directory records.
export type Page = { items: Row[]; page: number; page_size: number; total: number };
export type Tokens = { access_token: string; refresh_token: string };
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Session-scoped tokens allow separately hosted frontend and API without cross-site cookies.
// A strong CSP and avoiding untrusted HTML remain necessary against XSS.
let access = sessionStorage.getItem('ile-iwe.access');
let refreshPromise: Promise<boolean> | null = null;
export function saveTokens(tokens: Tokens) {
  access = tokens.access_token;
  sessionStorage.setItem('ile-iwe.access', access);
  sessionStorage.setItem('ile-iwe.refresh', tokens.refresh_token);
}
export function clearTokens() {
  access = null;
  sessionStorage.removeItem('ile-iwe.access');
  sessionStorage.removeItem('ile-iwe.refresh');
}
export function hasSession() {
  return Boolean(access);
}

async function refreshSession() {
  const token = sessionStorage.getItem('ile-iwe.refresh');
  if (!token) return false;
  try {
    const response = await fetch(API_URL + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return false;
    saveTokens(await response.json());
    return true;
  } catch {
    return false;
  }
}

export async function request(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (access) headers.set('Authorization', 'Bearer ' + access);
  let response: Response;
  try {
    response = await fetch(API_URL + path, { ...options, headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the school server. Check your connection and try again.');
  }
  if (
    response.status === 401 &&
    retry &&
    (!path.startsWith('/auth/') || path === '/auth/me' || path === '/auth/logout')
  ) {
    refreshPromise ||= refreshSession().finally(() => {
      refreshPromise = null;
    });
    if (await refreshPromise) return request(path, options, false);
    clearTokens();
    window.dispatchEvent(new Event('ile-iwe:signed-out'));
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      body.error?.message || 'The request could not be completed.',
    );
  }
  return response;
}
export async function api<T = Row>(path: string, method = 'GET', body?: unknown): Promise<T> {
  return (
    await request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
  ).json();
}
export async function downloadFile(path: string, filename: string) {
  const response = await request(path);
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function allRecords(resource: string): Promise<Row[]> {
  const first = await api<Page>(`/records/${resource}?page_size=100&direction=asc`);
  const rows = [...first.items];
  for (let page = 2; rows.length < first.total; page++) {
    const next = await api<Page>(`/records/${resource}?page_size=100&direction=asc&page=${page}`);
    rows.push(...next.items);
    if (!next.items.length) break;
  }
  return rows;
}
export const money = (value: unknown) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
export const label = (value: string) =>
  value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function schoolDate(timezone = 'Africa/Lagos') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
