// /api/expand — uses Claude Haiku to fan a clinician's term out into exactly
// three categorised sub-queries that map onto the three visual rows on the page.

export const runtime = 'edge';

const SYSTEM = `You are an assistant inside a tool called In-Consult, used by GPs and physiotherapists in the consult room to show visual references to a patient.

Given a clinical term the clinician typed, return EXACTLY THREE categorised sub-queries. The three categories are fixed and must be returned in this order:

1. "Diagram / schematic" — labelled medical illustration or schematic of the condition or affected anatomy.
2. "Overview / image" — a clear overview image of what the condition looks like in real life (clinical photograph, presentation, or representative real-world image).
3. "Treatment" — treatment approaches, devices, interventions, or recovery imagery.

For each category, write a short search query phrased to retrieve good clean medical imagery (e.g. "inguinal hernia labelled diagram", not just "diagram"). The query should bake in the condition name plus a category-appropriate qualifier.

Return STRICT JSON in this exact shape, no commentary, no markdown fences, exactly three items in this order:
{"categories":[{"label":"Diagram / schematic","query":"<query>"},{"label":"Overview / image","query":"<query>"},{"label":"Treatment","query":"<query>"}]}`;

export async function POST(req) {
  try {
    const { query, modifiers } = await req.json();
    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'query required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Graceful fallback so the demo still runs without a key configured.
      return Response.json({ categories: fallbackExpansion(query) });
    }

    const guidance = buildModifierGuidance(modifiers);
    const userContent = guidance
      ? `Clinician typed: "${query}"\n\n${guidance}`
      : `Clinician typed: "${query}"`;

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
        messages: [{ role: 'user', content: userContent }],
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

function buildModifierGuidance(modifiers) {
  if (!modifiers || typeof modifiers !== 'object') return '';
  const parts = [];
  if (modifiers.parental) {
    parts.push(
      'Parental mode: the patient is a child or a child is in the room. Favour clean labelled illustrations and gentle imagery. For the "Overview / image" row, prefer cartoon, illustrated, or stylised images over clinical photos of distressing visible signs (skin lesions, surgical sites, blood).'
    );
  }
  if (modifiers.visibility) {
    parts.push(
      'Visibility mode: the viewer has restricted vision or accessibility needs. Prefer simple, high-contrast labelled diagrams over dense clinical photos. Phrase queries to surface clear illustrations. Fewer, clearer rows is better than many.'
    );
  }
  const other = typeof modifiers.other === 'string' ? modifiers.other.trim() : '';
  if (other) {
    parts.push(`Additional clinician note: ${other}`);
  }
  if (!parts.length) return '';
  return `Constraints to apply:\n- ${parts.join('\n- ')}`;
}

function fallbackExpansion(q) {
  const term = q.toLowerCase();
  return [
    { label: 'Diagram / schematic', query: `${term} labelled diagram` },
    { label: 'Overview / image',    query: `${term} clinical presentation` },
    { label: 'Treatment',           query: `${term} treatment` },
  ];
}
