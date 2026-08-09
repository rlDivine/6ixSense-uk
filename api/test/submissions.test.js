import test from "node:test";
import assert from "node:assert/strict";

import { createSubmissionStore, __rules as RULES } from "../ai/submissions.js";
import { makeEvent } from "../sources/util.js";
import { greatCircleKm, inUkBox, londonNoon, withForbiddenFetch } from "./helpers.js";

// A fixed "now", so every expectation below is about a rule rather than about
// the day the suite happens to run. Noon on a Sunday in BST, deliberately:
// London is an hour ahead of UTC here, which is when "which day is it" has two
// answers and a store that reads the UTC one looks correct all winter.
const NOW = londonNoon(2026, 8, 9); // Sunday 9 August 2026, 12:00 London

const RAMSGATE = { lat: 51.3316, lng: 1.416 };
const LONDON = { lat: 51.5074, lng: -0.1278 };

/// A store whose clock the test drives.
function storeAt(start = NOW) {
  let at = start;
  const store = createSubmissionStore({ clock: () => at });
  return { store, set: (next) => { at = next; }, get now() { return at; } };
}

/// The Ramsgate Boating Pool post, as ai/extract.js hands it over: a makeEvent
/// object with its evidence, a coordinate from ai/geocode.js, and the two
/// fields the store needs that neither of those produces.
function candidate(overrides = {}) {
  return {
    ...makeEvent({
      id: "spotted-a1b2c3d4e5f6",
      title: "Free solar eclipse glasses",
      start: "2026-08-15T09:00:00.000Z", // Saturday 15 August, 10:00 London
      venue: "Ramsgate Boating Pool",
      lat: RAMSGATE.lat,
      lng: RAMSGATE.lng,
      url: "https://www.thanet.gov.uk/news/eclipse-glasses/",
      source: "Spotted locally",
      price: "Free",
    }),
    evidence: { title: { value: "Free solar eclipse glasses", quote: "free solar eclipse glasses to hand out" } },
    submitter: "person-a",
    regionId: "thanet",
    ...overrides,
  };
}

/// A second person's account of the same afternoon: different words, a
/// coordinate a couple of hundred metres along the seafront, and a different
/// post. This is what corroboration is meant to accept.
function secondSighting(overrides = {}) {
  return candidate({
    id: "spotted-999888777666",
    title: "Solar eclipse glasses giveaway",
    venue: "The boating pool, Ramsgate seafront",
    lat: RAMSGATE.lat + 0.002, // ~220m north, checked in its own test below
    url: "https://www.isleofthanetnews.com/eclipse/",
    submitter: "person-b",
    ...overrides,
  });
}

/// Publish one event the shortest honest way, so tests about the feed do not
/// restate the tests about promotion.
function published(store, extra = {}) {
  const { id } = store.submit(candidate(extra));
  store.moderate(id, "approve");
  return id;
}

// ---------------------------------------------------------------------------
// The fixtures themselves. A distance rule tested against coordinates nobody
// measured is a distance rule tested against nothing.
// ---------------------------------------------------------------------------

test("the fixtures sit in the UK, and the second sighting is inside the corroboration radius", () => {
  const first = candidate();
  const second = secondSighting();
  assert.ok(inUkBox(first.lat, first.lng), "the first sighting is outside the UK");
  assert.ok(inUkBox(second.lat, second.lng), "the second sighting is outside the UK");

  const apart = greatCircleKm(first.lat, first.lng, second.lat, second.lng) * 1000;
  assert.ok(apart < RULES.CORROBORATION_METRES, `the sightings are ${apart.toFixed(0)}m apart`);
  assert.ok(apart > 100, "the sightings are so close the radius is not being exercised");
});

// ---------------------------------------------------------------------------
// Pending, and what pending means.
// ---------------------------------------------------------------------------

test("a new submission is pending and reaches nobody", () => {
  const { store } = storeAt();
  const { id, status } = store.submit(candidate());
  assert.equal(status, "pending");
  assert.equal(store.get(id).status, "pending");

  assert.deepEqual(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }), []);
  // And it is visible to a moderator, which is the whole point of it being
  // stored rather than dropped.
  assert.equal(store.list({ status: "pending" }).length, 1);
});

