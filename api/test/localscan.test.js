import test from "node:test";
import assert from "node:assert/strict";

import { fetchLocalScan, auditLocalScan } from "../sources/localscan.js";
import { jsonResponse, htmlResponse, withEnv, withForbiddenFetch, withStubbedFetch } from "./helpers.js";

// Every test builds its own throwaway region and its own throwaway page URL.
// scanPage() and geocode() each keep a module level cache keyed by exactly
// those strings, and all tests in this file share one process, so a repeated
// URL or address across two tests would silently serve one test's cached
// result to another. Uniqueness per test is what keeps that from happening,
// not any test-only reset hook.
let n = 0;
function fakeRegion(overrides = {}) {
  n += 1;
  return {
    id: `test-region-${n}`,
    label: `Testford ${n}`,
    area: null,
    nation: "England",
    country: "GB",
    timeZone: "Europe/London",
    unit: "mi",
    lat: 51.0 + n / 1000,
    lng: -1.0 - n / 1000,
    radiusKm: 50,
    claimKm: 120,
    sources: [],
    eventbrite: null,
    ...overrides,
  };
}
function seedFor(region, extra = {}) {
  return { regionId: region.id, url: `https://example.test/page-${n}`, kind: "web", label: "test seed", ...extra };
}

function openaiResponse(events) {
  return jsonResponse({ choices: [{ message: { content: JSON.stringify({ events }) } }] });
}
function nominatimResponse(rows) {
  return jsonResponse(rows);
}
// Enough real-looking text to clear the THIN_CHARS floor and be worth an
// LLM call. Genuinely realistic: this is the shape a council listings page
// or a local paper's "What's On" page actually renders.
function pageHtml({ ogImage = "" } = {}) {
  return `<html><head><title>What's on in town</title>
    <meta property="og:title" content="What's on this week">
    <meta property="og:description" content="A roundup of local events, markets and things happening this week in the town centre and surrounding villages.">
    ${ogImage ? `<meta property="og:image" content="${ogImage}">` : ""}
    </head><body><nav>skip</nav>
    <main>Full listings for the coming weeks, including markets, a fete, and several club nights across the local venues.</main>
    <footer>copyright</footer></body></html>`;
}
function route(url, page, extra = {}) {
  if (url.includes("api.openai.com")) return extra.openai;
  if (url.includes("nominatim.openstreetmap.org")) return extra.nominatim ?? nominatimResponse([]);
  return page;
}

const NO_DELAY = { LOCALSCAN_GEOCODE_DELAY_MS: "0" };

test("returns nothing and makes no request when OPENAI_API_KEY is unset, even with a real seed", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  await withEnv({ OPENAI_API_KEY: undefined }, () =>
    withForbiddenFetch(async () => {
      assert.deepEqual(await fetchLocalScan(region, [seed]), []);
    })
  );
});

test("returns nothing and makes no request when this region has no seed pages", async () => {
  const region = fakeRegion();
  const other = fakeRegion();
  const seedForOther = seedFor(other);
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withForbiddenFetch(async () => {
      // seedForOther.regionId does not match region.id, so nothing here
      // belongs to this region and nothing should be fetched.
      assert.deepEqual(await fetchLocalScan(region, [seedForOther]), []);
    })
  );
});

test("a seed listed for a different region contributes nothing when scanning this one", async () => {
  const regionA = fakeRegion();
  const regionB = fakeRegion();
  const seedA = seedFor(regionA);
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withForbiddenFetch(async () => {
      assert.deepEqual(await fetchLocalScan(regionB, [seedA]), []);
    })
  );
});

test("fetches the page, extracts via the model, and maps onto the shared event shape", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  const page = htmlResponse(pageHtml({ ogImage: "https://example.test/photo.jpg" }));
  const oneEvent = openaiResponse([
    {
      title: "Riverside Market",
      description: "A monthly makers market by the river.",
      category: "Markets",
      startISO: new Date(Date.now() + 5 * 86400000).toISOString(),
      venue: "Riverside Green",
      address: "Riverside Green, Testford",
      isFree: true,
      price: "",
    },
  ]);

  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => route(url, page, { openai: oneEvent, nominatim: nominatimResponse([{ lat: "51.501", lon: "-0.141" }]) }),
      async () => {
        const [e] = await fetchLocalScan(region, [seed]);
        assert.equal(e.title, "Riverside Market");
        assert.equal(e.category, "Markets");
        assert.equal(e.venue, "Riverside Green");
        assert.equal(e.source, "Local pages");
        assert.equal(e.price, "Free");
        assert.equal(e.description, "A monthly makers market by the river.");
        // Real ISO date, not touched beyond re-serialising.
        assert.ok(!Number.isNaN(new Date(e.start).getTime()));
        // The scanned page, never anything the model produced: see the
        // SECURITY note at the top of localscan.js.
        assert.equal(e.url, seed.url);
        assert.equal(e.image, "https://example.test/photo.jpg");
        assert.equal(e.lat, 51.501);
        assert.equal(e.lng, -0.141);
      }
    )
  );
});

