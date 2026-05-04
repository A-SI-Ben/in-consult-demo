// /api/images — returns image tiles for a sub-query.
//
// Strategy:
//   1. Curated override always wins.
//   2. Otherwise fan out across Wikimedia, Openverse, and NLM Open-i in
//      parallel for BOTH the LLM-generated sub-query AND the bare clinical
//      term. The sub-query gives us context (e.g. "greenstick fracture x-ray"
//      for the "What it looks like" row), the bare term guarantees we get
//      *something* if the sub-query is too narrow for any source's metadata.
//   3. Merge: sub-query results take the front slots; bare-term results fill
//      in behind, deduped by URL.
//   4. Visibility mode: fewer tiles, prioritise drawings/illustrations.

import { findCurated } from '../../../lib/curated.js';
import { searchWikimedia } from '../../../lib/sources/wikimedia.js';
import { searchOpenverse } from '../../../lib/sources/openverse.js';
import { searchOpenI } from '../../../lib/sources/openi.js';

export const runtime = 'edge';

export async function POST(req) {
  try {
    const { query, hint, originalTerm, modifiers } = await req.json();
    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'query required' }, { status: 400 });
    }

    const visibilityMode = modifiers?.visibility === true;
    const targetCount = visibilityMode ? 3 : 4;

    // 1. Curated override.
    const curated = findCurated(originalTerm, hint);
    if (curated) {
      return Response.json({
        images: curated.slice(0, targetCount),
        source: 'Curated reference set',
      });
    }

    // 2. Fan out: sub-query AND (if different) bare term, all sources, parallel.
    const queries = [query];
    const bareTerm = (originalTerm || '').trim();
    if (bareTerm && bareTerm.toLowerCase() !== query.toLowerCase()) {
      queries.push(bareTerm);
    }

    const fanouts = await Promise.all(
      queries.map((q) =>
        Promise.all([
          safe(() => searchWikimedia(q, 12)),
          safe(() => searchOpenverse(q, 10)),
          safe(() => searchOpenI(q, 8)),
        ])
      )
    );

    // Interleave each query's source results so no one source dominates,
    // then concat queries in order so sub-query wins the top slots.
    let merged = [];
    for (const sourceArrays of fanouts) {
      merged = merged.concat(interleave(sourceArrays));
    }

    // De-dupe by URL.
    const seen = new Set();
    merged = merged.filter((img) => {
      if (seen.has(img.url)) return false;
      seen.add(img.url);
      return true;
    });

    // Visibility mode: drawings/illustrations to the front.
    if (visibilityMode) {
      merged = [
        ...merged.filter((i) => i.isDrawing),
        ...merged.filter((i) => !i.isDrawing),
      ];
    }

    const final = merged.slice(0, targetCount);
    const sourcesUsed = uniq(final.map((i) => i.sourceName));

    return Response.json({
      images: final,
      source: sourcesUsed.length ? sourcesUsed.join(' + ') : 'No matches',
    });
  } catch (e) {
    console.error(e);
    return Response.json({ images: [], source: 'error' }, { status: 200 });
  }
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

function uniq(arr) {
  return Array.from(new Set(arr));
}