test("a moderator publishes it, and the feed shows it once", () => {
  const { store } = storeAt();
  const { id } = store.submit(candidate());
  const after = store.moderate(id, "approve");
  assert.equal(after.status, "published");

  const events = store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW });
  assert.equal(events.length, 1);
  assert.equal(events[0].id, id);
});

test("a rejected submission is finished, and cannot be submitted back in", () => {
  const { store } = storeAt();
  const { id } = store.submit(candidate());
  assert.equal(store.moderate(id, "reject").status, "rejected");

  // The route past a moderator would otherwise be to submit again, twice, with
  // a friend. Both of these are that attempt.
  assert.equal(store.submit(candidate()).status, "rejected");
  assert.equal(store.submit(secondSighting()).status, "rejected");
  assert.equal(store.moderate(id, "approve").status, "rejected");
  assert.deepEqual(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }), []);
});

test("an unrecognised verdict changes nothing", () => {
  // There is no safe direction to default in, so a typo must not publish and
  // must not reject.
  const { store } = storeAt();
  const { id } = store.submit(candidate());
  for (const verdict of ["approved", "APPROVE", "yes", "", null, undefined, true]) {
    assert.equal(store.moderate(id, verdict), null, `verdict ${String(verdict)} was acted on`);
  }
  assert.equal(store.get(id).status, "pending");
});

// ---------------------------------------------------------------------------
// Corroboration, and everything that must not corroborate.
// ---------------------------------------------------------------------------

test("two independent sightings publish without a moderator", () => {
  const { store } = storeAt();
  const first = store.submit(candidate());
  assert.equal(first.status, "pending");

  const second = store.submit(secondSighting());
  assert.equal(second.status, "published");
  // One event, not two: the second sighting joined the first row rather than
  // starting one, so the queue holds events rather than reports of events.
  assert.equal(second.id, first.id);
  assert.equal(store.list().length, 1);
  assert.equal(store.get(first.id).witnesses, 2);
  assert.equal(store.get(first.id).sightings.length, 2);

  assert.equal(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }).length, 1);
});

test("one person cannot corroborate themselves, however many times they share", () => {
  // The failure this module exists to prevent. Extraction stops the model
  // inventing a date; nothing in it stops a person inventing an event.
  const { store } = storeAt();
  const first = store.submit(candidate());
  const again = store.submit(secondSighting({ submitter: "person-a" }));
  assert.equal(again.id, first.id);
  assert.equal(again.status, "pending", "one person auto-published an event");
  assert.equal(store.get(first.id).witnesses, 1);

  // A third and a fourth do not help either.
  store.submit(secondSighting({ id: "spotted-333", submitter: "person-a" }));
  store.submit(secondSighting({ id: "spotted-444", submitter: "person-a" }));
  assert.equal(store.get(first.id).status, "pending");
  assert.deepEqual(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }), []);
});

test("two people forwarding one post are not two witnesses", () => {
  // ai/extract.js fingerprints the text and the link, so the same post shared
  // by two people arrives with one id. It is one post, and publishing on it
  // would be publishing on the say-so of whoever wrote the original — which is
  // the thing nobody has checked.
  const { store } = storeAt();
  const first = store.submit(candidate());
  const relay = store.submit(candidate({ submitter: "person-b" }));
  assert.equal(relay.id, first.id);
  assert.equal(relay.status, "pending");
  assert.equal(store.list().length, 1);
  assert.equal(store.get(first.id).witnesses, 1);

  // A genuinely separate post from that same second person does publish it,
  // which is what keeps this a rule about evidence rather than about people.
  assert.equal(store.submit(secondSighting()).status, "published");
});

test("anonymous sightings never add up to a witness", () => {
  // An anonymous submitter cannot be shown to be a different person from the
  // last anonymous submitter, and "a different person" is the entire content
  // of the rule.
  const { store } = storeAt();
  const first = store.submit(candidate({ submitter: "" }));
  const second = store.submit(secondSighting({ submitter: undefined }));
  assert.equal(second.status, "pending");
  assert.equal(store.get(first.id).witnesses, 0);
  // The sightings are still recorded, because a moderator should see that two
  // people sent this in even when neither can be counted.
  assert.equal(store.get(first.id).sightings.length, 2);
});

