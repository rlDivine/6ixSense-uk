import test from "node:test";
import assert from "node:assert/strict";

import { fetchCarBoots, __table as TABLE } from "../sources/carboots.js";
import { categoryFromTitle } from "../sources/util.js";
import { greatCircleKm, inUkBox, londonParts, londonNoon } from "./helpers.js";

// A fixed "now" so every expectation below is about the rule, not about the
// day the suite happens to run. Mid-season on purpose: a winter date would let
// a broken season check pass by returning nothing for the outdoor sales.
const NOW = londonNoon(2026, 8, 9); // Sunday 9 August 2026, 12:00 London
const DAY_MS = 86400000;

const LONDON = { lat: 51.5074, lng: -0.1278 };

/// Every event the source can produce from NOW, ignoring distance.
function allEvents(now = NOW) {
  return fetchCarBoots({ now });
}

/// The source only ever offers a sale's *next* date, so a rule that repeats
/// (fortnightly, monthly, a skipped racing Saturday) cannot be checked from one
/// starting point. Walking `now` forward a week at a time and collecting what
/// each call offers reconstructs the series, and exercises the rule from every
/// phase of itself rather than from one lucky Sunday.
function datesOver(name, weeks, from = NOW) {
  const seen = new Set();
  for (let w = 0; w < weeks; w++) {
    const now = new Date(from.getTime() + w * 7 * DAY_MS);
    for (const e of fetchCarBoots({ now })) {
      if (e.title === name) seen.add(londonParts(e.start).date);
    }
  }
  return [...seen].sort();
}

/// The table row an event came from, matched on the title the source uses.
function rowFor(event) {
  const row = TABLE.find((s) => s.name === event.title);
  assert.ok(row, `no table row named ${event.title}`);
  return row;
}

// ---------------------------------------------------------------------------
// The table itself. A wrong row here sends a person to a field at six in the
// morning, so these are stricter than the shape checks the other sources get.
// ---------------------------------------------------------------------------

test("every sale sits inside the UK", () => {
  for (const s of TABLE) {
    assert.ok(inUkBox(s.lat, s.lng), `${s.name} is outside the UK box: ${s.lat}, ${s.lng}`);
  }
});

