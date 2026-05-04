// Google Image Search via direct page scrape — bypasses Custom Search API.
//
// Why this exists: the official Custom Search JSON API hit a stubborn
// account-level 403 we couldn't resolve. This module fetches google.com
// image-search HTML directly and pulls thumbnail URLs out of the embedded
// JSON. Same shape as the other sources so the route doesn't care.
//
// Two known risks:
//   1. Google changes the HTML format every few months. When they do, the
//      regex below stops matching and rows go quietly empty. Watch for that.
//   2. Vercel Edge runs on Cloudflare IPs that Google may flag faster than
//      a residential IP. Local dev is the cleanest test environment.
//
// If results dry up, three things to check in order:
//   a) Run a search locally — does it work outside Vercel?
//   b) Inspect the raw HTML response (logged on error) — has Google's format
//      changed?
//   c) Has the User-Agent gone stale? Bump to current Chrome version.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function searchGoogleScrape(query, limit = 10) {
  const url = new URL('https://www.google.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('tbm', 'isch'); // image search
  url.searchParams.set('safe', 'off');
  url.searchParams.set('hl', 'en');

  let html;
  try {
    const r = await fetch(url.toString(), {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity', // skip compression — Edge fetch decoding is fragile
      },
    });
    if (!r.ok) {
      console.warn('google scrape: HTTP', r.status);
      return [];
    }
    html = await r.text();
  } catch (e) {
    console.warn('google scrape: fetch error', e?.message);
    return [];
  }

  // Detect captcha / sorry page early.
  if (/sorry\/?index|unusual traffic from your computer/i.test(html)) {
    console.warn('google scrape: served captcha (likely IP-flagged); skipping');
    return [];
  }

  // Parse: Google's image-search HTML embeds image data in script tags.
  // The most stable pattern is the per-image array shape:
  //   ["<full image URL>", <height>, <width>]
  // followed somewhere by a thumbnail (gstatic.com/images?q=tbn:...).
  // We extract both and pair them up by document order.

  const fullUrlPattern = /\["(https?:\/\/[^"]+?\.(?:jpe?g|png|gif|webp|svg))",(\d{2,5}),(\d{2,5})\]/gi;
  const thumbPattern = /"(https:\/\/encrypted-tbn0\.gstatic\.com\/images\?q=tbn:[^"]+)"/g;
  const sourcePagePattern = /\["(https?:\/\/[^"]+?)",\["[^"]+?",\d+,\d+\],\d+\]/g;

  const fulls = [];
  let m;
  while ((m = fullUrlPattern.exec(html)) && fulls.length < limit * 4) {
    if (m[1].includes('gstatic.com') || m[1].includes('google.com/logos')) continue;
    fulls.push(m[1]);
  }

  const thumbs = [];
  while ((m = thumbPattern.exec(html)) && thumbs.length < limit * 4) {
    thumbs.push(m[1]);
  }

  if (thumbs.length === 0 && fulls.length === 0) {
    console.warn('google scrape: no images extracted from HTML — format may have changed');
    return [];
  }

  // Pair: prefer thumb-as-display, full-as-fullUrl. If counts mismatch,
  // align as best we can.
  const out = [];
  const pairCount = Math.min(thumbs.length, Math.max(fulls.length, thumbs.length), limit);
  for (let i = 0; i < pairCount; i++) {
    const thumb = thumbs[i];
    const full = fulls[i] || thumb;
    if (!thumb) continue;
    const titleGuess = decodeURIComponent(query);
    const isDrawing =
      /\.svg($|\?)/i.test(full) ||
      /diagram|illustration|drawing|figure|schematic/i.test(titleGuess);
    out.push({
      url: thumb,
      fullUrl: full,
      title: titleGuess,
      attribution: 'Google Images',
      sourceName: 'Google',
      isDrawing,
    });
  }
  return out.slice(0, limit);
}
