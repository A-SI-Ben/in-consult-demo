// Brave Search API — image search.
//
// Free tier ~2000 queries/month, $5 per 1000 beyond. Setup at
// https://api.search.brave.com/.
//
// API ref: https://api.search.brave.com/app/documentation/image-search/get-started
// Endpoint: GET https://api.search.brave.com/res/v1/images/search
// Auth:     X-Subscription-Token header (NOT a query param)
//
// Required env var: BRAVE_API_KEY
//
// Stock-photo domain filter: results from these domains get dropped before
// they reach the user. Stock photo sites tag content aggressively as "medical"
// and out-rank specialty clinical sites in Brave's index. Filtering them out
// surfaces real medical content (wikidoc.org, healthcentral.com, mayoclinic,
// nih.gov, etc.) instead of generic licensed imagery.

// Brand names (no TLD) so we catch gettyimages.com AND gettyimages.in AND
// de.gettyimages.com etc.
const STOCK_PHOTO_BRANDS = [
  'vecteezy',
  'gettyimages',
  'shutterstock',
  'istockphoto',
  'adobestock',
  'dreamstime',
  'vectorstock',
  'alamy',
  'depositphotos',
  '123rf',
  'canstockphoto',
  'fotolia',
  'bigstockphoto',
  'pixabay',
  'freepik',
];

function isStockPhotoDomain(host) {
  if (!host) return false;
  const h = host.toLowerCase().replace(/^www\./, '');
  return STOCK_PHOTO_BRANDS.some((brand) =>
    h === brand ||
    h.startsWith(brand + '.') ||
    h.endsWith('.' + brand) ||
    h.includes('.' + brand + '.')
  );
}

export async function searchBrave(query, limit = 10) {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    console.warn('brave source skipped: missing BRAVE_API_KEY');
    return [];
  }

  const url = new URL('https://api.search.brave.com/res/v1/images/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.min(Math.max(limit, 1), 100)));
  url.searchParams.set('safesearch', 'off');
  url.searchParams.set('search_lang', 'en');
  url.searchParams.set('country', 'NZ');

  let r;
  try {
    r = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });
  } catch (e) {
    console.warn('brave: fetch error', e?.message);
    return [];
  }
  if (!r.ok) {
    const t = await r.text();
    console.warn('brave: HTTP', r.status, t.slice(0, 200));
    return [];
  }

  let data;
  try {
    data = await r.json();
  } catch {
    console.warn('brave: JSON parse failed');
    return [];
  }
  const results = data?.results || [];

  return results
    .map((item) => {
      const thumb = item.thumbnail?.src || item.properties?.url;
      const fileUrl = item.properties?.url || thumb;
      const sourcePage = item.url || fileUrl;
      if (!thumb) return null;

      // Drop stock-photo domains — they out-rank specialty clinical sites in
      // Brave's index and hurt clinical relevance.
      let host = '';
      try { host = new URL(sourcePage).hostname; } catch { /* skip parse */ }
      if (isStockPhotoDomain(host)) return null;

      const title = item.title || '';
      const sourceLabel =
        item.source ||
        (host ? host.replace(/^www\./, '') : 'Brave');
      const isDrawing =
        /\.svg($|\?)/i.test(fileUrl) ||
        /diagram|illustration|drawing|figure|schematic/i.test(title);
      return {
        url: thumb,
        fullUrl: sourcePage, // open the source page on click-through
        title,
        attribution: sourceLabel,
        sourceName: 'Brave',
        isDrawing,
      };
    })
    .filter(Boolean);
}