test("a near miss on wording does not corroborate", () => {
  // Same seafront, same afternoon, plausibly worded, and a different thing.
  // A looser rule publishes an event with one thing's title and the other's
  // time, which nobody submitted and nobody can correct.
  const { store } = storeAt();
  const first = store.submit(candidate());
  const near = store.submit(secondSighting({ title: "Solar eclipse road closures" }));
  assert.notEqual(near.id, first.id, "two different events were merged into one");
  assert.equal(near.status, "pending");
  assert.equal(store.list().length, 2);
});

test("a title with one significant word never corroborates itself", () => {
  // "Fireworks" is not a description of an event, it is a description of a
  // hundred of them, so these wait for a moderator on purpose.
  const { store } = storeAt();
  const first = store.submit(candidate({ id: "spotted-f1", title: "Fireworks" }));
  const second = store.submit(secondSighting({ id: "spotted-f2", title: "Fireworks!" }));
  assert.notEqual(second.id, first.id);
  assert.equal(second.status, "pending");
});

test("a near miss on distance does not corroborate", () => {
  const { store } = storeAt();
  const first = store.submit(candidate());
  const far = secondSighting({ lat: RAMSGATE.lat + 0.01 }); // just over a kilometre
  const apart = greatCircleKm(RAMSGATE.lat, RAMSGATE.lng, far.lat, far.lng) * 1000;
  assert.ok(apart > RULES.CORROBORATION_METRES, `the fixture is only ${apart.toFixed(0)}m away`);

  const second = store.submit(far);
  assert.notEqual(second.id, first.id);
  assert.equal(second.status, "pending");
});

test("a near miss on the day does not corroborate", () => {
  const { store } = storeAt();
  const first = store.submit(candidate());
  const second = store.submit(secondSighting({ start: "2026-08-16T09:00:00.000Z" }));
  assert.notEqual(second.id, first.id);
  assert.equal(second.status, "pending");
});

test("a sighting an hour apart on the same day still corroborates", () => {
  // The other side of the same rule: two people at one thing write "from 10am"
  // and "10.30 start", and requiring them to agree on the minute would reject
  // exactly the honest pair this exists to reward.
  const { store } = storeAt();
  const first = store.submit(candidate());
  const second = store.submit(secondSighting({ start: "2026-08-15T09:30:00.000Z" }));
  assert.equal(second.id, first.id);
  assert.equal(second.status, "published");
});

// ---------------------------------------------------------------------------
// Reports.
// ---------------------------------------------------------------------------

test("one report pulls an uncorroborated event out of the feed at once", () => {
  const { store } = storeAt();
  const id = published(store);
  assert.equal(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }).length, 1);

  const after = store.report(id);
  assert.equal(after.status, "withdrawn");
  assert.deepEqual(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }), []);
});

test("a corroborated event takes as many reports as it had witnesses", () => {
  const { store } = storeAt();
  const { id } = store.submit(candidate());
  store.submit(secondSighting());
  assert.equal(store.get(id).status, "published");

  assert.equal(store.report(id).status, "published", "one report outweighed two witnesses");
  assert.equal(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }).length, 1);
  assert.equal(store.report(id).status, "withdrawn");
  assert.deepEqual(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }), []);
});

test("a report on a pending event stops it being published later", () => {
  const { store } = storeAt();
  const { id } = store.submit(candidate());
  assert.equal(store.report(id).status, "withdrawn");

  // A fresh independent sighting must not answer a report with more of the
  // same evidence that would have published it.
  const second = store.submit(secondSighting());
  assert.equal(second.id, id);
  assert.equal(store.get(id).status, "withdrawn");
  assert.deepEqual(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }), []);
});

test("a moderator can overrule a report, and one tap does not undo them", () => {
  const { store } = storeAt();
  const id = published(store);
  store.report(id);
  assert.equal(store.moderate(id, "approve").status, "published");
  assert.equal(store.get(id).reports, 0, "the report count survived the moderator");
  assert.equal(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }).length, 1);
});

