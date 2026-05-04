// In-Consult — single source of truth for search behaviour.
//
// Editing this file changes results across the app deterministically.
// Both the client (page.jsx, for instant skeleton rendering) and the
// server (api/images/route.js, for the actual queries) read from here.
//
// Final query for any row =
//   `<originalTerm> <category.queryModifier> <activeModifiers.queryAppend...> <UNIVERSAL_APPEND>`
//
// To add a new row:        add an entry to CATEGORIES
// To add a new modifier:   add an entry to MODIFIERS + handle it in the route
// To tighten what's shown: edit ALWAYS_EXCLUDE / PG_EXTRA_EXCLUDE
//
// Test live by appending ?debug=1 to the deployed URL.

// ---- Category rows ---------------------------------------------------------
//
// queryModifier MUST be a single word. Wikimedia, Openverse, and Open-i are
// free-text search engines — adding multiple modifier words tightens the AND
// scoring and collapses results to zero (verified empirically). One word is
// enough to bias the row; the per-row prefersDrawings flag handles fine
// ordering after fetch.

export const CATEGORIES = [
  {
    label: 'Diagram/Schematic',
    queryModifier: 'illustration',
    prefersDrawings: true,
  },
  {
    label: 'Overview/Image',
    queryModifier: 'appearance',
    prefersDrawings: false,
  },
];

// ---- Universal query append ------------------------------------------------

// Empty by default. We tried "medical" as a bias word and it backfired —
// stock photo sites (iStock, Adobe Stock, Dreamstime, Vecteezy, Getty)
// aggressively tag content as "medical", so the bias pulled them up and
// pushed specialty clinical sites (wikidoc, sportsmedreview) down. The
// stock-photo domain filter in lib/sources/brave.js does the work better.
export const UNIVERSAL_APPEND = '';

// ---- Top-level modifiers ---------------------------------------------------
//
// PG and Visibility intentionally have empty queryAppend. Stacking modifier
// words (e.g. "greenstick fracture diagram pediatric simple") collapses
// Wikimedia from 8 results to 1 and Openverse to 0 — the search APIs penalise
// tail words heavily. So PG does its work via the post-fetch PG_EXTRA_EXCLUDE
// regex below, and Visibility does its work via UI mode + forceDrawings sort.
// Other still passes user text through to the query — that's user-controlled.

export const MODIFIERS = {
  pg: {
    label: 'PG',
    hint: 'child-safe',
    queryAppend: '',
    forceDrawings: true,
  },
  visibility: {
    label: 'Visibility',
    hint: 'larger, fewer, accessible',
    queryAppend: '',
    forceDrawings: true,
    visibilityMode: true, // fewer + larger tiles, contain-fit
  },
  other: {
    label: 'Other',
    hint: '',
    // queryAppend filled in at runtime from the user-typed text field
    forceDrawings: false,
  },
};

// ---- Universal exclude regex -----------------------------------------------

// Applied to every search regardless of mode. Things no clinician's tool
// should ever surface. Tested against (image title + attribution).
export const ALWAYS_EXCLUDE = new RegExp(
  [
    // death / forensic
    'autops(y|ies)', 'cadaver(ic)?', 'post.?mortem', 'mortuary', 'morgue',
    'necrops(y|ies)', 'embalm(ed|ing)?', 'exhum(ed|ation)', 'death.?mask',
    // decomposition
    'putref(y|ied|action)', 'decompos(ed|ing|ition)', 'charred',
    // museum / forensic specimens
    'museum.?specimen', 'formalin.?fixed',
    'gross.?(specimen|lesion|pathology|appearance|examination)',
    // extreme trauma
    'dismember(ed|ment)', 'decapitat(ed|ion)', 'mutilat(ed|ion)',
    'evisceration', 'eviscerated', 'degloving', 'degloved',
    // gore tags + explicit
    'gore', 'gory', 'graphic\\s+(content|image)', 'disturbing',
    'NSFW', 'NSFL', 'viewer.?discretion', 'content.?warning', 'sensitive.?content',
    'R[-.]?18', 'X[-.]?rated', 'pornograph', 'erotic',
  ].join('|'),
  'i'
);

// ---- PG-mode extra exclude regex -------------------------------------------

// Added on top of ALWAYS_EXCLUDE when the PG checkbox is on. Covers content
// that's clinically legitimate for adults but inappropriate for child viewing.
export const PG_EXTRA_EXCLUDE = new RegExp(
  [
    // visible blood / surgical / wound
    'wound', 'bleeding', 'blood', 'surgical', 'lesion', 'ulcer', 'infected',
    'eschar', 'suppurating', 'purulent', '\\bpus\\b',
    'amputat(ed|ion)', 'severed', 'traumatic.?amputation',
    // tissue states
    'necrotic', 'necrosis', 'gangrene', 'gangrenous',
    'maggot', 'infestation',
    // dissection / cross-section
    'dissection', 'cross.?section',
    // trauma
    'gunshot.?wound', '\\bGSW\\b', 'stab.?wound', 'blast.?injury', 'ballistic',
    'crush.?injury',
    // sensitive
    'stillborn', 'fatal(ity|ities)?', 'deceased',
  ].join('|'),
  'i'
);
