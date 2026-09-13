import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, DailyTotal, EntryItem, SessionSummary, SessionType } from '../api';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [authError, setAuthError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entriesById, setEntriesById] = useState<Record<string, EntryItem[]>>({});
  const [dailyTotalsById, setDailyTotalsById] = useState<Record<string, DailyTotal[] | null>>({});
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  async function loadSessions() {
    try {
      const data = await api.listSessions();
      setSessions(data);
    } catch {
      setAuthError(true);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (authError) navigate('/login');
  }, [authError, navigate]);

  async function onLogout() {
    await api.logout();
    navigate('/login');
  }

  async function toggleExpand(session: SessionSummary) {
    if (expandedId === session._id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(session._id);
    if (!entriesById[session._id]) {
      const data = await api.getSession(session._id);
      setEntriesById((prev) => ({ ...prev, [session._id]: data.entries }));
      setDailyTotalsById((prev) => ({ ...prev, [session._id]: data.dailyTotals }));
    }
  }

  async function onClose(session: SessionSummary) {
    if (!confirm(`Clôturer « ${session.title} » ? Le lien n'acceptera plus de nouveaux envois.`)) return;
    await api.closeSession(session._id);
    loadSessions();
  }

  async function onReopen(session: SessionSummary) {
    await api.reopenSession(session._id);
    loadSessions();
  }

  async function onDeleteEntry(sessionId: string, entryId: string) {
    if (!confirm('Supprimer cette entrée ?')) return;
    await api.deleteEntry(sessionId, entryId);
    const data = await api.getSession(sessionId);
    setEntriesById((prev) => ({ ...prev, [sessionId]: data.entries }));
    setDailyTotalsById((prev) => ({ ...prev, [sessionId]: data.dailyTotals }));
    loadSessions();
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/c/${slug}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 1800);
    });
  }

  return (
    <div className="page">
      <div className="wrap wide">
        <div className="admin-header">
          <div className="brand" style={{ marginBottom: 0 }}>
            <span className="brand-mark">Carnet des proclamations</span>
          </div>
          <button className="link-quiet" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <h1 className="small" style={{ marginBottom: 2 }}>
                Événements
              </h1>
              <p className="subtitle" style={{ margin: 0 }}>
                Un lien par culte ou par semaine de croisade.
              </p>
            </div>
            <button className="btn-secondary" onClick={() => setShowCreate(true)}>
              Nouvel événement
            </button>
          </div>
        </div>

        {sessions === null && !authError && <div className="loading">Chargement...</div>}

        {sessions && sessions.length === 0 && (
          <div className="empty">Aucun événement pour l'instant. Crée le premier avec le bouton ci-dessus.</div>
        )}

        {sessions && sessions.length > 0 && (
          <ul className="session-list">
            {sessions.map((s) => (
              <li key={s._id} className="session-item">
                <div className="session-top">
                  <div>
                    <div className="session-title">{s.title}</div>
                    <div className="session-meta">
                      {s.type === 'croisade' ? `Semaine de croisade · ${s.dayCount} jours` : 'Culte'} · créé
                      le {formatDate(s.createdAt)} · {s.entryCount} entrée{s.entryCount > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${s.status}`}>
                      {s.status === 'open' ? 'Ouvert' : 'Clôturé'}
                    </span>
                    <div className="session-total">{s.total}</div>
                  </div>
                </div>

                <div className="link-box">
                  <span>{window.location.origin}/c/{s.slug}</span>
                  <button className="link-quiet" onClick={() => copyLink(s.slug)}>
                    {copiedSlug === s.slug ? 'Copié !' : 'Copier'}
                  </button>
                </div>

                <div className="session-actions">
                  <button className="btn-secondary" onClick={() => toggleExpand(s)}>
                    {expandedId === s._id ? 'Masquer le détail' : 'Voir le détail'}
                  </button>
                  {s.status === 'open' ? (
                    <button className="btn-secondary" onClick={() => onClose(s)}>
                      Clôturer
                    </button>
                  ) : (
                    <button className="btn-secondary" onClick={() => onReopen(s)}>
                      Rouvrir
                    </button>
                  )}
                  <a className="btn-secondary" href={api.reportUrl(s._id)} style={{ textDecoration: 'none', display: 'inline-block' }}>
                    Télécharger le PDF
                  </a>
                </div>

                {expandedId === s._id && s.type === 'croisade' && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                    {(dailyTotalsById[s._id] || []).map((d) => {
                      const dayEntries = (entriesById[s._id] || []).filter((e) => e.day === d.day);
                      return (
                        <div key={d.day} style={{ marginBottom: 14 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontWeight: 600,
                              fontSize: 14,
                              marginBottom: 4,
                            }}
                          >
                            <span>Jour {d.day}</span>
                            <span style={{ color: 'var(--gold-dark)' }}>{d.total}</span>
                          </div>
                          {dayEntries.length === 0 ? (
                            <div style={{ color: 'var(--ink-soft)', fontSize: 13.5 }}>
                              Aucune entrée pour ce jour.
                            </div>
                          ) : (
                            <ul className="entry-list" style={{ borderTop: 'none' }}>
                              {dayEntries.map((e) => (
                                <li key={e._id} className="entry-row">
                                  <span>{e.name}</span>
                                  <span className="entry-right">
                                    <span className="entry-count">{e.count}</span>
                                    <button
                                      className="entry-del"
                                      aria-label="Supprimer"
                                      onClick={() => onDeleteEntry(s._id, e._id)}
                                    >
                                      ✕
                                    </button>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {expandedId === s._id && s.type === 'culte' && (
                  <ul className="entry-list">
                    {(entriesById[s._id] || []).length === 0 && (
                      <li style={{ padding: '10px 2px', color: 'var(--ink-soft)', fontSize: 14 }}>
                        Aucune entrée pour cet événement.
                      </li>
                    )}
                    {(entriesById[s._id] || []).map((e) => (
                      <li key={e._id} className="entry-row">
                        <span>{e.name}</span>
                        <span className="entry-right">
                          <span className="entry-count">{e.count}</span>
                          <button
                            className="entry-del"
                            aria-label="Supprimer"
                            onClick={() => onDeleteEntry(s._id, e._id)}
                          >
                            ✕
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && (
        <CreateSessionModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadSessions();
          }}
        />
      )}
    </div>
  );
}

function CreateSessionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<SessionType>('culte');
  const [dayCount, setDayCount] = useState(7);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Le titre est requis.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.createSession(title.trim(), type, type === 'croisade' ? dayCount : undefined);
      onCreated();
    } catch (err: any) {
      setError(err.message || 'La création a échoué.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h1 className="small">Nouvel événement</h1>
        <p className="subtitle">Un lien unique sera généré pour cet événement.</p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="title">Titre</label>
            <input
              type="text"
              id="title"
              placeholder="Ex : Culte du dimanche 20 septembre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="type">Type</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value as SessionType)}>
              <option value="culte">Culte</option>
              <option value="croisade">Semaine de croisade</option>
            </select>
          </div>
          {type === 'croisade' && (
            <div className="field">
              <label htmlFor="dayCount">Nombre de jours</label>
              <input
                type="text"
                inputMode="numeric"
                id="dayCount"
                value={dayCount}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setDayCount(Number.isNaN(v) ? 1 : Math.min(Math.max(v, 1), 31));
                }}
              />
            </div>
          )}
          {error && <div className="error">{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Création...' : 'Créer le lien'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
