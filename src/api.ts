export type SessionType = 'culte' | 'croisade';
export type SessionStatus = 'open' | 'closed';

export interface SessionSummary {
  _id: string;
  title: string;
  type: SessionType;
  slug: string;
  status: SessionStatus;
  dayCount: number | null;
  createdAt: string;
  closedAt: string | null;
  total: number;
  entryCount: number;
}

export interface EntryItem {
  _id: string;
  name: string;
  count: number;
  day: number | null;
  submittedAt: string;
}

export interface DailyTotal {
  day: number;
  total: number;
  entryCount: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // réponse vide (ex: 204)
  }
  if (!res.ok) {
    throw new Error(data.error || 'Une erreur est survenue');
  }
  return data as T;
}

export const api = {
  login: (password: string) =>
    request<{ ok: true }>('/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: true }>('/logout', { method: 'POST' }),
  me: () => request<{ ok: true }>('/me'),

  listSessions: () => request<SessionSummary[]>('/sessions'),
  createSession: (title: string, type: SessionType, dayCount?: number) =>
    request<SessionSummary>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ title, type, dayCount }),
    }),
  getSession: (id: string) =>
    request<{
      session: SessionSummary;
      entries: EntryItem[];
      total: number;
      dailyTotals: DailyTotal[] | null;
    }>(`/sessions/${id}`),
  closeSession: (id: string) =>
    request<SessionSummary>(`/sessions/${id}/close`, { method: 'PATCH' }),
  reopenSession: (id: string) =>
    request<SessionSummary>(`/sessions/${id}/reopen`, { method: 'PATCH' }),
  deleteEntry: (sessionId: string, entryId: string) =>
    request<{ ok: true }>(`/sessions/${sessionId}/entries/${entryId}`, { method: 'DELETE' }),
  reportUrl: (id: string) => `/api/sessions/${id}/report`,

  getPublicSession: (slug: string) =>
    request<{ title: string; type: SessionType; status: SessionStatus; dayCount: number | null }>(
      `/public/${slug}`
    ),
  submitEntry: (slug: string, name: string, count: number, day?: number) =>
    request<{ ok: true }>(`/public/${slug}/entries`, {
      method: 'POST',
      body: JSON.stringify({ name, count, day }),
    }),
};
