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

export const CATEGORIES = [
  {
    label: 'Diagram/Schematic',
    queryModifier: 'illustration drawing schematic',
    prefersDrawings: true,
  },
  {
    label: 'Overview/Image',
    queryModifier: 'clinical overview image',
    prefersDrawings: false,
  },
  {
    label: 'Treatment',
    queryModifier: 'treatment',
    prefersDrawings: false,
  },
];

// ---- Universal query append ------------------------------------------------

// Appended to every search regardless of modifiers. One-word bias toward
// clinical content. Avoid stuffing more here — extra words can degrade
// relevance scoring on free-text image search APIs.
export const UNIVERSAL_APPEND = 'medical';

// ---- Top-level modifiers ---------------------------------------------------

export const MODIFIERS = {
  pg: {
    label: 'PG',
    hint: 'child-safe',
    queryAppend: 'pediatric educational',
    forceDrawings: true,
  },
  visibility: {
    label: 'Visibility',
    hint: 'larger, fewer, accessible',
    queryAppend: 'simple labelled clear',
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
