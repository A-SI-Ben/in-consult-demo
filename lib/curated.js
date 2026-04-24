// Curated overrides for the 5 prepared demo conditions.
//
// Each entry: condition keyword (lowercase) → array of {label, query, images}
// where images is an array of {url, attribution}.
//
// Lookup is fuzzy on the condition keyword. If the clinician's original term
// contains the keyword, AND the category label matches, we serve the curated
// images instead of hitting Wikipedia.
//
// Empty arrays mean "fall through to Wikipedia" — fill these in after the first
// smoke test if Wikipedia returns weak imagery for any condition + category.

export const CURATED = {
  hernia: {
    // 'Diagrams': [{ url: 'https://...', attribution: 'Source — License' }],
  },
  eczema: {},
  'plantar fasciitis': {},
  'sprained ankle': {},
  'lower back pain': {},
};

export function findCurated(originalTerm, categoryLabel) {
  if (!originalTerm) return null;
  const t = originalTerm.toLowerCase();
  for (const [condition, cats] of Object.entries(CURATED)) {
    if (t.includes(condition)) {
      const imgs = cats[categoryLabel];
      if (Array.isArray(imgs) && imgs.length > 0) {
        return imgs;
      }
    }
  }
  return null;
}
