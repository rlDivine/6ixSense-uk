import test from "node:test";
import assert from "node:assert/strict";

import { fetchEventbrite } from "../sources/eventbrite.js";
import { htmlResponse, withStubbedFetch } from "./helpers.js";

// The source reads a schema.org ItemList out of the server-rendered HTML, so
// the fixtures here are the shape of that JSON-LD block rather than an API
// payload. Only the fields the source actually touches are present.
function ldEvent(overrides = {}) {
  return {
    name: "Jazz at the Vortex",
    url: "https://www.eventbrite.co.uk/e/jazz-at-the-vortex-tickets-1234567",
    startDate: "2026-09-12T20:00:00+01:00",
    image: "https://img.evbuc.com/large.jpg",
    location: {
      name: "Vortex Jazz Club",
      address: { streetAddress: "11 Gillett Square", addressLocality: "London" },
      geo: { latitude: "51.5486", longitude: "-0.0754" },
    },
    ...overrides,
  };
}

/// A discovery page carrying an ItemList of the given events.
function page(events, { extraBlocks = [] } = {}) {
  const blocks = [
    ...extraBlocks,
    JSON.stringify({
      "@type": "ItemList",
      itemListElement: events.map((e) => ({ item: e })),
    }),
  ];
  return `<!doctype html><html><head>${blocks
    .map((b) => `<script type="application/ld+json">${b}</script>`)
    .join("")}</head><body></body></html>`;
}

/// Serve one page per vertical. `byCategory` maps a URL fragment to its events;
/// anything unlisted gets an empty ItemList, which is what an off-season
/// vertical really returns.
function serve(byCategory) {
  return (url) => {
    for (const [fragment, events] of Object.entries(byCategory)) {
      if (url.includes(fragment)) return htmlResponse(page(events));
    }
    return htmlResponse(page([]));
  };
}

test("parses the JSON-LD ItemList into events", async () => {
  await withStubbedFetch(serve({ "/music--events/": [ldEvent()] }), async () => {
    const out = await fetchEventbrite();
    assert.equal(out.length, 1);
    const e = out[0];
    assert.equal(e.title, "Jazz at the Vortex");
    assert.equal(e.venue, "Vortex Jazz Club");
    assert.equal(e.address, "11 Gillett Square, London");
    assert.equal(e.source, "Eventbrite");
    assert.equal(e.lat, 51.5486);
    assert.equal(e.lng, -0.0754);
  });
});

test("the vertical a listing came from becomes its category", async () => {
  await withStubbedFetch(
    serve({
      "/music--events/": [ldEvent({ url: "https://eb/e/a-1" })],
      "--comedy--events/": [ldEvent({ url: "https://eb/e/b-2" })],
      "/sports-and-fitness--events/": [ldEvent({ url: "https://eb/e/c-3" })],
    }),
    async () => {
      const out = await fetchEventbrite();
      const cats = Object.fromEntries(out.map((e) => [e.url, e.category]));
      assert.equal(cats["https://eb/e/a-1"], "Music");
      assert.equal(cats["https://eb/e/b-2"], "Comedy");
      assert.equal(cats["https://eb/e/c-3"], "Sports");
    }
  );
});

