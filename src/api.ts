export type SessionType = 'culte' | 'croisade';
export type SessionStatus = 'open' | 'closed';

export interface SessionSummary {
  _id: string;
  title: string;
  type: SessionType;
  slug: string;
  status: SessionStatus;
  createdAt: string;
  closedAt: string | null;
  total: number;
  entryCount: number;
}

export interface EntryItem {
  _id: string;
  name: string;
  count: number;
  submittedAt: string;
}

export interface Croisade {
  _id: string;
  title: string;
  dayCount: number;
  createdAt: string;
  total: number;
  entryCount: number;
  openCount: number;
  closedCount: number;
}

export interface CroisadeDay extends SessionSummary {
  day: number;
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

  // Cultes
  listSessions: () => request<SessionSummary[]>('/sessions'),
  createSession: (title: string) =>
    request<SessionSummary>('/sessions', { method: 'POST', body: JSON.stringify({ title }) }),
  getSession: (id: string) =>
    request<{ session: SessionSummary; entries: EntryItem[]; total: number }>(`/sessions/${id}`),
  closeSession: (id: string) =>
    request<SessionSummary>(`/sessions/${id}/close`, { method: 'PATCH' }),
  reopenSession: (id: string) =>
    request<SessionSummary>(`/sessions/${id}/reopen`, { method: 'PATCH' }),
  deleteEntry: (sessionId: string, entryId: string) =>
    request<{ ok: true }>(`/sessions/${sessionId}/entries/${entryId}`, { method: 'DELETE' }),
  reportUrl: (id: string) => `/api/sessions/${id}/report`,

  // Semaines de croisade
  listCroisades: () => request<Croisade[]>('/croisades'),
  createCroisade: (title: string, dayCount: number) =>
    request<{ croisade: Croisade; sessions: CroisadeDay[] }>('/croisades', {
      method: 'POST',
      body: JSON.stringify({ title, dayCount }),
    }),
  getCroisadeDetail: (id: string) =>
    request<{ croisade: Croisade; days: (CroisadeDay & { total: number; entryCount: number })[]; grandTotal: number }>(
      `/croisades/${id}`
    ),
  closeAllCroisadeDays: (id: string) =>
    request<{ ok: true }>(`/croisades/${id}/close-all`, { method: 'PATCH' }),
  croisadeReportUrl: (id: string) => `/api/croisades/${id}/report`,

  // Formulaire public
  getPublicSession: (slug: string) =>
    request<{ title: string; status: SessionStatus }>(`/public/${slug}`),
  submitEntry: (slug: string, name: string, count: number) =>
    request<{ ok: true }>(`/public/${slug}/entries`, {
      method: 'POST',
      body: JSON.stringify({ name, count }),
    }),
};
