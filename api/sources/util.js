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
  category = "Event",
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
    category: decodeEntities(category),
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
