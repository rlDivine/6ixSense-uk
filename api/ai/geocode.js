// Turning "the Boating Pool in Ramsgate" into a coordinate, or into nothing.
//
// Distance is this app's entire premise. Every feed is sorted by how far away
// a thing is, every radius filter is a distance test, and the map is nothing
// else. An event that cannot be placed cannot be sorted, filtered or drawn, so
// a discovered event that will not geocode is an event that does not ship.
//
// That makes this a gate rather than a best-effort enricher, and the two are
// written very differently. A best-effort geocoder is judged on how many
// questions it answers; this one is judged on the questions it refuses. The
// refusals are the feature.
//
// Why there is no API key to gate on, unlike every other networked source
// here. postcodes.io is free, keyless, UK-only and ONS-derived, which is four
// separate reasons rather than one. Rejected:
//   - Nominatim. The usage policy caps it at a request a second and asks for a
//     contact header, which is workable, but it is a WORLDWIDE geocoder, and a
//     worldwide geocoder asked for "Newport" has half a dozen correct answers
//     and no way to know that this app only ever means a British one.
//   - Google or Mapbox geocoding. A key, a bill, and licence terms that
//     restrict storing the coordinate you were given -- which is precisely what
//     the pipeline in AI-DISCOVERY.md does, since the whole point is that the
//     worker geocodes once and the request path only reads.
//   - Asking the language model for the coordinate. It will always answer, it
//     will answer to four decimal places, and roughly nothing about the way it
//     answers tells you which of those answers it made up.
//
// The two things this will use, in order: a postcode in the text, then a
// gazetteer of specifically named venues. And the one thing it will never use:
// the centre of the town the text came from. A town-centre pin does not look
// like a guess in the app -- it is drawn as a dot on the map and labelled
// "1.2 km", exactly like a coordinate that is right -- so nobody doubts it and
// somebody drives to it. A dropped event is a gap in a feed that already has
// gaps. A misplaced one is a person standing in the wrong car park at the time
// the thing was meant to start. The gap is much the cheaper mistake.
import { distanceKm, fetchWithTimeout } from "../sources/util.js";

const POSTCODES_IO = "https://api.postcodes.io";

// Shorter than the 9 second default in util.js. This runs inside a batch job
// that geocodes a page's worth of extractions one after another, so a slow
// lookup costs the whole pass, and postcodes.io answers in tens of
// milliseconds when it is answering at all.
const TIMEOUT_MS = 6000;

// The same bounding box test/helpers.js checks every shipped coordinate
// against, restated here because a guard that lives in the test directory is a
// guard that does not run in production.
const UK_BOX = { minLat: 49.8, maxLat: 61.0, minLng: -8.7, maxLng: 1.9 };

// What a caller is told when there is no coordinate. Short fixed phrases
// rather than sentences built around the input: these end up in a moderation
// queue and in logs, where they want to be groupable, and the input they would
// quote is untrusted text from somebody else's web page.
const REASON = {
  noText: "no place text",
  noMatch: "no postcode or known venue",
  notFound: "postcode not found",
  lookupFailed: "lookup failed",
  outsideUk: "outside the United Kingdom",
  outsideRegion: "too far from the region",
  ambiguous: "ambiguous place name",
};

// A full postcode anywhere in the text.
//
// The inward code's two letters are restricted to Royal Mail's alphabet, which
// excludes C, I, K, M, O and V. That is not pedantry: without it "meet at A2
// 5pm" parses as the postcode A2 5PM, and "doors 7am" is one comma away from
// the same trick. The excluded letters kill both, at no cost to any postcode
// that really exists.
const FULL_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[ABD-HJLNP-UW-Z]{2})\b/i;

// An outward code on its own, once the text has been split into words.
const OUTCODE_WORD = /^[A-Z]{1,2}\d[A-Z\d]?$/i;

// Words that mean the token after them is a road, not a postal district.
//
// "M25", "B12" and "A20" are all valid-looking outward codes and all far more
// likely to be a motorway or an A road in a sentence about how to reach an
// event. There is no lexical difference between the M25 and the M25 postal
// district in Manchester -- they are the same three characters -- so the only
// thing left to read is the words either side, and in British prose a road
// takes "the" and a postcode does not.
const ROAD_BEFORE = new Set(["the", "off", "onto", "along", "via", "junction", "jct", "exit"]);
const ROAD_AFTER = new Set(["junction", "jct", "motorway", "exit", "roundabout", "corridor"]);

