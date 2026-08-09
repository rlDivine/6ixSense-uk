// PredictHQ, an events intelligence API covering concerts, festivals,
// performing arts, expos, community events and sport worldwide, filtered here
// to the categories that read as "something to go to" and pinned to GB.
//
// Free key: https://control.predicthq.com/ (sign up, then Access Tokens in
// the Control Center). Despite the env var name below it is not sent as a
// query parameter the way Ticketmaster and Skiddle take theirs: PredictHQ
// authenticates every request with `Authorization: Bearer <token>`.
// Set it via the PREDICTHQ_API_KEY environment variable. Without one this
// source returns nothing and the app falls back to the others.
//
// Two real gaps, not oversights:
//   - No url. PredictHQ is a demand-intelligence feed, not a ticketing one, so
//     there is nothing to link out to. makeEvent's safeUrl() turns the empty
//     string into "", and both clients already hide the "Get tickets" action
//     rather than show a dead link when url is blank.
//   - No image. The category wash and glyph carry the card exactly as they do
//     for any other listing with a missing or failed photo.
// What it does carry that most sources here do not is a real description for
// some categories (expos, festivals, community), which is worth more for this
// source than for the others precisely because there is no link to fall back
// on, so it is threaded through to makeEvent's `description`.
import { makeEvent, fetchWithTimeout } from "./util.js";

const LONDON = { lat: 51.5074, lng: -0.1278 };

// PredictHQ's own category slugs, restricted to the ones a "what's on"
// audience would actually want. Left out on purpose: conferences (b2b),
// academic, politics, observances, public-holidays, school-holidays,
// severe-weather, disasters, terror, health-warnings, airport-delays and
// daylight-savings are demand signals for forecasting, not things to attend.
const CATEGORIES = ["concerts", "festivals", "performing-arts", "community", "expos", "sports"];

// Onto the vocabulary the rest of the app already shares.
const CATEGORY_BY_SLUG = {
  concerts: "Music",
  festivals: "Festivals",
  "performing-arts": "Theatre",
  sports: "Sport",
  // Trade shows, comic conventions, home and garden shows: too varied to sit
  // under "Museums", which the rest of the app reserves for actual heritage
  // and exhibition venues.
  expos: "Things to do",
  // Farmers markets, fun runs, fetes: genuinely "things to do", not noise.
  // PredictHQ's own significance score (`rank`) is deliberately not used to
  // filter these out. It is tuned for forecasting global demand, not for
  // judging whether a small local listing is worth showing, and this app
  // exists to surface exactly the small local listings the ticketing sources
  // miss. If community turns out to be too noisy in practice, a `rank.gte`
  // floor on that one category is the first knob to reach for.
  community: "Things to do",
};

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

export async function fetchPredictHQ({ lat = LONDON.lat, lng = LONDON.lng, radiusKm = 50 } = {}) {
  const key = process.env.PREDICTHQ_API_KEY;
  if (!key) return [];

  const now = new Date();
  const params = new URLSearchParams({
    // "{radius}{unit}@{lat},{lon}", PredictHQ's own format for a point search.
    within: `${Math.max(1, Math.round(radiusKm))}km@${lat},${lng}`,
    country: "GB",
    category: CATEGORIES.join(","),
    // "Active" means the search window overlaps the event's own start/end,
    // which is the right definition for "what's on" rather than "what was
    // announced". Same 60 day horizon as the other date-windowed sources.
    "active.gte": ymd(now),
    "active.lte": ymd(new Date(now.getTime() + 60 * 86400000)),
    limit: "100",
    sort: "start",
  });

  const res = await fetchWithTimeout(
    `https://api.predicthq.com/v1/events/?${params}`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${key}` } },
    15000
  );
  if (!res.ok) throw new Error(`PredictHQ ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];

  return results.map((e) => {
    const entities = Array.isArray(e.entities) ? e.entities : [];
    const venue =
      entities.find((x) => x.type === "venue") ||
      entities.find((x) => x.type === "place") ||
      entities[0];

    // GeoJSON order: [longitude, latitude], the reverse of every other source
    // here and of what makeEvent expects.
    const [lng2, lat2] = Array.isArray(e.location) ? e.location : [null, null];

    return makeEvent({
      id: `phq-${e.id}`,
      title: e.title,
      category: CATEGORY_BY_SLUG[e.category] || "Things to do",
      start: e.start || null,
      venue: venue?.name || "",
      address: venue?.formatted_address || "",
      lat: typeof lat2 === "number" ? lat2 : null,
      lng: typeof lng2 === "number" ? lng2 : null,
      source: "PredictHQ",
      description: e.description || "",
      // No url, no image, no price: PredictHQ does not carry any of the
      // three. Leaving them unset is makeEvent's own default for each.
    });
  });
}