test("reporting something that was never there is not an error", () => {
  const { store } = storeAt();
  assert.equal(store.report("spotted-nothing"), null);
  assert.equal(store.report(undefined), null);
  assert.equal(store.moderate("spotted-nothing", "approve"), null);
  assert.equal(store.get("spotted-nothing"), null);
});

// ---------------------------------------------------------------------------
// The feed.
// ---------------------------------------------------------------------------

test("an event that has started is not offered, and a bare date lasts its day", () => {
  const { store } = storeAt();
  // Four separate events, because two submissions on one day at one place with
  // one title are one event and would merge — which is a different test.
  //
  // 10:00 London this morning: started, and an unconfirmed thing that has
  // already started is the weakest row the app can print.
  published(store, { id: "spotted-earlier", title: "Beach clean at the harbour", start: "2026-08-09T09:00:00.000Z" });
  // Yesterday, with no time at all.
  published(store, { id: "spotted-yesterday", title: "Sandwich flower show", start: "2026-08-08" });
  // Today, with no time: the post said a day, and the day is not over.
  published(store, { id: "spotted-today", title: "Broadstairs folk week busking", start: "2026-08-09" });
  // Next Saturday.
  published(store, { id: "spotted-saturday", start: "2026-08-15T09:00:00.000Z" });

  const ids = store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }).map((e) => e.id);
  assert.deepEqual(ids.sort(), ["spotted-saturday", "spotted-today"]);
});

test("the day is judged in London, not in UTC", () => {
  // 00:30 London on 10 August is 23:30Z on the 9th. An event dated the 10th
  // has not happened; a store reading the UTC date would call it tomorrow's
  // and would call the 9th's still current.
  const { store } = storeAt();
  published(store, { id: "spotted-9th", start: "2026-08-09" });
  published(store, { id: "spotted-10th", start: "2026-08-10" });

  const justAfterMidnight = new Date(Date.UTC(2026, 7, 9, 23, 30));
  const ids = store.toEvents({ ...RAMSGATE, radiusKm: 50, now: justAfterMidnight }).map((e) => e.id);
  assert.deepEqual(ids, ["spotted-10th"]);
});

test("the radius filter keeps only what is inside it, measured independently", () => {
  const { store } = storeAt();
  published(store);

  const away = greatCircleKm(LONDON.lat, LONDON.lng, RAMSGATE.lat, RAMSGATE.lng);
  assert.ok(away > 50 && away < 150, `the fixture is ${away.toFixed(0)}km from London`);

  assert.deepEqual(store.toEvents({ ...LONDON, radiusKm: 50, now: NOW }), []);
  assert.equal(store.toEvents({ ...LONDON, radiusKm: 150, now: NOW }).length, 1);
  // No point given is everything, the way carboots.js behaves.
  assert.equal(store.toEvents({ now: NOW }).length, 1);
});

test("a tighter radius returns a strict subset", () => {
  const { store } = storeAt();
  published(store, { id: "spotted-near" });
  published(store, {
    id: "spotted-far",
    title: "Margate harbour lantern parade",
    venue: "Margate harbour",
    lat: 51.3891,
    lng: 1.3826,
  });

  const wide = new Set(store.toEvents({ ...RAMSGATE, radiusKm: 40, now: NOW }).map((e) => e.id));
  const tight = store.toEvents({ ...RAMSGATE, radiusKm: 2, now: NOW }).map((e) => e.id);
  assert.equal(wide.size, 2);
  assert.deepEqual(tight, ["spotted-near"]);
  for (const id of tight) assert.ok(wide.has(id), `${id} is in the tight slice but not the wide one`);
});

test("one event never occupies two rows, whichever route it arrives by", () => {
  // The invariant behind the deduping: sightings are merged at the door, so a
  // third and fourth account of the same afternoon cannot become extra rows in
  // a feed that is sorted by distance, where they would land adjacent and read
  // as a bug in the app.
  const { store } = storeAt();
  const first = store.submit(candidate());
  store.submit(secondSighting()); // publishes it
  store.submit(secondSighting({ id: "spotted-c", title: "Solar eclipse glasses handout", submitter: "person-c" }));
  store.submit(secondSighting({ id: "spotted-d", submitter: "person-d", lat: RAMSGATE.lat - 0.001 }));

  assert.equal(store.list().length, 1);
  assert.equal(store.get(first.id).sightings.length, 4);
  const events = store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW });
  assert.equal(events.length, 1);
  assert.equal(events[0].id, first.id);
});