// Named places, for the text that carries no postcode at all -- which is most
// of it, because a Facebook post says "down the boating pool" and a council
// what's-on page says "Turner Contemporary".
//
// Seeded for the Thanet pilot AI-DISCOVERY.md picks, plus the handful of
// neighbours a Thanet feed's radius reaches. It is a table for the same reason
// carboots.js is a table: the alternative is geocoding the same twelve names
// on every pass of the worker, against a service that will answer differently
// on a bad day.
//
// Coordinates are the ONS centroid of the venue's own postcode, taken from the
// same postcodes.io data this module queries at runtime, so the table and the
// live lookup cannot quietly disagree about where a place is. Where a place
// has no postcode of its own -- a beach, a harbour -- it is the public access
// point, because that is where somebody arriving would stand. `town` is
// carried so the tests can check every row landed in the town it names.
//
// The naming rule, which is the whole reason this is trustworthy:
//
//   `names` are phrases that name ONE place in the United Kingdom and could
//   not be read as anything else. "Turner Contemporary", "Viking Bay",
//   "Dreamland".
//
//   `qualified` are phrases that name a KIND of place, and count only when the
//   town is also somewhere in the text. "Winter Gardens" is Margate's, and
//   Blackpool's, and Eastbourne's. "Main Sands" is Margate's and Ramsgate's,
//   and they are three miles apart. "Botany Bay" is in Broadstairs, in Enfield
//   and in Sydney.
//
// Nothing generic is ever a name on its own, which is what makes "the beach"
// and "the park" resolve to nothing at all rather than to whichever beach this
// table happens to list first.
const GAZETTEER = [
  {
    name: "Ramsgate Boating Pool",
    town: "Ramsgate",
    lat: 51.3278,
    lng: 1.4030, // CT11 0HE, Royal Esplanade
    names: ["Ramsgate Boating Pool", "Boating Pool Ramsgate"],
    // The plan's own example is "The Boating Pool in Ramsgate", where the two
    // halves are three words apart, so the contiguous phrase never matches and
    // the qualifier is doing all the work.
    qualified: [{ phrase: "boating pool", towns: ["Ramsgate", "Thanet"] }],
  },
  {
    name: "Ramsgate Main Sands",
    town: "Ramsgate",
    lat: 51.3300,
    lng: 1.4210,
    names: ["Ramsgate Main Sands", "Ramsgate Sands"],
    qualified: [{ phrase: "main sands", towns: ["Ramsgate"] }],
  },
  {
    name: "Ramsgate Royal Harbour",
    town: "Ramsgate",
    lat: 51.3265,
    lng: 1.4190,
    names: ["Ramsgate Royal Harbour", "Royal Harbour Ramsgate", "Ramsgate Harbour"],
    qualified: [{ phrase: "royal harbour", towns: ["Ramsgate", "Thanet"] }],
  },
  {
    name: "Margate Main Sands",
    town: "Margate",
    lat: 51.3880,
    lng: 1.3830,
    names: ["Margate Main Sands", "Margate Sands"],
    qualified: [{ phrase: "main sands", towns: ["Margate"] }],
  },
  {
    name: "Dreamland Margate",
    town: "Margate",
    lat: 51.3866,
    lng: 1.3777, // CT9 1XJ, Marine Terrace
    names: ["Dreamland"],
  },
  {
    name: "Turner Contemporary",
    town: "Margate",
    lat: 51.3913,
    lng: 1.3822, // CT9 1HG, Rendezvous
    names: ["Turner Contemporary"],
  },
  {
    name: "Margate Winter Gardens",
    town: "Margate",
    lat: 51.3914,
    lng: 1.3865, // CT9 1HX, Fort Crescent
    names: ["Margate Winter Gardens", "Winter Gardens Margate"],
    qualified: [{ phrase: "winter gardens", towns: ["Margate"] }],
  },
  {
    name: "Broadstairs Viking Bay",
    town: "Broadstairs",
    lat: 51.3602,
    lng: 1.4452, // CT10 1EY, Harbour Street
    names: ["Viking Bay"],
  },
  {
    name: "Botany Bay, Broadstairs",
    town: "Broadstairs",
    lat: 51.3879,
    lng: 1.4359, // CT10 3LG, Kingsgate
    names: ["Botany Bay Broadstairs", "Broadstairs Botany Bay"],
    qualified: [{ phrase: "botany bay", towns: ["Broadstairs", "Kingsgate", "Thanet", "Kent"] }],
  },
  {
    name: "Joss Bay, Broadstairs",
    town: "Broadstairs",
    lat: 51.3817,
    lng: 1.4444, // CT10 3PG
    names: ["Joss Bay"],
  },
  {
    name: "Quex Park",
    town: "Birchington",
    lat: 51.3668,
    lng: 1.3157, // CT7 0BH
    names: ["Quex Park", "Quex House", "Powell-Cotton Museum"],
  },
  {
    name: "Canterbury Cathedral",
    town: "Canterbury",
    lat: 51.2788,
    lng: 1.0835, // CT1 2EH
    names: ["Canterbury Cathedral"],
  },
].map((entry) => ({
  // Normalised once at load rather than on every call, so the table above can
  // be written the way a person would write the name.
  ...entry,
  keys: entry.names.map(normalise),
  qualifiers: (entry.qualified || []).map(({ phrase, towns }) => ({
    phrase: normalise(phrase),
    towns: towns.map(normalise),
  })),
}));