test("the event always links to the scanned page, never a url-shaped string the model wrote", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  const page = htmlResponse(pageHtml());
  // A description that itself contains something url-shaped, to prove the
  // mapping never promotes anything out of model text into e.url.
  const trap = openaiResponse([
    {
      title: "Talk and tour",
      description: "Details at https://not-the-real-site.test/tickets, arrive early.",
      category: "Museums",
      startISO: null,
      venue: "Testford Museum",
      address: "",
      isFree: false,
      price: "",
    },
  ]);
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => route(url, page, { openai: trap }),
      async () => {
        const [e] = await fetchLocalScan(region, [seed]);
        assert.equal(e.url, seed.url);
        assert.doesNotMatch(e.url, /not-the-real-site/);
        // The suspicious text is still there as description, which is fine:
        // it is rendered as escaped text, never as a link.
        assert.match(e.description, /not-the-real-site/);
      }
    )
  );
});

test("the image is only ever the page's own og:image; blank when there is none", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  const page = htmlResponse(pageHtml()); // no og:image
  const withDescriptionUrl = openaiResponse([
    { title: "Quiz night", description: "Weekly pub quiz.", category: "Things to do", startISO: null, venue: "The Anchor", address: "", isFree: false, price: "" },
  ]);
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => route(url, page, { openai: withDescriptionUrl }),
      async () => {
        const [e] = await fetchLocalScan(region, [seed]);
        assert.equal(e.image, "");
      }
    )
  );
});

test("an undated event is kept; an implausibly far future date is dropped as a bad extraction", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  const page = htmlResponse(pageHtml());
  const events = openaiResponse([
    { title: "Soon", description: "", category: "Music", startISO: new Date(Date.now() + 3 * 86400000).toISOString(), venue: "", address: "", isFree: false, price: "" },
    { title: "Undated", description: "", category: "Music", startISO: null, venue: "", address: "", isFree: false, price: "" },
    // 900 days out: past MAX_FUTURE_DAYS (400), almost certainly a bad read.
    { title: "TooFarOut", description: "", category: "Music", startISO: new Date(Date.now() + 900 * 86400000).toISOString(), venue: "", address: "", isFree: false, price: "" },
  ]);
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => route(url, page, { openai: events }),
      async () => {
        const out = await fetchLocalScan(region, [seed]);
        const titles = out.map((e) => e.title).sort();
        assert.deepEqual(titles, ["Soon", "Undated"]);
        assert.equal(out.find((e) => e.title === "Undated").start, null);
      }
    )
  );
});

test("an event with no title is dropped rather than shown blank", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  const page = htmlResponse(pageHtml());
  const events = openaiResponse([
    { title: "", description: "", category: "Music", startISO: null, venue: "", address: "", isFree: false, price: "" },
    { title: "Real one", description: "", category: "Music", startISO: null, venue: "", address: "", isFree: false, price: "" },
  ]);
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => route(url, page, { openai: events }),
      async () => {
        const out = await fetchLocalScan(region, [seed]);
        assert.equal(out.length, 1);
        assert.equal(out[0].title, "Real one");
      }
    )
  );
});

test("malformed JSON from the model is treated as nothing found, not a crash", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  const page = htmlResponse(pageHtml());
  const brokenJson = jsonResponse({ choices: [{ message: { content: "not actually json" } }] });
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => route(url, page, { openai: brokenJson }),
      async () => {
        assert.deepEqual(await fetchLocalScan(region, [seed]), []);
      }
    )
  );
});

test("more than the per-page cap is truncated rather than shown in full", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  const page = htmlResponse(pageHtml());
  // Mirrors MAX_EVENTS_PER_PAGE (20) in localscan.js. A page genuinely
  // listing more than that in one scan is rarer than a mis-extraction that
  // read a listings page as many separate events.
  const many = Array.from({ length: 25 }, (_, i) => ({
    title: `Event ${i}`, description: "", category: "Music", startISO: null, venue: "", address: "", isFree: false, price: "",
  }));
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => route(url, page, { openai: openaiResponse(many) }),
      async () => {
        const out = await fetchLocalScan(region, [seed]);
        assert.equal(out.length, 20);
      }
    )
  );
});

