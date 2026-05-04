// Google Custom Search JSON API — image search across the configured
// Programmable Search Engine (CSE). Free tier is 100 queries/day; cap your
// daily quota in Google Cloud → APIs & Services → Custom Search API → Quotas.
//
// API ref: https://developers.google.com/custom-search/v1/using_rest
//
// Requires two env vars:
//   GOOGLE_API_KEY  — Cloud Console API key with Custom Search API enabled
//   GOOGLE_CSE_ID   — Programmable Search Engine ID (the cx parameter)

export async function searchGoogle(query, limit = 10) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) {
    console.error('google source skipped: missing GOOGLE_API_KEY or GOOGLE_CSE_ID');
    return [];
  }

  const url = new URL('https://customsearch.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cseId);
  url.searchParams.set('q', query);
  url.searchParams.set('searchType', 'image');
  // CSE caps `num` at 10 per request.
  url.searchParams.set('num', String(Math.min(Math.max(limit, 1), 10)));
  // SafeSearch off — clinical content like surgical photos must come through
  // for adult use. The PG modifier's post-fetch exclude regex handles
  // child-safe filtering when needed.
  url.searchParams.set('safe', 'off');

  const r = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });
  if (!r.ok) {
    const t = await r.text();
    console.error('google CSE error', r.status, t);
    return [];
  }

  const data = await r.json();
  const items = data?.items || [];

  return items
    .map((item) => {
      const thumb = item.image?.thumbnailLink || item.link;
      if (!thumb) return null;
      const fileUrl = item.link || thumb;
      const sourcePage = item.image?.contextLink || fileUrl;
      const title = item.title || '';
      const displayLink = item.displayLink || '';
      const isDrawing =
        /diagram|illustration|drawing|figure|schematic/i.test(title) ||
        /\.svg($|\?)/i.test(fileUrl) ||
        item.fileFormat === 'image/svg+xml' ||
        (item.mime || '') === 'image/svg+xml';
      return {
        url: thumb,
        fullUrl: sourcePage, // open the source page on click-through, not the raw image
        title,
        attribution: displayLink || 'Google',
        sourceName: 'Google',
        isDrawing,
      };
    })
    .filter(Boolean);
}
