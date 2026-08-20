import test from "node:test";
import assert from "node:assert/strict";

import { createLimiter, rateLimit } from "../ratelimit.js";

// A clock the test drives, so nothing here sleeps.
function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("a caller gets exactly its allowance before being refused", () => {
  const clock = fakeClock();
  const limiter = createLimiter({ windowMs: 1000, max: 5, now: clock.now });

  for (let i = 0; i < 5; i += 1) {
    assert.equal(limiter.take("a").ok, true, `request ${i + 1} of 5 should pass`);
  }
  assert.equal(limiter.take("a").ok, false);
});

test("callers are counted separately", () => {
  const clock = fakeClock();
  const limiter = createLimiter({ windowMs: 1000, max: 2, now: clock.now });

  assert.equal(limiter.take("a").ok, true);
  assert.equal(limiter.take("a").ok, true);
  assert.equal(limiter.take("a").ok, false);
  // "b" has spent nothing and must be unaffected by "a" being over.
  assert.equal(limiter.take("b").ok, true);
});

test("the allowance refills over time rather than all at once", () => {
  const clock = fakeClock();
  const limiter = createLimiter({ windowMs: 1000, max: 10, now: clock.now });

  for (let i = 0; i < 10; i += 1) limiter.take("a");
  assert.equal(limiter.take("a").ok, false);

  // A tenth of the window buys back one request, not the whole allowance.
  clock.advance(100);
  assert.equal(limiter.take("a").ok, true);
  assert.equal(limiter.take("a").ok, false);
});

test("waiting exactly as long as it was told is enough", () => {
  // The contract the Retry-After header makes. If a caller is told to wait
  // one second, waits one second and is refused again, the header is a lie
  // and a well behaved client ends up in a retry loop.
  const clock = fakeClock();
  const limiter = createLimiter({ windowMs: 1000, max: 4, now: clock.now });

  for (let i = 0; i < 4; i += 1) limiter.take("a");
  const refused = limiter.take("a");
  assert.equal(refused.ok, false);

  clock.advance(refused.retryAfterMs);
  assert.equal(limiter.take("a").ok, true);
});

test("a full allowance does not accumulate past the maximum while idle", () => {
  // Otherwise a caller that waits an hour arrives with an hour of tokens and
  // the limit means nothing for the first burst, which is the burst that
  // matters.
  const clock = fakeClock();
  const limiter = createLimiter({ windowMs: 1000, max: 3, now: clock.now });

  clock.advance(60 * 60 * 1000);
  assert.equal(limiter.take("a").ok, true);
  assert.equal(limiter.take("a").ok, true);
  assert.equal(limiter.take("a").ok, true);
  assert.equal(limiter.take("a").ok, false);
});

test("the bucket store is bounded, so a wide address range cannot grow it forever", () => {
  const clock = fakeClock();
  const limiter = createLimiter({ windowMs: 1000, max: 5, maxKeys: 10, now: clock.now });

  for (let i = 0; i < 500; i += 1) limiter.take(`addr-${i}`);
  assert.ok(limiter.size() <= 10, `expected at most 10 buckets, got ${limiter.size()}`);
});

test("eviction drops the least recently seen caller, not an active one", () => {
  const clock = fakeClock();
  const limiter = createLimiter({ windowMs: 1000, max: 2, maxKeys: 3, now: clock.now });

  limiter.take("old");     // seen once, then never again
  limiter.take("busy");
  limiter.take("busy");    // spent out

  // Three more callers, which must push "old" out before "busy".
  limiter.take("x");
  limiter.take("y");

  // "busy" is still over its limit, so its bucket survived.
  assert.equal(limiter.take("busy").ok, false);
});

// --- the middleware ---------------------------------------------------------

function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test("the middleware passes a request through and reports what is left", () => {
  const mw = rateLimit({ windowMs: 1000, max: 3 });
  const res = fakeRes();
  let called = false;

  mw({ ip: "1.2.3.4" }, res, () => { called = true; });

  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["RateLimit-Remaining"], "2");
});

test("a refused request is a 429 carrying Retry-After, and does not continue", () => {
  const clock = fakeClock();
  const mw = rateLimit({ windowMs: 1000, max: 1, now: clock.now });
  const next = () => { throw new Error("a refused request must not reach the route"); };

  mw({ ip: "1.2.3.4" }, fakeRes(), () => {});   // spends the allowance

  const res = fakeRes();
  mw({ ip: "1.2.3.4" }, res, next);

  assert.equal(res.statusCode, 429);
  assert.ok(Number(res.headers["Retry-After"]) >= 1);
  assert.equal(res.body.error, "Too many requests");
});

test("a request with no address still gets a bucket rather than throwing", () => {
  // req.ip is undefined if the app is ever run without a socket address, and
  // an exception in the limiter would take out every request rather than one.
  const mw = rateLimit({ windowMs: 1000, max: 1 });
  const res = fakeRes();
  let called = false;

  mw({}, res, () => { called = true; });
  assert.equal(called, true);
});
