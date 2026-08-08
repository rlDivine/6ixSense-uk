// Shared test utilities. Nothing here touches the network.

// Rough bounding box for the United Kingdom. Every coordinate the app ships
// (region centres, curated venues, football grounds) has to sit inside it.
export const UK_BOX = { minLat: 49.8, maxLat: 61.0, minLng: -8.7, maxLng: 1.9 };

export function inUkBox(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= UK_BOX.minLat &&
    lat <= UK_BOX.maxLat &&
    lng >= UK_BOX.minLng &&
    lng <= UK_BOX.maxLng
  );
}

// An independent great-circle distance, written with the spherical law of
// cosines rather than the haversine the source uses. Agreeing to a few metres
// via a different formula is a real cross-check; re-implementing haversine
// would only prove the test copied the source.
export function greatCircleKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const p1 = rad(lat1);
  const p2 = rad(lat2);
  const dl = rad(lng2 - lng1);
  const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return R * Math.acos(Math.min(1, Math.max(-1, c)));
}

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const LONDON_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour12: false,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/// Break an instant into Europe/London wall-clock fields. weekday is 0=Sun.
export function londonParts(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = Object.fromEntries(LONDON_FMT.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    weekday: WEEKDAY_INDEX[p.weekday],
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    // en-GB renders midnight as "24" in some ICU builds, so fold it back to 0.
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
    date: `${p.year}-${p.month}-${p.day}`,
  };
}

/// The instant of 12:00 Europe/London on the given calendar date. Probing the
/// offset at an approximate guess is safe because no UK transition happens
/// anywhere near midday.
export function londonNoon(year, month, day) {
  const guess = Date.UTC(year, month - 1, day, 12, 0, 0);
  const probe = londonParts(guess);
  const drift = (probe.hour - 12) * 60 + probe.minute;
  return new Date(guess - drift * 60000);
}

/// Minimal stand-in for a fetch Response. Only the members the sources touch.
export function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

/// Replace globalThis.fetch for the duration of `run`, then always put the real
/// one back. `handler(url, opts, index)` returns the response for each call;
/// `run(calls)` receives the growing list of {url, opts} so a test can assert
/// on the request the source built.
export async function withStubbedFetch(handler, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    const href = typeof url === "string" ? url : String(url);
    calls.push({ url: href, opts });
    const out = await handler(href, opts, calls.length - 1);
    return out === undefined ? jsonResponse({}) : out;
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

/// Run `run` with globalThis.fetch replaced by a landmine, so a source that is
/// supposed to short-circuit fails loudly instead of silently going online.
export async function withForbiddenFetch(run) {
  return withStubbedFetch(
    (url) => {
      throw new Error(`unexpected network call to ${url}`);
    },
    run
  );
}

/// Set (or delete, with undefined) environment variables around `run`.
export async function withEnv(vars, run) {
  const saved = new Map();
  for (const [key, value] of Object.entries(vars)) {
    saved.set(key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/// Query parameters of a URL as a plain object.
export function paramsOf(url) {
  return Object.fromEntries(new URL(url).searchParams.entries());
}
