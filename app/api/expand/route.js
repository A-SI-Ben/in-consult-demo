// /api/expand — uses Claude Haiku to fan a clinician's term out into 4-5
// categorised sub-queries that map onto the visual rows on the page.

export const runtime = 'edge';

const SYSTEM = `You are an assistant inside a tool called In-Consult, used by GPs and physiotherapists in the consult room to show visual references to a patient.

Given a clinical term the clinician typed, return 4-5 categorised sub-queries that would each surface useful patient-facing visual content. Each category should map onto a different *kind* of view a clinician might point to when explaining the diagnosis.

Use these category labels where they apply (omit ones that don't fit, add others if a condition genuinely needs them):
- "Diagrams" — labelled medical illustrations
- "Anatomy" — relevant anatomy of the affected area
- "What it looks like" — clinical photographs (skin conditions, visible signs)
- "Treatment" — treatment approaches, devices, interventions
- "Self-care & exercises" — stretches, home management (musculoskeletal especially)
- "Patient explanation" — plain-English overview imagery

For each category, write a short search query phrased to retrieve good clean medical imagery (e.g. "inguinal hernia anatomy diagram", not just "diagram").

Return STRICT JSON in this exact shape, no commentary, no markdown fences:
{"categories":[{"label":"Diagrams","query":"<query>"},{"label":"Anatomy","query":"<query>"}, ...]}

Pick 4-5 categories total. Order them in the order a clinician would naturally walk a patient through them (usually: what is it / where is it → what it looks like → treatment / self-care).`;

export async function POST(req) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'query required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Graceful fallback so the demo still runs without a key configured.
      return Response.json({ categories: fallbackExpansion(query) });
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Clinician typed: "${query}"` }],
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error('Anthropic error', r.status, t);
      return Response.json({ categories: fallbackExpansion(query) });
    }

    const data = await r.json();
    const text = data?.content?.[0]?.text || '';
    const parsed = safeParse(text);
    if (!parsed?.categories?.length) {
      return Response.json({ categories: fallbackExpansion(query) });
    }
    return Response.json({ categories: parsed.categories });
  } catch (e) {
    console.error(e);
    return Response.json({ categories: fallbackExpansion('condition') });
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    // try to find the first {...} block
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { return null; }
    }
    return null;
  }
}

function fallbackExpansion(q) {
  const term = q.toLowerCase();
  return [
    { label: 'Diagrams',         query: `${term} medical diagram` },
    { label: 'Anatomy',          query: `${term} anatomy` },
    { label: 'What it looks like', query: `${term} clinical` },
    { label: 'Treatment',        query: `${term} treatment` },
    { label: 'Patient explanation', query: `${term} explanation` },
  ];
}
