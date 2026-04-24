# In-Consult Demo

Tiny Next.js app. One page, two serverless functions. Built for showing a GP what the experience could feel like — not a real product.

**Flow:** clinician types a diagnosis → Claude Haiku fans it into 4–5 categorised sub-queries (Diagrams, Anatomy, What it looks like, Treatment, etc.) → each row pulls 5–6 image-only tiles from Wikimedia Commons → clicking a tile opens a clean lightbox.

No Google. No ads. No raw text-and-image search-results page.

---

## Deploy in ~5 minutes (Vercel)

The fastest path to a shareable URL.

1. **Sign in to vercel.com** (free, GitHub or email login).
2. Click **Add New… → Project → Continue with `Other`**, then drag the `demo` folder onto the importer (or push it to a GitHub repo and import that).
3. On the configuration screen, expand **Environment Variables** and add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your Claude API key (starts with `sk-ant-…`)
4. Click **Deploy**. ~60 seconds later you get a URL like `in-consult-demo-xyz.vercel.app`.
5. Send that URL to the GP.

To change the project name (so the URL is friendlier), go into the project → Settings → General → Project Name.

### If you don't have an Anthropic key

The app still runs without one — `/api/expand` falls through to a hardcoded category fan-out. Looks fine, but the GP won't see the LLM's intelligent rephrasing (e.g. "shoulder pain" → "rotator cuff anatomy", "subacromial bursitis"). Strongly recommend a real key for the demo.

Get one at console.anthropic.com → Settings → API Keys. Cost per search is well under a cent on Haiku.

---

## Run locally first

```bash
cd demo
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Open http://localhost:3000.

---

## What's where

```
demo/
├── app/
│   ├── page.jsx           ← the UI (search bar, category rows, lightbox)
│   ├── layout.jsx
│   ├── globals.css        ← all styling, edit colours / type here
│   └── api/
│       ├── expand/route.js   ← Claude call: term → categorised sub-queries
│       └── images/route.js   ← Wikimedia Commons image search per sub-query
├── lib/
│   └── curated.js         ← optional hand-curated overrides per condition
├── package.json
└── next.config.mjs
```

### Tweaking before the GP sees it

- **Brand colour** — `--accent` and `--accent-deep` in `app/globals.css`. Currently a clinical teal.
- **Wordmark** — top-left of `app/page.jsx`, the `brand-mark` div. Replace `iC` with anything (or drop in an SVG).
- **Example chips on the empty state** — the `EXAMPLES` array at the top of `app/page.jsx`.
- **LLM prompt** — `SYSTEM` constant in `app/api/expand/route.js`. Change category labels here if you want different rows.
- **Image quality for a known condition** — open `lib/curated.js`, paste hand-picked image URLs into the matching condition + category. The API serves these instead of Wikipedia for that combo.

---

## What this isn't

- Not medical advice — there's a footer caveat. Demo only.
- Not a content licence model — Wikimedia Commons images are fine to display attributed, but for a real product you'd license a clinical image library or build one.
- Not the takeaway artefact (parked for v2) — for the GP demo, mention verbally: "after this we add a 'send to patient' button that emails them a clean branded summary."

---

## Known caveats

- Wikimedia results vary by query phrasing. If the LLM picks a weak query for a category, that row will look thin. Two fixes: tighten the LLM prompt, or curate that condition+category in `lib/curated.js`.
- First request after a cold deploy can take 2–3s. Subsequent are fast.
- If you want a custom domain (e.g. `inconsult.co.nz`), Vercel → Project → Settings → Domains.