test("events are well formed, badged, and carry where they came from", () => {
  const { store } = storeAt();
  const id = published(store);
  const [event] = store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW });

  // The same shape every other source emits, plus exactly two fields.
  const shape = new Set(Object.keys(makeEvent({ id: "x", title: "x" })));
  assert.deepEqual(
    Object.keys(event).filter((k) => !shape.has(k)).sort(),
    ["sourceUrl", "unconfirmed"]
  );
  for (const key of shape) assert.ok(key in event, `the event lost ${key}`);

  assert.equal(event.id, id);
  assert.equal(event.source, RULES.SOURCE);
  assert.equal(event.source, "Spotted locally");
  assert.equal(event.unconfirmed, true);
  assert.equal(event.sourceUrl, "https://www.thanet.gov.uk/news/eclipse-glasses/");
  assert.equal(event.url, event.sourceUrl);
  assert.equal(event.title, "Free solar eclipse glasses");
  assert.equal(event.venue, "Ramsgate Boating Pool");
  assert.equal(event.category, "Things to do");
  assert.ok(inUkBox(event.lat, event.lng));
  assert.ok(!Number.isNaN(new Date(event.start).getTime()));
});

test("a corroborated event is still badged unconfirmed", () => {
  // Two people is better evidence than one and it is still not a listing
  // somebody published, so the badge is about where the event came from rather
  // than about how sure the store feels.
  const { store } = storeAt();
  store.submit(candidate());
  store.submit(secondSighting());
  const [event] = store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW });
  assert.equal(event.unconfirmed, true);
});

test("a hostile link never reaches a client", () => {
  // safeUrl is makeEvent's job, and this is the check that the store did not
  // route around it by carrying the raw link in its own field.
  const { store } = storeAt();
  published(store, { id: "spotted-nasty", url: "javascript:alert(document.cookie)" });
  const [event] = store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW });
  assert.equal(event.url, "");
  assert.equal(event.sourceUrl, "");
});

test("ids are unique and stable across two reads", () => {
  const { store } = storeAt();
  published(store, { id: "spotted-one" });
  published(store, { id: "spotted-two", title: "Margate harbour lantern parade", lat: 51.3891, lng: 1.3826 });

  const first = store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }).map((e) => e.id);
  assert.equal(new Set(first).size, first.length);
  assert.deepEqual(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }).map((e) => e.id), first);
});

// ---------------------------------------------------------------------------
// What arrives when something upstream has gone wrong.
// ---------------------------------------------------------------------------

test("nothing a caller can submit makes the store throw", () => {
  const { store } = storeAt();
  const junk = [
    undefined, null, 0, "", "spotted-x", [], true,
    {},
    { id: "spotted-1" },
    { id: "spotted-2", title: "   ", start: "2026-08-15", lat: 51.3, lng: 1.4 },
    { id: "spotted-3", title: 12, start: "2026-08-15", lat: 51.3, lng: 1.4 },
    { id: "spotted-4", title: "A thing", start: "next Saturday", lat: 51.3, lng: 1.4 },
    { id: "spotted-5", title: "A thing", start: null, lat: 51.3, lng: 1.4 },
    { id: "spotted-6", title: "A thing", start: { day: 15 }, lat: 51.3, lng: 1.4 },
  ];
  for (const input of junk) {
    const out = store.submit(input);
    assert.equal(out.status, "rejected", `${JSON.stringify(input)} was accepted`);
  }
  assert.deepEqual(store.toEvents({ now: NOW }), []);
  assert.equal(store.list({ status: "pending" }).length, 0);
});

test("a submission with no coordinate is refused at the door, with a reason", () => {
  // The plan's "no coordinate, no event" rule. It cannot ever be shown, so
  // leaving it in the queue for a moderator to approve into nothing is worse
  // than saying so now — and it is also how the integrator finds out that
  // geocoding comes before submitting.
  const { store } = storeAt();
  const out = store.submit(candidate({ lat: null, lng: null }));
  assert.equal(out.status, "rejected");
  assert.equal(out.reason, RULES.REASON.noCoordinate);
  assert.equal(store.get(out.id).reason, RULES.REASON.noCoordinate);
  assert.equal(store.moderate(out.id, "approve").status, "rejected");
  assert.deepEqual(store.toEvents({ now: NOW }), []);
});

