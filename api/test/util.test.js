import test from "node:test";
import assert from "node:assert/strict";

import { canonicalCategory, decodeEntities, distanceKm, makeEvent, safeUrl } from "../sources/util.js";
import { greatCircleKm } from "./helpers.js";

const LONDON = [51.5074, -0.1278];
const MANCHESTER = [53.4808, -2.2426];
const EDINBURGH = [55.9533, -3.1883];
const CARDIFF = [51.4816, -3.1791];

function within(actual, expected, fraction) {
  return Math.abs(actual - expected) <= expected * fraction;
}

test("distanceKm matches known UK city pairs to within 3 per cent", () => {
  const cases = [
    ["London to Manchester", LONDON, MANCHESTER, 262],
    ["London to Edinburgh", LONDON, EDINBURGH, 534],
    ["London to Cardiff", LONDON, CARDIFF, 211],
  ];
  for (const [label, a, b, expected] of cases) {
    const got = distanceKm(a[0], a[1], b[0], b[1]);
    assert.ok(
      within(got, expected, 0.03),
      `${label}: expected about ${expected} km, got ${got}`
    );
  }
});

test("distanceKm agrees with an independent great-circle formula", () => {
  const points = [LONDON, MANCHESTER, EDINBURGH, CARDIFF, [54.5973, -5.9301]];
  for (const a of points) {
    for (const b of points) {
      const got = distanceKm(a[0], a[1], b[0], b[1]);
      const ref = greatCircleKm(a[0], a[1], b[0], b[1]);
      assert.ok(
        Math.abs(got - ref) < 0.01,
        `haversine ${got} vs law of cosines ${ref} for ${a} to ${b}`
      );
    }
  }
});

test("distanceKm is zero for a point against itself and is symmetric", () => {
  assert.equal(distanceKm(51.5074, -0.1278, 51.5074, -0.1278), 0);
  const there = distanceKm(...LONDON, ...EDINBURGH);
  const back = distanceKm(...EDINBURGH, ...LONDON);
  assert.ok(Math.abs(there - back) < 1e-9);
});

test("distanceKm returns null rather than NaN for unusable input", () => {
  // A null here would otherwise poison every downstream radius comparison, so
  // the source has to reject non-numbers outright.
  const bad = [
    [null, 0, 0, 0],
    [0, null, 0, 0],
    [0, 0, null, 0],
    [0, 0, 0, null],
    [undefined, 0, 0, 0],
    ["51.5074", -0.1278, 53.4808, -2.2426],
    [51.5074, "-0.1278", 53.4808, -2.2426],
    [NaN, 0, 0, 0],
    [0, 0, 0, NaN],
    [{}, 0, 0, 0],
    [[], 0, 0, 0],
  ];
  for (const args of bad) {
    assert.equal(distanceKm(...args), null, `expected null for ${JSON.stringify(args)}`);
  }
  assert.equal(distanceKm(), null);
});

test("decodeEntities handles numeric, hex and named entities", () => {
  assert.equal(decodeEntities("Caf&#233;"), "Café");
  assert.equal(decodeEntities("&#x2013;"), "–");
  assert.equal(decodeEntities("&#X1F600;"), "\u{1F600}");
  assert.equal(decodeEntities("Rock &amp; Roll"), "Rock & Roll");
  assert.equal(decodeEntities("&quot;Live&quot;"), '"Live"');
  assert.equal(decodeEntities("Ronnie Scott&#039;s"), "Ronnie Scott's");
  assert.equal(decodeEntities("Ronnie Scott&apos;s"), "Ronnie Scott's");
  assert.equal(decodeEntities("&lt;b&gt;"), "<b>");
  assert.equal(decodeEntities("a&nbsp;b"), "a b");
  assert.equal(decodeEntities("&#233;&#232;"), "éè");
});

test("decodeEntities passes empty and falsy input straight through", () => {
  assert.equal(decodeEntities(""), "");
  assert.equal(decodeEntities(null), null);
  assert.equal(decodeEntities(undefined), undefined);
  assert.equal(decodeEntities("plain text"), "plain text");
});

test("decodeEntities does not re-decode an already escaped ampersand", () => {
  // "&amp;#39;" is a literal "&#39;" in the feed, not an apostrophe. Decoding
  // twice would silently corrupt titles that quote markup.
  assert.equal(decodeEntities("&amp;#39;"), "&#39;");
});