test("thin page content is never sent to the model at all", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  const thin = htmlResponse("<html><body>Hi</body></html>");
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => {
        if (url.includes("api.openai.com")) throw new Error("should never be called for a thin page");
        return thin;
      },
      async () => {
        assert.deepEqual(await fetchLocalScan(region, [seed]), []);
      }
    )
  );
});

test("a page that fails to fetch returns nothing rather than throwing", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => (url.includes("api.openai.com") ? undefined : htmlResponse("", { ok: false, status: 500 })),
      async () => {
        assert.deepEqual(await fetchLocalScan(region, [seed]), []);
      }
    )
  );
});

test("a cached page is not re-fetched, re-extracted or re-geocoded on the next call", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  const page = htmlResponse(pageHtml());
  const oneEvent = openaiResponse([
    { title: "Cached fete", description: "", category: "Family", startISO: null, venue: "Green", address: "Testford", isFree: true, price: "" },
  ]);
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => route(url, page, { openai: oneEvent, nominatim: nominatimResponse([{ lat: "1", lon: "2" }]) }),
      async (calls) => {
        const first = await fetchLocalScan(region, [seed]);
        assert.equal(first.length, 1);
        const callsAfterFirst = calls.length;
        assert.ok(callsAfterFirst > 0);

        const second = await fetchLocalScan(region, [seed]);
        assert.equal(second.length, 1);
        assert.equal(calls.length, callsAfterFirst, "the second call should not touch the network at all");
      }
    )
  );
});

test("one page seeded for two regions costs one LLM call but yields each region its own events", async () => {
  // The case this guards: a district council or tourism board page covers
  // every town in the district, so the same url is legitimately seeded for
  // several regions. Caching finished events against the url would hand the
  // second region the first region's events, with the first region's id in
  // the event ids and the first region's centre as the coordinate fallback,
  // and nothing would look broken enough to notice.
  const regionA = fakeRegion();
  const regionB = fakeRegion();
  const sharedUrl = `https://example.test/district-${n}`;
  const seedA = { regionId: regionA.id, url: sharedUrl, kind: "web", label: "district page" };
  const seedB = { regionId: regionB.id, url: sharedUrl, kind: "web", label: "district page" };
  const page = htmlResponse(pageHtml());
  const oneEvent = openaiResponse([
    { title: "District fete", description: "", category: "Family", startISO: null, venue: "Nowhere findable at all", address: "", isFree: false, price: "" },
  ]);

  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => route(url, page, { openai: oneEvent, nominatim: nominatimResponse([]) }),
      async (calls) => {
        const outA = await fetchLocalScan(regionA, [seedA]);
        const llmCallsAfterA = calls.filter((c) => c.url.includes("api.openai.com")).length;
        const outB = await fetchLocalScan(regionB, [seedB]);
        const llmCallsAfterB = calls.filter((c) => c.url.includes("api.openai.com")).length;

        assert.equal(outA.length, 1);
        assert.equal(outB.length, 1);

        // The whole point of the url-keyed cache: the expensive half is not
        // repeated for the second region.
        assert.equal(llmCallsAfterA, 1);
        assert.equal(llmCallsAfterB, 1, "the second region must not pay for another extraction");

        // But the cheap, region-specific half is genuinely redone.
        assert.notEqual(outA[0].id, outB[0].id, "event ids must carry their own region");
        assert.match(outA[0].id, new RegExp(regionA.id));
        assert.match(outB[0].id, new RegExp(regionB.id));
        // Unresolvable address, so each falls back to its OWN region centre.
        assert.equal(outA[0].lat, regionA.lat);
        assert.equal(outB[0].lat, regionB.lat);
        assert.notEqual(outA[0].lat, outB[0].lat);
      }
    )
  );
});

test("a scan that runs out of budget returns what it has, and leaves the rest cached for next time", async () => {
  // server.js kills any source that takes over 90 seconds and discards
  // everything it produced. A cold scan of a well-seeded town can genuinely
  // take that long, so the source stops starting new pages at its own budget
  // and returns partial results instead of risking the lot.
  const region = fakeRegion();
  const seeds = Array.from({ length: 6 }, (_, i) => ({
    regionId: region.id,
    url: `https://example.test/budget-${n}-${i}`,
    kind: "web",
    label: `page ${i}`,
  }));
  const page = htmlResponse(pageHtml());
  const oneEvent = openaiResponse([
    { title: "Something on", description: "", category: "Music", startISO: null, venue: "", address: "", isFree: false, price: "" },
  ]);

  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY, LOCALSCAN_BUDGET_MS: "0" }, () =>
    withStubbedFetch(
      (url) => route(url, page, { openai: oneEvent }),
      async (calls) => {
        // Budget of 0 means the deadline has already passed, so no page is
        // even started. The point is that this resolves to an empty list
        // rather than hanging or throwing.
        const out = await fetchLocalScan(region, seeds);
        assert.deepEqual(out, []);
        assert.equal(calls.length, 0, "no page should be fetched once the budget is gone");
      }
    )
  );

  // With a real budget the same seeds now work, proving the guard is the
  // budget and not something permanently broken.
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => route(url, page, { openai: oneEvent }),
      async () => {
        const out = await fetchLocalScan(region, seeds);
        assert.equal(out.length, 6);
      }
    )
  );
});

