import { useState } from 'react';

export default function SearchForm({ onSearch, loading }) {
  const [url, setUrl] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (url.trim()) onSearch(url.trim());
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <label htmlFor="profile-url">LinkedIn Profile URL</label>
      <div className="search-row">
        <input
          id="profile-url"
          type="url"
          placeholder="https://www.linkedin.com/in/williamhgates"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading || !url.trim()}>
          {loading ? 'Fetching…' : 'Extract Profile'}
        </button>
      </div>
      <p className="search-hint">
        Accepts full URLs or vanity names like <code>williamhgates</code>
      </p>
    </form>
  );
}
