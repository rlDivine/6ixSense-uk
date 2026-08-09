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
  theatre: "Theatre", theater: "Theatre", arts: "Theatre",
  "arts & theatre": "Theatre", "performing arts": "Theatre",
  film: "Film", "film & media": "Film", cinema: "Film",
  food: "Food", "food & drink": "Food", "food and drink": "Food", drink: "Food",
  family: "Family", kids: "Family", "family & education": "Family",
  "things to do": "Things to do", miscellaneous: "Things to do", other: "Things to do",
}));

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
}) {
  return {
    id: String(id),
    title: decodeEntities((title || "Untitled event").trim()),
    category: canonicalCategory(decodeEntities(category)),
    start, // ISO 8601 or null if unknown
    venue: decodeEntities(venue),
    address: decodeEntities(address),
    lat: typeof lat === "number" ? lat : lat ? Number(lat) : null,
    lng: typeof lng === "number" ? lng : lng ? Number(lng) : null,
    url: safeUrl(url),
    image: safeUrl(image),
    source,
    price,
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
