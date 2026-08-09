import test from "node:test";
import assert from "node:assert/strict";

import { geocodePlace, __gazetteer as GAZETTEER } from "../ai/geocode.js";
import {
  greatCircleKm,
  htmlResponse,
  inUkBox,
  jsonResponse,
  withForbiddenFetch,
  withStubbedFetch,
} from "./helpers.js";

// The pilot region AI-DISCOVERY.md names, and the one every "is this near
// enough" expectation below is measured from.
const THANET = { regionLat: 51.3400, regionLng: 1.4100 };

// The two Newports. Both are real answers to the word "Newport", which is the
// entire problem: one is 145km from the other, and a third is in Rhode Island.
const NEWPORT_GWENT = { latitude: 51.5842, longitude: -2.9977 };
const NEWPORT_IOW = { lat: 50.7010, lng: -1.2900 };
const NEWPORT_RHODE_ISLAND = { latitude: 41.4901, longitude: -71.3128 };

/// A postcodes.io /postcodes/<postcode> reply, trimmed to the fields read.
function postcodeReply({ postcode = "CT9 1HX", latitude = 51.391448, longitude = 1.38649 } = {}) {
  return jsonResponse({ status: 200, result: { postcode, latitude, longitude } });
}

/// A postcodes.io /outcodes/<outcode> reply.
function outcodeReply({ outcode = "CT11", latitude = 51.3346, longitude = 1.4088 } = {}) {
  return jsonResponse({ status: 200, result: { outcode, latitude, longitude } });
}

/// Run `geocodePlace` against a fixed stubbed response, returning the result
/// and the requests it made.
async function geocodeWith(response, placeText, options) {
  let seen;
  const out = await withStubbedFetch(
    () => (typeof response === "function" ? response() : response),
    async (calls) => {
      const result = await geocodePlace(placeText, options);
      seen = calls;
      return result;
    }
  );
  return { result: out, calls: seen };
}

/// The gazetteer row with this display name.
function row(name) {
  const found = GAZETTEER.find((e) => e.name === name);
  assert.ok(found, `no gazetteer row named ${name}`);
  return found;
}

// ---------------------------------------------------------------------------
// The gazetteer table. A wrong row here pins an event to the wrong beach, and
// nothing downstream would ever notice, so it is checked the way carboots.js's
// table is.
// ---------------------------------------------------------------------------

test("every gazetteer row sits inside the UK", () => {
  for (const e of GAZETTEER) {
    assert.ok(inUkBox(e.lat, e.lng), `${e.name} is outside the UK box: ${e.lat}, ${e.lng}`);
  }
});

test("every gazetteer row lands in the town it claims", () => {
  // Rough town centres, and a generous five kilometres: this asserts that the
  // coordinate is in the right place, not that it is the right place, which is
  // what the postcode comments in the table itself record.
  const CENTRES = {
    Ramsgate: [51.335, 1.42],
    Margate: [51.3855, 1.3865],
    Broadstairs: [51.36, 1.44],
    Birchington: [51.376, 1.305],
    Canterbury: [51.28, 1.08],
  };
  for (const e of GAZETTEER) {
    const centre = CENTRES[e.town];
    assert.ok(centre, `${e.name} names a town with no centre to check it against: ${e.town}`);
    const away = greatCircleKm(centre[0], centre[1], e.lat, e.lng);
    assert.ok(away <= 5, `${e.name} is ${away.toFixed(1)}km from ${e.town}`);
  }
});

test("no gazetteer phrase is generic, and none can swallow another row", () => {
  const names = GAZETTEER.map((e) => e.name);
  assert.equal(new Set(names).size, names.length, "two rows share a display name");

  for (const e of GAZETTEER) {
    assert.ok(e.keys.length > 0, `${e.name} has no phrase that names it`);
    for (const key of e.keys) {
      // Two words minimum, because one word is how "beach", "park" and
      // "harbour" would get in. Dreamland is the deliberate exception: it is a
      // proper noun that names one place in Britain.
      const words = key.split(" ").length;
      assert.ok(words >= 2 || key === "dreamland", `${e.name} accepts the bare word "${key}"`);

      // A phrase belonging to one row must not appear inside another row's
      // phrase. If it did, one text would match both rows and the ambiguity
      // guard would reject a place this table can name exactly.
      for (const other of GAZETTEER) {
        if (other === e) continue;
        for (const otherKey of other.keys) {
          assert.ok(
            !` ${otherKey} `.includes(` ${key} `),
            `"${key}" (${e.name}) is inside "${otherKey}" (${other.name})`
          );
        }
      }
    }
    // A qualified phrase without a town is just a generic phrase with extra
    // steps, and it would resolve "the winter gardens" to Margate's.
    for (const q of e.qualifiers) {
      assert.ok(q.phrase, `${e.name} has an empty qualified phrase`);
      assert.ok(q.towns.length > 0, `${e.name} qualifies "${q.phrase}" with no town`);
    }
  }
});

