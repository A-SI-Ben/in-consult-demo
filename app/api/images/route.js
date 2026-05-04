// /api/images — deterministic image search.
//
// Request:  { originalTerm, modifiers: { pg, visibility, other } }
// Response: { categories: [{label, query, source, images, debug}, ...] }
//
// Reads lib/modifiers.js for the category set, query templates, and exclude
// regexes. No LLM in the path — same input always yields the same query.

import {
  CATEGORIES,
  UNIVERSAL_APPEND,
  MODIFIERS,
  ALWAYS_EXCLUDE,
  PG_EXTRA_EXCLUDE,
} from '../../../lib/modifiers.js';
import { searchWikimedia } from '../../../lib/sources/wikimedia.js';
import { searchOpenverse } from '../../../lib/sources/openverse.js';
import { searchOpenI } from '../../../lib/sources/openi.js';

export const runtime = 'edge';

const SOURCE_TIMEOUT_MS = 1500;

export async function POST(req) {
  try {
    const { originalTerm, modifiers = {} } = await req.json();
    if (!originalTerm || typeof originalTerm !== 'string') {
      return Response.json({ error: 'originalTerm required' }, { status: 400 });
    }
    const term = originalTerm.trim();

    // Compose query appends from active modifiers.
    const queryAppends = [];
    if (modifiers.pg) queryAppends.push(MODIFIERS.pg.queryAppend);
    if (modifiers.visibility) queryAppends.push(MODIFIERS.visibility.queryAppend);
    if (
      typeof modifiers.other === 'string' &&
      modifiers.other.trim()
    ) {
      queryAppends.push(modifiers.other.trim());
    }

    // Compose the exclude regex for this request.
    const exclude = modifiers.pg
      ? new RegExp(`${ALWAYS_EXCLUDE.source}|${PG_EXTRA_EXCLUDE.source}`, 'i')
      : ALWAYS_EXCLUDE;

    const visibilityMode = !!modifiers.visibility;
    const forceDrawings = !!(modifiers.pg || modifiers.visibility);
    const targetCount = visibilityMode ? 3 : 4;

    const filled = await Promise.all(
      CATEGORIES.map((cat) =>
        fetchRow({ term, cat, queryAppends, exclude, forceDrawings, targetCount })
      )
    );

    // Cross-row dedupe so the same image doesn't show in two rows.
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

async function fetchRow({ term, cat, queryAppends, exclude, forceDrawings, targetCount }) {
  const queryParts = [term, cat.queryModifier, ...queryAppends, UNIVERSAL_APPEND];
  const query = queryParts.filter(Boolean).join(' ');

  const [wm, ov, oi] = await Promise.all([
    timed(() => searchWikimedia(query, 8)),
    timed(() => searchOpenverse(query, 8)),
    timed(() => searchOpenI(query, 6)),
  ]);

  const rawCounts = {
    wikimedia: wm.length,
    openverse: ov.length,
    openi: oi.length,
  };

  // Interleave + dedupe within row.
  let images = dedupe(interleave([wm, ov, oi]));
  const beforeFilter = images.length;

  // Apply exclude filter.
  images = images.filter((img) => {
    const haystack = [img.title, img.attribution].filter(Boolean).join(' ');
    return !exclude.test(haystack);
  });
  const filteredOut = beforeFilter - images.length;

  // Drawings preferred? Per-category default plus modifier override.
  const wantsDrawing = forceDrawings || cat.prefersDrawings;
  if (wantsDrawing) {
    images = [
      ...images.filter((i) => i.isDrawing),
      ...images.filter((i) => !i.isDrawing),
    ];
  } else {
    images = [
      ...images.filter((i) => !i.isDrawing),
      ...images.filter((i) => i.isDrawing),
    ];
  }

  const final = images.slice(0, targetCount);
  const sourcesUsed = uniq(final.map((i) => i.sourceName));

  return {
    label: cat.label,
    query,
    images: final,
    source: sourcesUsed.length ? sourcesUsed.join(' + ') : 'No matches',
    debug: { query, rawCounts, beforeFilter, filteredOut, finalCount: final.length },
  };
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

function uniq(arr) {
  return Array.from(new Set(arr));
}