test("makeEvent fills every field with a safe default", () => {
  const e = makeEvent({ id: 42, title: "  Gig night  " });
  assert.deepEqual(e, {
    id: "42",
    title: "Gig night",
    category: "Things to do",
    start: null,
    venue: "",
    address: "",
    lat: null,
    lng: null,
    url: "",
    image: "",
    source: "",
    price: "",
    description: "",
  });
});

test("makeEvent falls back to a placeholder title", () => {
  assert.equal(makeEvent({ id: 1 }).title, "Untitled event");
  assert.equal(makeEvent({ id: 1, title: "" }).title, "Untitled event");
  assert.equal(makeEvent({ id: 1, title: null }).title, "Untitled event");
});

test("makeEvent decodes entities in the text fields", () => {
  const e = makeEvent({
    id: "x",
    title: "Rock &amp; Roll",
    category: "Food &amp; Drink",
    venue: "Ronnie Scott&#039;s",
    address: "47 Frith St &amp; Soho",
  });
  assert.equal(e.title, "Rock & Roll");
  assert.equal(e.category, "Food");
  assert.equal(e.venue, "Ronnie Scott's");
  assert.equal(e.address, "47 Frith St & Soho");
});

test("makeEvent decodes and trims the description, most sources never set one", () => {
  assert.equal(makeEvent({ id: 1 }).description, "");
  assert.equal(
    makeEvent({ id: 1, description: "  Fish &amp; chips, live music.  " }).description,
    "Fish & chips, live music."
  );
});

test("makeEvent coerces coordinates and keeps zero", () => {
  assert.equal(makeEvent({ id: 1, lat: 51.5, lng: -0.12 }).lat, 51.5);
  assert.equal(makeEvent({ id: 1, lat: "51.5", lng: "-0.12" }).lng, -0.12);
  // Greenwich sits on longitude 0, so a falsy-but-valid zero must survive.
  assert.equal(makeEvent({ id: 1, lat: 0, lng: 0 }).lat, 0);
  assert.equal(makeEvent({ id: 1, lat: "0", lng: "0" }).lng, 0);
  assert.equal(makeEvent({ id: 1, lat: "", lng: null }).lat, null);
  assert.equal(makeEvent({ id: 1 }).lng, null);
});

test("makeEvent stringifies the id so sources cannot collide on type", () => {
  assert.strictEqual(makeEvent({ id: 7 }).id, "7");
  assert.strictEqual(makeEvent({ id: "7" }).id, "7");
});

// Every url and image in the feed comes from a third party, and one source
// (Eventbrite) is a page anyone can publish to. A "javascript:" link reaching a
// client is script execution in the app's own origin the moment the user taps
// the primary action, so the scheme is checked when the event is built.
test("safeUrl keeps ordinary http and https links untouched", () => {
  for (const u of [
    "https://www.eventbrite.co.uk/e/gig-tickets-123",
    "http://example.com/a?b=c&d=e#f",
    "https://img.evbuc.com/x.jpg",
  ]) {
    assert.equal(safeUrl(u), u);
  }
});

test("safeUrl drops every scheme that is not http or https", () => {
  for (const u of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)  ",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "blob:https://example.com/uuid",
  ]) {
    assert.equal(safeUrl(u), "", `expected to be dropped: ${u}`);
  }
});

test("safeUrl drops anything it cannot parse, rather than passing it on", () => {
  for (const u of ["/relative/path", "not a url", "//protocol-relative", "", null, undefined, 42, {}]) {
    assert.equal(safeUrl(u), "");
  }
});

test("makeEvent sanitises both url and image, not just url", () => {
  const e = makeEvent({
    id: "1",
    title: "Gig",
    url: "javascript:window.x=1",
    image: "x');background:url('https://evil.example/beacon.png",
  });
  assert.equal(e.url, "");
  assert.equal(e.image, "");
});

test("makeEvent leaves a legitimate listing's links alone", () => {
  const e = makeEvent({
    id: "1",
    title: "Gig",
    url: "https://www.skiddle.com/e/123",
    image: "https://cdn.skiddle.com/large.jpg",
  });
  assert.equal(e.url, "https://www.skiddle.com/e/123");
  assert.equal(e.image, "https://cdn.skiddle.com/large.jpg");
});

