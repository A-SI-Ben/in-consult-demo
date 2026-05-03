// NLM Open-i (National Library of Medicine) — figures from open-access PMC
// articles. Medical-tuned, public, no key. Image URLs come back as paths and
// must be prefixed with the openi.nlm.nih.gov host.
//
// API ref: https://openi.nlm.nih.gov/services
// Field names are defensive — the response shape has shifted historically.

const HOST = 'https://openi.nlm.nih.gov';

export async function searchOpenI(query, limit = 8) {
  const url = new URL('https://openi.nlm.nih.gov/api/search');
  url.searchParams.set('query', query);
  url.searchParams.set('m', '1');
  url.searchParams.set('n', String(limit));

  const r = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });
  if (!r.ok) return [];

  const data = await r.json();
  const list = data?.list || [];

  return list
    .map((item) => {
      const thumbPath = item.imgThumb || item.imgGrid150 || item.imgLarge;
      const fullPath = item.imgLarge || item.imgThumb;
      if (!thumbPath) return null;
      const thumb = abs(thumbPath);
      const full = abs(fullPath || thumbPath);
      const title = item.image?.caption || item.title || '';
      const journal = item.Journal || '';
      // Open-i imgClass: 'g' graphic, 'p' photograph, 'c' clinical
      const isDrawing =
        item.imgClass === 'g' ||
        /diagram|illustration|figure|schematic/i.test(title);
      return {
        url: thumb,
        fullUrl: full,
        title,
        attribution: ['NLM Open-i', journal, 'PMC'].filter(Boolean).join(' · '),
        sourceName: 'NLM Open-i',
        isDrawing,
      };
    })
    .filter(Boolean);
}

function abs(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return HOST + (path.startsWith('/') ? path : `/${path}`);
}