/// Lower case, no punctuation, single spaces. Hyphens and apostrophes become
/// spaces on both sides of the comparison, so "Powell-Cotton" and "Powell
/// Cotton" are the same phrase and neither needs a second table entry.
function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/// Does `phrase` appear in `text` as whole words? Both already normalised.
/// The padding is what stops "park" matching inside "parkway", and what makes
/// the containment one-directional: the text has to contain the table's
/// phrase, never the other way round, so "the park" cannot reach "Quex Park".
function containsPhrase(text, phrase) {
  return phrase.length > 0 && ` ${text} `.includes(` ${phrase} `);
}

/// The gazetteer rows a piece of text names, deduplicated by row.
function gazetteerMatches(text) {
  const hits = [];
  for (const entry of GAZETTEER) {
    const named = entry.keys.some((key) => containsPhrase(text, key));
    const qualified = entry.qualifiers.some(
      ({ phrase, towns }) =>
        containsPhrase(text, phrase) && towns.some((town) => containsPhrase(text, town))
    );
    if (named || qualified) hits.push(entry);
  }
  return hits;
}

/// The first full postcode in the text, in canonical "CT11 9JX" form, or null.
function findPostcode(text) {
  const m = FULL_POSTCODE.exec(String(text || ""));
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : null;
}

/// The first plausible outward code standing on its own, or null.
///
/// Two-character outcodes (M1, B1, L4) are deliberately not accepted. They are
/// real postal districts, but a bare two-character token in a sentence is far
/// more often a motorway, a vitamin or a paper size, and the districts they
/// name are the dense city-centre ones whose centroid is least useful anyway.
/// Consistent with the rest of this module: a signal this weak is worth less
/// than the wrong answers accepting it would produce.
function findOutcode(text) {
  const words = String(text || "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.length < 3 || !OUTCODE_WORD.test(word)) continue;
    if (ROAD_BEFORE.has(words[i - 1]?.toLowerCase())) continue;
    if (ROAD_AFTER.has(words[i + 1]?.toLowerCase())) continue;
    return word.toUpperCase();
  }
  return null;
}

