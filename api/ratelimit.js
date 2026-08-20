// A per-caller rate limit for the JSON API.
//
// WHAT THIS IS ACTUALLY PROTECTING, because it is not what it looks like.
// Flooding one region costs nothing: /api/events serves from a twelve minute
// per-region cache, refreshes in the background, and dedupes concurrent
// refreshes, so a thousand requests for London are a thousand cache reads and
// at most one scrape. The expensive request is a request for a region nobody
// has asked for recently. MAX_REGIONS is 24 and regions.js lists over four
// hundred towns, so walking that list evicts the cache on every request and
// makes every one of them a cold scrape: Ticketmaster, Skiddle, PredictHQ and
// Eventbrite, per request, against quotas that are not ours to refill.
//
// That vector needs nothing but the region list, which anybody can read. The
// limit below does not distinguish a cheap request from an expensive one, and
// deliberately so: telling them apart means reaching into the cache from the
// middleware, and a limit that is simple enough to be obviously correct is
// worth more here than one that is precisely targeted.
//
// WRITTEN RATHER THAN INSTALLED. express-rate-limit would do this and do it
// well. It is fifty lines against a dependency on a repository that is about
// to be public and has two, and the requirements here are narrow enough to
// state completely: one process, in memory, one bucket per address. If this
// ever runs on more than one instance the buckets stop being shared and the
// effective limit multiplies by the instance count, at which point the answer
// is a shared store, not a bigger number here.

/// A token bucket per key, refilling continuously.
///
/// Continuous refill rather than a fixed window, because a fixed window lets a
/// caller spend the whole allowance in the last second of one window and the
/// whole of the next in the first second of the following one, which is twice
/// the limit back to back at exactly the moment it matters.
///
/// `now` is injectable so the tests can drive time instead of sleeping.
export function createLimiter({ windowMs, max, maxKeys = 10_000, now = Date.now }) {
  // key -> { tokens, at }
  const buckets = new Map();
  const perMs = max / windowMs;

  function take(key) {
    const t = now();
    let b = buckets.get(key);
    if (!b) {
      b = { tokens: max, at: t };
      buckets.set(key, b);
    } else {
      // Re-inserting moves the key to the end of the Map's insertion order,
      // which is what makes the eviction below least-recently-used.
      buckets.delete(key);
      buckets.set(key, b);
      b.tokens = Math.min(max, b.tokens + (t - b.at) * perMs);
      b.at = t;
    }

    // Bounded, or a caller with a large address range grows this until the
    // process dies. Evicting the least recently seen bucket refunds that
    // caller's allowance, which is the right way round: the alternative is
    // evicting an active bucket and rate limiting somebody who was behaving.
    if (buckets.size > maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest !== key) buckets.delete(oldest);
    }

    if (b.tokens < 1) {
      // Whole milliseconds, rounded up, so a caller told to wait one second
      // and waiting exactly one second is not refused again.
      return { ok: false, retryAfterMs: Math.ceil((1 - b.tokens) / perMs) };
    }
    b.tokens -= 1;
    return { ok: true, remaining: Math.floor(b.tokens) };
  }

  return { take, size: () => buckets.size };
}

/// Express middleware around the bucket above.
///
/// `keyFor` defaults to req.ip, which is only the caller's address if the app
/// is told how many proxies sit in front of it. See the `trust proxy` line in
/// server.js: without it every request through Render's proxy shares one
/// bucket and the first busy minute locks out the entire internet at once.
export function rateLimit({ windowMs, max, keyFor = (req) => req.ip, now = Date.now }) {
  const limiter = createLimiter({ windowMs, max, now });

  const middleware = (req, res, next) => {
    const verdict = limiter.take(keyFor(req) || "unknown");
    if (verdict.ok) {
      res.set("RateLimit-Remaining", String(verdict.remaining));
      return next();
    }
    const seconds = Math.ceil(verdict.retryAfterMs / 1000);
    res.set("Retry-After", String(seconds));
    // 429 with a body the client can actually read. The iOS app treats any
    // non-2xx as "could not reach the listings", which is the right message
    // for a user either way, but a person with curl deserves the reason.
    return res.status(429).json({
      error: "Too many requests",
      retryAfterSeconds: seconds,
    });
  };
  middleware.limiter = limiter;
  return middleware;
}
