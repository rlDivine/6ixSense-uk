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
  const js = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const named = new Set(
    [...js.matchAll(/^\s*"?([A-Za-z][A-Za-z &-]*?)"?:\s*\{\s*c:\s*"#/gm)].map((m) => m[1].toLowerCase())
  );
  const required = ["Music", "Live music", "Clubs", "Festivals", "Comedy", "Football",
    "Sport", "Markets", "Museums", "Theatre", "Film", "Food", "Family"];
  const missing = required.filter((c) => !named.has(c.toLowerCase()));
  assert.deepEqual(missing, [], `categories with no colour: ${missing.join(", ")}`);
});