// The design's colour table is keyed on this vocabulary, so a source spelling
// that does not fold onto it shows up as a grey fallback chip in the app.
test("canonicalCategory folds every spelling the sources actually emit", () => {
  const cases = {
    // Ticketmaster segments
    Music: "Music", Sports: "Sport", "Arts & Theatre": "Theatre", Film: "Film",
    Miscellaneous: "Things to do",
    // Eventbrite verticals
    "Food & Drink": "Food", Festival: "Festivals", Comedy: "Comedy",
    "Pop-up": "Markets", Family: "Family", "Things to do": "Things to do",
    // Skiddle, after its own code table
    "Live music": "Live music", Clubs: "Clubs", Museums: "Museums",
    // Curated
    Market: "Markets", Tours: "Museums", Arts: "Theatre",
    // Football is kept apart from sport in general
    Football: "Football",
  };
  for (const [raw, want] of Object.entries(cases)) {
    assert.equal(canonicalCategory(raw), want, `${raw} should fold to ${want}`);
  }
});

test("canonicalCategory is case and plural tolerant", () => {
  assert.equal(canonicalCategory("MUSIC"), "Music");
  assert.equal(canonicalCategory("  festivals  "), "Festivals");
  assert.equal(canonicalCategory("museum"), "Museums");
  assert.equal(canonicalCategory("markets"), "Markets");
});

test("canonicalCategory sends anything unrecognised to the real generic bucket", () => {
  for (const raw of ["", null, undefined, "Show", "Wellness", "Zzz"]) {
    assert.equal(canonicalCategory(raw), "Things to do");
  }
});

test("every canonical category has a colour in the web client", async () => {
  const fs = await import("node:fs");
  // webapp/, not public/: public/ is the marketing site now, and the web app
  // moved out of it when the landing page took over the root.
  const js = fs.readFileSync(new URL("../webapp/app.js", import.meta.url), "utf8");

  // Matches a CATS entry whose value is either an inline literal or a
  // reference into FAMILY. It used to require the literal, which quietly
  // stopped matching anything the day thirteen hues were merged into six
  // families and every value became FAMILY.something: the test then reported
  // ten categories as having no colour when all thirteen still resolved.
  const block = js.slice(js.indexOf("const CATS = {"), js.indexOf("const CAT_FALLBACK"));
  const named = new Set(
    [...block.matchAll(/^\s*"?([A-Za-z][A-Za-z &-]*?)"?:\s*(?:FAMILY\.[a-z]+|\{\s*c:\s*"#)/gm)]
      .map((m) => m[1].toLowerCase())
  );

  // Derived from the alias table rather than duplicated here, so a category
  // added to the API is covered without anyone remembering to update a list.
  const util = fs.readFileSync(new URL("../sources/util.js", import.meta.url), "utf8");
  const aliases = util.slice(util.indexOf("const CATEGORY_ALIASES"), util.indexOf("export function canonicalCategory"));
  const required = [...new Set([...aliases.matchAll(/:\s*"([A-Z][^"]*)"/g)].map((m) => m[1]))]
    .filter((c) => c !== "Things to do");   // the generic bucket uses CAT_FALLBACK

  assert.ok(required.length >= 13, `expected the real category list, got ${required.length}`);
  const missing = required.filter((c) => !named.has(c.toLowerCase()));
  assert.deepEqual(missing, [], `categories with no colour: ${missing.join(", ")}`);
});

test("the six colour families are all reachable from a real category", async () => {
  // Guards the merge. A family nothing maps onto is a sixth of the palette
  // that renders nowhere, which is what Outdoors was before it was added to
  // the API's vocabulary: every walk and open-air listing fell through to
  // "Things to do" and drew in the neutral fallback.
  const fs = await import("node:fs");
  const js = fs.readFileSync(new URL("../webapp/app.js", import.meta.url), "utf8");
  const block = js.slice(js.indexOf("const CATS = {"), js.indexOf("const CAT_FALLBACK"));
  const used = new Set([...block.matchAll(/FAMILY\.([a-z]+)/g)].map((m) => m[1]));
  const declared = [...js.slice(js.indexOf("const FAMILY = {"), js.indexOf("const CATS = {"))
    .matchAll(/^\s*([a-z]+):\s*\{/gm)].map((m) => m[1]);

  assert.deepEqual(declared.sort(), ["culture", "food", "music", "outdoor", "sport", "stage"]);
  const unreachable = declared.filter((f) => !used.has(f));
  assert.deepEqual(unreachable, [], `families no category maps onto: ${unreachable.join(", ")}`);
});
