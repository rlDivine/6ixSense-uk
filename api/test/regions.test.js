import test from "node:test";
import assert from "node:assert/strict";

import {
  CITIES,
  DEFAULT_REGION,
  isInMarket,
  nearestCity,
  rangeWindow,
  regionCatalogue,
  resolveRegion,
  tzOffsetMinutes,
} from "../sources/regions.js";
import { inUkBox, londonNoon, londonParts, UK_BOX } from "./helpers.js";

const LONDON_TZ = "Europe/London";
const DAY_MS = 86400000;

// MARK: resolveRegion --------------------------------------------------------

test("resolveRegion lands in the right nation for each home nation", () => {
  // Deliberately not the listed city centres: an off-centre point exercises the
  // nearest-city search rather than an exact coordinate match.
  const cases = [
    ["Peak District", 53.35, -1.8, "England"],
    ["Salisbury Plain", 51.18, -1.83, "England"],
    ["Snowdonia", 53.07, -4.08, "Wales"],
    ["Gower peninsula", 51.6, -4.15, "Wales"],
    ["Loch Ness", 57.3, -4.45, "Scotland"],
    ["Isle of Skye", 57.27, -6.22, "Scotland"],
    ["Ballymena", 54.86, -6.28, "Northern Ireland"],
    ["Sperrin Mountains", 54.75, -7.05, "Northern Ireland"],
  ];
  for (const [label, lat, lng, nation] of cases) {
    const region = resolveRegion(lat, lng);
    assert.equal(region.nation, nation, `${label} resolved to ${region.id} in ${region.nation}`);
    assert.equal(region.country, "GB");
    assert.ok(isInMarket(lat, lng), `${label} should be in market`);
  }
});

test("resolveRegion returns the exact city when standing on it", () => {
  for (const id of ["london", "manchester", "cardiff", "edinburgh", "belfast"]) {
    const city = CITIES.find((c) => c.id === id);
    assert.equal(resolveRegion(city.lat, city.lng).id, id);
  }
});

test("a coordinate abroad falls back to London and is out of market", () => {
  const abroad = [
    ["Paris", 48.8566, 2.3522],
    ["Toronto", 43.6532, -79.3832],
    ["New York", 40.7128, -74.006],
    ["Sydney", -33.8688, 151.2093],
    ["Reykjavik", 64.1466, -21.9426],
  ];
  for (const [label, lat, lng] of abroad) {
    const region = resolveRegion(lat, lng);
    assert.equal(region.id, "london", `${label} should fall back to London, got ${region.id}`);
    assert.equal(region, DEFAULT_REGION);
    assert.equal(isInMarket(lat, lng), false, `${label} should be out of market`);
  }
});

test("a missing or unusable coordinate falls back to London", () => {
  for (const args of [[], [null, null], [NaN, 0], ["51.5", "-0.12"], [undefined, undefined]]) {
    assert.equal(resolveRegion(...args).id, "london");
    assert.equal(isInMarket(...args), false);
  }
});

test("nearestCity reports zero distance for a listed city centre", () => {
  const { city, km } = nearestCity(51.5074, -0.1278);
  assert.equal(city.id, "london");
  assert.ok(km < 0.001, `expected ~0 km, got ${km}`);
});

// MARK: catalogue integrity --------------------------------------------------

test("every CITIES entry is a well-formed UK region", () => {
  const problems = [];
  const seenIds = new Set();
  const nations = new Set(["England", "Wales", "Scotland", "Northern Ireland"]);

  for (const c of CITIES) {
    const id = c.id || "(missing id)";
    if (!c.id || typeof c.id !== "string") problems.push(`${id}: id missing or not a string`);
    if (seenIds.has(c.id)) problems.push(`${id}: duplicate id`);
    seenIds.add(c.id);

    if (!c.label || !String(c.label).trim()) problems.push(`${id}: empty label`);
    if (!c.area || !String(c.area).trim()) problems.push(`${id}: empty area`);
    if (!c.nation || !String(c.nation).trim()) problems.push(`${id}: empty nation`);
    if (c.nation && !nations.has(c.nation)) problems.push(`${id}: unknown nation ${c.nation}`);

    if (c.country !== "GB") problems.push(`${id}: country is ${c.country}, expected GB`);
    if (c.timeZone !== "Europe/London") problems.push(`${id}: timeZone is ${c.timeZone}`);
    if (c.unit !== "mi") problems.push(`${id}: unit is ${c.unit}, expected mi`);

    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) {
      problems.push(`${id}: lat/lng not finite (${c.lat}, ${c.lng})`);
    } else if (!inUkBox(c.lat, c.lng)) {
      problems.push(
        `${id}: ${c.lat},${c.lng} outside the UK box ` +
          `(${UK_BOX.minLat}..${UK_BOX.maxLat}, ${UK_BOX.minLng}..${UK_BOX.maxLng})`
      );
    }

    const slug = c.eventbrite?.slug;
    if (!slug || !String(slug).trim()) problems.push(`${id}: missing eventbrite slug`);
    else if (!slug.startsWith("united-kingdom--")) problems.push(`${id}: slug ${slug} is not a UK slug`);
  }

  assert.equal(problems.length, 0, `\n${problems.join("\n")}\n`);
  assert.ok(CITIES.length > 100, `catalogue looks truncated: ${CITIES.length} entries`);
});

