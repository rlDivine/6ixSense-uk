import test from "node:test";
import assert from "node:assert/strict";

import { decodeEntities, distanceKm, makeEvent } from "../sources/util.js";
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
    category: "Event",
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
  assert.equal(e.category, "Food & Drink");
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