test("a candidate with no id at all is refused without being stored", () => {
  const { store } = storeAt();
  const out = store.submit({ title: "A thing", start: "2026-08-15", lat: 51.3, lng: 1.4 });
  assert.equal(out.status, "rejected");
  assert.equal(out.id, "");
  assert.equal(store.list().length, 0);
});

// ---------------------------------------------------------------------------
// The interface a Postgres implementation has to keep.
// ---------------------------------------------------------------------------

test("the store hands out copies, not its own records", () => {
  const { store } = storeAt();
  const id = published(store);

  const held = store.get(id);
  held.status = "rejected";
  held.candidate.title = "Something else entirely";
  held.sightings.push({ submitter: "nobody" });
  assert.equal(store.get(id).status, "published");
  assert.equal(store.get(id).candidate.title, "Free solar eclipse glasses");
  assert.equal(store.get(id).sightings.length, 1);

  const events = store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW });
  events[0].title = "Tampered";
  assert.equal(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW })[0].title, "Free solar eclipse glasses");
});

test("list filters by status and by region, and neither is a search", () => {
  const { store } = storeAt();
  const thanet = store.submit(candidate());
  const leeds = store.submit(
    candidate({
      id: "spotted-leeds",
      title: "Kirkgate market late night",
      venue: "Kirkgate Market",
      lat: 53.7975,
      lng: -1.5382,
      regionId: "leeds",
      submitter: "person-c",
    })
  );
  store.moderate(leeds.id, "approve");

  assert.equal(store.list().length, 2);
  assert.deepEqual(store.list({ status: "pending" }).map((r) => r.id), [thanet.id]);
  assert.deepEqual(store.list({ regionId: "leeds" }).map((r) => r.id), [leeds.id]);
  assert.deepEqual(store.list({ status: "published", regionId: "thanet" }), []);
  assert.equal(store.list({ status: "nonsense" }).length, 0);
});

test("timestamps come from the injected clock", () => {
  const clock = storeAt();
  const { id } = clock.store.submit(candidate());
  assert.equal(clock.store.get(id).createdAt, NOW.toISOString());

  const later = new Date(NOW.getTime() + 3600000);
  clock.set(later);
  clock.store.moderate(id, "approve");
  const record = clock.store.get(id);
  assert.equal(record.createdAt, NOW.toISOString());
  assert.equal(record.updatedAt, later.toISOString());
});

test("toEvents defaults its now to the clock", () => {
  const clock = storeAt();
  published(clock.store, { start: "2026-08-15T09:00:00.000Z" });
  assert.equal(clock.store.toEvents({ ...RAMSGATE, radiusKm: 50 }).length, 1);

  // A fortnight later the same event is behind us, without the caller saying so.
  clock.set(new Date(NOW.getTime() + 14 * 86400000));
  assert.deepEqual(clock.store.toEvents({ ...RAMSGATE, radiusKm: 50 }), []);
});

test("the store never goes near the network", async () => {
  // It holds what a model already produced. A store that fetches would put the
  // slowest, least predictable part of the system back in the request path,
  // which is the thing the plan's architecture exists to avoid.
  await withForbiddenFetch(async () => {
    const { store } = storeAt();
    const { id } = store.submit(candidate());
    store.submit(secondSighting());
    store.report(id);
    store.moderate(id, "approve");
    store.list({ regionId: "thanet" });
    store.get(id);
    assert.equal(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }).length, 1);
  });
});

test("an empty store answers everything without complaint", () => {
  const { store } = storeAt();
  assert.deepEqual(store.list(), []);
  assert.deepEqual(store.list({ status: "published", regionId: "thanet" }), []);
  assert.equal(store.get("spotted-anything"), null);
  assert.deepEqual(store.toEvents({ ...RAMSGATE, radiusKm: 50, now: NOW }), []);
  assert.deepEqual(store.toEvents(), []);
});
