import test from "node:test";
import assert from "node:assert/strict";
import {
  keepAliveTarget,
  keepAliveIntervalMs,
  pingOnce,
  startKeepAlive,
} from "../keepalive.js";

const quiet = { log() {}, warn() {} };

test("the target is derived from the url Render publishes", () => {
  assert.equal(
    keepAliveTarget({ RENDER_EXTERNAL_URL: "https://pulse-uk-api.onrender.com" }),
    "https://pulse-uk-api.onrender.com/healthz"
  );
});

test("a trailing slash on the Render url does not produce a double slash", () => {
  assert.equal(
    keepAliveTarget({ RENDER_EXTERNAL_URL: "https://pulse-uk-api.onrender.com/" }),
    "https://pulse-uk-api.onrender.com/healthz"
  );
});

test("the target is never localhost", () => {
  // The entire mechanism depends on this. A request that does not leave the
  // container never reaches Render's router, so it does not count as traffic
  // and the instance sleeps anyway while the log cheerfully reports pings.
  const url = keepAliveTarget({ RENDER_EXTERNAL_URL: "https://pulse-uk-api.onrender.com" });
  assert.ok(!/localhost|127\.0\.0\.1/.test(url));
});

test("KEEPALIVE_URL overrides the derived target", () => {
  const env = {
    RENDER_EXTERNAL_URL: "https://pulse-uk-api.onrender.com",
    KEEPALIVE_URL: "https://example.org/ping",
  };
  assert.equal(keepAliveTarget(env), "https://example.org/ping");
});

test("off by default anywhere that is not Render", () => {
  // Nothing should ping on a laptop, and nobody should have to remember to
  // switch it off there.
  assert.equal(keepAliveTarget({}), null);
  assert.equal(keepAliveTarget({ RENDER_EXTERNAL_URL: "" }), null);
  assert.equal(startKeepAlive({ env: {}, log: quiet }), null);
});

test("KEEPALIVE=off wins over both ways of setting a target", () => {
  for (const value of ["off", "OFF", "Off"]) {
    const env = {
      KEEPALIVE: value,
      RENDER_EXTERNAL_URL: "https://pulse-uk-api.onrender.com",
      KEEPALIVE_URL: "https://example.org/ping",
    };
    assert.equal(keepAliveTarget(env), null, `KEEPALIVE=${value} did not switch it off`);
  }
});

test("the interval defaults to something inside Render's idle window", () => {
  const ms = keepAliveIntervalMs({});
  assert.ok(ms < 15 * 60 * 1000, "the default is longer than the ~15 min sleep window");
  assert.ok(ms >= 5 * 60 * 1000, "the default pings more often than it needs to");
});

test("a bad interval falls back rather than pinging in a tight loop", () => {
  const fallback = keepAliveIntervalMs({});
  for (const bad of ["", "banana", "0", "-1", undefined]) {
    assert.equal(keepAliveIntervalMs({ KEEPALIVE_INTERVAL_MS: bad }), fallback);
  }
  // A small but valid-looking number is clamped, not honoured: a stray "100"
  // would otherwise be ten pings a second at the service.
  assert.equal(keepAliveIntervalMs({ KEEPALIVE_INTERVAL_MS: "100" }), 60 * 1000);
  assert.equal(keepAliveIntervalMs({ KEEPALIVE_INTERVAL_MS: "300000" }), 300000);
});

test("a ping is a plain GET at the target", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push([url, opts]);
    return { ok: true, status: 200 };
  };
  assert.equal(await pingOnce("https://example.org/healthz", { fetchImpl, log: quiet }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://example.org/healthz");
  assert.equal(calls[0][1].method, "GET");
});

test("a failing ping resolves false instead of rejecting", async () => {
  // A rejection here would be an unhandled one on a timer, which takes the
  // whole process down over a request that does not matter.
  const boom = async () => { throw new Error("ECONNRESET"); };
  await assert.doesNotReject(() => pingOnce("https://example.org/healthz", { fetchImpl: boom, log: quiet }));
  assert.equal(await pingOnce("https://example.org/healthz", { fetchImpl: boom, log: quiet }), false);

  const notOk = async () => ({ ok: false, status: 502 });
  assert.equal(await pingOnce("https://example.org/healthz", { fetchImpl: notOk, log: quiet }), false);
});

test("starting it returns a timer that does not hold the process open", () => {
  const timer = startKeepAlive({
    env: { RENDER_EXTERNAL_URL: "https://example.org", KEEPALIVE_INTERVAL_MS: "60000" },
    fetchImpl: async () => ({ ok: true, status: 200 }),
    log: quiet,
  });
  assert.ok(timer, "no timer was started with a target available");
  // If this test finishes, the timer was unref'd. A ref'd 60s interval would
  // keep the test runner alive for a minute after the assertions pass.
  clearInterval(timer);
});
