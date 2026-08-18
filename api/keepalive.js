// Keeps a free-tier Render instance from spinning down.
//
// Render's free plan stops an instance after about 15 minutes with no INBOUND
// traffic, and the next visitor pays a 30 to 60 second cold start. This pings
// the service's own public URL on a timer so that idle window never elapses.
//
// THE PING MUST GO TO THE PUBLIC URL, NOT TO LOCALHOST. This is the whole
// trick and it is easy to get wrong. A request to http://localhost:$PORT never
// leaves the container, so Render's router never sees it and the idle timer
// keeps running. The request has to go out to the internet and come back in
// through the router to count as traffic. Render publishes the right address
// as RENDER_EXTERNAL_URL, which is why that is the default target.
//
// Two limits worth knowing before relying on this:
//
//   1. IT PREVENTS SLEEP, IT DOES NOT CURE IT. Once the instance is stopped
//      this code is not running either, so nothing pings and nothing wakes.
//      Any deploy, crash or restart followed by a quiet spell puts the service
//      to sleep with no way back other than a real visitor. Only something
//      OUTSIDE the service can fix that; see DEPLOY.md.
//   2. Free instance hours are capped per month across the workspace. Staying
//      up continuously spends roughly 744 of them in a 31 day month against an
//      allowance of 750, so this leaves almost nothing for a second free
//      service. See DEPLOY.md.
//
// /healthz is the target on purpose: it returns a constant and never touches a
// source or the cache, so a ping costs nothing but the request itself.

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000; // 10 min, inside the ~15 min window
const MIN_INTERVAL_MS = 60 * 1000; // a guard against a typo hammering the service
const PING_TIMEOUT_MS = 30 * 1000;

// Where to ping, or null to stay switched off. Null is the right answer for
// local development: RENDER_EXTERNAL_URL only exists on Render, so this is
// inert on a laptop without anyone having to configure that.
export function keepAliveTarget(env = process.env) {
  if (String(env.KEEPALIVE || "").toLowerCase() === "off") return null;

  const explicit = (env.KEEPALIVE_URL || "").trim();
  if (explicit) return explicit;

  const base = (env.RENDER_EXTERNAL_URL || "").trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/healthz`;
}

export function keepAliveIntervalMs(env = process.env) {
  const raw = Number(env.KEEPALIVE_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, raw);
}

// Resolves to true or false rather than rejecting. A failed ping is not worth
// an unhandled rejection taking the process down: the next one is ten minutes
// away and the service is still perfectly able to serve real traffic.
export async function pingOnce(url, { fetchImpl = fetch, log = console } = {}) {
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { "user-agent": "ventrack-keepalive" },
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    if (!res.ok) {
      log.warn(`[keepalive] ${url} returned ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    log.warn(`[keepalive] ${url} failed: ${err.message}`);
    return false;
  }
}

// Returns the timer, or null when there is nothing to ping. Successful pings
// are silent: one every ten minutes forever would bury anything worth reading
// in the log. Failures are not silent, because a run of them means the service
// is about to sleep.
export function startKeepAlive({ env = process.env, fetchImpl = fetch, log = console } = {}) {
  const url = keepAliveTarget(env);
  if (!url) return null;

  const every = keepAliveIntervalMs(env);
  log.log(`  Keep-alive: pinging ${url} every ${Math.round(every / 60000)} min`);

  const timer = setInterval(() => { pingOnce(url, { fetchImpl, log }); }, every);
  // Do not hold the event loop open on this alone. The HTTP listener is what
  // should decide when this process is allowed to exit.
  timer.unref?.();
  return timer;
}
