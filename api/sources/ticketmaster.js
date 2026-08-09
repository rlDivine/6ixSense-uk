// Ticketmaster Discovery API source: concerts, shows, festivals, sport.
// Free API key (instant signup): https://developer.ticketmaster.com/
// Set it via the TM_API_KEY environment variable. Without a key this source
// returns nothing and the app falls back to the other (no-key) sources.
import { makeEvent, fetchWithTimeout } from "./util.js";

const LONDON = { lat: 51.5074, lng: -0.1278 };

export async function fetchTicketmaster({ lat = LONDON.lat, lng = LONDON.lng, radiusKm = 50 } = {}) {
  const key = process.env.TM_API_KEY;
  if (!key) return [];

  const startDateTime = new Date().toISOString().split(".")[0] + "Z";
  const params = new URLSearchParams({
    apikey: key,
    latlong: `${lat},${lng}`,
    radius: String(Math.round(radiusKm)),
    unit: "km",
    // Pulse is a UK product. Pinning the country stops a radius search from the
    // Kent coast or Northern Ireland pulling in French or Irish listings the
    // app has no business showing.
    countryCode: "GB",
    sort: "date,asc",
    startDateTime,
    size: "100",
    locale: "*",
  });
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Ticketmaster ${res.status}`);
  const data = await res.json();
  const events = data?._embedded?.events || [];

  return events.map((e) => {
    const venue = e?._embedded?.venues?.[0];
    const loc = venue?.location;
    const seg = e?.classifications?.[0]?.segment?.name;
    const start =
      e?.dates?.start?.dateTime ||
      (e?.dates?.start?.localDate
        ? `${e.dates.start.localDate}T${e?.dates?.start?.localTime || "19:00:00"}`
        : null);
    const priceRange = e?.priceRanges?.[0];
    return makeEvent({
      id: `tm-${e.id}`,
      title: e.name,
      category: seg || "Things to do",
      start,
      venue: venue?.name || "",
      address: [venue?.address?.line1, venue?.city?.name].filter(Boolean).join(", "),
      lat: loc?.latitude ? Number(loc.latitude) : null,
      lng: loc?.longitude ? Number(loc.longitude) : null,
      url: e.url || "",
      image: (e.images || []).sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || "",
      source: "Ticketmaster",
      price: formatPrice(priceRange),
    });
  });
}

// Ticketmaster GB quotes in pounds, so render "£12-£30" rather than bolting a
// dollar sign onto a sterling figure. A non-GBP range (rare, but possible on a
// cross-border listing) keeps its ISO code so nothing is mislabelled.
function formatPrice(range) {
  if (!range) return "";
  const min = round(range.min);
  const max = round(range.max);
  const same = min === max;
  if (range.currency === "GBP" || !range.currency) {
    return same ? `£${min}` : `£${min}-£${max}`;
  }
  return same ? `${min} ${range.currency}` : `${min}-${max} ${range.currency}`;
}

function round(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