test("hits every vertical, and none of them more than once", async () => {
  await withStubbedFetch(serve({}), async (calls) => {
    await fetchEventbrite();
    assert.equal(calls.length, 11);
    assert.equal(new Set(calls.map((c) => c.url)).size, 11);
    // All eleven are on the UK site, not eventbrite.com.
    for (const c of calls) assert.match(c.url, /^https:\/\/www\.eventbrite\.co\.uk\/d\//);
  });
});

test("de-dupes across verticals, and the most specific one wins the category", async () => {
  const shared = "https://www.eventbrite.co.uk/e/same-gig-tickets-999";
  await withStubbedFetch(
    serve({
      // Music is queried before the general "Things to do" feed.
      "/music--events/": [ldEvent({ url: shared })],
      "/united-kingdom--london/events/": [ldEvent({ url: shared })],
    }),
    async () => {
      const out = await fetchEventbrite();
      assert.equal(out.length, 1);
      assert.equal(out[0].category, "Music");
    }
  );
});

test("a later Free hit upgrades the price without changing the category", async () => {
  const shared = "https://www.eventbrite.co.uk/e/free-gig-tickets-321";
  await withStubbedFetch(
    serve({
      "/music--events/": [ldEvent({ url: shared })],
      "/free--events/": [ldEvent({ url: shared })],
    }),
    async () => {
      const out = await fetchEventbrite();
      assert.equal(out.length, 1);
      assert.equal(out[0].category, "Music");
      assert.equal(out[0].price, "Free");
    }
  );
});

test("a date with no time is treated as an evening event", async () => {
  await withStubbedFetch(
    serve({ "/music--events/": [ldEvent({ startDate: "2026-09-12" })] }),
    async () => {
      const out = await fetchEventbrite();
      // The server runs in UTC, where 19:00 local is 19:00Z.
      assert.match(out[0].start, /^2026-09-12T19:00/);
    }
  );
});

// The regression this file was written for. `new Date("nonsense").toISOString()`
// raises a RangeError, and every listing on a page is mapped in one pass whose
// rejection the caller swallows into an empty list. One malformed date used to
// cost the entire vertical.
test("one unparseable date costs one event, not the whole vertical", async () => {
  await withStubbedFetch(
    serve({
      "/music--events/": [
        ldEvent({ url: "https://eb/e/bad-1", startDate: "sometime next year" }),
        ldEvent({ url: "https://eb/e/good-2" }),
        ldEvent({ url: "https://eb/e/good-3" }),
      ],
    }),
    async () => {
      const out = await fetchEventbrite();
      assert.equal(out.length, 3);
      const bad = out.find((e) => e.url === "https://eb/e/bad-1");
      assert.equal(bad.start, null);
      assert.ok(out.find((e) => e.url === "https://eb/e/good-2").start);
    }
  );
});

test("a missing startDate is null rather than a crash or a fake date", async () => {
  await withStubbedFetch(
    serve({ "/music--events/": [ldEvent({ startDate: undefined })] }),
    async () => {
      const out = await fetchEventbrite();
      assert.equal(out[0].start, null);
    }
  );
});

test("a listing with no coordinates still comes through", async () => {
  await withStubbedFetch(
    serve({ "/music--events/": [ldEvent({ location: { name: "TBC" } })] }),
    async () => {
      const out = await fetchEventbrite();
      assert.equal(out.length, 1);
      assert.equal(out[0].lat, null);
      assert.equal(out[0].lng, null);
      assert.equal(out[0].venue, "TBC");
    }
  );
});

test("a malformed JSON-LD block does not stop the real one being found", async () => {
  await withStubbedFetch(
    (url) =>
      url.includes("/music--events/")
        ? htmlResponse(page([ldEvent()], { extraBlocks: ["{ this is not json"] }))
        : htmlResponse(page([])),
    async () => {
      const out = await fetchEventbrite();
      assert.equal(out.length, 1);
      assert.equal(out[0].title, "Jazz at the Vortex");
    }
  );
});

test("one failing vertical does not take the others down", async () => {
  await withStubbedFetch(
    (url) => {
      if (url.includes("/music--events/")) return htmlResponse("upstream is down", { ok: false, status: 503 });
      if (url.includes("--comedy--events/")) return htmlResponse(page([ldEvent({ url: "https://eb/e/c-1" })]));
      return htmlResponse(page([]));
    },
    async () => {
      const out = await fetchEventbrite();
      assert.equal(out.length, 1);
      assert.equal(out[0].category, "Comedy");
    }
  );
});

test("a region with no Eventbrite city mapped makes no requests at all", async () => {
  await withStubbedFetch(
    (url) => {
      throw new Error(`unexpected network call to ${url}`);
    },
    async (calls) => {
      assert.deepEqual(await fetchEventbrite(null), []);
      assert.equal(calls.length, 0);
    }
  );
});

test("a supplied site is used instead of the London default", async () => {
  await withStubbedFetch(serve({}), async (calls) => {
    await fetchEventbrite({ host: "www.eventbrite.co.uk", slug: "united-kingdom--manchester" });
    for (const c of calls) assert.match(c.url, /united-kingdom--manchester/);
  });
});
