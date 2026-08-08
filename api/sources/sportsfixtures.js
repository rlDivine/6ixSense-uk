// Upcoming football fixtures from TheSportsDB.
//
// Football is the single biggest "what's on" category in Britain and the one
// the ticketing sources cover worst, because most clubs sell through their own
// box office rather than through Ticketmaster. This fills that gap.
//
// Free API key (instant signup): https://www.thesportsdb.com/api.php
// Set it via the THESPORTSDB_KEY environment variable. Without a key this
// source returns nothing and the app falls back to the others.
//
// The one awkward part: TheSportsDB names the ground but does not give its
// coordinates on the free tier. A fixture without coordinates would sort to
// the bottom of "Nearest" and never appear on the map, which for a distance
// ranked app is worse than not showing it. So grounds are resolved through the
// table below, and a fixture at a ground we cannot place is skipped rather
// than shown badly.
import { makeEvent, fetchWithTimeout, distanceKm } from "./util.js";

// League ids are TheSportsDB's own. Add to this list to widen coverage; each
// one costs a single request, and they run concurrently.
const LEAGUES = [
  { id: "4328", label: "Premier League" },
  { id: "4329", label: "Championship" },
  { id: "4396", label: "League One" },
  { id: "4397", label: "League Two" },
  { id: "4330", label: "Scottish Premiership" },
];

// Grounds, keyed by a normalised venue name. Coordinates are to roughly the
// nearest 10 metres, which is far more precision than a map pin needs.
//
// Matching is deliberately loose (see `groundFor`) because the feed spells the
// same ground several ways: "Old Trafford", "Old Trafford Stadium", and so on.
const GROUNDS = {
  // England, top flight and the larger clubs below it
  "emirates stadium": [51.5549, -0.1084],
  "villa park": [52.5092, -1.8848],
  "vitality stadium": [50.7352, -1.8384],
  "gtech community stadium": [51.4907, -0.2887],
  "amex stadium": [50.8616, -0.0837],
  "falmer stadium": [50.8616, -0.0837],
  "stamford bridge": [51.4817, -0.191],
  "selhurst park": [51.3983, -0.0855],
  "craven cottage": [51.4749, -0.2217],
  "anfield": [53.4308, -2.9608],
  "goodison park": [53.4388, -2.9663],
  "etihad stadium": [53.4831, -2.2004],
  "old trafford": [53.4631, -2.2913],
  "st james' park": [54.9756, -1.6217],
  "st james park": [54.9756, -1.6217],
  "city ground": [52.94, -1.1329],
  "tottenham hotspur stadium": [51.6043, -0.0665],
  "london stadium": [51.5387, -0.0166],
  "molineux": [52.5903, -2.1303],
  "elland road": [53.7778, -1.5722],
  "st mary's stadium": [50.9058, -1.3911],
  "king power stadium": [52.6204, -1.1422],
  "stadium of light": [54.9145, -1.3882],
  "turf moor": [53.789, -2.2303],
  "bramall lane": [53.3703, -1.4709],
  "hillsborough": [53.4114, -1.5008],
  "the hawthorns": [52.5091, -1.9639],
  "carrow road": [52.6222, 1.3092],
  "pride park": [52.915, -1.447],
  "riverside stadium": [54.5783, -1.217],
  "bet365 stadium": [52.9884, -2.1756],
  "ashton gate": [51.44, -2.6203],
  "portman road": [52.0551, 1.1449],
  "kenilworth road": [51.8842, -0.4317],
  "deepdale": [53.7722, -2.6881],
  "the den": [51.4861, -0.0507],
  "loftus road": [51.5093, -0.2321],
  "coventry building society arena": [52.4481, -1.4956],
  "vicarage road": [51.6499, -0.4015],
  "oakwell": [53.5522, -1.4677],
  "home park": [50.3881, -4.1508],
  "wembley stadium": [51.556, -0.2795],

  // Wales
  "cardiff city stadium": [51.4728, -3.2031],
  "swansea.com stadium": [51.6428, -3.9348],
  "rodney parade": [51.5875, -2.9899],
  "stok cae ras": [53.0509, -2.9946],

  // Scotland
  "celtic park": [55.8497, -4.2055],
  "ibrox stadium": [55.8531, -4.3092],
  "hampden park": [55.8258, -4.2522],
  "tynecastle park": [55.9392, -3.2306],
  "easter road": [55.9617, -3.1656],
  "pittodrie stadium": [57.1592, -2.0889],
  "dens park": [56.475, -2.9711],
  "tannadice park": [56.475, -2.9686],
  "mcdiarmid park": [56.4114, -3.4756],
  "fir park": [55.7797, -3.9931],
  "rugby park": [55.6039, -4.5081],

  // Northern Ireland
  "windsor park": [54.5847, -5.955],
};