// ---------------------------------------------------------------------------
// Postcodes.
// ---------------------------------------------------------------------------

test("a full postcode is looked up and returned at postcode precision", async () => {
  const { result, calls } = await geocodeWith(
    postcodeReply(),
    "Margate Winter Gardens, Fort Crescent, Margate CT9 1HX",
    THANET
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.postcodes.io/postcodes/CT91HX");
  assert.equal(calls[0].opts?.headers?.Accept, "application/json");
  assert.deepEqual(result, {
    ok: true,
    lat: 51.391448,
    lng: 1.38649,
    precision: "postcode",
    // Postcodes.io's own spelling wins over the one scraped out of the text.
    matched: "CT9 1HX",
    reason: "",
  });
});

test("a postcode is found however it was typed", async () => {
  // All four of these turn up in real posts, and all four are the same place.
  const spellings = [
    "CT11 9JX",
    "ct11 9jx",
    "CT119JX",
    "ct119jx",
    "Ramsgate,  CT11   9JX.",
    "meet at ct11 9jx then walk down",
  ];
  for (const text of spellings) {
    const { result, calls } = await geocodeWith(
      postcodeReply({ postcode: "CT11 9JX", latitude: 51.3295, longitude: 1.4141 }),
      text,
      THANET
    );
    assert.equal(calls[0].url, "https://api.postcodes.io/postcodes/CT119JX", text);
    assert.equal(result.ok, true, text);
    assert.equal(result.precision, "postcode", text);
  }
});

test("a partial postcode falls back to the outcode endpoint, at its own precision", async () => {
  const { result, calls } = await geocodeWith(
    outcodeReply(),
    "Somewhere on the seafront, CT11, all welcome",
    THANET
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.postcodes.io/outcodes/CT11");
  assert.equal(result.ok, true);
  // Not "postcode". A district centroid can be a mile from the event, and a
  // caller that only knows the three precisions in the plan will treat this
  // one as unknown and drop it, which is the safe direction to be wrong in.
  assert.equal(result.precision, "outcode");
  assert.equal(result.matched, "CT11");
});

test("a road number is not a postal district", async () => {
  // The failure this guard exists for: "just off the M25" is a valid outcode
  // in Manchester, and a Kent event pinned to Manchester is 400km wrong.
  const roads = [
    "Free parking, just off the M25",
    "M25 junction 4, then follow the signs",
    "Take the A20 towards Dover",
    "Meet by the B12 sign",
  ];
  for (const text of roads) {
    await withForbiddenFetch(async () => {
      const result = await geocodePlace(text, THANET);
      assert.equal(result.ok, false, text);
      assert.equal(result.reason, "no postcode or known venue", text);
    });
  }
});

test("a two character outcode is not trusted on its own", async () => {
  // M1, B1 and L4 are real postal districts and also a motorway, a vitamin and
  // a stand at Anfield. Null beats a guess.
  for (const text of ["Somewhere in M1", "B1 area", "L4 tonight"]) {
    await withForbiddenFetch(async () => {
      assert.equal((await geocodePlace(text, THANET)).ok, false, text);
    });
  }
});

test("a time of day is not mistaken for a postcode", async () => {
  // "A2 5pm" fits the shape of a postcode exactly, until you apply Royal
  // Mail's rule that the last two letters exclude C, I, K, M, O and V.
  for (const text of ["Meet at A2 5pm", "Doors 7am, first come first served"]) {
    await withForbiddenFetch(async () => {
      assert.equal((await geocodePlace(text, THANET)).ok, false, text);
    });
  }
});

test("a postcode that does not exist is not retried as its own district", async () => {
  const { result, calls } = await geocodeWith(
    jsonResponse({ status: 404, error: "Postcode not found" }, { ok: false, status: 404 }),
    "Village hall, ZZ99 9ZZ",
    THANET
  );
  // One call, not two. Answering with the centroid of the district a typo
  // happens to fall in is exactly the plausible-but-wrong pin this refuses.
  assert.equal(calls.length, 1);
  assert.deepEqual(result, {
    ok: false,
    lat: null,
    lng: null,
    precision: null,
    matched: "",
    reason: "postcode not found",
  });
});

test("postcodes.io being down is reported as a lookup failure, not as a bad postcode", async () => {
  // The distinction matters to the worker: a bad postcode means drop this
  // event, a failed lookup means come back to it tomorrow.
  const downs = [
    () => jsonResponse({}, { ok: false, status: 503 }),
    () => jsonResponse({}, { ok: false, status: 500 }),
    () => {
      throw new Error("ECONNRESET");
    },
  ];
  for (const response of downs) {
    const { result } = await geocodeWith(response, "Village hall, CT9 1HX", THANET);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "lookup failed");
  }
});

test("a reply with no usable coordinate is a failure, never a zero", async () => {
  // 0,0 is in the Atlantic, and a coordinate that arrives as null or as a
  // string is the shape this has to survive without producing one.
  const malformed = [
    jsonResponse({}),
    jsonResponse({ result: null }),
    jsonResponse({ result: {} }),
    jsonResponse({ result: { latitude: null, longitude: null } }),
    jsonResponse({ result: { latitude: "not a number", longitude: "nor this" } }),
    jsonResponse({ result: { latitude: 51.39 } }),
    // A 200 that is not JSON at all, which is what a proxy or a maintenance
    // page in front of the service looks like.
    htmlResponse("<html>maintenance</html>"),
  ];
  for (const response of malformed) {
    const { result } = await geocodeWith(response, "Village hall, CT9 1HX", THANET);
    assert.equal(result.ok, false, JSON.stringify(response));
    assert.equal(result.lat, null);
    assert.equal(result.lng, null);
    assert.equal(result.reason, "lookup failed");
  }
});

// ---------------------------------------------------------------------------
// The gazetteer, which is the no-postcode path and makes no network call.
// ---------------------------------------------------------------------------

test("a named venue is placed from the table, with no network call at all", async () => {
  await withForbiddenFetch(async () => {
    const cases = [
      // The plan's own example, verbatim. The town and the venue are three
      // words apart, which is why the qualifier rule exists.
      ["The Boating Pool in Ramsgate is handing out free solar eclipse glasses", "Ramsgate Boating Pool"],
      ["Ramsgate Boating Pool, Royal Esplanade", "Ramsgate Boating Pool"],
      ["dreamland, saturday night", "Dreamland Margate"],
      ["TURNER CONTEMPORARY", "Turner Contemporary"],
      ["Turner Contemporary!", "Turner Contemporary"],
      ["Sandcastle competition on Viking Bay", "Broadstairs Viking Bay"],
      ["Craft fair at Quex Park", "Quex Park"],
      ["Powell-Cotton Museum late opening", "Quex Park"],
      ["powell cotton museum late opening", "Quex Park"],
      ["Fireworks over Margate Main Sands", "Margate Main Sands"],
      ["Litter pick, main sands, Ramsgate", "Ramsgate Main Sands"],
      ["Winter Gardens, Margate", "Margate Winter Gardens"],
      ["Rock pooling at Botany Bay, Broadstairs", "Botany Bay, Broadstairs"],
      ["Evensong at Canterbury Cathedral", "Canterbury Cathedral"],
    ];
    for (const [text, expected] of cases) {
      const result = await geocodePlace(text, THANET);
      assert.equal(result.ok, true, text);
      assert.equal(result.precision, "gazetteer", text);
      assert.equal(result.matched, expected, text);
      assert.equal(result.lat, row(expected).lat, text);
      assert.equal(result.lng, row(expected).lng, text);
      assert.equal(result.reason, "", text);
    }
  });
});

test("a vague place resolves to nothing, which is the point of the table", async () => {
  await withForbiddenFetch(async () => {
    const vague = [
      // The two the brief names. Neither can mean one place, and the app has
      // no business pretending otherwise.
      "Meet at the beach",
      "A picnic in the park",
      // The same words the table does know, stripped of what made them
      // specific. Each of these is at least two real places.
      "Down the boating pool at noon",
      "Fun day on the main sands",
      "Winter Gardens, doors at seven",
      "Beach clean at Botany Bay",
      "On the seafront",
      "By the harbour",
      "The bandstand",
      "At the community centre",
      // A word that contains a table phrase but is not it.
      "Parkway Retail Park",
    ];
    for (const text of vague) {
      const result = await geocodePlace(text, THANET);
      assert.equal(result.ok, false, text);
      assert.equal(result.lat, null, text);
      assert.equal(result.precision, null, text);
      assert.equal(result.reason, "no postcode or known venue", text);
    }
  });
});

test("two named places in one sentence is not a coordinate", async () => {
  await withForbiddenFetch(async () => {
    const both = [
      "Parade from Dreamland to Margate Main Sands",
      "Main sands at Margate, or Ramsgate if it rains",
    ];
    for (const text of both) {
      const result = await geocodePlace(text, THANET);
      assert.equal(result.ok, false, text);
      assert.equal(result.reason, "ambiguous place name", text);
    }
  });
});

test("empty input asks nobody anything", async () => {
  await withForbiddenFetch(async () => {
    for (const text of ["", "   ", "\n\t", null, undefined, "!!!", "…"]) {
      const result = await geocodePlace(text, THANET);
      assert.deepEqual(result, {
        ok: false,
        lat: null,
        lng: null,
        precision: null,
        matched: "",
        reason: "no place text",
      });
    }

    // And text that exists but names nothing is a different answer, because
    // the two mean different things to whoever reads the queue: one is a bug
    // in the extractor, the other is a post that never said where.
    for (const text of ["0", "TBC", "see poster for details"]) {
      assert.equal((await geocodePlace(text, THANET)).reason, "no postcode or known venue", text);
    }
  });
});

test("the table rescues a placeable event when postcodes.io is unavailable", async () => {
  // The postcode was the better signal and it could not be used. The gazetteer
  // hit is a specifically named venue, not a town centre, so taking it breaks
  // nothing this module promises -- and dropping an event we can place exactly
  // because a third party is having a bad afternoon would be the worse call.
  const { result, calls } = await geocodeWith(
    () => jsonResponse({}, { ok: false, status: 503 }),
    "Turner Contemporary, Rendezvous, Margate CT9 1HG",
    THANET
  );
  assert.equal(calls.length, 1);
  assert.equal(result.ok, true);
  assert.equal(result.precision, "gazetteer");
  assert.equal(result.matched, "Turner Contemporary");
});

// ---------------------------------------------------------------------------
// The sanity checks. This is the failure the module exists to prevent.
// ---------------------------------------------------------------------------

test("a coordinate outside the UK is refused however authoritative it looked", async () => {
  const { result } = await geocodeWith(
    postcodeReply({ postcode: "NP20 1XX", ...NEWPORT_RHODE_ISLAND }),
    "The Riverfront, Newport NP20 1XX",
    THANET
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "outside the United Kingdom");
  assert.equal(result.lat, null);
  // What was recognised is still reported, so a moderation queue can show why
  // the event was dropped without re-running the lookup.
  assert.equal(result.matched, "NP20 1XX");
});

test("the wrong Newport is refused when it is too far from the region", async () => {
  // Newport, Gwent is a perfectly good answer to "Newport". It is 145km from
  // Newport on the Isle of Wight, which is the region that asked.
  const { result } = await geocodeWith(
    postcodeReply({ postcode: "NP20 1XX", ...NEWPORT_GWENT }),
    "Riverfront, Newport NP20 1XX",
    { regionLat: NEWPORT_IOW.lat, regionLng: NEWPORT_IOW.lng, maxKm: 60 }
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "too far from the region");

  // And the same coordinate is fine for the region it actually belongs to, so
  // the check is measuring distance rather than disliking Newport.
  const near = await geocodeWith(
    postcodeReply({ postcode: "NP20 1XX", ...NEWPORT_GWENT }),
    "Riverfront, Newport NP20 1XX",
    { regionLat: 51.4816, regionLng: -3.1791, maxKm: 60 } // Cardiff, 20km away
  );
  assert.equal(near.result.ok, true);
  assert.equal(near.result.lat, NEWPORT_GWENT.latitude);
});

test("a rejected coordinate is never quietly swapped for a nearer guess", async () => {
  // The text names a venue the table knows AND carries a postcode that
  // resolves somewhere else entirely. Falling through to the gazetteer here
  // would be choosing the answer we liked over the answer we were given.
  const { result } = await geocodeWith(
    postcodeReply({ postcode: "NP20 1XX", ...NEWPORT_GWENT }),
    "Turner Contemporary, Margate NP20 1XX",
    THANET
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "too far from the region");
});

test("the radius check covers the table too, because a typo there is invisible", async () => {
  await withForbiddenFetch(async () => {
    const far = await geocodePlace("Dreamland, tonight", {
      regionLat: 55.9533,
      regionLng: -3.1883, // Edinburgh
      maxKm: 60,
    });
    assert.equal(far.ok, false);
    assert.equal(far.reason, "too far from the region");
    assert.equal(far.matched, "Dreamland Margate");
  });
});

test("maxKm is the caller's to set, and no region means no radius check", async () => {
  await withForbiddenFetch(async () => {
    const text = "Dreamland, tonight";
    const edinburgh = { regionLat: 55.9533, regionLng: -3.1883 };

    // Margate is roughly 600km from Edinburgh by great circle.
    assert.equal((await geocodePlace(text, { ...edinburgh, maxKm: 500 })).ok, false);
    assert.equal((await geocodePlace(text, { ...edinburgh, maxKm: 700 })).ok, true);

    // A caller with no region still gets the UK box, and nothing else.
    assert.equal((await geocodePlace(text)).ok, true);
    assert.equal((await geocodePlace(text, {})).ok, true);
    assert.equal((await geocodePlace(text, { regionLat: 51.34 })).ok, true);
  });
});

test("the default radius is sixty kilometres", async () => {
  await withForbiddenFetch(async () => {
    const dreamland = row("Dreamland Margate");
    // A region centre placed just inside and just outside 60km of Margate,
    // measured independently rather than by asking the module twice.
    const inside = { regionLat: dreamland.lat - 0.5, regionLng: dreamland.lng };
    const outside = { regionLat: dreamland.lat - 0.6, regionLng: dreamland.lng };
    assert.ok(greatCircleKm(inside.regionLat, inside.regionLng, dreamland.lat, dreamland.lng) < 60);
    assert.ok(greatCircleKm(outside.regionLat, outside.regionLng, dreamland.lat, dreamland.lng) > 60);

    assert.equal((await geocodePlace("Dreamland", inside)).ok, true);
    assert.equal((await geocodePlace("Dreamland", outside)).ok, false);
  });
});

test("the result shape is the same six keys whatever happened", async () => {
  const keys = ["ok", "lat", "lng", "precision", "matched", "reason"];
  const results = [
    (await geocodeWith(postcodeReply(), "CT9 1HX", THANET)).result,
    (await geocodeWith(outcodeReply(), "CT11 somewhere", THANET)).result,
    (await geocodeWith(jsonResponse({}, { ok: false, status: 404 }), "CT9 1HX", THANET)).result,
    await withForbiddenFetch(() => geocodePlace("Dreamland", THANET)),
    await withForbiddenFetch(() => geocodePlace("the beach", THANET)),
    await withForbiddenFetch(() => geocodePlace("", THANET)),
  ];
  for (const result of results) {
    assert.deepEqual(Object.keys(result).sort(), [...keys].sort(), JSON.stringify(result));
    assert.equal(typeof result.ok, "boolean");
    assert.equal(typeof result.matched, "string");
    assert.equal(typeof result.reason, "string");
    if (result.ok) {
      assert.ok(Number.isFinite(result.lat) && Number.isFinite(result.lng));
      assert.equal(result.reason, "");
    } else {
      assert.equal(result.lat, null);
      assert.equal(result.lng, null);
      assert.equal(result.precision, null);
      assert.ok(result.reason.length > 0);
    }
  }
});
