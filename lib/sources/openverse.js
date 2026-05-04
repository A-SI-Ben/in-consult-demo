// Openverse — aggregator across Wikimedia, Flickr CC, museum collections, etc.
// Public API, no key required for demo volumes. Already filters to permissive
// licences, and exposes a `mature=false` flag we set defensively.
//
// Note: Openverse titles for Wikimedia-sourced items often arrive as raw HTML
// containing multilingual `<div style='display: none;'>` label blocks. We
// strip the HTML and decode common entities before exposing the title.

export async function searchOpenverse(query, limit = 10) {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q', query);
  url.searchParams.set('page_size', String(limit));
  url.searchParams.set('mature', 'false');

  const r = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });
  if (!r.ok) return [];

  const data = await r.json();
  const results = data?.results || [];

  return results
    .map((item) => {
      const thumb = item.thumbnail || item.url;
      if (!thumb) return null;
      const license = [item.license, item.license_version].filter(Boolean).join(' ').toUpperCase();
      const creator = stripHtml(item.creator || '');
      const sourceLabel = item.source || 'Openverse';
      const title = cleanTitle(item.title || '');
      const fileUrl = item.url || '';
      const isDrawing =
        /diagram|illustration|drawing|figure|schematic/i.test(title) ||
        /\.svg($|\?)/i.test(fileUrl);
      return {
        url: thumb,
        fullUrl: fileUrl || thumb,
        title,
        attribution: [creator, license, sourceLabel].filter(Boolean).join(' · '),
        sourceName: 'Openverse',
        isDrawing,
      };
    })
    .filter(Boolean);
}

function cleanTitle(raw) {
  // Drop hidden multilingual label blocks Openverse inherits from Wikimedia.
  let s = String(raw).replace(/<div style='display:\s*none;[^>]*>[\s\S]*?<\/div>/gi, ' ');
  s = stripHtml(s);
  s = decodeEntities(s);
  // Collapse whitespace and trim, then cap length so the lightbox doesn't blow up.
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > 140) s = s.slice(0, 137) + '…';
  return s;
}

function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, ' ');
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
