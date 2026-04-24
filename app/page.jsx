'use client';

import { useState, useCallback } from 'react';

const EXAMPLES = [
  'Hernia',
  'Eczema',
  'Plantar fasciitis',
  'Sprained ankle',
  'Lower back pain',
];

export default function Page() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [categories, setCategories] = useState([]); // [{label, query, source, images}]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const runSearch = useCallback(async (term) => {
    const t = term.trim();
    if (!t) return;
    setSubmitted(t);
    setLoading(true);
    setError('');
    setCategories([]);
    try {
      // 1. Expand
      const expandRes = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: t }),
      });
      if (!expandRes.ok) throw new Error('Could not expand query');
      const { categories: cats } = await expandRes.json();

      // Show categories with skeletons immediately
      setCategories(cats.map(c => ({ ...c, images: null })));

      // 2. Fetch images per category in parallel
      const filled = await Promise.all(cats.map(async (c) => {
        try {
          const r = await fetch('/api/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: c.query, hint: c.label, originalTerm: t }),
          });
          if (!r.ok) return { ...c, images: [] };
          const data = await r.json();
          return { ...c, images: data.images || [], source: data.source || c.source };
        } catch {
          return { ...c, images: [] };
        }
      }));
      setCategories(filled);
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    runSearch(query);
  };

  const onChip = (term) => {
    setQuery(term);
    runSearch(term);
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <div className="brand-mark">iC</div>
            <div className="brand-text">
              <span className="brand-name">In-Consult</span>
              <span className="brand-tag">Clinical Visual Reference</span>
            </div>
          </div>

          <form className="search-shell" onSubmit={onSubmit} role="search">
            <span className="search-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              className="search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a diagnosis to show the patient…"
              autoFocus
            />
            <button type="submit" className="search-button" disabled={loading || !query.trim()}>
              {loading ? 'Loading…' : 'Show'}
            </button>
          </form>

          <div className="header-meta">
            <span className="header-meta-dot" />
            <span>Demo mode</span>
          </div>
        </div>
      </header>

      <main className="main">
        {!submitted && !loading && (
          <div className="empty">
            <div className="empty-eyebrow">For in-consult use</div>
            <h1>Show your patient a clean, curated explanation.</h1>
            <p>Type a condition. We expand it into the views you'd actually point to in the room — diagrams, anatomy, what it looks like, treatment paths — pulled from clinically curated sources.</p>
            <div className="chips">
              {EXAMPLES.map(ex => (
                <button key={ex} className="chip" onClick={() => onChip(ex)}>{ex}</button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="error-wrap">{error}</div>
        )}

        {submitted && !error && (
          <>
            <div className="result-head">
              <h2>{submitted}</h2>
              <span className="meta">
                {categories.length > 0
                  ? `${categories.length} views, sourced from clinically curated references`
                  : 'Composing views…'}
              </span>
            </div>

            {loading && categories.length === 0 && (
              <div className="loading-wrap">
                <div className="spinner" />
                Expanding query into clinical views…
              </div>
            )}

            {categories.map((cat, i) => (
              <section key={i} className="row">
                <div className="row-head">
                  <div className="row-title">
                    <h3>{cat.label}</h3>
                    {cat.images && cat.images.length > 0 && (
                      <span className="row-pill">{cat.images.length}</span>
                    )}
                  </div>
                  <div className="row-source">{cat.source || 'Curated sources'}</div>
                </div>

                <div className="tiles">
                  {cat.images === null && (
                    Array.from({ length: 6 }).map((_, k) => (
                      <div key={k} className="tile tile-skel" />
                    ))
                  )}
                  {cat.images !== null && cat.images.length === 0 && (
                    <div className="tile tile-empty">No clean results in demo set.</div>
                  )}
                  {cat.images && cat.images.map((img, k) => (
                    <div
                      key={k}
                      className="tile"
                      onClick={() => setLightbox({ ...img, label: cat.label })}
                    >
                      <img src={img.url} alt="" loading="lazy" />
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <div className="caveat">
              In-Consult demo. Visual reference only — not medical advice. Sources: Wikipedia / Wikimedia Commons + curated set.
            </div>
          </>
        )}
      </main>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt="" />
          <div className="lightbox-caption">{lightbox.label} — {lightbox.attribution || 'source attached'}</div>
        </div>
      )}
    </>
  );
}
