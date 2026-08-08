import test from "node:test";
import assert from "node:assert/strict";

import { fetchSportsFixtures, groundFor } from "../sources/sportsfixtures.js";
import {
  greatCircleKm,
  inUkBox,
  jsonResponse,
  withEnv,
  withForbiddenFetch,
  withStubbedFetch,
} from "./helpers.js";

// MARK: the ground matcher ---------------------------------------------------

test("resolves a ground named exactly as the table spells it", () => {
  assert.deepEqual(groundFor("Anfield"), [53.4308, -2.9608]);
  assert.deepEqual(groundFor("Emirates Stadium"), [51.5549, -0.1084]);
  assert.deepEqual(groundFor("Celtic Park"), [55.8497, -4.2055]);
  assert.deepEqual(groundFor("Windsor Park"), [54.5847, -5.955]);
});

test("is insensitive to case, punctuation and stray spacing", () => {
  const expected = [54.9756, -1.6217];
  for (const spelling of [
    "St James' Park",
    "St James’ Park",
    "St James` Park",
    "ST JAMES' PARK",
    "St. James' Park",
    "  st  james'   park  ",
    "St James Park",
  ]) {
    assert.deepEqual(groundFor(spelling), expected, `failed on ${JSON.stringify(spelling)}`);
  }
});

test("matches the dressed-up spellings the feed uses", () => {
  // The feed writes the same ground several ways, so containment has to work in
  // both directions: a longer feed name around a shorter table key, and back.
  assert.deepEqual(groundFor("Old Trafford Stadium"), [53.4631, -2.2913]);
  assert.deepEqual(groundFor("The Etihad Stadium"), [53.4831, -2.2004]);
  assert.deepEqual(groundFor("Molineux Stadium"), [52.5903, -2.1303]);
  assert.deepEqual(groundFor("Hampden Park, Glasgow"), [55.8258, -4.2522]);
  assert.deepEqual(groundFor("Hampden"), [55.8258, -4.2522]);
  assert.deepEqual(groundFor("Wembley"), [51.556, -0.2795]);
});

test("a near miss on a real ground name does not resolve", () => {
  // Firhill is Partick Thistle's ground and is nowhere near Motherwell's Fir
  // Park; matching them would put a Glasgow fixture in Lanarkshire.
  assert.equal(groundFor("Firhill"), null);
  assert.equal(groundFor("Firhill Stadium"), null);
  // "Homebase" only shares a prefix with Home Park.
  assert.equal(groundFor("Homebase"), null);
  assert.equal(groundFor("Homebase Retail Park"), null);
  // And the ones they must not be confused with still resolve.
  assert.deepEqual(groundFor("Fir Park"), [55.7797, -3.9931]);
  assert.deepEqual(groundFor("Home Park"), [50.3881, -4.1508]);
});

test("an unlisted ground resolves to null so the fixture can be dropped", () => {
  for (const name of ["Somewhere Else", "Firhill", "Broadhurst Park", "", null, undefined, "   "]) {
    assert.equal(groundFor(name), null, `${JSON.stringify(name)} should not resolve`);
  }
});

test("a generic single word must not stand in for a specific ground", () => {
  // The matcher's own rule is that a one-word name has to be distinctive.
  // "Stadium" is the least distinctive word in the table.
  assert.equal(groundFor("Stadium"), null);
  assert.equal(groundFor("Park"), null);
  assert.equal(groundFor("Arena"), null);
  assert.equal(groundFor("Ground"), null);
});

test("a generic multi-word name must not stand in for a specific ground", () => {
  // "Community Stadium" is how York City's and Colchester United's grounds are
  // often written, and both clubs are inside the leagues this source polls, so
  // resolving it to the Gtech would put a fixture 150 miles from where it is.
  assert.equal(groundFor("Community Stadium"), null);

  // "Building Society Arena" is deliberately NOT in that category. Only one
  // ground in British football carries it, so the shorthand is unambiguous and
  // resolving it to Coventry is the right answer rather than a false positive.
  assert.deepEqual(groundFor("Building Society Arena"), [52.4481, -1.4956]);
});