test("all four home nations are represented", () => {
  const nations = new Set(CITIES.map((c) => c.nation));
  assert.deepEqual([...nations].sort(), ["England", "Northern Ireland", "Scotland", "Wales"]);
});

test("London is first so the country picker lands there", () => {
  assert.equal(CITIES[0].id, "london");
  assert.equal(DEFAULT_REGION.id, "london");
});

// MARK: regionCatalogue ------------------------------------------------------

test("regionCatalogue groups into exactly one country whose first city is London", () => {
  const cat = regionCatalogue();
  assert.equal(cat.length, 1);
  const [gb] = cat;
  assert.equal(gb.country, "GB");
  assert.equal(gb.label, "United Kingdom");
  assert.equal(gb.cities.length, CITIES.length);
  assert.equal(gb.cities[0].id, "london");
  assert.equal(gb.cities[0].label, "London");
  assert.deepEqual(gb.nations, ["England", "Wales", "Scotland", "Northern Ireland"]);
  for (const city of gb.cities) {
    assert.equal(city.unit, "mi");
    assert.equal(city.timeZone, "Europe/London");
    assert.ok(Number.isFinite(city.lat) && Number.isFinite(city.lng));
  }
});

// MARK: date windows ---------------------------------------------------------

// A midweek day, a Saturday and a Sunday, in both GMT and BST, so the window
// maths is exercised on either side of the clock change.
const SAMPLE_WEEKS = [
  { label: "January (GMT)", start: [2026, 1, 5] },
  { label: "June (BST)", start: [2026, 6, 1] },
];

function weekOf([year, month, day]) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const base = londonNoon(year, month, day);
    out.push(new Date(base.getTime() + i * DAY_MS));
  }
  return out;
}

test("rangeWindow('all') has no bounds", () => {
  assert.equal(rangeWindow("all", new Date(), 0), null);
});

test("rangeWindow('today') runs from now to the end of the London day", () => {
  for (const week of SAMPLE_WEEKS) {
    for (const now of weekOf(week.start)) {
      const off = tzOffsetMinutes(LONDON_TZ, now);
      const w = rangeWindow("today", now, off);
      assert.equal(w.min, now.getTime(), `${week.label}: min should be now`);

      const end = londonParts(w.max);
      const start = londonParts(now);
      assert.equal(end.date, start.date, `${week.label} ${start.date}: max is on another day`);
      assert.equal(end.hour, 23);
      assert.equal(end.minute, 59);
      assert.equal(end.second, 59);

      const nextDay = londonParts(w.max + 1);
      assert.equal(nextDay.hour, 0);
      assert.equal(nextDay.minute, 0);
      assert.ok(w.max > w.min);
    }
  }
});

test("rangeWindow('week') runs from now to the end of the seventh day ahead", () => {
  for (const week of SAMPLE_WEEKS) {
    for (const now of weekOf(week.start)) {
      const off = tzOffsetMinutes(LONDON_TZ, now);
      const w = rangeWindow("week", now, off);
      assert.equal(w.min, now.getTime());

      const span = w.max - w.min;
      assert.ok(span > 7 * DAY_MS, `week window too short: ${span / DAY_MS} days`);
      assert.ok(span < 8 * DAY_MS, `week window too long: ${span / DAY_MS} days`);

      const end = londonParts(w.max);
      assert.equal(end.hour, 23);
      assert.equal(end.minute, 59);
      assert.equal(end.weekday, londonParts(now).weekday, "week should end on the same weekday");
    }
  }
});

