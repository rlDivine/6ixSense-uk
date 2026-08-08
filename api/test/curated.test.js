import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { fetchCurated } from "../sources/curated.js";
import { greatCircleKm, inUkBox, londonParts } from "./helpers.js";

const DAY_MS = 86400000;
const CURATED_PATH = fileURLToPath(new URL("../sources/curated.js", import.meta.url));

// The VENUES table is module-private, so the expected recurrence day and hour
// are read straight out of the source. Parsing keeps the expectations honest:
// editing the table changes what the tests demand, and a parse that stops
// matching the table trips the guard assertions below.
function readVenueTable() {
  const src = readFileSync(CURATED_PATH, "utf8");
  const from = src.indexOf("const VENUES = [");
  assert.ok(from >= 0, "could not find the VENUES table");
  const to = src.indexOf("\n];", from);
  assert.ok(to > from, "could not find the end of the VENUES table");
  const block = src.slice(from, to);

  const rows = block.match(/^\s*\{ title:.*\},\s*$/gm) || [];
  return rows.map((row) => {
    const pick = (field, pattern) => {
      const m = row.match(pattern);
      assert.ok(m, `could not read ${field} from: ${row.trim()}`);
      return m[1];
    };
    return {
      title: pick("title", /title:\s*"([^"]*)"/),
      category: pick("category", /category:\s*"([^"]*)"/),
      venue: pick("venue", /venue:\s*"([^"]*)"/),
      address: pick("address", /address:\s*"([^"]*)"/),
      lat: Number(pick("lat", /lat:\s*(-?[\d.]+)/)),
      lng: Number(pick("lng", /lng:\s*(-?[\d.]+)/)),
      day: Number(pick("day", /day:\s*(\d)/)),
      hour: Number(pick("hour", /hour:\s*(\d+)/)),
    };
  });
}

const VENUES = readVenueTable();

test("the venue table parsed cleanly and matches an unfiltered fetch", () => {
  assert.ok(VENUES.length >= 30, `only parsed ${VENUES.length} venues`);
  assert.equal(fetchCurated().length, VENUES.length);
  for (const v of VENUES) {
    assert.ok(v.day >= 0 && v.day <= 6, `${v.venue}: day ${v.day} out of range`);
    assert.ok(v.hour >= 0 && v.hour <= 23, `${v.venue}: hour ${v.hour} out of range`);
  }
});

test("fetchCurated with no arguments returns every venue", () => {
  const events = fetchCurated();
  assert.equal(events.length, VENUES.length);
  const venues = new Set(events.map((e) => e.venue));
  for (const v of VENUES) assert.ok(venues.has(v.venue), `${v.venue} missing from the full set`);
});

test("fetchCurated ignores a half-supplied coordinate and returns everything", () => {
  assert.equal(fetchCurated({ lat: 51.5074 }).length, VENUES.length);
  assert.equal(fetchCurated({ lng: -0.1278 }).length, VENUES.length);
  assert.equal(fetchCurated({ lat: null, lng: null }).length, VENUES.length);
});

test("fetchCurated returns exactly the venues inside the radius", () => {
  const origins = [
    ["London", 51.5074, -0.1278],
    ["Manchester", 53.4808, -2.2426],
    ["Cardiff", 51.4816, -3.1791],
    ["Edinburgh", 55.9533, -3.1883],
    ["Belfast", 54.5973, -5.9301],
    ["Truro", 50.2632, -5.051],
  ];
  for (const [label, lat, lng] of origins) {
    for (const radiusKm of [5, 25, 50, 120]) {
      const expected = VENUES.filter((v) => greatCircleKm(lat, lng, v.lat, v.lng) <= radiusKm)
        .map((v) => v.venue)
        .sort();
      const got = fetchCurated({ lat, lng, radiusKm }).map((e) => e.venue).sort();
      assert.deepEqual(got, expected, `${label} within ${radiusKm} km`);
    }
  }
});

test("no returned venue sits beyond the requested radius", () => {
  const lat = 53.4808;
  const lng = -2.2426;
  const radiusKm = 60;
  for (const e of fetchCurated({ lat, lng, radiusKm })) {
    const d = greatCircleKm(lat, lng, e.lat, e.lng);
    assert.ok(d <= radiusKm, `${e.venue} is ${d.toFixed(1)} km away, outside ${radiusKm} km`);
  }
});

