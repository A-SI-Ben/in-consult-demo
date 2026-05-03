# In-Consult Demo — Claude Code Briefing

A throwaway demo deployed to show GPs what In-Consult could feel like. Not a real product. Built fast, deliberately narrow.

## The product idea (1-paragraph version)

GPs currently turn the monitor around mid-consult to show patients raw Google for things like "hernia" — gore, ads, irrelevant images, looks unprofessional for a top-dollar service. In-Consult replaces that moment with a clean branded chat-style search that fans the term out into categorised image rows (diagrams, anatomy, what it looks like, treatment, self-care). All curated, no clutter, no ads. Full context: `../idea-exploration.md` and `../landscape.md` in the parent folder.

## What this demo does

1. GP types a diagnosis into a single search bar.
2. `/api/expand` calls Claude Haiku, which returns 4–5 categorised sub-queries (e.g. "hernia" → `[{Diagrams, "inguinal hernia anatomy diagram"}, {Anatomy, "groin anatomy"}, {What it looks like, "inguinal hernia clinical photograph"}, {Treatment, "hernia mesh repair"}]`).
3. For each sub-query, `/api/images` queries Wikimedia Commons MediaSearch and returns 5–6 image-only thumbnails with attribution.
4. Each row renders as a horizontal grid of clickable image tiles. Click → lightbox.
5. **Out of scope for this demo:** the patient takeaway artefact (parked for v2 — to be mentioned verbally to the GP).

## Stack

- **Next.js 14** App Router, plain JavaScript (no TypeScript by choice — fast iteration).
- **Edge runtime** for both API routes (cold starts ~200ms vs ~2s for node).
- **No database, no auth, no state.** Everything is request/response.
- **Anthropic Claude Haiku** for query expansion. Model: `claude-haiku-4-5-20251001`. Costs fractions of a cent per search.
- **Wikimedia Commons** for images via their public API. No key, no rate limit hassle for demo volumes. Polite User-Agent set.

## File map

```
demo/
├── app/
│   ├── page.jsx              UI: search bar, category rows, lightbox. ~200 lines, all the visible logic.
│   ├── layout.jsx            Root layout, metadata.
│   ├── globals.css           ALL styling. Edit colours + type here. CSS vars at the top.
│   └── api/
│       ├── expand/route.js   POST /api/expand → Claude call. SYSTEM prompt is the lever for category quality.
│       └── images/route.js   POST /api/images → Wikimedia Commons search + curated override.
├── lib/
│   └── curated.js            Hand-picked image overrides per condition + category. Currently empty stubs.
├── package.json
├── next.config.mjs
├── README.md                 Deploy walkthrough for humans.
└── CLAUDE.md                 This file.
```

## Run locally

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Opens at http://localhost:3000.

## Deployed at

- **GitHub:** https://github.com/A-SI-Ben/in-consult-demo
- **Vercel project:** in-consult-demo (Ben to confirm exact URL)
- **Push to main → Vercel auto-deploys.** No manual deploy step needed.
- **Env var:** `ANTHROPIC_API_KEY` set in Vercel project settings.
- **Vercel Framework Preset:** Next.js. Root Directory: `demo` (because the repo has files nested in a `demo/` subfolder — historical accident from initial git setup, not worth fixing).

## Iteration levers (in order of impact)

### 1. The Claude system prompt — biggest single lever for demo quality

Lives in `app/api/expand/route.js` as the `SYSTEM` constant. Controls:
- Which categories get returned for a given condition.
- The phrasing of each sub-query (which directly affects Wikipedia image quality).
- Ordering of categories.

To experiment: edit, `npm run dev`, run a few searches, observe. The fallback `fallbackExpansion()` function at the bottom of the same file is what runs if no API key is set.

### 2. Curated image overrides — bulletproofing the demo five

`lib/curated.js`. Five conditions stubbed: hernia, eczema, plantar fasciitis, sprained ankle, lower back pain. Each is an empty object — fill in like:

```js
hernia: {
  'Diagrams': [
    { url: 'https://upload.wikimedia.org/.../inguinal-hernia-diagram.png',
      attribution: 'Wikimedia Commons · CC-BY-SA' },
    // ...5 more
  ],
  'Anatomy': [ /* ... */ ],
}
```

The lookup matches the condition keyword as a substring of the original term, AND the category label (which Claude returns) must match exactly. So the curated category labels need to align with what Claude is currently returning.

When to curate: when Wikipedia returns weak/empty results for a condition+category that the GP demo will hit. Run the demo, identify weak rows, paste hand-picked URLs in.

### 3. Visual polish

- Brand colour: `--accent` and `--accent-deep` in `app/globals.css`.
- Wordmark: top-left of `app/page.jsx` — `<div className="brand-mark">iC</div>`. Replace with SVG if Ben provides one.
- Empty state copy: the `<div className="empty">` block in `page.jsx`.
- Example chips: `EXAMPLES` array at the top of `page.jsx`.
- Search bar shape, header, footer caveat — all in `page.jsx` and `globals.css`.

### 4. Speed

Cold starts on Vercel free tier are ~1–2s for the first search after a quiet period. Subsequent searches are ~500ms (Claude expansion) + parallel image fetches.

If this becomes a problem: pre-warm the function with a Vercel cron, or move expansion to a static-friendly cache for the prepared 5 conditions.

## Known weaknesses going in

- **Wikipedia image quality is uneven.** Strong for anatomy and diagrams, weaker for clinical photos and treatment depictions. This is the #1 thing to watch when reviewing.
- **No takeaway artefact yet.** Mention it verbally during the GP demo: "after this we'd add a 'send to patient' button that emails them a clean branded summary."
- **No analytics.** No idea what queries the GP runs unless they tell us. If we want this signal, add a lightweight log to a Vercel KV or just `console.log` and tail Vercel function logs.
- **No mobile-specific work beyond responsive CSS.** Should work on a phone but hasn't been hammered on one.
- **Initial smoke test was code-only.** Live API responses (Anthropic + Wikimedia) were not verified before first deploy — the deploy itself was the first end-to-end test.

## What 'good' looks like for the GP demo

- Searches feel instant.
- Each category row has 5–6 clean, professional, on-topic images.
- No gore, no ads, no irrelevant logos/icons in image results.
- The brand reads as a real medical tool — not a hobby project, not Google in disguise.
- The GP's first reaction is "show me how it handles X" (engagement) rather than "what is this exactly?" (confusion).

## Parent project context

- `../raw-brief.md` — Ben's original verbatim idea description.
- `../idea-exploration.md` — full structured exploration: gap, beliefs, who pays, where-first.
- `../landscape.md` — competitive landscape (3D anatomy tools, NZ EHRs, AI scribes, Physitrack).

These exist for context. Not required reading to iterate on the demo, but useful when deciding what to add or cut.

## Conventions

- Plain JS, no TypeScript.
- No CSS framework — just `globals.css` with CSS variables.
- API routes use Edge runtime — no Node-only APIs.
- `'use client'` only on `app/page.jsx`. Layouts and routes are server.
- Branch model: just `main`. No PRs, no review — it's a demo.
