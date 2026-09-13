import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.login(password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Connexion impossible');
    } finally {
      setLoading(false);
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
          <h1 className="small">Espace responsable</h1>
          <p className="subtitle">Entre le mot de passe pour accéder au tableau de bord.</p>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="password">Mot de passe</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            {error && <div className="error">{error}</div>}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Connexion...' : 'Accéder'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
