import test from "node:test";
import assert from "node:assert/strict";

import { fetchSkiddle } from "../sources/skiddle.js";
import { jsonResponse, paramsOf, withEnv, withForbiddenFetch, withStubbedFetch } from "./helpers.js";

const KM_PER_MILE = 1.609344;

// Synthetic payload shaped from the /events/search/ fields the source reads.
function skiddleEvent(overrides = {}) {
  return {
    id: "12345678",
    eventname: "Warehouse Project",
    EventCode: "CLUB",
    startdate: "2026-09-12T22:00:00",
    date: "2026-09-12",
    openingtimes: { doorsopen: "22:00:00" },
    link: "https://www.skiddle.com/e/12345678",
    largeimageurl: "https://img/large.jpg",
    imageurl: "https://img/small.jpg",
    entryprice: 22.5,
    venue: {
      name: "Depot Mayfield",
      address: "Baring St",
      town: "Manchester",
      postcode: "M1 2PZ",
      latitude: "53.4771",
      longitude: "-2.2280",
    },
    ...overrides,
  };
}

function payload(results) {
  return jsonResponse({ results });
}

async function fetchWith(results, opts) {
  return withEnv({ SKIDDLE_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload(results),
      async () => fetchSkiddle(opts)
    )
  );
}

test("returns an empty list and makes no request when SKIDDLE_API_KEY is unset", async () => {
  await withEnv({ SKIDDLE_API_KEY: undefined }, () =>
    withForbiddenFetch(async () => {
      assert.deepEqual(await fetchSkiddle(), []);
      assert.deepEqual(await fetchSkiddle({ lat: 53.48, lng: -2.24, radiusKm: 25 }), []);
    })
  );
});

test("converts the kilometre radius into the miles Skiddle expects", async () => {
  // Getting this wrong is the easy mistake here: every other source in the app
  // takes kilometres, so an unconverted 50 would search a 50 mile circle.
  const cases = [
    [32.18688, "20"], // exactly 20 miles
    [16.09344, "10"],
    [8.04672, "5"],
    [1, "1"],
    [0, "1"], // never fall below the API's minimum
    [50, "30"], // capped
    [500, "30"],
  ];
  for (const [radiusKm, expected] of cases) {
    await withEnv({ SKIDDLE_API_KEY: "k" }, () =>
      withStubbedFetch(
        () => payload([]),
        async (calls) => {
          await fetchSkiddle({ lat: 53.48, lng: -2.24, radiusKm });
          const p = paramsOf(calls[0].url);
          assert.equal(p.radius, expected, `${radiusKm} km should be ${expected} miles`);
        }
      )
    );
  }
  // Sanity check on the conversion factor the expectations above assume.
  assert.equal(Math.round(32.18688 / KM_PER_MILE), 20);
});

test("builds the search request with the documented parameters", async () => {
  await withEnv({ SKIDDLE_API_KEY: "secret" }, () =>
    withStubbedFetch(
      () => payload([]),
      async (calls) => {
        await fetchSkiddle({ lat: 51.4816, lng: -3.1791, radiusKm: 32.18688 });
        assert.equal(calls.length, 1);
        assert.ok(calls[0].url.startsWith("https://www.skiddle.com/api/v1/events/search/?"));
        const p = paramsOf(calls[0].url);
        assert.equal(p.api_key, "secret");
        assert.equal(p.latitude, "51.4816");
        assert.equal(p.longitude, "-3.1791");
        assert.equal(p.order, "date");
        assert.equal(p.limit, "100");
        assert.match(p.minDate, /^\d{4}-\d{2}-\d{2}$/);
        assert.match(p.maxDate, /^\d{4}-\d{2}-\d{2}$/);
        const span = (Date.parse(p.maxDate) - Date.parse(p.minDate)) / 86400000;
        assert.equal(span, 60);
        assert.equal(calls[0].opts?.headers?.Accept, "application/json");
      }
    )
  );
});

test("defaults to London when no coordinate is supplied", async () => {
  await withEnv({ SKIDDLE_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([]),
      async (calls) => {
        await fetchSkiddle();
        const p = paramsOf(calls[0].url);
        assert.equal(p.latitude, "51.5074");
        assert.equal(p.longitude, "-0.1278");
      }
    )
  );
});

test("maps a full event onto the normalised shape", async () => {
  const [e] = await fetchWith([skiddleEvent()]);
  assert.equal(e.id, "sk-12345678");
  assert.equal(e.title, "Warehouse Project");
  assert.equal(e.category, "Music");
  assert.equal(e.start, "2026-09-12T22:00:00");
  assert.equal(e.venue, "Depot Mayfield");
  assert.equal(e.address, "Baring St, Manchester, M1 2PZ");
  assert.equal(e.lat, 53.4771);
  assert.equal(e.lng, -2.228);
  assert.equal(e.url, "https://www.skiddle.com/e/12345678");
  assert.equal(e.image, "https://img/large.jpg");
  assert.equal(e.source, "Skiddle");
  assert.equal(e.price, "£22.50");
});