test("two events at the same address geocode once and share the result; an unresolved address falls back to the region centre", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  const page = htmlResponse(pageHtml());
  const twoEvents = openaiResponse([
    { title: "First", description: "", category: "Music", startISO: null, venue: "Testford Hall", address: "1 High St", isFree: false, price: "" },
    { title: "Second", description: "", category: "Music", startISO: null, venue: "Testford Hall", address: "1 High St", isFree: false, price: "" },
    { title: "Nowhere findable", description: "", category: "Music", startISO: null, venue: "Somewhere made up", address: "", isFree: false, price: "" },
  ]);
  await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, () =>
    withStubbedFetch(
      (url) => {
        if (url.includes("nominatim.openstreetmap.org")) {
          // The made-up venue resolves to nothing; the real address does.
          return url.includes("Somewhere") ? nominatimResponse([]) : nominatimResponse([{ lat: "52.1", lon: "-1.9" }]);
        }
        return route(url, page, { openai: twoEvents });
      },
      async (calls) => {
        const out = await fetchLocalScan(region, [seed]);
        const [first, second, unresolved] = ["First", "Second", "Nowhere findable"].map((t) =>
          out.find((e) => e.title === t)
        );
        assert.equal(first.lat, 52.1);
        assert.equal(first.lng, -1.9);
        assert.equal(second.lat, 52.1);
        assert.equal(second.lng, -1.9);
        // Falls back to the region's own centre, not left null.
        assert.equal(unresolved.lat, region.lat);
        assert.equal(unresolved.lng, region.lng);

        // One geocode call for the shared address, one for the unresolved
        // one: not three, because "First" and "Second" share a cache key.
        const geocodeCalls = calls.filter((c) => c.url.includes("nominatim.openstreetmap.org"));
        assert.equal(geocodeCalls.length, 2);
      }
    )
  );
});

// --- the per-region seed cap -------------------------------------------------

test("a region listing more pages than the cap only scans up to the cap", async () => {
  // Guards the case the cap exists for: one town with a huge list spending the
  // whole scan budget on itself and starving its own tail for ever.
  const region = fakeRegion();
  const seeds = Array.from({ length: 40 }, (_, i) => ({
    regionId: region.id,
    url: `https://example.org/page-${i}`,
    kind: "web",
    label: `page ${i}`,
  }));
  const fetched = [];
  await withEnv(
    { OPENAI_API_KEY: "k", LOCALSCAN_MAX_SEEDS_PER_REGION: "24" },
    async () => {
      globalThis.fetch = async (url) => {
        fetched.push(String(url));
        // Deliberately thin, so isThin() short circuits before any LLM call and
        // the test exercises seed selection rather than extraction.
        return { ok: true, status: 200, text: async () => "<html><body>x</body></html>" };
      };
      await fetchLocalScan(region, seeds);
    }
  );
  const pages = fetched.filter((u) => u.includes("/page-"));
  assert.equal(pages.length, 24, `scanned ${pages.length} pages, expected the cap of 24`);
});

test("the cap is applied in file order, so which pages are watched is deterministic", async () => {
  const region = fakeRegion();
  const seeds = Array.from({ length: 30 }, (_, i) => ({
    regionId: region.id,
    url: `https://example.org/p${i}`,
    kind: "web",
    label: `p${i}`,
  }));
  const seen = new Set();
  await withEnv(
    { OPENAI_API_KEY: "k", LOCALSCAN_MAX_SEEDS_PER_REGION: "5" },
    async () => {
      globalThis.fetch = async (url) => {
        seen.add(String(url));
        return { ok: true, status: 200, text: async () => "<html><body>x</body></html>" };
      };
      await fetchLocalScan(region, seeds);
    }
  );
  for (let i = 0; i < 5; i++) {
    assert.ok(seen.has(`https://example.org/p${i}`), `p${i} should be watched`);
  }
  assert.ok(!seen.has("https://example.org/p5"), "p5 is past the cap and should not be watched");
});

