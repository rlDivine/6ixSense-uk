// Shared helpers for event sources.

// Decode HTML entities (numeric + a few common named) found in feed titles.
export function decodeEntities(s) {
  if (!s) return s;
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/// Keep a link only if it is an absolute http(s) URL, otherwise drop it.
///
/// Every url and image in the feed comes from a third party, and one of them
/// (Eventbrite) is a page anyone can publish to. A "javascript:" link reaching
/// a client is script execution in the app's own origin the moment a user taps
/// the primary action, so the scheme is checked here, at the point the event is
/// built, rather than trusted and escaped later. Escaping does not help: it
/// stops an attribute being broken out of, not a scheme being chosen.
///
/// Note that entities are decoded before this runs on titles, but url and image
/// are deliberately not decoded, so "&#106;avascript:" cannot slip past by
/// being un-escaped downstream.
export function safeUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return ""; // relative or unparseable, and we have no base to resolve against
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : "";
}

// The category vocabulary, which is also the design's colour table.
//
// Sources each speak their own dialect: Ticketmaster returns its raw segment
// names, Skiddle returns four letter event codes, Eventbrite returns the name
// of the vertical the listing was scraped from. Left alone they produce three
// spellings of the same idea ("Festival", "Festivals", "FEST"), which shows up
// as duplicate filter chips and as events falling through to the grey fallback
// colour. Everything is folded to this list once, here, so the chip row and the
// palette are the same twelve things.
//
// Anything genuinely uncategorised stays "Things to do", which is a real
// bucket rather than a failure: it is what the generic Eventbrite feed and
// Skiddle's community listings are.
const CATEGORY_ALIASES = new Map(Object.entries({
  // Music
  music: "Music", "live music": "Live music", gig: "Music", gigs: "Music",
  concert: "Music", concerts: "Music",
  // Club nights are their own thing in British listings, not a subset of music.
  club: "Clubs", clubs: "Clubs", clubbing: "Clubs", "club night": "Clubs",
  nightlife: "Clubs",
  festival: "Festivals", festivals: "Festivals",
  comedy: "Comedy",
  // Football is the biggest single category in the feed and has its own colour,
  // so it is kept apart from sport in general.
  football: "Football", soccer: "Football",
  sport: "Sport", sports: "Sport", "sports & fitness": "Sport",
  market: "Markets", markets: "Markets", "pop-up": "Markets", "pop up": "Markets",
  museum: "Museums", museums: "Museums", exhibition: "Museums",
  exhibitions: "Museums", heritage: "Museums", tours: "Museums", tour: "Museums",
  // Outdoors is the sixth of the client's colour families, and before this it
  // was the only one nothing could reach: every walk and open-air listing fell
  // through to "Things to do" and rendered in the neutral fallback. British
  // listings put a lot in here, especially in summer.
  outdoor: "Outdoors", outdoors: "Outdoors", walk: "Outdoors", walks: "Outdoors",
  hike: "Outdoors", hiking: "Outdoors", garden: "Outdoors", gardens: "Outdoors",
  park: "Outdoors", parks: "Outdoors", "open air": "Outdoors",
  "open-air": "Outdoors", nature: "Outdoors", wildlife: "Outdoors",
  swim: "Outdoors", swimming: "Outdoors", cycling: "Outdoors",
  theatre: "Theatre", theater: "Theatre", arts: "Theatre",
  "arts & theatre": "Theatre", "performing arts": "Theatre",
  film: "Film", "film & media": "Film", cinema: "Film",
  food: "Food", "food & drink": "Food", "food and drink": "Food", drink: "Food",
  // Eventbrite's food vertical crossed with its format filters, which is how
  // food festivals and food expos arrive now that those pages are scraped too.
  "food festival": "Food", "food & drink festival": "Food", "food expo": "Food",
  family: "Family", kids: "Family", "family & education": "Family",
  // A boot sale is a market to anyone browsing, so it folds onto the bucket
  // that already has a colour and a glyph rather than minting a new one.
  "car boot": "Markets", "car boot sale": "Markets", "boot sale": "Markets",
  "boot fair": "Markets", "flea market": "Markets", "jumble sale": "Markets",
  "farmers market": "Markets",
  "things to do": "Things to do", miscellaneous: "Things to do", other: "Things to do",
}));