test("every sale carries the fields an event needs", () => {
  for (const s of TABLE) {
    assert.ok(s.name && typeof s.name === "string", "a sale has no name");
    assert.ok(s.venue, `${s.name} has no venue`);
    // A postcode is what makes the address navigable, and it is also the thing
    // that was geocoded, so requiring one keeps the row and the coordinate
    // traceable to the same place.
    assert.match(
      s.address,
      /[A-Z]{1,2}\d[A-Z\d]?(\s*\d[A-Z]{2})?$/,
      `${s.name} address does not end in a postcode: ${s.address}`
    );
    assert.ok(s.admission, `${s.name} does not say what a buyer pays`);
    assert.match(s.url, /^https?:\/\//, `${s.name} has no absolute url`);
    assert.ok(Array.isArray(s.days) && s.days.length > 0, `${s.name} has no days`);
    for (const d of s.days) {
      assert.ok(Number.isInteger(d) && d >= 0 && d <= 6, `${s.name} has a bad weekday ${d}`);
    }
    assert.equal(new Set(s.days).size, s.days.length, `${s.name} repeats a weekday`);

    const [hour, minute] = s.open;
    assert.ok(Number.isInteger(hour) && hour >= 0 && hour <= 23, `${s.name} bad open hour`);
    assert.ok(Number.isInteger(minute) && minute >= 0 && minute <= 59, `${s.name} bad open minute`);

    const [from, to] = s.season;
    assert.ok(Number.isInteger(from) && from >= 1 && from <= 12, `${s.name} bad season start`);
    assert.ok(Number.isInteger(to) && to >= 1 && to <= 12, `${s.name} bad season end`);
  }
});

test("names are unique, so an event title identifies one sale", () => {
  const names = TABLE.map((s) => s.name);
  assert.equal(new Set(names).size, names.length, "two sales share a name");
});

test("a fortnightly sale has an anchor that is itself one of its days", () => {
  // Without this the parity arithmetic is anchored to the wrong week and every
  // date the sale produces is exactly seven days out, which is the kind of
  // wrong that looks completely right.
  for (const s of TABLE.filter((x) => x.every === "fortnight")) {
    assert.ok(s.anchor, `${s.name} is fortnightly with no anchor`);
    assert.match(s.anchor, /^\d{4}-\d{2}-\d{2}$/, `${s.name} anchor is not a date`);
    const [y, m, d] = s.anchor.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    assert.ok(
      s.days.includes(weekday),
      `${s.name} anchor ${s.anchor} is a weekday ${weekday}, which the sale does not run on`
    );
  }
});

test("a monthly sale says which occurrence of the weekday it is", () => {
  for (const s of TABLE.filter((x) => x.every === "month")) {
    assert.ok(
      Number.isInteger(s.nth) && s.nth >= 1 && s.nth <= 5,
      `${s.name} is monthly with no usable nth`
    );
  }
});

test("skipDates are real dates the sale would otherwise have run on", () => {
  for (const s of TABLE.filter((x) => x.skipDates)) {
    for (const iso of s.skipDates) {
      assert.match(iso, /^\d{4}-\d{2}-\d{2}$/, `${s.name} has a malformed skipDate ${iso}`);
      const [y, m, d] = iso.split("-").map(Number);
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      assert.ok(
        s.days.includes(weekday),
        `${s.name} skips ${iso}, which is not one of its days anyway`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Expansion: recurrence rules turned into dates.
// ---------------------------------------------------------------------------

test("every occurrence lands on a day the sale actually runs", () => {
  // Checked in Europe/London, not UTC. A 6am BST sale is 05:00Z, and reading
  // the weekday off the UTC instant is right there but wrong for a sale that
  // opens in the hour after midnight.
  for (const e of allEvents()) {
    const row = rowFor(e);
    const { weekday } = londonParts(e.start);
    assert.ok(
      row.days.includes(weekday),
      `${e.title} on ${e.start} is a weekday ${weekday}, not one of ${row.days}`
    );
  }
});

test("every occurrence opens at the advertised time, London wall clock", () => {
  for (const e of allEvents()) {
    const row = rowFor(e);
    const { hour, minute } = londonParts(e.start);
    assert.equal(hour, row.open[0], `${e.title} opens at ${hour}, expected ${row.open[0]}`);
    assert.equal(minute, row.open[1], `${e.title} opens at :${minute}, expected :${row.open[1]}`);
  }
});

test("every occurrence falls inside the sale's season", () => {
  for (const e of allEvents()) {
    const row = rowFor(e);
    const { month } = londonParts(e.start);
    const [from, to] = row.season;
    const ok = from <= to ? month >= from && month <= to : month >= from || month <= to;
    assert.ok(ok, `${e.title} on ${e.start} is in month ${month}, outside season ${from}-${to}`);
    assert.ok(
      !row.skipMonths?.includes(month),
      `${e.title} ran in month ${month}, which it skips`
    );
  }
});

test("a monthly sale produces only its nth weekday of the month", () => {
  const monthly = TABLE.filter((s) => s.every === "month");
  assert.ok(monthly.length > 0, "no monthly sale in the table to exercise the rule");

  for (const row of monthly) {
    // Nearly a year, so the rule is tested across month boundaries rather than
    // inside one month, where "first Sunday" and "every Sunday" can agree.
    const dates = datesOver(row.name, 50, londonNoon(2026, 2, 1));
    assert.ok(dates.length >= 6, `${row.name} produced only ${dates.length} dates in a year`);
    for (const iso of dates) {
      const day = Number(iso.slice(8, 10));
      const nth = Math.floor((day - 1) / 7) + 1;
      assert.equal(nth, row.nth, `${row.name} on ${iso} is occurrence ${nth}, expected ${row.nth}`);
    }
    // Exactly one per month it runs in, which is what "monthly" has to mean.
    const months = dates.map((iso) => iso.slice(0, 7));
    assert.equal(new Set(months).size, months.length, `${row.name} ran twice in one month`);
  }
});

test("a fortnightly sale produces alternate weeks, in step with its anchor", () => {
  const fortnightly = TABLE.filter((s) => s.every === "fortnight");
  assert.ok(fortnightly.length > 0, "no fortnightly sale in the table to exercise the rule");

  for (const row of fortnightly) {
    const dates = datesOver(row.name, 50, londonNoon(2026, 2, 1));
    assert.ok(dates.length >= 6, `${row.name} produced only ${dates.length} dates in a season`);

    const [ay, am, ad] = row.anchor.split("-").map(Number);
    const anchorUTC = Date.UTC(ay, am - 1, ad);
    for (const iso of dates) {
      const [y, m, d] = iso.split("-").map(Number);
      const delta = Math.round((Date.UTC(y, m - 1, d) - anchorUTC) / DAY_MS);
      assert.equal(delta % 14, 0, `${row.name} on ${iso} is ${delta} days off its anchor`);
    }
    // Consecutive dates inside the season are a fortnight apart, not a week.
    // The one gap allowed to be longer is the winter, between seasons.
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      const a = dates[i - 1].split("-").map(Number);
      const b = dates[i].split("-").map(Number);
      gaps.push(Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / DAY_MS));
    }
    assert.ok(gaps.every((g) => g === 14 || g > 60), `${row.name} gaps: ${gaps.join(", ")}`);
    assert.ok(gaps.includes(14), `${row.name} never produced a 14 day gap`);
  }
});

test("a skipped date never appears", () => {
  const withSkips = TABLE.filter((s) => s.skipDates?.length);
  assert.ok(withSkips.length > 0, "no skipDates in the table to exercise the rule");

  for (const row of withSkips) {
    // From the start of the year, so every listed racing Saturday is reachable.
    const dates = new Set(datesOver(row.name, 52, londonNoon(2026, 1, 1)));
    assert.ok(dates.size > 0, `${row.name} produced nothing at all over a year`);
    for (const iso of row.skipDates) {
      assert.ok(!dates.has(iso), `${row.name} produced ${iso}, which it should skip`);
    }
    // And it did run on the Saturdays either side, so the skip is a hole in a
    // real series rather than a sale that never appears anyway.
    for (const iso of row.skipDates) {
      const [y, m, d] = iso.split("-").map(Number);
      const before = new Date(Date.UTC(y, m - 1, d - 7)).toISOString().slice(0, 10);
      const after = new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
      assert.ok(
        dates.has(before) || dates.has(after),
        `${row.name} skips ${iso} but ran on neither ${before} nor ${after}`
      );
    }
  }
});

test("one sale never occupies more than one row per weekday it runs on", () => {
  // The reason the source offers only the next date per weekday. The feed's
  // default sort is by distance, and every date of one sale is the same
  // distance away, so extra dates land adjacent and read as duplicate rows.
  for (const now of [NOW, londonNoon(2026, 5, 6), londonNoon(2026, 10, 21)]) {
    const byTitle = new Map();
    for (const e of fetchCarBoots({ now })) {
      if (!byTitle.has(e.title)) byTitle.set(e.title, []);
      byTitle.get(e.title).push(londonParts(e.start).weekday);
    }
    for (const [title, weekdays] of byTitle) {
      assert.equal(
        new Set(weekdays).size,
        weekdays.length,
        `${title} appears twice on the same weekday from ${now.toISOString()}`
      );
      const row = TABLE.find((s) => s.name === title);
      assert.ok(weekdays.length <= row.days.length, `${title} has more rows than it has days`);
    }
  }
});

test("a winter date silences the closed sales and keeps the ones that run through", () => {
  // The check that the season filter is doing anything at all. The window has
  // to stay inside one month: a fortnight from mid-January is still January,
  // whereas a month of it reaches February, when several sales legitimately
  // reopen, and the test would be asserting the wrong thing about real data.
  const runsInJanuary = (s) => {
    const [from, to] = s.season;
    const inSeason = from <= to ? from <= 1 && to >= 1 : from <= 1 || to >= 1;
    return inSeason && !s.skipMonths?.includes(1);
  };

  const january = fetchCarBoots({ now: londonNoon(2027, 1, 11), lookaheadDays: 14 });
  const titles = new Set(january.map((e) => e.title));

  const closed = TABLE.filter((s) => !runsInJanuary(s));
  const open = TABLE.filter(runsInJanuary);
  assert.ok(closed.length > 0 && open.length > 0, "table needs both kinds to test this");

  for (const s of closed) {
    assert.ok(!titles.has(s.name), `${s.name} is shut in January but appeared: season ${s.season}`);
  }
  for (const s of open) {
    // A fortnightly or monthly sale can legitimately have no date in any given
    // fortnight, so only the weekly ones are required to show up.
    if (s.every && s.every !== "week") continue;
    assert.ok(titles.has(s.name), `${s.name} runs in January but is missing from the feed`);
  }
});

test("nothing is produced for a date already well past", () => {
  const events = allEvents();
  for (const e of events) {
    assert.ok(
      new Date(e.start).getTime() >= NOW.getTime() - 6 * 3600 * 1000,
      `${e.title} at ${e.start} is more than six hours in the past`
    );
  }
});

test("the lookahead bounds how far a next date can be", () => {
  const lookaheadDays = 8;
  const events = fetchCarBoots({ now: NOW, lookaheadDays });
  assert.ok(events.length > 0, "no events inside a week");
  const limit = NOW.getTime() + (lookaheadDays + 1) * DAY_MS;
  for (const e of events) {
    assert.ok(new Date(e.start).getTime() <= limit, `${e.title} at ${e.start} is past the lookahead`);
  }
  // A week reaches every weekly sale but not the monthly and fortnightly ones,
  // so widening it finds strictly more. That is the parameter doing its job.
  const wider = fetchCarBoots({ now: NOW, lookaheadDays: 42 });
  assert.ok(wider.length > events.length, "widening the lookahead found nothing new");
});

test("a weekly sale is always within a week, so every date range can see it", () => {
  // The claim that makes "next date only" safe: the app's widest range is
  // eight days, and no weekly in-season sale can be further away than seven.
  const weekly = fetchCarBoots({ now: NOW, lookaheadDays: 7 });
  const titles = new Set(weekly.map((e) => e.title));
  for (const s of TABLE) {
    if (s.every && s.every !== "week") continue;
    // Only in-season sales are required, which the January test covers.
    const anySoon = fetchCarBoots({ now: NOW, lookaheadDays: 42 }).some((e) => e.title === s.name);
    if (!anySoon) continue;
    assert.ok(titles.has(s.name), `${s.name} is weekly and in season but more than 7 days away`);
  }
});

// ---------------------------------------------------------------------------
// The region slice.
// ---------------------------------------------------------------------------

test("the radius filter keeps only sales inside it, measured independently", () => {
  const radiusKm = 50;
  const events = fetchCarBoots({ ...LONDON, radiusKm, now: NOW });
  assert.ok(events.length > 0, "no car boot sales near London");

  const seen = new Set();
  for (const e of events) {
    const d = greatCircleKm(LONDON.lat, LONDON.lng, e.lat, e.lng);
    assert.ok(d <= radiusKm + 0.01, `${e.title} is ${d.toFixed(1)}km away, outside ${radiusKm}km`);
    seen.add(e.title);
  }

  // Nothing inside the radius was dropped either.
  for (const s of TABLE) {
    const d = greatCircleKm(LONDON.lat, LONDON.lng, s.lat, s.lng);
    if (d <= radiusKm - 0.01 && !seen.has(s.name)) {
      // Only acceptable if the sale is out of season or out of horizon.
      const anyDate = fetchCarBoots({ ...LONDON, radiusKm, now: NOW, lookaheadDays: 42 });
      assert.ok(
        anyDate.some((e) => e.title === s.name),
        `${s.name} is ${d.toFixed(1)}km from London but never appears`
      );
    }
  }
});

test("a tighter radius returns a strict subset", () => {
  const wide = new Set(fetchCarBoots({ ...LONDON, radiusKm: 80, now: NOW }).map((e) => e.title));
  const tight = fetchCarBoots({ ...LONDON, radiusKm: 20, now: NOW }).map((e) => e.title);
  for (const t of tight) assert.ok(wide.has(t), `${t} is in the 20km slice but not the 80km one`);
});

test("every UK nation has at least one sale, so the feature is not London-only", () => {
  // Rough centres, generous radius: this is a coverage assertion, not a
  // geography one.
  const probes = [
    ["England", 52.5, -1.5, 200],
    ["Wales", 51.8, -3.4, 150],
    ["Scotland", 55.9, -3.8, 150],
    ["Northern Ireland", 54.7, -6.2, 120],
  ];
  for (const [nation, lat, lng, radiusKm] of probes) {
    const hits = fetchCarBoots({ lat, lng, radiusKm, now: NOW, lookaheadDays: 42 });
    assert.ok(hits.length > 0, `no car boot sales anywhere near ${nation}`);
  }
});

// ---------------------------------------------------------------------------
// The event objects the clients receive.
// ---------------------------------------------------------------------------

test("events are well formed and land in the Markets bucket", () => {
  const events = allEvents();
  assert.ok(events.length > 0);
  for (const e of events) {
    assert.equal(e.category, "Markets", `${e.title} is categorised ${e.category}`);
    assert.equal(e.source, "Car boot sales");
    assert.match(e.url, /^https?:\/\//, `${e.title} lost its url`);
    assert.ok(e.venue && e.address, `${e.title} lost its venue or address`);
    assert.ok(typeof e.lat === "number" && typeof e.lng === "number", `${e.title} lost coordinates`);
    assert.ok(e.price, `${e.title} lost its admission price`);
    assert.ok(e.description, `${e.title} lost its note`);
    assert.ok(!Number.isNaN(new Date(e.start).getTime()), `${e.title} has an unparseable start`);
  }
});

test("ids are unique, and stable across two calls at the same instant", () => {
  const first = allEvents();
  const ids = first.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "two occurrences share an id");
  for (const id of ids) assert.match(id, /^boot-[a-z0-9-]+-\d{4}-\d{2}-\d{2}$/);

  const second = allEvents();
  assert.deepEqual(second.map((e) => e.id), ids, "ids moved between identical calls");
});

test("a sale running two days a week produces both", () => {
  const twoDay = TABLE.find((s) => s.days.length === 2 && s.season[0] === 1 && s.season[1] === 12);
  assert.ok(twoDay, "no year-round two-day sale in the table");
  const days = new Set(
    allEvents(NOW)
      .filter((e) => e.title === twoDay.name)
      .map((e) => londonParts(e.start).weekday)
  );
  assert.deepEqual([...days].sort(), [...twoDay.days].sort());
});

// ---------------------------------------------------------------------------
// The title classifier, which is what makes a boot sale from any *other*
// source land in the same bucket as these.
// ---------------------------------------------------------------------------

test("titles that name a boot sale or a food festival are classified from the title", () => {
  const markets = [
    "Camden Car Boot Sale",
    "Sunday car-boot at the racecourse",
    "Giant Boot Fair",
    "Brenzett Thrift Farm Boot Sale",
    "St Mary's Jumble Sale",
    "Spitalfields Flea Market",
    "Farmers Market on the Green",
    "Table top sale in aid of the hospice",
  ];
  for (const t of markets) assert.equal(categoryFromTitle(t), "Markets", t);

  const food = [
    "Manchester Food & Drink Festival",
    "Wimbledon Beer Festival",
    "Bath Cider Fest",
    "Ludlow Food Fayre",
    "Street Food Market Takeover",
    "The Great British Cheese Festival",
    "Gin Expo 2026",
  ];
  for (const t of food) assert.equal(categoryFromTitle(t), "Food", t);
});

test("the classifier stays quiet when a title does not name the thing outright", () => {
  // These are the false positives that a looser rule would produce, and each
  // one would take a real listing out of its correct category.
  const quiet = [
    "Glastonbury Festival",
    "Reading Festival 2026",
    "Market Rasen Races",
    "Covent Garden Market Christmas Lights",
    "Beer and Banter with the Boot Boys",
    "Food for Thought: a panel discussion",
    "The Boot Room: a football podcast live",
    "Camden Market Late",
  ];
  for (const t of quiet) assert.equal(categoryFromTitle(t), null, t);
});

test("the title beats the shelf a listing was found on", async () => {
  const { makeEvent } = await import("../sources/util.js");
  // Exactly the case that motivated the rule: Eventbrite files a boot sale
  // under its food vertical, and Skiddle calls a beer festival FEST.
  const boot = makeEvent({ id: "1", title: "Chiswick Car Boot Sale", category: "Food & Drink" });
  assert.equal(boot.category, "Markets");

  const beer = makeEvent({ id: "2", title: "Wanstead Beer Festival", category: "Festivals" });
  assert.equal(beer.category, "Food");

  // And a title that says nothing still defers to the source.
  const gig = makeEvent({ id: "3", title: "The Smile", category: "Live music" });
  assert.equal(gig.category, "Live music");
});