test("a radius with nothing near it returns an empty list", () => {
  // Mid North Sea. The guide is allowed to have nothing to say.
  assert.deepEqual(fetchCurated({ lat: 56.0, lng: 2.0, radiusKm: 20 }), []);
});

test("every generated event is complete, placed in the UK and uniquely identified", () => {
  const before = Date.now();
  const events = fetchCurated();
  const ids = new Set();

  for (const e of events) {
    assert.ok(e.id && !ids.has(e.id), `duplicate or missing id: ${e.id}`);
    ids.add(e.id);

    assert.ok(e.title && e.title.trim().length > 0, `${e.id}: empty title`);
    assert.ok(e.venue && e.venue.trim().length > 0, `${e.id}: empty venue`);
    assert.ok(e.address && e.address.trim().length > 0, `${e.id}: empty address`);
    assert.ok(e.category && e.category.trim().length > 0, `${e.id}: empty category`);
    assert.equal(e.source, "Local guide");
    assert.ok(e.url.startsWith("https://"), `${e.id}: url is ${e.url}`);
    assert.ok(inUkBox(e.lat, e.lng), `${e.id}: ${e.lat},${e.lng} outside the UK box`);

    const startMs = Date.parse(e.start);
    assert.ok(Number.isFinite(startMs), `${e.id}: unparseable start ${e.start}`);
    assert.ok(startMs > before, `${e.id}: start ${e.start} is not in the future`);
    assert.ok(
      startMs - before < 8 * DAY_MS,
      `${e.id}: start ${e.start} is more than eight days away`
    );
  }
  assert.equal(ids.size, events.length);
});

test("the recurrence lands on the intended London weekday and hour", () => {
  const events = fetchCurated();
  const byVenue = new Map(events.map((e) => [e.venue, e]));

  for (const v of VENUES) {
    const e = byVenue.get(v.venue);
    assert.ok(e, `${v.venue} produced no event`);
    const p = londonParts(e.start);
    assert.equal(
      p.weekday,
      v.day,
      `${v.venue}: ${e.start} is weekday ${p.weekday} in London, table says ${v.day}`
    );
    assert.equal(p.hour, v.hour, `${v.venue}: ${e.start} is ${p.hour}:00 in London, table says ${v.hour}:00`);
    assert.equal(p.minute, 0, `${v.venue}: ${e.start} is not on the hour`);
    assert.equal(p.second, 0, `${v.venue}: ${e.start} is not on the minute`);
  }

  // The table spans several different weekdays, so this really is checking the
  // recurrence maths rather than one lucky day.
  assert.ok(new Set(VENUES.map((v) => v.day)).size >= 4);
});

test("the recurrence picks the soonest matching weekday, not a later one", () => {
  const before = Date.now();
  const events = fetchCurated();
  const todayLondon = londonParts(before);

  for (const e of events) {
    const p = londonParts(e.start);
    // Whole days between today and the event, in London calendar terms.
    const daysAhead = Math.round(
      (Date.UTC(p.year, p.month - 1, p.day) -
        Date.UTC(todayLondon.year, todayLondon.month - 1, todayLondon.day)) /
        DAY_MS
    );
    assert.ok(
      daysAhead >= 0 && daysAhead <= 7,
      `${e.id}: ${e.start} is ${daysAhead} days ahead, expected 0 to 7`
    );
    // The only way an occurrence lands a full week out is when today's slot has
    // already passed, so a same-weekday event seven days away has to be one
    // whose local hour is already behind us.
    if (daysAhead === 7) {
      assert.ok(
        p.hour < todayLondon.hour || (p.hour === todayLondon.hour && p.minute <= todayLondon.minute),
        `${e.id}: pushed a week ahead even though ${p.hour}:00 today has not passed`
      );
    }
  }
});

test("ids are stable, slugged from the venue name and unique within a response", () => {
  const events = fetchCurated({ lat: 51.5074, lng: -0.1278, radiusKm: 50 });
  assert.ok(events.length > 0);
  for (const e of events) {
    assert.match(e.id, /^curated-[a-z0-9-]+$/, `unexpected id shape: ${e.id}`);
    const slug = e.venue.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    assert.ok(e.id.startsWith(`curated-${slug}-`), `${e.id} does not encode ${e.venue}`);
  }
  assert.equal(new Set(events.map((e) => e.id)).size, events.length);
});