// Titles that mean more than the shelf a listing was found on.
//
// A source's category is only ever the name of that shelf. Eventbrite returns
// "Food & Drink" for a car boot someone listed under food and "Festivals" for a
// beer festival; Skiddle calls both of those FEST; PredictHQ files farmers
// markets and village fetes under "community", which drops them all into the
// generic bucket. In every one of those cases the title says plainly what the
// thing is and the category does not.
//
// So these run after the source's own wording and beat it, but only for phrases
// that admit no second reading. Deliberately absent: bare "festival", "market"
// and "food", each of which turns up in the name of plenty of events that are
// none of the three.
//
// Order matters: a "car boot and food fair" is a car boot.
const TITLE_RULES = [
  [/\bcar[\s-]?boot\b|\bboot\s?(?:sale|fair)\b|\bjumble\s+sale\b|\bflea\s+market\b|\bbric[\s-]?a[\s-]?brac\b|\btable[\s-]?top\s+sale\b/i, "Markets"],
  [/\bfarmers?['’`]?\s+market\b|\bproduce\s+market\b/i, "Markets"],
  [
    // Food and drink festivals, named by the drink as often as by the food.
    // The festival word has to be adjacent: "beer festival" is one of these,
    // "beer at the festival" is not.
    /\b(?:food|street[\s-]?food|beer|ale|cider|gin|wine|whisky|whiskey|rum|coffee|cheese|chilli|chocolate|seafood|curry|vegan|bbq|barbecue)\s*(?:&|and)?\s*(?:drink\s+)?(?:festival|fest|fayre|fair|expo)\b/i,
    "Food",
  ],
  [/\bfood\s*(?:&|and)\s*drink\b|\bstreet\s+food\b/i, "Food"],
];

/// The category a title asserts outright, or null when it asserts nothing.
export function categoryFromTitle(title) {
  const t = String(title || "");
  if (!t) return null;
  for (const [pattern, category] of TITLE_RULES) {
    if (pattern.test(t)) return category;
  }
  return null;
}

/// Fold a source's own wording onto the shared vocabulary above.
export function canonicalCategory(raw) {
  const key = String(raw || "").trim().toLowerCase();
  if (!key) return "Things to do";
  const hit = CATEGORY_ALIASES.get(key);
  if (hit) return hit;
  // Trailing "s" is the single most common difference between two sources
  // naming the same thing, so try it before giving up.
  const singular = key.endsWith("s") ? key.slice(0, -1) : `${key}s`;
  return CATEGORY_ALIASES.get(singular) || "Things to do";
}

// Haversine distance in kilometres between two lat/lng points.
export function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => typeof v !== "number" || Number.isNaN(v))) {
    return null;
  }
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Build a normalized event object. Missing fields are tolerated.
export function makeEvent({
  id,
  title,
  category = "Things to do",
  start = null, // ISO string or null
  venue = "",
  address = "",
  lat = null,
  lng = null,
  url = "",
  image = "",
  source = "",
  price = "",
  // Most sources give the client nothing to say beyond the fields above, and
  // the client already falls back to "tap Get tickets" when this is blank.
  // PredictHQ is the first source that sometimes has real prose (for expos,
  // festivals and community listings), and it is also the source most likely
  // to have no ticket link at all, so a real description is worth carrying.
  description = "",
  // True when lat/lng is a stand-in rather than the venue's own position,
  // which in practice means the centre of the town. Those coordinates are good
  // enough to put a pin on a map and not good enough to measure a distance
  // from, and the difference matters: the app's primary sort is distance, so
  // an event carrying a made up one does not merely display a wrong number, it
  // wins a ranking it has no claim to. Declared here so the shape of an event
  // says out loud that the coordinates can be a guess.
  approx = false,
}) {
  const cleanTitle = decodeEntities((title || "Untitled event").trim());
  return {
    id: String(id),
    title: cleanTitle,
    // The title wins when it names the thing outright, because a source's own
    // category is only ever the shelf the listing sat on. See TITLE_RULES.
    category: categoryFromTitle(cleanTitle) || canonicalCategory(decodeEntities(category)),
    start, // ISO 8601 or null if unknown
    venue: decodeEntities(venue),
    address: decodeEntities(address),
    lat: typeof lat === "number" ? lat : lat ? Number(lat) : null,
    lng: typeof lng === "number" ? lng : lng ? Number(lng) : null,
    url: safeUrl(url),
    image: safeUrl(image),
    source,
    price,
    description: decodeEntities(description).trim(),
    approx: Boolean(approx),
  };
}

// fetch with a timeout so a slow source can't hang the whole request.
export async function fetchWithTimeout(url, opts = {}, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
