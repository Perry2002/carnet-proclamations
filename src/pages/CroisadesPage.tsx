import { useState, useEffect } from 'react';
import { api, Croisade, CroisadeDay, EntryItem } from '../api';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

type CroisadeDetail = {
  days: (CroisadeDay & { total: number; entryCount: number })[];
  grandTotal: number;
};

export default function CroisadesPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Croisade[]; totalPages: number; total: number } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [expandedCroisadeId, setExpandedCroisadeId] = useState<string | null>(null);
  const [croisadeDetailById, setCroisadeDetailById] = useState<Record<string, CroisadeDetail>>({});
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const [dayEntriesById, setDayEntriesById] = useState<Record<string, EntryItem[]>>({});
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  async function load() {
    const res = await api.listCroisades(page, PAGE_SIZE);
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

  async function loadCroisadeDetail(id: string) {
    const detail = await api.getCroisadeDetail(id);
    setCroisadeDetailById((prev) => ({ ...prev, [id]: { days: detail.days, grandTotal: detail.grandTotal } }));
  }

  async function toggleCroisadeExpand(croisade: Croisade) {
    if (expandedCroisadeId === croisade._id) {
      setExpandedCroisadeId(null);
      return;
    }
    setExpandedCroisadeId(croisade._id);
    if (!croisadeDetailById[croisade._id]) {
      await loadCroisadeDetail(croisade._id);
    }
  }

  async function toggleDayEntries(daySessionId: string) {
    if (expandedDayId === daySessionId) {
      setExpandedDayId(null);
      return;
    }
    setExpandedDayId(daySessionId);
    if (!dayEntriesById[daySessionId]) {
      const detail = await api.getSession(daySessionId);
      setDayEntriesById((prev) => ({ ...prev, [daySessionId]: detail.entries }));
    }
  }

  async function onCloseDay(croisadeId: string, daySessionId: string) {
    await api.closeSession(daySessionId);
    await loadCroisadeDetail(croisadeId);
    load();
  }

  async function onReopenDay(croisadeId: string, daySessionId: string) {
    await api.reopenSession(daySessionId);
    await loadCroisadeDetail(croisadeId);
    load();
  }

  async function onCloseAllDays(croisade: Croisade) {
    if (!confirm(`Clôturer tous les jours de « ${croisade.title} » ? Plus aucun lien de cette semaine n'acceptera de nouveaux envois.`)) return;
    await api.closeAllCroisadeDays(croisade._id);
    await loadCroisadeDetail(croisade._id);
    load();
  }

  async function onDeleteCroisadeEntry(croisadeId: string, daySessionId: string, entryId: string) {
    if (!confirm('Supprimer cette entrée ?')) return;
    await api.deleteEntry(daySessionId, entryId);
    const detail = await api.getSession(daySessionId);
    setDayEntriesById((prev) => ({ ...prev, [daySessionId]: detail.entries }));
    await loadCroisadeDetail(croisadeId);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="small" style={{ marginBottom: 2 }}>Semaines de croisade</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Un lien généré automatiquement pour chaque jour.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>Nouvelle semaine</button>
      </div>

      {data === null && <div className="loading">Chargement...</div>}
      {data && data.items.length === 0 && <div className="empty">Aucune semaine de croisade pour l'instant.</div>}

      {data && data.items.length > 0 && (
        <>
          <ul className="session-list">
            {data.items.map((c) => {
              const detail = croisadeDetailById[c._id];
              return (
                <li key={c._id} className="session-item">
                  <div className="session-top">
                    <div>
                      <div className="session-title">{c.title}</div>
                      <div className="session-meta">
                        {c.dayCount} jours · créé le {formatDate(c.createdAt)} · {c.entryCount} entrée{c.entryCount > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${c.openCount > 0 ? 'open' : 'closed'}`}>
                        {c.openCount > 0 ? `${c.openCount}/${c.dayCount} jours ouverts` : 'Tout clôturé'}
                      </span>
                      <div className="session-total">{c.total}</div>
                    </div>
                  </div>

                  <div className="session-actions">
                    <button className="btn-secondary" onClick={() => toggleCroisadeExpand(c)}>
                      {expandedCroisadeId === c._id ? 'Masquer les jours' : 'Voir les jours'}
                    </button>
                    {c.openCount > 0 && (
                      <button className="btn-secondary" onClick={() => onCloseAllDays(c)}>Clôturer tous les jours</button>
                    )}
                    <a className="btn-secondary" href={api.croisadeReportUrl(c._id)} style={{ textDecoration: 'none', display: 'inline-block' }}>
                      Télécharger le rapport de la semaine
                    </a>
                  </div>

                  {expandedCroisadeId === c._id && detail && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                      {detail.days.map((d) => (
                        <div key={d._id} style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                              Jour {d.day} <span style={{ color: 'var(--gold-dark)', fontWeight: 700 }}>· {d.total}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span className={`badge ${d.status}`}>{d.status === 'open' ? 'Ouvert' : 'Clôturé'}</span>
                              <button className="link-quiet" onClick={() => toggleDayEntries(d._id)}>
                                {expandedDayId === d._id ? 'Masquer les noms' : 'Voir les noms'}
                              </button>
                              {d.status === 'open' ? (
                                <button className="link-quiet" onClick={() => onCloseDay(c._id, d._id)}>Clôturer</button>
                              ) : (
                                <button className="link-quiet" onClick={() => onReopenDay(c._id, d._id)}>Rouvrir</button>
                              )}
                            </div>
                          </div>
                          <div className="link-box">
                            <span>{window.location.origin}/c/{d.slug}</span>
                            <button className="link-quiet" onClick={() => copyLink(d.slug)}>
                              {copiedSlug === d.slug ? 'Copié !' : 'Copier'}
                            </button>
                          </div>
                          {expandedDayId === d._id && (
                            <ul className="entry-list">
                              {(dayEntriesById[d._id] || []).length === 0 && (
                                <li style={{ padding: '10px 2px', color: 'var(--ink-soft)', fontSize: 14 }}>
                                  Aucune entrée pour ce jour.
                                </li>
                              )}
                              {(dayEntriesById[d._id] || []).map((e) => (
                                <li key={e._id} className="entry-row">
                                  <span>{e.name}</span>
                                  <span className="entry-right">
                                    <span className="entry-count">{e.count}</span>
                                    <button
                                      className="entry-del"
                                      aria-label="Supprimer"
                                      onClick={() => onDeleteCroisadeEntry(c._id, d._id, e._id)}
                                    >
                                      ✕
                                    </button>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}

      {showCreate && (
        <CreateCroisadeModal
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

function CreateCroisadeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
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
      await api.createCroisade(title.trim(), dayCount);
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
        <h1 className="small">Nouvelle semaine de croisade</h1>
        <p className="subtitle">
          Un lien sera généré automatiquement pour chaque jour — personne n'aura à choisir le jour.
        </p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="ctitle">Titre</label>
            <input
              type="text"
              id="ctitle"
              placeholder="Ex : Croisade de prière et de jeûne de septembre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
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
          {error && <div className="error">{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Création...' : 'Créer les liens'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
