import test from "node:test";
import assert from "node:assert/strict";

import { fetchPredictHQ } from "../sources/predicthq.js";
import { jsonResponse, paramsOf, withEnv, withForbiddenFetch, withStubbedFetch } from "./helpers.js";

// Synthetic payload, shaped from the PredictHQ Events API fields the source
// reads. Real fields not read (labels, rank, phq_attendance, scope, geo,
// place_hierarchies, state, duration) are left out.
function phqEvent(overrides = {}) {
  return {
    id: "Fjfg5zt5xpFmBtXjWZ",
    title: "Radiohead",
    description: "",
    category: "concerts",
    start: "2026-09-12T19:00:00Z",
    timezone: "Europe/London",
    // GeoJSON order: [longitude, latitude].
    location: [-0.0038, 51.503],
    country: "GB",
    entities: [
      { entity_id: "abc", name: "The O2", type: "venue", formatted_address: "Peninsula Square, London SE10 0DX" },
    ],
    ...overrides,
  };
}

function payload(results) {
  return jsonResponse({ count: results.length, results });
}

test("returns an empty list and makes no request when PREDICTHQ_API_KEY is unset", async () => {
  await withEnv({ PREDICTHQ_API_KEY: undefined }, () =>
    withForbiddenFetch(async () => {
      assert.deepEqual(await fetchPredictHQ(), []);
      assert.deepEqual(await fetchPredictHQ({ lat: 53.48, lng: -2.24, radiusKm: 25 }), []);
    })
  );
});

test("authenticates with a Bearer header, not a query parameter", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "test-token" }, () =>
    withStubbedFetch(
      () => payload([]),
      async (calls) => {
        await fetchPredictHQ();
        assert.equal(calls.length, 1);
        assert.equal(calls[0].opts.headers.Authorization, "Bearer test-token");
        // Never as ?apikey=... or similar: the token would end up in server logs.
        assert.doesNotMatch(calls[0].url, /test-token/);
      }
    )
  );
});

test("builds a GB-scoped kilometre radius search around the given point", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([]),
      async (calls) => {
        await fetchPredictHQ({ lat: 53.4808, lng: -2.2426, radiusKm: 27.4 });
        const p = paramsOf(calls[0].url);
        assert.equal(p.within, "27km@53.4808,-2.2426"); // rounded, and km
        assert.equal(p.country, "GB");
      }
    )
  );
});

test("queries only the categories a discovery app would show", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([]),
      async (calls) => {
        await fetchPredictHQ();
        const cats = paramsOf(calls[0].url).category.split(",");
        for (const c of ["concerts", "festivals", "performing-arts", "community", "expos", "sports"]) {
          assert.ok(cats.includes(c), `expected ${c} in the category filter`);
        }
        // Forecasting-only categories have no place in a "what's on" feed.
        for (const c of ["conferences", "academic", "politics", "public-holidays", "severe-weather"]) {
          assert.ok(!cats.includes(c), `${c} should not be requested`);
        }
      }
    )
  );
});

test("maps a full event onto the normalised shape", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([phqEvent()]),
      async () => {
        const [e] = await fetchPredictHQ();
        assert.equal(e.id, "phq-Fjfg5zt5xpFmBtXjWZ");
        assert.equal(e.title, "Radiohead");
        assert.equal(e.category, "Music");
        assert.equal(e.start, "2026-09-12T19:00:00Z");
        assert.equal(e.venue, "The O2");
        assert.equal(e.address, "Peninsula Square, London SE10 0DX");
        // GeoJSON order flipped back to plain lat/lng.
        assert.equal(e.lat, 51.503);
        assert.equal(e.lng, -0.0038);
        assert.equal(e.source, "PredictHQ");
      }
    )
  );
});

test("carries no url, image or price: the source has none of the three", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([phqEvent()]),
      async () => {
        const [e] = await fetchPredictHQ();
        assert.equal(e.url, "");
        assert.equal(e.image, "");
        assert.equal(e.price, "");
      }
    )
  );
});

test("a real description is carried through, unlike every other source", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([phqEvent({ description: "The UK's biggest comic and gaming convention." })]),
      async () => {
        const [e] = await fetchPredictHQ();
        assert.equal(e.description, "The UK's biggest comic and gaming convention.");
      }
    )
  );
});

test("maps every requested category onto the shared vocabulary", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "k" }, () =>
    withStubbedFetch(
      () =>
        payload([
          phqEvent({ id: "1", category: "concerts" }),
          phqEvent({ id: "2", category: "festivals" }),
          phqEvent({ id: "3", category: "performing-arts" }),
          phqEvent({ id: "4", category: "sports" }),
          phqEvent({ id: "5", category: "expos" }),
          phqEvent({ id: "6", category: "community" }),
        ]),
      async () => {
        const out = await fetchPredictHQ();
        const byId = Object.fromEntries(out.map((e) => [e.id, e.category]));
        assert.equal(byId["phq-1"], "Music");
        assert.equal(byId["phq-2"], "Festivals");
        assert.equal(byId["phq-3"], "Theatre");
        assert.equal(byId["phq-4"], "Sport");
        assert.equal(byId["phq-5"], "Things to do");
        assert.equal(byId["phq-6"], "Things to do");
      }
    )
  );
});

test("an unrecognised category falls back to Things to do rather than being dropped", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([phqEvent({ category: "some-future-category" })]),
      async () => {
        const [e] = await fetchPredictHQ();
        assert.equal(e.category, "Things to do");
      }
    )
  );
});

test("falls back through entity types when there is no venue-typed entity", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "k" }, () =>
    withStubbedFetch(
      () =>
        payload([
          phqEvent({
            entities: [{ entity_id: "x", name: "Hyde Park", type: "place", formatted_address: "London" }],
          }),
        ]),
      async () => {
        const [e] = await fetchPredictHQ();
        assert.equal(e.venue, "Hyde Park");
        assert.equal(e.address, "London");
      }
    )
  );
});

test("tolerates a sparse event with no entities and no location", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => payload([{ id: "9", title: "Fallback title", category: "community" }]),
      async () => {
        const [e] = await fetchPredictHQ();
        assert.equal(e.id, "phq-9");
        assert.equal(e.title, "Fallback title");
        assert.equal(e.venue, "");
        assert.equal(e.address, "");
        assert.equal(e.lat, null);
        assert.equal(e.lng, null);
      }
    )
  );
});

test("an error response throws rather than silently returning nothing", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => jsonResponse({ error: "invalid token" }, { ok: false, status: 401 }),
      async () => {
        await assert.rejects(() => fetchPredictHQ(), /PredictHQ 401/);
      }
    )
  );
});

test("a missing results array is treated as no events, not a crash", async () => {
  await withEnv({ PREDICTHQ_API_KEY: "k" }, () =>
    withStubbedFetch(
      () => jsonResponse({ count: 0 }),
      async () => {
        assert.deepEqual(await fetchPredictHQ(), []);
      }
    )
  );
});
