// /api/images — fetches image tiles for an entire result set in one call.
//
// Request body: { originalTerm, categories: [{label, query}, ...], modifiers }
// Response:     { categories: [{label, query, images, source}, ...] }
//
// Per row:
//   1. Curated override always wins.
//   2. Fan out the LLM sub-query across Wikimedia / Openverse / NLM Open-i.
//   3. If the row came back with <2 results, fall back to the bare clinical
//      term. Sub-query results keep the front slots so the row stays on-topic.
//   4. Score by category: rows with "diagram"/"anatomy"/"schematic" labels
//      prefer SVG / illustration content; "clinical"/"what it looks like"
//      rows prefer photographs. Visibility mode forces drawings to the front.
//   5. Per-source 1.5s soft timeout so a slow source can't stall a row.
//   6. Cross-row dedupe so the same image doesn't appear in two rows.

import { findCurated } from '../../../lib/curated.js';
import { searchWikimedia } from '../../../lib/sources/wikimedia.js';
import { searchOpenverse } from '../../../lib/sources/openverse.js';
import { searchOpenI } from '../../../lib/sources/openi.js';

export const runtime = 'edge';

const SOURCE_TIMEOUT_MS = 1500;

export async function POST(req) {
  try {
    const { originalTerm, categories, modifiers } = await req.json();
    if (!Array.isArray(categories) || categories.length === 0) {
      return Response.json({ categories: [] });
    }

    const visibilityMode = modifiers?.visibility === true;
    const targetCount = visibilityMode ? 3 : 4;

    const filled = await Promise.all(
      categories.map((cat) =>
        fetchRow({
          query: cat.query,
          label: cat.label,
          originalTerm,
          visibilityMode,
          targetCount,
        })
      )
    );

    // Cross-row dedupe — same image must not appear in two rows.
    const seen = new Set();
    const deduped = filled.map((row) => ({
      ...row,
      images: row.images.filter((img) => {
        if (seen.has(img.url)) return false;
        seen.add(img.url);
        return true;
      }),
    }));

    return Response.json({ categories: deduped });
  } catch (e) {
    console.error('images route error', e);
    return Response.json({ categories: [], error: 'request failed' }, { status: 200 });
  }
}

async function fetchRow({ query, label, originalTerm, visibilityMode, targetCount }) {
  const baseRow = { label, query };

  // 1. Curated override
  const curated = findCurated(originalTerm, label);
  if (curated) {
    return {
      ...baseRow,
      images: curated.slice(0, targetCount),
      source: 'Curated reference set',
    };
  }

  // 2. Sub-query fan-out
  let results = await fanOut(query);

  // 3. Conditional fallback — only when the sub-query came up nearly empty
  if (
    results.length < 2 &&
    originalTerm &&
    originalTerm.toLowerCase() !== query.toLowerCase()
  ) {
    const fallback = await fanOut(originalTerm);
    results = dedupe(results.concat(fallback));
  } else {
    results = dedupe(results);
  }

  // 4. Category-aware scoring
  results = scoreByCategory(results, label, visibilityMode);

  const final = results.slice(0, targetCount);
  const sourcesUsed = uniq(final.map((i) => i.sourceName));

  return {
    ...baseRow,
    images: final,
    source: sourcesUsed.length ? sourcesUsed.join(' + ') : 'No matches',
  };
}

async function fanOut(q) {
  const [wm, ov, oi] = await Promise.all([
    timed(() => searchWikimedia(q, 8)),
    timed(() => searchOpenverse(q, 8)),
    timed(() => searchOpenI(q, 6)),
  ]);
  return interleave([wm, ov, oi]);
}

function timed(fn) {
  return Promise.race([
    safe(fn),
    new Promise((resolve) => setTimeout(() => resolve([]), SOURCE_TIMEOUT_MS)),
  ]);
}

async function safe(fn) {
  try {
    return (await fn()) || [];
  } catch (e) {
    console.error('source error', e);
    return [];
  }
}

function interleave(arrays) {
  const out = [];
  let any = true;
  for (let i = 0; any; i++) {
    any = false;
    for (const arr of arrays) {
      if (arr[i]) {
        out.push(arr[i]);
        any = true;
      }
    }
  }
  return out;
}

function dedupe(images) {
  const seen = new Set();
  return images.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });
}

function scoreByCategory(images, label, visibilityMode) {
  const l = (label || '').toLowerCase();
  const wantsDrawing =
    visibilityMode ||
    /diagram|schematic|illustration|drawing|figure|anatomy|self.?care|exercise|patient.explanation/.test(l);
  const wantsPhoto =
    !wantsDrawing && /what it looks like|clinical|photo|x.?ray|treatment/.test(l);

  if (wantsDrawing) {
    return [
      ...images.filter((i) => i.isDrawing),
      ...images.filter((i) => !i.isDrawing),
    ];
  }
  if (wantsPhoto) {
    return [
      ...images.filter((i) => !i.isDrawing),
      ...images.filter((i) => i.isDrawing),
    ];
  }
  return images;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}
