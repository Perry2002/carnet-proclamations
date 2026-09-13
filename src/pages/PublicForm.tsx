import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, SessionStatus } from '../api';

type LoadState = 'loading' | 'ready' | 'not-found';

export default function PublicForm() {
  const { slug = '' } = useParams();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<SessionStatus>('open');

  const [name, setName] = useState('');
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api
      .getPublicSession(slug)
      .then((s) => {
        setTitle(s.title);
        setStatus(s.status);
        setLoadState('ready');
      })
      .catch(() => setLoadState('not-found'));
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Merci d\'indiquer ton nom.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.submitEntry(slug, name.trim(), count);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "L'envoi a échoué, réessaie dans un instant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="wrap">
        <div className="brand">
          <span className="brand-mark">Carnet des proclamations</span>
          <span className="brand-line" />
        </div>
        <div className="card">
          {loadState === 'loading' && <div className="loading">Chargement...</div>}

          {loadState === 'not-found' && (
            <div className="confirm">
              <h2>Lien invalide</h2>
              <p>Ce lien ne correspond à aucun événement. Vérifie qu'il a été copié en entier.</p>
            </div>
          )}

          {loadState === 'ready' && status === 'closed' && (
            <div className="confirm">
              <h2>Événement clôturé</h2>
              <p>« {title} » est clôturé. Les envois ne sont plus acceptés pour cet événement.</p>
            </div>
          )}

          {loadState === 'ready' && status === 'open' && !submitted && (
            <>
              <h1>{title}</h1>
              <p className="subtitle">Indique ton nom et le nombre de proclamations faites.</p>
              <form onSubmit={onSubmit}>
                <div className="field">
                  <label htmlFor="name">Nom complet</label>
                  <input
                    type="text"
                    id="name"
                    placeholder="Ex : Jean Dossou"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="count">
                    <span className="tally">
                      <span></span><span></span><span></span><span></span>
                    </span>
                    Nombre de proclamations
                  </label>
                  <div className="stepper">
                    <button
                      type="button"
                      aria-label="Diminuer"
                      onClick={() => setCount((c) => Math.max(0, c - 1))}
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      id="count"
                      value={count}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setCount(Number.isNaN(v) ? 0 : Math.max(0, v));
                      }}
                    />
                    <button type="button" aria-label="Augmenter" onClick={() => setCount((c) => c + 1)}>
                      +
                    </button>
                  </div>
                </div>
                {error && <div className="error">{error}</div>}
                <button className="btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Envoi...' : 'Envoyer'}
                </button>
              </form>
            </>
          )}

          {submitted && (
            <div className="confirm">
              <div className="confirm-badge">✓</div>
              <h2>Merci, {name} !</h2>
              <p>Ton compte a bien été enregistré pour « {title} ».</p>
              <button
                className="btn-secondary"
                onClick={() => {
                  setSubmitted(false);
                  setName('');
                  setCount(0);
                }}
              >
                Envoyer une autre entrée
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
