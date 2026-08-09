// Skiddle, a UK-only listings service covering gigs, club nights, festivals,
// comedy and food events. It is the strongest single addition for this market:
// the coverage is British by design, every result carries coordinates, and
// prices come back in pounds.
//
// Free API key (instant signup): https://www.skiddle.com/api/
// Set it via the SKIDDLE_API_KEY environment variable. Without a key this
// source returns nothing and the app falls back to the others.
//
// API notes that shaped the code below:
//   - the endpoint is /api/v1/events/search/
//   - `radius` is in MILES, not kilometres, which is easy to get wrong given
//     every other source here takes km
//   - `eventcode` is a coarse type (LIVE, CLUB, FEST, DATE, ARTS, KIDS, BARP,
//     EXHB, THTR, SPRT, LGBT, COMM), which maps onto our categories better
//     than the free-text genre list does
//   - `minDate`/`maxDate` are plain YYYY-MM-DD
import { makeEvent, fetchWithTimeout } from "./util.js";

const LONDON = { lat: 51.5074, lng: -0.1278 };
const KM_PER_MILE = 1.609344;

// Skiddle's event codes, mapped onto the category vocabulary the rest of the
// app already uses so the filter chips stay coherent across sources.
const CATEGORY_BY_CODE = {
  LIVE: "Live music",
  CLUB: "Clubs",
  FEST: "Festivals",
  DATE: "Food",
  BARP: "Food",
  ARTS: "Theatre",
  EXHB: "Museums",
  THTR: "Theatre",
  KIDS: "Family",
  SPRT: "Sport",
  COMM: "Things to do",
  LGBT: "Things to do",
};

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

/// Skiddle quotes entry prices as a number of pounds, or 0 for free entry.
/// Anything unparseable is left blank rather than guessed at.
function formatPrice(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "Free";
  return Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
}

/// Prefer the explicit start timestamp, then the date with the door time, then
/// the bare date. Skiddle sends UK local times without an offset, which the
/// clients already know how to read.
function startOf(e) {
  if (e.startdate) return e.startdate;
  if (e.date && e.openingtimes?.doorsopen) return `${e.date}T${e.openingtimes.doorsopen}`;
  if (e.date) return e.date;
  return null;
}

export async function fetchSkiddle({ lat = LONDON.lat, lng = LONDON.lng, radiusKm = 50 } = {}) {
  const key = process.env.SKIDDLE_API_KEY;
  if (!key) return [];

  const now = new Date();
  const params = new URLSearchParams({
    api_key: key,
    latitude: String(lat),
    longitude: String(lng),
    // Skiddle wants miles here. Cap it: the API rejects very large radii, and a
    // wider net than the other sources use would skew the distance sort.
    radius: String(Math.min(30, Math.max(1, Math.round(radiusKm / KM_PER_MILE)))),
    minDate: ymd(now),
    maxDate: ymd(new Date(now.getTime() + 60 * 86400000)),
    order: "date",
    limit: "100",
    description: "1",
  });

  const res = await fetchWithTimeout(
    `https://www.skiddle.com/api/v1/events/search/?${params}`,
    { headers: { Accept: "application/json" } },
    15000
  );
  if (!res.ok) throw new Error(`Skiddle ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];

  return results.map((e) => {
    const v = e.venue || {};
    // Coordinates arrive as strings on the venue object.
    const vlat = v.latitude != null ? Number(v.latitude) : null;
    const vlng = v.longitude != null ? Number(v.longitude) : null;
    return makeEvent({
      id: `sk-${e.id}`,
      title: e.eventname || e.title,
      category: CATEGORY_BY_CODE[e.EventCode || e.eventcode] || "Things to do",
      start: startOf(e),
      venue: v.name || "",
      address: [v.address, v.town, v.postcode].filter(Boolean).join(", "),
      lat: Number.isFinite(vlat) ? vlat : null,
      lng: Number.isFinite(vlng) ? vlng : null,
      url: e.link || "",
      image: e.largeimageurl || e.imageurl || "",
      source: "Skiddle",
      price: formatPrice(e.entryprice),
    });
  });
}