test("every ground in the table sits inside the UK", () => {
  // Sampling the whole table indirectly: each name resolves to itself, and the
  // coordinates have to be plausible.
  const names = [
    "Emirates Stadium", "Villa Park", "Vitality Stadium", "Gtech Community Stadium",
    "Amex Stadium", "Stamford Bridge", "Selhurst Park", "Craven Cottage", "Anfield",
    "Goodison Park", "Etihad Stadium", "Old Trafford", "St James' Park", "City Ground",
    "Tottenham Hotspur Stadium", "London Stadium", "Molineux", "Elland Road",
    "St Mary's Stadium", "King Power Stadium", "Stadium of Light", "Turf Moor",
    "Bramall Lane", "Hillsborough", "The Hawthorns", "Carrow Road", "Pride Park",
    "Riverside Stadium", "Bet365 Stadium", "Ashton Gate", "Portman Road",
    "Kenilworth Road", "Deepdale", "The Den", "Loftus Road", "Vicarage Road",
    "Oakwell", "Home Park", "Wembley Stadium", "Cardiff City Stadium",
    "Swansea.com Stadium", "Rodney Parade", "Stok Cae Ras", "Celtic Park",
    "Ibrox Stadium", "Hampden Park", "Tynecastle Park", "Easter Road",
    "Pittodrie Stadium", "Dens Park", "Tannadice Park", "McDiarmid Park",
    "Fir Park", "Rugby Park", "Windsor Park",
  ];
  for (const name of names) {
    const coords = groundFor(name);
    assert.ok(coords, `${name} did not resolve`);
    assert.ok(inUkBox(coords[0], coords[1]), `${name}: ${coords} outside the UK box`);
  }
});

// MARK: fetchSportsFixtures --------------------------------------------------

const LEAGUE_IDS = ["4328", "4329", "4396", "4397", "4330"];

function fixture(overrides = {}) {
  return {
    idEvent: "2052001",
    strEvent: "Manchester United vs Liverpool",
    strHomeTeam: "Manchester United",
    strAwayTeam: "Liverpool",
    strVenue: "Old Trafford",
    strTimestamp: "2026-09-12T14:00:00+00:00",
    dateEvent: "2026-09-12",
    strTime: "15:00:00",
    strThumb: "https://img/thumb.jpg",
    strPoster: "https://img/poster.jpg",
    ...overrides,
  };
}

/// Serve `events` from the first league and nothing from the rest, so a test
/// sees exactly the fixtures it wrote.
function leagueHandler(byLeague) {
  return (url) => {
    const id = new URL(url).searchParams.get("id");
    return jsonResponse({ events: byLeague[id] ?? null });
  };
}

async function fetchWith(events, opts) {
  return withEnv({ THESPORTSDB_KEY: "k" }, () =>
    withStubbedFetch(leagueHandler({ 4328: events }), async () => fetchSportsFixtures(opts))
  );
}

test("returns an empty list and makes no request when THESPORTSDB_KEY is unset", async () => {
  await withEnv({ THESPORTSDB_KEY: undefined }, () =>
    withForbiddenFetch(async () => {
      assert.deepEqual(await fetchSportsFixtures(), []);
      assert.deepEqual(await fetchSportsFixtures({ lat: 53.48, lng: -2.24, radiusKm: 25 }), []);
    })
  );
});

test("polls every configured league once", async () => {
  await withEnv({ THESPORTSDB_KEY: "secret" }, () =>
    withStubbedFetch(leagueHandler({}), async (calls) => {
      await fetchSportsFixtures();
      assert.equal(calls.length, LEAGUE_IDS.length);
      const ids = calls.map((c) => new URL(c.url).searchParams.get("id")).sort();
      assert.deepEqual(ids, [...LEAGUE_IDS].sort());
      for (const call of calls) {
        assert.ok(call.url.includes("/api/v1/json/secret/eventsnextleague.php"), call.url);
      }
    })
  );
});