test("tolerates a sparse event", async () => {
  const [e] = await fetchWith([{ id: "9", title: "Fallback title" }]);
  assert.equal(e.id, "sk-9");
  assert.equal(e.title, "Fallback title");
  assert.equal(e.category, "Things to do");
  assert.equal(e.start, null);
  assert.equal(e.venue, "");
  assert.equal(e.address, "");
  assert.equal(e.lat, null);
  assert.equal(e.lng, null);
  assert.equal(e.url, "");
  assert.equal(e.image, "");
  assert.equal(e.price, "");
});

test("drops a venue coordinate that is not a number", async () => {
  // A NaN coordinate would break the distance sort, so it has to become null.
  const [e] = await fetchWith([
    skiddleEvent({
      venue: { name: "Somewhere", latitude: "not a number", longitude: "also not a number" },
    }),
  ]);
  assert.equal(e.lat, null);
  assert.equal(e.lng, null);
});

test("reads venue coordinates that arrive as strings", async () => {
  const [e] = await fetchWith([
    skiddleEvent({ venue: { name: "Ulster Hall", latitude: "54.5940", longitude: "-5.9330" } }),
  ]);
  assert.equal(e.lat, 54.594);
  assert.equal(e.lng, -5.933);
});

test("maps every documented event code onto an app category", async () => {
  const expected = {
    LIVE: "Live music",
    CLUB: "Music",
    FEST: "Festival",
    DATE: "Food & Drink",
    BARP: "Food & Drink",
    ARTS: "Arts",
    EXHB: "Arts",
    THTR: "Arts",
    KIDS: "Family",
    SPRT: "Sports",
    COMM: "Things to do",
    LGBT: "Things to do",
  };
  const events = Object.keys(expected).map((code, i) =>
    skiddleEvent({ id: String(i), EventCode: code })
  );
  const got = await fetchWith(events);
  Object.values(expected).forEach((category, i) => {
    assert.equal(got[i].category, category, `code ${Object.keys(expected)[i]}`);
  });
});

test("an unknown or missing event code becomes the catch-all category", async () => {
  const got = await fetchWith([
    skiddleEvent({ id: "a", EventCode: "ZZZZ" }),
    skiddleEvent({ id: "b", EventCode: undefined }),
  ]);
  assert.equal(got[0].category, "Things to do");
  assert.equal(got[1].category, "Things to do");
});

test("accepts the lower-case eventcode spelling too", async () => {
  const [e] = await fetchWith([skiddleEvent({ EventCode: undefined, eventcode: "FEST" })]);
  assert.equal(e.category, "Festival");
});

test("formats entry prices in pounds and calls zero free", async () => {
  const cases = [
    [0, "Free"],
    ["0", "Free"],
    [12, "£12"],
    ["12", "£12"],
    [12.5, "£12.50"],
    [7.99, "£7.99"],
    [null, ""],
    [undefined, ""],
    ["", ""],
    ["on the door", ""],
  ];
  for (const [entryprice, expected] of cases) {
    const [e] = await fetchWith([skiddleEvent({ entryprice })]);
    assert.equal(e.price, expected, `entryprice ${JSON.stringify(entryprice)}`);
  }
});

test("prefers the start timestamp, then the door time, then the bare date", async () => {
  const cases = [
    [{ startdate: "2026-09-12T22:00:00", date: "2026-09-12" }, "2026-09-12T22:00:00"],
    [
      { startdate: undefined, date: "2026-09-12", openingtimes: { doorsopen: "21:30:00" } },
      "2026-09-12T21:30:00",
    ],
    [{ startdate: undefined, date: "2026-09-12", openingtimes: undefined }, "2026-09-12"],
    [{ startdate: undefined, date: undefined, openingtimes: undefined }, null],
  ];
  for (const [overrides, expected] of cases) {
    const [e] = await fetchWith([skiddleEvent(overrides)]);
    assert.equal(e.start, expected, JSON.stringify(overrides));
  }
});

test("falls back to the small image when there is no large one", async () => {
  const [e] = await fetchWith([skiddleEvent({ largeimageurl: undefined })]);
  assert.equal(e.image, "https://img/small.jpg");
});

test("returns an empty list when the response carries no results", async () => {
  for (const body of [{}, { results: null }, { results: "oops" }]) {
    const out = await withEnv({ SKIDDLE_API_KEY: "k" }, () =>
      withStubbedFetch(
        () => jsonResponse(body),
        async () => fetchSkiddle()
      )
    );
    assert.deepEqual(out, []);
  }
});

test("throws on a non-ok response", async () => {
  await withEnv({ SKIDDLE_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => jsonResponse({}, { ok: false, status: 503 }),
      async () => {
        await assert.rejects(() => fetchSkiddle(), /Skiddle 503/);
      }
    )
  );
});