/// Punctuation and spacing only. Deliberately does NOT strip words like "park"
/// or "stadium": those are what distinguish Fir Park from Firhill, and Home
/// Park from anywhere else beginning "home".
function normalise(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[\u2019`]/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The table is written the way the grounds are spelled, so some keys carry
// punctuation ("Swansea.com Stadium"). Normalise both sides once at load, or
// an exact lookup can never hit those entries.
const NORMALISED_GROUNDS = new Map(
  Object.entries(GROUNDS).map(([name, coords]) => [normalise(name), coords])
);

// Words that appear in dozens of ground names and so identify nothing on their
// own. A candidate match has to share at least one word outside this set,
// otherwise "Stadium" would resolve to the Emirates and "Community Stadium" to
// the Gtech.
const GENERIC_WORDS = new Set([
  "stadium", "park", "ground", "arena", "the", "community", "city", "town",
  "road", "lane", "street", "field", "centre", "center", "sports", "football",
  "club", "county", "new", "old", "north", "south", "east", "west", "united",
]);

/// Resolve a ground name to coordinates, tolerating the ways the feed dresses
/// up the same place ("Old Trafford", "Old Trafford Stadium"). Returns null
/// when we have no entry, which is the signal to drop the fixture.
///
/// Matching is exact first, then whole-word containment in either direction.
/// Containment needs the shorter name to be a run of complete words, so
/// "Firhill" cannot match "Fir Park" and "Homebase" cannot match "Home Park".
export function groundFor(venue) {
  const v = normalise(venue);
  if (!v) return null;
  const exact = NORMALISED_GROUNDS.get(v);
  if (exact) return exact;

  const words = v.split(" ");
  for (const [key, coords] of NORMALISED_GROUNDS) {
    const kw = key.split(" ");
    if (containsRun(words, kw) || containsRun(kw, words)) return coords;
  }
  return null;
}

/// True when `needle` appears in `haystack` as a consecutive run of whole
/// words, and carries at least one word that identifies a specific ground. The
/// second condition is what stops "Stadium" or "Community Stadium" standing in
/// for a real name, and a single-word needle still has to be a long one so
/// "Park" cannot match half the country either.
function containsRun(haystack, needle) {
  if (!needle.length || needle.length > haystack.length) return false;
  if (!needle.some((w) => !GENERIC_WORDS.has(w))) return false;
  if (needle.length === 1 && needle[0].length < 7) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let hit = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { hit = false; break; }
    }
    if (hit) return true;
  }
  return false;
}

async function fetchLeague(key, league) {
  const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key)}/eventsnextleague.php?id=${league.id}`;
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 12000);
  if (!res.ok) throw new Error(`TheSportsDB ${league.label} ${res.status}`);
  const data = await res.json();
  // The API answers with { events: null } rather than an empty list when a
  // league has nothing scheduled, typically over the summer.
  return Array.isArray(data?.events) ? data.events : [];
}

export async function fetchSportsFixtures({ lat, lng, radiusKm = 50 } = {}) {
  const key = process.env.THESPORTSDB_KEY;
  if (!key) return [];

  const settled = await Promise.allSettled(LEAGUES.map((l) => fetchLeague(key, l)));
  const fixtures = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  const out = [];
  for (const f of fixtures) {
    const coords = groundFor(f.strVenue);
    if (!coords) continue; // no position, so it would sort and map badly

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const d = distanceKm(lat, lng, coords[0], coords[1]);
      if (d == null || d > radiusKm) continue;
    }

    // strTimestamp is a full UTC instant. The date and time pair is UK local
    // and carries no offset, which the clients already handle.
    const start =
      f.strTimestamp || (f.dateEvent ? `${f.dateEvent}T${f.strTime || "15:00:00"}` : null);

    out.push(
      makeEvent({
        id: `sdb-${f.idEvent}`,
        title: f.strEvent || `${f.strHomeTeam} v ${f.strAwayTeam}`,
        category: "Sports",
        start,
        venue: f.strVenue || "",
        address: f.strVenue || "",
        lat: coords[0],
        lng: coords[1],
        // No ticket link on the free tier, so point at the club's own listing
        // on TheSportsDB rather than inventing a box office URL.
        url: f.idEvent ? `https://www.thesportsdb.com/event/${f.idEvent}` : "",
        image: f.strThumb || f.strPoster || "",
        source: "Football fixtures",
        price: "",
      })
    );
  }
  return out;
}