test("maps a fixture onto the normalised shape with the ground's coordinates", async () => {
  const [e] = await fetchWith([fixture()]);
  assert.equal(e.id, "sdb-2052001");
  assert.equal(e.title, "Manchester United vs Liverpool");
  assert.equal(e.category, "Sports");
  assert.equal(e.start, "2026-09-12T14:00:00+00:00");
  assert.equal(e.venue, "Old Trafford");
  assert.equal(e.address, "Old Trafford");
  assert.deepEqual([e.lat, e.lng], [53.4631, -2.2913]);
  assert.equal(e.url, "https://www.thesportsdb.com/event/2052001");
  assert.equal(e.image, "https://img/thumb.jpg");
  assert.equal(e.source, "Football fixtures");
  assert.equal(e.price, "");
});

test("skips a fixture at a ground it cannot place", async () => {
  const events = await fetchWith([
    fixture({ idEvent: "1", strVenue: "Somewhere Unknown" }),
    fixture({ idEvent: "2", strVenue: "" }),
    fixture({ idEvent: "3", strVenue: undefined }),
    fixture({ idEvent: "4", strVenue: "Anfield" }),
  ]);
  assert.deepEqual(events.map((e) => e.id), ["sdb-4"]);
});

test("filters by radius using the resolved ground position", async () => {
  const events = [
    fixture({ idEvent: "1", strVenue: "Old Trafford" }),
    fixture({ idEvent: "2", strVenue: "Anfield" }),
    fixture({ idEvent: "3", strVenue: "Celtic Park" }),
  ];
  const near = await fetchWith(events, { lat: 53.4808, lng: -2.2426, radiusKm: 10 });
  assert.deepEqual(near.map((e) => e.id), ["sdb-1"]);

  const wider = await fetchWith(events, { lat: 53.4808, lng: -2.2426, radiusKm: 60 });
  assert.deepEqual(wider.map((e) => e.id).sort(), ["sdb-1", "sdb-2"]);

  // Cross-check the boundary independently.
  assert.ok(greatCircleKm(53.4808, -2.2426, 53.4308, -2.9608) < 60);
  assert.ok(greatCircleKm(53.4808, -2.2426, 55.8497, -4.2055) > 60);
});

test("keeps every fixture when no origin is supplied", async () => {
  const events = await fetchWith([
    fixture({ idEvent: "1", strVenue: "Old Trafford" }),
    fixture({ idEvent: "2", strVenue: "Celtic Park" }),
  ]);
  assert.equal(events.length, 2);
});

test("falls back to the date and time pair, then to a 15:00 kick-off", async () => {
  const cases = [
    [{ strTimestamp: undefined }, "2026-09-12T15:00:00"],
    [{ strTimestamp: undefined, strTime: undefined }, "2026-09-12T15:00:00"],
    [{ strTimestamp: undefined, strTime: "12:30:00" }, "2026-09-12T12:30:00"],
    [{ strTimestamp: undefined, dateEvent: undefined }, null],
  ];
  for (const [overrides, expected] of cases) {
    const [e] = await fetchWith([fixture(overrides)]);
    assert.equal(e.start, expected, JSON.stringify(overrides));
  }
});

test("builds a title from the team names when the feed omits one", async () => {
  const [e] = await fetchWith([fixture({ strEvent: undefined })]);
  assert.equal(e.title, "Manchester United v Liverpool");
});

test("falls back to the poster when there is no thumbnail", async () => {
  const [e] = await fetchWith([fixture({ strThumb: undefined })]);
  assert.equal(e.image, "https://img/poster.jpg");
});

test("handles the null events list an empty league returns", async () => {
  const out = await withEnv({ THESPORTSDB_KEY: "k" }, () =>
    withStubbedFetch(
      () => jsonResponse({ events: null }),
      async () => fetchSportsFixtures()
    )
  );
  assert.deepEqual(out, []);
});

test("one failing league does not lose the others", async () => {
  // The leagues run concurrently through Promise.allSettled, so a single
  // rejection must not take the whole source down.
  const out = await withEnv({ THESPORTSDB_KEY: "k" }, () =>
    withStubbedFetch(
      (url) => {
        const id = new URL(url).searchParams.get("id");
        if (id === "4328") return jsonResponse({}, { ok: false, status: 500 });
        if (id === "4330") return jsonResponse({ events: [fixture({ strVenue: "Ibrox Stadium" })] });
        return jsonResponse({ events: null });
      },
      async () => fetchSportsFixtures()
    )
  );
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].lat, out[0].lng], [55.8531, -4.3092]);
});
