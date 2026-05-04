'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { CATEGORIES, MODIFIERS } from '../lib/modifiers.js';

const DEFAULT_MODIFIERS = {
  pg: false,
  visibility: false,
  other: false,
  otherText: '',
};

// Skeleton rows the client knows about up-front, so the layout snaps in place
// the instant Show is pressed (no waiting for the server to tell us what rows
// exist — that's already determined by lib/modifiers.js).
const SKELETON_ROWS = CATEGORIES.map((c) => ({
  label: c.label,
  images: null,
  source: '',
}));

export default function Page() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [categories, setCategories] = useState([]); // [{label, query, source, images, debug}]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [modifiers, setModifiers] = useState(DEFAULT_MODIFIERS);
  const [debug, setDebug] = useState(false);

  // ?debug=1 toggles the per-row query / counts panel
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setDebug(params.get('debug') === '1');
    }
  }, []);

  const runSearch = useCallback(async (term, mods) => {
    const t = term.trim();
    if (!t) return;
    setSubmitted(t);
    setLoading(true);
    setError('');
    setCategories(SKELETON_ROWS); // skeletons appear immediately

    const apiModifiers = {
      pg: !!mods.pg,
      visibility: !!mods.visibility,
      other: mods.other && mods.otherText.trim() ? mods.otherText.trim() : '',
    };

    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalTerm: t, modifiers: apiModifiers }),
      });
      if (!res.ok) throw new Error('Could not fetch images');
      const { categories: filled } = await res.json();
      setCategories(
        (filled || []).map((row) => ({ ...row, images: row.images || [] }))
      );
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

  const toggleModifier = (key) => {
    const next = { ...modifiers, [key]: !modifiers[key] };
    setModifiers(next);
    if (submitted) runSearch(submitted, next);
  };

  const onOtherTextChange = (text) => {
    setModifiers((m) => ({ ...m, otherText: text }));
  };

  const commitOtherText = () => {
    if (modifiers.other && submitted) runSearch(submitted, modifiers);
  };

  // While loading: show all skeleton rows. After loading: hide rows with no images.
  const visibleCategories = useMemo(() => {
    if (loading) return categories;
    return categories.filter((c) => c.images === null || c.images.length > 0);
  }, [categories, loading]);

  const allEmpty =
    !loading &&
    submitted &&
    categories.length > 0 &&
    categories.every((c) => Array.isArray(c.images) && c.images.length === 0);

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
            <span>{debug ? 'Debug' : 'Live'}</span>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="filters" role="group" aria-label="Result modifiers">
          <label className={`filter-checkbox${modifiers.pg ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={modifiers.pg}
              onChange={() => toggleModifier('pg')}
            />
            <span className="filter-label">{MODIFIERS.pg.label}</span>
            <span className="filter-hint">{MODIFIERS.pg.hint}</span>
          </label>
          <label className={`filter-checkbox${modifiers.visibility ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={modifiers.visibility}
              onChange={() => toggleModifier('visibility')}
            />
            <span className="filter-label">{MODIFIERS.visibility.label}</span>
            <span className="filter-hint">{MODIFIERS.visibility.hint}</span>
          </label>
          <label className={`filter-checkbox${modifiers.other ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={modifiers.other}
              onChange={() => toggleModifier('other')}
            />
            <span className="filter-label">{MODIFIERS.other.label}</span>
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
            <p>Type a condition. We expand it into the three views you'd actually point to in the room — a diagram, an overview image, and treatment — pulled from clinically curated sources.</p>
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
                {loading
                  ? 'Composing views…'
                  : `${visibleCategories.length} ${visibleCategories.length === 1 ? 'view' : 'views'} · Wikimedia Commons, Openverse, NLM Open-i`}
              </span>
            </div>

            {allEmpty && (
              <div className="loading-wrap">
                No matches for that term across our sources. Try rephrasing, or remove modifiers.
              </div>
            )}

            {visibleCategories.map((cat, i) => (
              <section key={`${cat.label}-${i}`} className="row">
                <div className="row-head">
                  <div className="row-title">
                    <h3>{cat.label}</h3>
                    {cat.images && cat.images.length > 0 && (
                      <span className="row-pill">{cat.images.length}</span>
                    )}
                  </div>
                  <div className="row-source">{cat.source || 'Sourcing…'}</div>
                </div>

                <div className={`tiles${modifiers.visibility ? ' tiles-visibility' : ''}`}>
                  {cat.images === null &&
                    Array.from({ length: modifiers.visibility ? 3 : 4 }).map((_, k) => (
                      <div key={k} className="tile tile-skel" />
                    ))}
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

                {debug && cat.debug && (
                  <div className="debug-panel">
                    <div className="debug-row">
                      <span className="debug-key">query</span>
                      <code className="debug-val">{cat.debug.query}</code>
                    </div>
                    <div className="debug-row">
                      <span className="debug-key">raw</span>
                      <code className="debug-val">
                        wikimedia: {cat.debug.rawCounts?.wikimedia ?? 0} ·{' '}
                        openverse: {cat.debug.rawCounts?.openverse ?? 0} ·{' '}
                        open-i: {cat.debug.rawCounts?.openi ?? 0}
                      </code>
                    </div>
                    <div className="debug-row">
                      <span className="debug-key">filter</span>
                      <code className="debug-val">
                        {cat.debug.beforeFilter ?? 0} → {cat.debug.finalCount ?? 0}
                        {' '}({cat.debug.filteredOut ?? 0} dropped by exclude regex)
                      </code>
                    </div>
                  </div>
                )}
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
