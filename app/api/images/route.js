// /api/images — returns image tiles for a sub-query.
// Strategy:
//   1. If a curated override exists in lib/curated.js, use it (always wins).
//   2. Otherwise fan out across Wikimedia, Openverse, and NLM Open-i in
//      parallel, merge with source-interleaving, dedupe by URL, and trim
//      to the target count.
//   3. Visibility mode: fewer tiles, prioritise drawings/illustrations.

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
    const targetCount = visibilityMode ? 3 : 6;

    // 1. Curated override — pre-vetted images always win.
    const curated = findCurated(originalTerm, hint);
    if (curated) {
      return Response.json({
        images: curated.slice(0, targetCount),
        source: 'Curated reference set',
      });
    }

    // 2. Fan out across all sources in parallel. One failing source must not
    //    kill the others, so each call is wrapped.
    const [wm, ov, oi] = await Promise.all([
      safe(() => searchWikimedia(query, 12)),
      safe(() => searchOpenverse(query, 10)),
      safe(() => searchOpenI(query, 8)),
    ]);

    // Interleave by source so the result set isn't dominated by whichever
    // source happened to return the most matches.
    let merged = interleave([wm, ov, oi]);

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
      source: sourcesUsed.length ? sourcesUsed.join(' + ') : 'No sources returned',
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
