'use client';

import { useState, useCallback } from 'react';

const EXAMPLES = [
  'Hernia',
  'Eczema',
  'Plantar fasciitis',
  'Sprained ankle',
  'Lower back pain',
];

const DEFAULT_MODIFIERS = {
  parental: false,
  visibility: false,
  other: false,
  otherText: '',
};

export default function Page() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [categories, setCategories] = useState([]); // [{label, query, source, images}]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [modifiers, setModifiers] = useState(DEFAULT_MODIFIERS);

  const runSearch = useCallback(async (term, mods) => {
    const t = term.trim();
    if (!t) return;
    setSubmitted(t);
    setLoading(true);
    setError('');
    setCategories([]);

    const apiModifiers = {
      parental: !!mods.parental,
      visibility: !!mods.visibility,
      other: mods.other && mods.otherText.trim() ? mods.otherText.trim() : '',
    };

    try {
      // 1. Expand
      const expandRes = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: t, modifiers: apiModifiers }),
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
            body: JSON.stringify({
              query: c.query,
              hint: c.label,
              originalTerm: t,
              modifiers: apiModifiers,
            }),
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
    runSearch(query, modifiers);
  };

  const onChip = (term) => {
    setQuery(term);
    runSearch(term, modifiers);
  };

  const toggleModifier = (key) => {
    const next = { ...modifiers, [key]: !modifiers[key] };
    setModifiers(next);
    if (submitted) runSearch(submitted, next);
  };

  const onOtherTextChange = (text) => {
    setModifiers(m => ({ ...m, otherText: text }));
  };

  const commitOtherText = () => {
    if (modifiers.other && submitted) runSearch(submitted, modifiers);
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
            <span>Live</span>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="filters" role="group" aria-label="Result modifiers">
          <label className={`filter-checkbox${modifiers.parental ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={modifiers.parental}
              onChange={() => toggleModifier('parental')}
            />
            <span className="filter-label">Parental</span>
            <span className="filter-hint">child-safe</span>
          </label>
          <label className={`filter-checkbox${modifiers.visibility ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={modifiers.visibility}
              onChange={() => toggleModifier('visibility')}
            />
            <span className="filter-label">Visibility</span>
            <span className="filter-hint">larger, fewer, accessible</span>
          </label>
          <label className={`filter-checkbox${modifiers.other ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={modifiers.other}
              onChange={() => toggleModifier('other')}
            />
            <span className="filter-label">Other</span>
          </label>
          {modifiers.other && (
            <input
              className="filter-other-input"
              type="text"
              value={modifiers.otherText}
              onChange={(e) => onOtherTextChange(e.target.value)}
              onBlur={commitOtherText}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitOtherText(); } }}
              placeholder="e.g. paediatric, post-surgical, NZ context"
            />
          )}
        </div>

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
                  ? `${categories.length} views · Wikimedia Commons, Openverse, NLM Open-i`
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

                <div className={`tiles${modifiers.visibility ? ' tiles-visibility' : ''}`}>
                  {cat.images === null && (
                    Array.from({ length: modifiers.visibility ? 3 : 6 }).map((_, k) => (
                      <div key={k} className="tile tile-skel" />
                    ))
                  )}
                  {cat.images !== null && cat.images.length === 0 && (
                    <div className="tile tile-empty">
                      No matches for this view. Try rephrasing the term, or remove modifiers.
                    </div>
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
              Visual reference only — not a substitute for medical advice. Sources: Wikimedia Commons, Openverse, NLM Open-i + curated set.
            </div>
          </>
        )}
      </main>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox.fullUrl || lightbox.url} alt="" onClick={(e) => e.stopPropagation()} />
          <div className="lightbox-caption" onClick={(e) => e.stopPropagation()}>
            <span>{lightbox.label} — {lightbox.attribution || 'source attached'}</span>
            {lightbox.fullUrl && (
              <a
                className="lightbox-source"
                href={lightbox.fullUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View source ↗
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
