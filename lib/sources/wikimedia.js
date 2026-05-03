// Wikimedia Commons MediaSearch — broad, public, no key.
// Returns normalised {url, fullUrl, title, attribution, sourceName, isDrawing}.

const UA = 'In-Consult-Demo/0.1 (https://github.com/; demo build)';

export async function searchWikimedia(query, limit = 14) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', `${query} filetype:bitmap|drawing`);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', String(limit));
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|mime|extmetadata');
  url.searchParams.set('iiurlwidth', '500');
  url.searchParams.set('origin', '*');

  const r = await fetch(url.toString(), {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!r.ok) return [];

  const data = await r.json();
  const pages = data?.query?.pages || {};

  return Object.values(pages)
    .map((p) => {
      const info = p?.imageinfo?.[0];
      if (!info) return null;
      const mime = info.mime || '';
      if (!mime.startsWith('image/')) return null;
      const thumbUrl = info.thumburl || info.url;
      if (!thumbUrl) return null;
      const title = (p.title || '').replace(/^File:/, '');
      const artistRaw = info.extmetadata?.Artist?.value || '';
      const license = info.extmetadata?.LicenseShortName?.value || '';
      const artist = stripHtml(artistRaw);
      const isDrawing =
        mime === 'image/svg+xml' ||
        /diagram|illustration|drawing|figure|schematic/i.test(title);
      return {
        url: thumbUrl,
        fullUrl: info.url,
        title,
        attribution: [artist, license].filter(Boolean).join(' · ') || 'Wikimedia Commons',
        sourceName: 'Wikimedia Commons',
        isDrawing,
      };
    })
    .filter(Boolean);
}

function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
