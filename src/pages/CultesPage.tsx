import { useEffect, useState } from 'react';
import { api, EntryItem, SessionSummary } from '../api';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CultesPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: SessionSummary[]; totalPages: number; total: number } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entriesById, setEntriesById] = useState<Record<string, EntryItem[]>>({});
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  async function load() {
    const res = await api.listSessions(page, PAGE_SIZE);
    setData(res);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function copyLink(slug: string) {
    const url = `${window.location.origin}/c/${slug}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 1800);
    });
  }

  async function toggleExpand(session: SessionSummary) {
    if (expandedId === session._id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(session._id);
    if (!entriesById[session._id]) {
      const detail = await api.getSession(session._id);
      setEntriesById((prev) => ({ ...prev, [session._id]: detail.entries }));
    }
  }

  async function onClose(session: SessionSummary) {
    if (!confirm(`Clôturer « ${session.title} » ? Le lien n'acceptera plus de nouveaux envois.`)) return;
    await api.closeSession(session._id);
    load();
  }

  async function onReopen(session: SessionSummary) {
    await api.reopenSession(session._id);
    load();
  }

  async function onDeleteEntry(sessionId: string, entryId: string) {
    if (!confirm('Supprimer cette entrée ?')) return;
    await api.deleteEntry(sessionId, entryId);
    const detail = await api.getSession(sessionId);
    setEntriesById((prev) => ({ ...prev, [sessionId]: detail.entries }));
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="small" style={{ marginBottom: 2 }}>Cultes</h1>
          <p className="subtitle" style={{ margin: 0 }}>Un lien par culte.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>Nouveau culte</button>
      </div>

      {data === null && <div className="loading">Chargement...</div>}
      {data && data.items.length === 0 && <div className="empty">Aucun culte pour l'instant.</div>}

      {data && data.items.length > 0 && (
        <>
          <ul className="session-list">
            {data.items.map((s) => (
              <li key={s._id} className="session-item">
                <div className="session-top">
                  <div>
                    <div className="session-title">{s.title}</div>
                    <div className="session-meta">
                      créé le {formatDate(s.createdAt)} · {s.entryCount} entrée{s.entryCount > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${s.status}`}>{s.status === 'open' ? 'Ouvert' : 'Clôturé'}</span>
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
                    <button className="btn-secondary" onClick={() => onClose(s)}>Clôturer</button>
                  ) : (
                    <button className="btn-secondary" onClick={() => onReopen(s)}>Rouvrir</button>
                  )}
                  <a className="btn-secondary" href={api.reportUrl(s._id)} style={{ textDecoration: 'none', display: 'inline-block' }}>
                    Télécharger le PDF
                  </a>
                </div>

                {expandedId === s._id && (
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
                          <button className="entry-del" aria-label="Supprimer" onClick={() => onDeleteEntry(s._id, e._id)}>✕</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}

      {showCreate && (
        <CreateCulteModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setPage(1);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateCulteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
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
      await api.createSession(title.trim());
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
        <h1 className="small">Nouveau culte</h1>
        <p className="subtitle">Un lien unique sera généré pour ce culte.</p>
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
          {error && <div className="error">{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Création...' : 'Créer le lien'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
