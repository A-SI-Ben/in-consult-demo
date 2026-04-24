// /api/images — returns 5-6 image URLs for a sub-query.
// Strategy:
//   1. If a curated override exists, use it.
//   2. Otherwise query Wikimedia Commons MediaSearch for files in the File: namespace,
//      filter to image mime types, return the thumbnail URLs.

import { findCurated } from '../../../lib/curated.js';

export const runtime = 'edge';

const UA = 'In-Consult-Demo/0.1 (https://github.com/; demo build)';

export async function POST(req) {
  try {
    const { query, hint, originalTerm } = await req.json();
    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'query required' }, { status: 400 });
    }

    // 1. curated override
    const curated = findCurated(originalTerm, hint);
    if (curated) {
      return Response.json({ images: curated.slice(0, 6), source: 'Curated reference set' });
    }

    // 2. Wikimedia Commons search
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrsearch', `${query} filetype:bitmap|drawing`);
    url.searchParams.set('gsrnamespace', '6');
    url.searchParams.set('gsrlimit', '14');
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url|mime|extmetadata');
    url.searchParams.set('iiurlwidth', '500');
    url.searchParams.set('origin', '*');

    const r = await fetch(url.toString(), {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    });

    if (!r.ok) {
      return Response.json({ images: [], source: 'Wikimedia Commons (no results)' });
    }

    const data = await r.json();
    const pages = data?.query?.pages || {};

    const images = Object.values(pages)
      .map((p) => {
        const info = p?.imageinfo?.[0];
        if (!info) return null;
        const mime = info.mime || '';
        if (!mime.startsWith('image/')) return null;
        // Skip SVG-only icons that often render small or odd in clinical context
        // (still allow them, but lower-rank later if we want)
        const thumbUrl = info.thumburl || info.url;
        if (!thumbUrl) return null;
        const title = (p.title || '').replace(/^File:/, '');
        const artistRaw = info.extmetadata?.Artist?.value || '';
        const license = info.extmetadata?.LicenseShortName?.value || '';
        const artist = stripHtml(artistRaw);
        return {
          url: thumbUrl,
          fullUrl: info.url,
          title,
          attribution: [artist, license].filter(Boolean).join(' · ') || 'Wikimedia Commons',
        };
      })
      .filter(Boolean);

    // De-dupe by URL
    const seen = new Set();
    const deduped = [];
    for (const img of images) {
      if (seen.has(img.url)) continue;
      seen.add(img.url);
      deduped.push(img);
      if (deduped.length >= 6) break;
    }

    return Response.json({
      images: deduped,
      source: 'Wikimedia Commons',
    });
  } catch (e) {
    console.error(e);
    return Response.json({ images: [], source: 'error' }, { status: 200 });
  }
}

function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
