// Openverse — aggregator across Wikimedia, Flickr CC, museum collections, etc.
// Public API, no key required for demo volumes. Already filters to permissive
// licences, and exposes a `mature=false` flag we set defensively.

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
      const creator = item.creator || '';
      const sourceLabel = item.source || 'Openverse';
      const title = item.title || '';
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