// --- not paying twice for a page that has not changed -----------------------

test("an unchanged page is re-fetched but not re-extracted", async () => {
  // This is where nearly all of the running cost sits. A council what's-on
  // page that changes twice a month was being sent to the model every TTL
  // window regardless, which is what this short circuit stops.
  const region = fakeRegion();
  const seed = seedFor(region);
  const body = `<html><body><h1>What's on</h1>${"Live music at the hall on 3 September. ".repeat(30)}</body></html>`;
  let fetches = 0, extractions = 0;

  await withEnv({ OPENAI_API_KEY: "k", LOCALSCAN_PAGE_TTL_MS: "0" }, async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes("openai.com")) {
        extractions += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: '{"events":[]}' } }] }),
        };
      }
      fetches += 1;
      return { ok: true, status: 200, text: async () => body };
    };

    // TTL of 0 means every pass considers the entry stale, so without the hash
    // check this would extract three times.
    await fetchLocalScan(region, [seed]);
    await fetchLocalScan(region, [seed]);
    await fetchLocalScan(region, [seed]);
  });

  assert.equal(fetches, 3, "the page should still be fetched each pass");
  assert.equal(extractions, 1, `expected one extraction, paid for ${extractions}`);
});

test("a changed page is extracted again", async () => {
  const region = fakeRegion();
  const seed = seedFor(region);
  let extractions = 0;
  let version = 1;

  await withEnv({ OPENAI_API_KEY: "k", LOCALSCAN_PAGE_TTL_MS: "0" }, async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes("openai.com")) {
        extractions += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: '{"events":[]}' } }] }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => `<html><body>${`Gig number ${version} on 3 September. `.repeat(30)}</body></html>`,
      };
    };
    await fetchLocalScan(region, [seed]);
    version = 2;                       // the venue added something
    await fetchLocalScan(region, [seed]);
  });

  assert.equal(extractions, 2, "new content has to be read, not reused");
});

test("an unchanged page is re-extracted once it passes the max age", async () => {
  // Guards the staleness bound: the prompt is given today's date, so an
  // extraction of "this Saturday" cannot be reused indefinitely even behind a
  // page that never changes.
  const region = fakeRegion();
  const seed = seedFor(region);
  const body = `<html><body>${"Quiz night this Saturday at the club. ".repeat(30)}</body></html>`;
  let extractions = 0;

  await withEnv(
    { OPENAI_API_KEY: "k", LOCALSCAN_PAGE_TTL_MS: "0", LOCALSCAN_PAGE_MAX_AGE_MS: "0" },
    async () => {
      globalThis.fetch = async (url) => {
        if (String(url).includes("openai.com")) {
          extractions += 1;
          return {
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: '{"events":[]}' } }] }),
          };
        }
        return { ok: true, status: 200, text: async () => body };
      };
      await fetchLocalScan(region, [seed]);
      await fetchLocalScan(region, [seed]);
    }
  );

  assert.equal(extractions, 2, "past the max age the extraction must be redone");
});

test("the audit separates a url that cannot be fetched from one that is merely thin", async () => {
  // Regression guard. extractForPage() catches a failed fetch and returns the
  // same thin entry it returns for a page with no text, which is right for the
  // scan path and wrong for the audit: the first full run reported "failed to
  // fetch 0%" while whole towns were failing every request, because a dead
  // domain and a JavaScript-rendered venue page were landing in one bucket.
  // Those two want opposite treatment, so the two cases have to stay tellable
  // apart.
  const region = fakeRegion();
  const dead = seedFor(region, { url: `https://dead-${n}.test/whats-on` });
  const bare = seedFor(region, { url: `https://bare-${n}.test/whats-on` });

  const rows = await withEnv({ OPENAI_API_KEY: "k", ...NO_DELAY }, async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes("dead-")) throw new Error("fetch failed");
      return htmlResponse("<html><body>nothing here</body></html>");
    };
    return auditLocalScan(region, [dead, bare]);
  });

  const byUrl = new Map(rows.map((r) => [r.url, r]));
  assert.equal(byUrl.get(dead.url).why, "fetch");
  assert.match(byUrl.get(dead.url).error, /fetch failed/);
  assert.equal(byUrl.get(bare.url).why, "thin");
  assert.equal(byUrl.get(bare.url).error, null, "a thin page is not an error, it is just empty");
  // Both are thin as far as the scan path is concerned, which is the whole
  // reason the audit needs its own signal.
  assert.ok(byUrl.get(dead.url).thin && byUrl.get(bare.url).thin);
});