test("rangeWindow('weekend') covers Saturday and Sunday in Europe/London", () => {
  for (const week of SAMPLE_WEEKS) {
    for (const now of weekOf(week.start)) {
      const off = tzOffsetMinutes(LONDON_TZ, now);
      const today = londonParts(now);
      const w = rangeWindow("weekend", now, off, LONDON_TZ);
      const where = `${week.label} ${today.date} (weekday ${today.weekday})`;

      assert.ok(w.min >= now.getTime(), `${where}: window starts in the past`);

      // The window has to stop at the very end of a Sunday, never spill into
      // Monday and never stop short of Sunday midnight.
      const end = londonParts(w.max);
      assert.equal(end.weekday, 0, `${where}: window ends on weekday ${end.weekday}, not Sunday`);
      assert.equal(end.hour, 23, `${where}: window ends at ${end.hour}:${end.minute}`);
      assert.equal(end.minute, 59, `${where}: window ends at ${end.hour}:${end.minute}`);
      const justAfter = londonParts(w.max + 1);
      assert.equal(justAfter.weekday, 1, `${where}: the instant after the window is not Monday`);
      assert.equal(justAfter.hour, 0, `${where}: Monday does not start at midnight`);

      // Sunday afternoon of that weekend must always be inside the window.
      const sundayNoon = londonNoon(end.year, end.month, end.day).getTime();
      assert.ok(
        sundayNoon >= w.min && sundayNoon <= w.max,
        `${where}: Sunday midday is outside the window`
      );

      if (today.weekday === 0) {
        // On a Sunday, Saturday has already gone, so the window starts at now.
        assert.equal(w.min, now.getTime(), `${where}: Sunday window should start at now`);
      } else {
        // Otherwise the whole of Saturday afternoon must be inside it.
        const saturdayNoon = londonNoon(end.year, end.month, end.day - 1).getTime();
        assert.ok(
          saturdayNoon >= w.min && saturdayNoon <= w.max,
          `${where}: Saturday midday is outside the window`
        );
        const startParts = londonParts(w.min);
        if (today.weekday === 6) {
          assert.equal(w.min, now.getTime(), `${where}: Saturday window should start at now`);
        } else {
          assert.equal(startParts.weekday, 6, `${where}: window starts on weekday ${startParts.weekday}`);
          assert.equal(startParts.hour, 0);
          assert.equal(startParts.minute, 0);
        }
      }
    }
  }
});

test("rangeWindow('weekend') stays on Saturday and Sunday through a clock change", () => {
  // British Summer Time starts 29 March 2026 and ends 25 October 2026. A
  // weekend on the far side of a transition is the case most likely to slip an
  // hour, because the offset sampled at `now` is not the offset at the boundary
  // being computed. An offset on its own cannot know about a future
  // transition, so rangeWindow takes the timeZone as well and corrects itself.
  // server.js passes region.timeZone for exactly this reason.
  const weeks = [
    { label: "week before BST starts", start: [2026, 3, 23] },
    { label: "week before BST ends", start: [2026, 10, 19] },
  ];
  for (const week of weeks) {
    for (const now of weekOf(week.start)) {
      const off = tzOffsetMinutes(LONDON_TZ, now);
      const today = londonParts(now);
      const w = rangeWindow("weekend", now, off, LONDON_TZ);
      const where = `${week.label}, ${today.date}`;

      const end = londonParts(w.max);
      assert.equal(end.weekday, 0, `${where}: window ends on weekday ${end.weekday}, not Sunday`);
      assert.equal(
        `${end.hour}:${end.minute}`,
        "23:59",
        `${where}: window ends at ${end.hour}:${end.minute} London time, not 23:59`
      );
    }
  }
});

test("tzOffsetMinutes knows Europe/London's summer and winter offsets", () => {
  assert.equal(tzOffsetMinutes(LONDON_TZ, new Date("2026-01-15T12:00:00Z")), 0);
  assert.equal(tzOffsetMinutes(LONDON_TZ, new Date("2026-07-15T12:00:00Z")), 60);
  assert.equal(tzOffsetMinutes("", new Date()), 0);
  assert.equal(tzOffsetMinutes("Not/AZone", new Date()), 0);
});
