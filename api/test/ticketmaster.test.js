import test from "node:test";
import assert from "node:assert/strict";

import { fetchTicketmaster } from "../sources/ticketmaster.js";
import { jsonResponse, paramsOf, withEnv, withForbiddenFetch, withStubbedFetch } from "./helpers.js";

// Synthetic payloads, shaped from the Discovery API fields the source reads.
function tmEvent(overrides = {}) {
  return {
    id: "G5vzZ9",
    name: "Test Band Live",
    url: "https://www.ticketmaster.co.uk/event/G5vzZ9",
    images: [
      { url: "https://img/small.jpg", width: 100 },
      { url: "https://img/large.jpg", width: 2048 },
      { url: "https://img/medium.jpg", width: 640 },
    ],
    dates: { start: { dateTime: "2026-09-12T19:00:00Z", localDate: "2026-09-12", localTime: "20:00:00" } },
    classifications: [{ segment: { name: "Music" } }],
    priceRanges: [{ currency: "GBP", min: 12, max: 30 }],
    _embedded: {
      venues: [
        {
          name: "O2 Academy Brixton",
          address: { line1: "211 Stockwell Rd" },
          city: { name: "London" },
          location: { latitude: "51.4657", longitude: "-0.1148" },
        },
      ],
    },
    ...overrides,
  };
}

function payload(events) {
  return jsonResponse({ _embedded: { events } });
}

test("returns an empty list and makes no request when TM_API_KEY is unset", async () => {
  await withEnv({ TM_API_KEY: undefined }, () =>
    withForbiddenFetch(async () => {
      assert.deepEqual(await fetchTicketmaster(), []);
      assert.deepEqual(await fetchTicketmaster({ lat: 53.48, lng: -2.24, radiusKm: 25 }), []);
    })
  );
});

test("builds a UK-scoped kilometre request around the given point", async () => {
  await withEnv({ TM_API_KEY: "test-key" }, () =>
    withStubbedFetch(
      () => payload([]),
      async (calls) => {
        await fetchTicketmaster({ lat: 53.4808, lng: -2.2426, radiusKm: 27.4 });
        assert.equal(calls.length, 1);
        const p = paramsOf(calls[0].url);
        assert.equal(p.apikey, "test-key");
        assert.equal(p.latlong, "53.4808,-2.2426");
        assert.equal(p.radius, "27"); // rounded, and quoted in kilometres
        assert.equal(p.unit, "km");
        // Pinning the country is what stops a Kent or Ulster search returning
        // French and Irish listings.
        assert.equal(p.countryCode, "GB");
        assert.equal(p.sort, "date,asc");
        assert.equal(p.size, "100");
        assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(p.startDateTime), p.startDateTime);
      }
    )
  );
});

test("defaults to London when no coordinate is supplied", async () => {
  await withEnv({ TM_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([]),
      async (calls) => {
        await fetchTicketmaster();
        assert.equal(paramsOf(calls[0].url).latlong, "51.5074,-0.1278");
      }
    )
  );
});

test("maps a full event onto the normalised shape", async () => {
  await withEnv({ TM_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([tmEvent()]),
      async () => {
        const [e] = await fetchTicketmaster();
        assert.equal(e.id, "tm-G5vzZ9");
        assert.equal(e.title, "Test Band Live");
        assert.equal(e.category, "Music");
        assert.equal(e.start, "2026-09-12T19:00:00Z");
        assert.equal(e.venue, "O2 Academy Brixton");
        assert.equal(e.address, "211 Stockwell Rd, London");
        assert.equal(e.lat, 51.4657);
        assert.equal(e.lng, -0.1148);
        assert.equal(e.url, "https://www.ticketmaster.co.uk/event/G5vzZ9");
        assert.equal(e.image, "https://img/large.jpg"); // widest wins
        assert.equal(e.source, "Ticketmaster");
        assert.equal(e.price, "£12-£30");
      }
    )
  );
});

test("tolerates a sparse event", async () => {
  const sparse = { id: "X1", name: "Mystery show" };
  await withEnv({ TM_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([sparse]),
      async () => {
        const [e] = await fetchTicketmaster();
        assert.equal(e.id, "tm-X1");
        assert.equal(e.category, "Show");
        assert.equal(e.start, null);
        assert.equal(e.venue, "");
        assert.equal(e.address, "");
        assert.equal(e.lat, null);
        assert.equal(e.lng, null);
        assert.equal(e.image, "");
        assert.equal(e.price, "");
      }
    )
  );
});

test("falls back to the local date, with a 19:00 default time", async () => {
  const cases = [
    [{ start: { localDate: "2026-09-12", localTime: "14:30:00" } }, "2026-09-12T14:30:00"],
    [{ start: { localDate: "2026-09-12" } }, "2026-09-12T19:00:00"],
    [{ start: {} }, null],
  ];
  for (const [dates, expected] of cases) {
    await withEnv({ TM_API_KEY: "k" }, () =>
      withStubbedFetch(
        () => payload([tmEvent({ dates })]),
        async () => {
          const [e] = await fetchTicketmaster();
          assert.equal(e.start, expected);
        }
      )
    );
  }
});

test("returns an empty list when the response carries no events", async () => {
  await withEnv({ TM_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => jsonResponse({ page: { totalElements: 0 } }),
      async () => {
        assert.deepEqual(await fetchTicketmaster(), []);
      }
    )
  );
});

test("throws on a non-ok response so the caller can drop just this source", async () => {
  await withEnv({ TM_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => jsonResponse({}, { ok: false, status: 429 }),
      async () => {
        await assert.rejects(() => fetchTicketmaster(), /Ticketmaster 429/);
      }
    )
  );
});

// MARK: price formatting -----------------------------------------------------

async function priceFor(priceRanges) {
  return withEnv({ TM_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([tmEvent({ priceRanges })]),
      async () => (await fetchTicketmaster())[0].price
    )
  );
}

test("formats a sterling range with pound signs on both ends", async () => {
  assert.equal(await priceFor([{ currency: "GBP", min: 12, max: 30 }]), "£12-£30");
});

test("collapses a single sterling price to one figure", async () => {
  assert.equal(await priceFor([{ currency: "GBP", min: 15, max: 15 }]), "£15");
});

test("assumes sterling when the currency is missing", async () => {
  assert.equal(await priceFor([{ min: 8, max: 20 }]), "£8-£20");
  assert.equal(await priceFor([{ min: 8, max: 8 }]), "£8");
});

test("keeps two decimal places for a non-integer sterling price", async () => {
  assert.equal(await priceFor([{ currency: "GBP", min: 12.5, max: 30.75 }]), "£12.50-£30.75");
  assert.equal(await priceFor([{ currency: "GBP", min: 9.99, max: 9.99 }]), "£9.99");
});

test("labels a non-sterling price with its ISO code instead of a pound sign", async () => {
  // A cross-border listing must never be dressed up as sterling.
  assert.equal(await priceFor([{ currency: "EUR", min: 10, max: 25 }]), "10-25 EUR");
  assert.equal(await priceFor([{ currency: "EUR", min: 40, max: 40 }]), "40 EUR");
  assert.equal(await priceFor([{ currency: "USD", min: 12.5, max: 12.5 }]), "12.50 USD");
});

test("leaves the price blank when the listing has none", async () => {
  assert.equal(await priceFor(undefined), "");
  assert.equal(await priceFor([]), "");
});

test("uses the first price range when several are quoted", async () => {
  assert.equal(
    await priceFor([
      { currency: "GBP", min: 20, max: 20 },
      { currency: "GBP", min: 99, max: 199 },
    ]),
    "£20"
  );
});