/// A latitude or longitude out of a JSON reply, or NaN.
///
/// Not just Number(): Number(null), Number("") and Number(false) are all 0,
/// and 0, 0 is a coordinate in the Atlantic that passes every finiteness check
/// there is. The UK box would catch it here, but only by accident, and the
/// next caller of this file would not have a UK box. Absent has to mean
/// absent at the point the value is read.
function toCoordinate(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

function placed(lat, lng, precision, matched) {
  return { ok: true, lat, lng, precision, matched, reason: "" };
}

function unplaced(reason, matched = "") {
  return { ok: false, lat: null, lng: null, precision: null, matched, reason };
}

/// Ask postcodes.io about one postcode or outcode.
///
/// Returns {lat, lng, matched} or {reason}. Deliberately no throwing: a
/// geocoder that throws makes every caller write the same try/catch, and the
/// answer they would put in it is the same "no coordinate, here is why" this
/// already returns. The failure is reported, not swallowed -- `reason` says
/// which of the two it was, because a 404 means this postcode is wrong and a
/// timeout means try the same event again tomorrow.
async function lookup(path) {
  let res;
  try {
    res = await fetchWithTimeout(
      `${POSTCODES_IO}${path}`,
      { headers: { Accept: "application/json" } },
      TIMEOUT_MS
    );
  } catch {
    return { reason: REASON.lookupFailed };
  }

  // 404 is postcodes.io's answer for a postcode that does not exist or has
  // been terminated, and it is the only status that says anything about the
  // input rather than about the service.
  if (res.status === 404) return { reason: REASON.notFound };
  if (!res.ok) return { reason: REASON.lookupFailed };

  let body;
  try {
    body = await res.json();
  } catch {
    return { reason: REASON.lookupFailed };
  }

  const result = body?.result;
  const lat = toCoordinate(result?.latitude);
  const lng = toCoordinate(result?.longitude);
  // A 200 carrying no usable coordinate is the service misbehaving, not the
  // postcode being wrong, so it reads as a failed lookup. It does happen: a
  // handful of live postcodes have null coordinates in the ONS data.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { reason: REASON.lookupFailed };

  return { lat, lng, matched: result.postcode || result.outcode || "" };
}

/// Reject a coordinate that cannot be the one we were looking for.
///
/// Both checks are about the same failure, which is a geocoder confidently
/// returning a different place of the same name. The UK box catches the
/// Newport in Rhode Island; the radius catches the Newport in Gwent when the
/// region is the Newport on the Isle of Wight. Neither is paranoia -- they are
/// the documented behaviour of every geocoder that covers more than one
/// country, and this app covers exactly one.
///
/// Applied to gazetteer hits as well as lookups, cheaply and on purpose: a
/// typo in the table above is the one error nothing else here would catch.
function rejectionFor(lat, lng, regionLat, regionLng, maxKm) {
  if (lat < UK_BOX.minLat || lat > UK_BOX.maxLat) return REASON.outsideUk;
  if (lng < UK_BOX.minLng || lng > UK_BOX.maxLng) return REASON.outsideUk;

  if (Number.isFinite(regionLat) && Number.isFinite(regionLng) && Number.isFinite(maxKm)) {
    const away = distanceKm(regionLat, regionLng, lat, lng);
    if (away == null || away > maxKm) return REASON.outsideRegion;
  }
  return null;
}

/// Place a scrap of text, or explain why it cannot be placed.
///
/// Returns { ok, lat, lng, precision, matched, reason }:
///   precision  "postcode" for a full postcode, "outcode" for a postal
///              district centroid, "gazetteer" for a named venue, null when
///              ok is false. A caller that trusts only doorstep accuracy
///              should require "postcode" or "gazetteer" and drop the rest.
///   matched    what was actually recognised -- the canonical postcode, or the
///              venue's name -- so a moderation queue can show its working.
///              Kept on the two rejections that had something to reject.
///   reason     "" when ok, otherwise one short phrase from REASON above.
///
/// Never throws, and makes no network call at all for text with no postcode in
/// it, which is the common case for the gazetteer.
export async function geocodePlace(placeText, { regionLat, regionLng, maxKm = 60 } = {}) {
  const raw = String(placeText ?? "");
  const text = normalise(raw);
  if (!text) return unplaced(REASON.noText);

  const finish = (lat, lng, precision, matched) => {
    const rejection = rejectionFor(lat, lng, regionLat, regionLng, maxKm);
    return rejection ? unplaced(rejection, matched) : placed(lat, lng, precision, matched);
  };

  // A postcode is the strongest thing a piece of text can carry, so it is
  // tried first and its answer is final. Note what does NOT happen when it
  // fails: a full postcode that 404s is not retried as its own outcode. The
  // outcode of a postcode that does not exist is a district somebody typed by
  // accident, and answering with its centroid turns a typo into a pin.
  const postcode = findPostcode(raw);
  const outcode = postcode ? null : findOutcode(raw);

  let failure = "";
  if (postcode || outcode) {
    const path = postcode
      ? `/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ""))}`
      : `/outcodes/${encodeURIComponent(outcode)}`;
    const hit = await lookup(path);
    if (!hit.reason) {
      return finish(hit.lat, hit.lng, postcode ? "postcode" : "outcode", hit.matched || postcode || outcode);
    }
    // Fall through to the gazetteer rather than giving up here. The failure
    // was postcodes.io's, and a text like "Turner Contemporary, Margate CT9
    // 1HG" is still perfectly placeable from a table that is already in
    // memory. This only ever substitutes a specifically named venue, never a
    // town centre, so the rule at the top of the file holds.
    //
    // Note this is reached only when the lookup produced no coordinate. A
    // coordinate that came back and was then rejected as out of region does
    // NOT come here: that is a definite answer that the text means somewhere
    // else, and shopping around for a nearer one is how you end up with the
    // answer you liked rather than the one you were given.
    failure = hit.reason;
  }

  const hits = gazetteerMatches(text);
  // Two different places named in one sentence is not a coordinate. It is
  // usually a listing that mentions where to park, or a trail between two
  // venues, and picking the first or the longest match would be picking at
  // random with a tie-break attached.
  if (hits.length > 1) return unplaced(REASON.ambiguous);
  if (hits.length === 1) return finish(hits[0].lat, hits[0].lng, "gazetteer", hits[0].name);

  return unplaced(failure || REASON.noMatch);
}

// Exported for the tests, which check the table itself rather than only what
// the lookups do with it.
export const __gazetteer = GAZETTEER;
