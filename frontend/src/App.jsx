import { useState } from 'react';
import SearchForm from './components/SearchForm.jsx';
import ProfileCard from './components/ProfileCard.jsx';
import JsonViewer from './components/JsonViewer.jsx';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('card');

  async function handleSearch(url, refresh = false) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({ url });
      if (refresh) params.set('refresh', 'true');

      const response = await fetch(`${API_BASE}/api/profile?${params}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to fetch profile');
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.25 6.5 1.75 1.75 0 016.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h3v1.76c.39-.68 1.09-1.66 2.79-1.66 2.2 0 3.66 1.45 3.66 4.39z" />
              </svg>
            </div>
            <div>
              <h1>LinkedIn Profile API</h1>
              <p>Reverse-engineered Voyager endpoints → structured JSON</p>
            </div>
          </div>
          <div className="header-badges">
            <span className="badge">MERN Stack</span>
            <span className="badge badge-accent">Voyager API</span>
          </div>
        </div>
      </header>

      <main className="main">
        <SearchForm onSearch={handleSearch} loading={loading} />

        {error && (
          <div className="alert alert-error">
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <section className="results">
            <div className="results-toolbar">
              <div className="meta-chips">
                <span className="chip">{result.meta.vanityName}</span>
                {result.meta.cached && <span className="chip chip-cache">Cached</span>}
                <span className="chip chip-muted">
                  {new Date(result.meta.fetchedAt).toLocaleString()}
                </span>
              </div>
              <div className="view-toggle">
                <button
                  className={view === 'card' ? 'active' : ''}
                  onClick={() => setView('card')}
                  type="button"
                >
                  Card View
                </button>
                <button
                  className={view === 'json' ? 'active' : ''}
                  onClick={() => setView('json')}
                  type="button"
                >
                  JSON
                </button>
              </div>
            </div>

            {view === 'card' ? (
              <ProfileCard data={result.data} meta={result.meta} />
            ) : (
              <JsonViewer data={result} />
            )}
          </section>
        )}

        {!result && !error && !loading && (
          <section className="hero-info">
            <div className="info-grid">
              <InfoCard
                title="Input"
                desc="Paste any public LinkedIn profile URL"
                example="linkedin.com/in/username"
              />
              <InfoCard
                title="Output"
                desc="Clean JSON with identity, experience, education, skills & more"
                example="name · headline · location · about"
              />
              <InfoCard
                title="Approach"
                desc="Direct HTTP calls to LinkedIn Voyager REST & GraphQL APIs"
                example="No browser automation"
              />
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>
          Built with Express · React · MongoDB · LinkedIn Voyager API reverse engineering
        </p>
      </footer>
    </div>
  );
}

function InfoCard({ title, desc, example }) {
  return (
    <div className="info-card">
      <h3>{title}</h3>
      <p>{desc}</p>
      <code>{example}</code>
    </div>
  );
}
