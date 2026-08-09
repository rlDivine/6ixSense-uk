import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { distanceKm } from "./sources/util.js";
import { fetchTicketmaster } from "./sources/ticketmaster.js";
import { fetchSkiddle } from "./sources/skiddle.js";
import { fetchSportsFixtures } from "./sources/sportsfixtures.js";
import { fetchCurated } from "./sources/curated.js";
import { fetchCarBoots } from "./sources/carboots.js";
import { aiConfigured } from "./ai/provider.js";
import { aiSearch } from "./ai/search.js";
import { extractEvent } from "./ai/extract.js";
import { geocodePlace } from "./ai/geocode.js";
import { createSubmissionStore } from "./ai/submissions.js";
import { fetchEventbrite } from "./sources/eventbrite.js";
import { fetchPredictHQ } from "./sources/predicthq.js";
import {
  CITIES,
  DEFAULT_REGION,
  resolveRegion,
  isInMarket,
  publicRegion,
  regionOffsetMinutes,
  rangeWindow,
  regionCatalogue,
} from "./sources/regions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env for local dev, with no dependency. Host-provided env (Render) wins,
// so existing process.env values are never overwritten. No-op if .env is absent.
try {
  const envFile = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* no .env file, which is fine in production */ }

const app = express();
const PORT = process.env.PORT || 3000;

// Submissions are held in memory, which is a deliberate Phase 1 limit and not
// an oversight: AI-DISCOVERY.md defers Postgres to Phase 2 pending a decision
// on hosting, and the store is written behind an interface so that swap does
// not reach callers. What it means today is that a restart, and on Render's
// free plan a spin-down, empties the queue. Nothing user-facing is lost that
// was not already unverified, but do not promise a submitter it is kept.
const submissions = createSubmissionStore();

// Only /api/submissions posts a body, and it is text from a share sheet rather
// than an upload, so the cap is small on purpose: it bounds both the request
// and, downstream, what can be handed to a model that is paid for by the token.
app.use(express.json({ limit: "128kb" }));

// Every event source, keyed by the ids that regions list in `sources`.
// Each one is handed the region so it searches around that town rather than
// around a hardcoded origin.
const SOURCE_IMPL = {
  ticketmaster: {
    label: "Ticketmaster",
    run: (r) => fetchTicketmaster({ lat: r.lat, lng: r.lng, radiusKm: r.radiusKm }),
  },
  skiddle: {
    label: "Skiddle",
    run: (r) => fetchSkiddle({ lat: r.lat, lng: r.lng, radiusKm: r.radiusKm }),
  },
  fixtures: {
    label: "Football fixtures",
    run: (r) => fetchSportsFixtures({ lat: r.lat, lng: r.lng, radiusKm: r.radiusKm }),
  },
  predicthq: {
    label: "PredictHQ",
    run: (r) => fetchPredictHQ({ lat: r.lat, lng: r.lng, radiusKm: r.radiusKm }),
  },
  eventbrite: { label: "Eventbrite", run: (r) => fetchEventbrite(r.eventbrite) },
  curated: {
    label: "Local guide",
    run: (r) => Promise.resolve(fetchCurated({ lat: r.lat, lng: r.lng, radiusKm: r.radiusKm })),
  },
  // Like the guide, a table rather than a fetch, for the reasons set out at the
  // top of sources/carboots.js. No feed carries car boot sales.
  carboots: {
    label: "Car boot sales",
    run: (r) => Promise.resolve(fetchCarBoots({ lat: r.lat, lng: r.lng, radiusKm: r.radiusKm })),
  },
  // Events somebody spotted and sent in. Listed last so that on a de-dupe tie
  // the ticketed copy of an event always wins: §4 of AI-DISCOVERY.md says an
  // unverified listing never outranks one somebody sold a ticket for, and the
  // order of this object is where that is actually enforced.
  spotted: {
    label: "Spotted locally",
    run: (r) =>
      Promise.resolve(submissions.toEvents({ lat: r.lat, lng: r.lng, radiusKm: r.radiusKm })),
  },
};

/// Moderation is destructive and publishes to everyone's feed, so it is shut
/// unless a token is configured. An open moderate route would let anyone
/// approve their own submission, which is a worse hole than having no
/// moderation at all: unverified events are at least badged as unverified.
/// Unset means the endpoints answer 503 rather than 404, because a silent
/// not-found reads as a bug when it is a deliberate closed door.
function moderatorOk(req) {
  const token = process.env.MODERATION_TOKEN;
  if (!token) return false;
  const sent = req.get("x-moderation-token") || "";
  return sent.length === token.length && sent === token;
}

/// Which optional keys are configured. Reported by /api/status and /api/diag,
/// which is the quickest way to work out why a feed looks thin.
function keyStatus() {
  return {
    TM_API_KEY: !!process.env.TM_API_KEY,
    SKIDDLE_API_KEY: !!process.env.SKIDDLE_API_KEY,
    THESPORTSDB_KEY: !!process.env.THESPORTSDB_KEY,
    PREDICTHQ_API_KEY: !!process.env.PREDICTHQ_API_KEY,
    // Not a source key: it gates AI search and submission extraction. Unset
    // means both answer "not configured" and make no network call.
    AI_API_KEY: aiConfigured(),
    MODERATION_TOKEN: !!process.env.MODERATION_TOKEN,
  };
}

function sourcesFor(region) {
  return region.sources.map((id) => ({ id, ...SOURCE_IMPL[id] })).filter((s) => s.run);
}

// One cache entry per region. Requests are always served from cache; scraping
// happens in the background (and on boot for the warm regions), so user
// requests and the host's health checks never block on a live scrape.
// "Stale-while-revalidate": when an entry ages out we still return it
// immediately and refresh behind the request.
const CACHE_MS = 12 * 60 * 1000;
const MAX_REGIONS = 24; // LRU cap, so a wandering user base can't grow this forever
const caches = new Map();   // regionId -> { at, used, events }
const refreshing = new Map(); // regionId -> in-flight promise

// Regions kept warm on boot and on the background timer: the towns busy
// enough that someone is almost always asking for them. Everywhere else warms
// lazily on the first request from that area.
//
// These are also the only entries exempt from LRU eviction. Making the whole
// curated list exempt would make MAX_REGIONS meaningless now that it covers
// every UK county: county towns age out like anywhere else, and re-warm on the
// next request from that area.
const WARM_IDS = (process.env.WARM_REGIONS || "london,manchester,birmingham,glasgow")
  .split(",")
  .map((s) => s.trim());
const WARM = CITIES.filter((c) => WARM_IDS.includes(c.id));
const PROTECTED_IDS = new Set(WARM.map((c) => c.id));

function cacheFor(region) {
  let entry = caches.get(region.id);
  if (!entry) {
    entry = { at: 0, used: 0, events: [] };
    caches.set(region.id, entry);
  }
  entry.used = Date.now();
  if (caches.size > MAX_REGIONS) {
    // Evict the least recently used entries, but never a warm region and never
    // the one being asked for right now.
    [...caches.entries()]
      .filter(([id]) => !PROTECTED_IDS.has(id) && id !== region.id)
      .sort((a, b) => a[1].used - b[1].used)
      .slice(0, caches.size - MAX_REGIONS)
      .forEach(([id]) => caches.delete(id));
  }
  return entry;
}

// Reject a source if it runs too long, so one slow/hung source (e.g. Eventbrite)
// can't stall the whole refresh.
function withTimeout(p, ms, label) {
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out ${ms}ms`)), ms)),
  ]);
}

// Scrape every source for one region and rebuild its cache entry.
// De-duped to one in-flight run per region.
function refreshEvents(region) {
  const inflight = refreshing.get(region.id);
  if (inflight) return inflight;

  const sources = sourcesFor(region);
  const run = (async () => {
    const settled = await Promise.allSettled(
      sources.map((s) => withTimeout(s.run(region), 90000, s.label))
    );
    const all = [];
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") all.push(...r.value);
      else console.warn(`[${region.id}/${sources[i].label}] ${r.reason?.message || r.reason}`);
    });
    // De-dupe by title+day so the same show from two sources collapses.
    const seen = new Map();
    for (const e of all) {
      const key = `${e.title.toLowerCase().slice(0, 40)}|${(e.start || "").slice(0, 10)}`;
      if (!seen.has(key)) seen.set(key, e);
    }
    const entry = cacheFor(region);
    entry.at = Date.now();
    entry.events = [...seen.values()];
    console.log(`[cache:${region.id}] refreshed, ${entry.events.length} events`);
    return entry.events;
  })().finally(() => refreshing.delete(region.id));

  refreshing.set(region.id, run);
  return run;
}

async function gatherEvents(region) {
  const entry = cacheFor(region);
  const fresh = Date.now() - entry.at < CACHE_MS;
  if (entry.events.length) {
    if (!fresh) {
      refreshEvents(region).catch((e) => console.warn(`[cache:${region.id}] bg refresh:`, e.message));
    }
    return entry.events; // serve instantly (fresh, or stale-while-revalidating)
  }
  return refreshEvents(region); // cold: nothing cached for this region yet
}

// Lightweight health check for the host (Render). Never triggers a scrape.
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// The curated towns, grouped by country (only ever the UK). The app's settings
// screen uses this to offer a manual location override, so adding a region
// server-side shows up in the picker without shipping a new build.
app.get("/api/regions", (_req, res) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.json({ countries: regionCatalogue() });
});

// Instant status, read from the in-memory caches only. No scrape.
app.get("/api/status", (_req, res) => {
  const regions = {};
  for (const [id, entry] of caches) {
    const bySource = {};
    for (const e of entry.events) bySource[e.source] = (bySource[e.source] || 0) + 1;
    regions[id] = {
      events: entry.events.length,
      ageSec: entry.at ? Math.round((Date.now() - entry.at) / 1000) : null,
      refreshing: refreshing.has(id),
      bySource,
    };
  }
  res.json({
    keys: keyStatus(),
    cities: CITIES.map((c) => c.id),
    regions,
  });
});

// Per-source diagnostics for one region. Runs every source independently
// (bypassing cache) and reports count / timing / error. Pass ?lat=&lng= to
// diagnose a region other than London.
app.get("/api/diag", async (req, res) => {
  const region = resolveRegion(Number(req.query.lat), Number(req.query.lng));
  const results = await Promise.all(
    sourcesFor(region).map(async (s) => {
      const t0 = Date.now();
      try {
        const events = await s.run(region);
        return { source: s.label, ok: true, count: events.length, ms: Date.now() - t0,
                 sample: events[0]?.title || null };
      } catch (err) {
        return { source: s.label, ok: false, count: 0, ms: Date.now() - t0,
                 error: err?.message || String(err) };
      }
    })
  );
  res.json({
    region: publicRegion(region),
    keys: keyStatus(),
    total: results.reduce((n, r) => n + r.count, 0),
    sources: results,
  });
});

app.get("/api/events", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng);

  // The region decides *which* events exist; the origin only decides how they
  // are ranked. Without a coordinate we fall back to London.
  const region = hasOrigin ? resolveRegion(lat, lng) : DEFAULT_REGION;

  // Rank from the user's own position when they are in the UK. Someone abroad
  // is served London, and ranking "nearest" from their actual position would
  // just sort London by its distance from Madrid, so they get distances from
  // the city centre instead, which is the number they can act on.
  const inMarket = hasOrigin && isInMarket(lat, lng);
  const origin = inMarket ? { lat, lng } : { lat: region.lat, lng: region.lng };

  const sort = req.query.sort === "soonest" ? "soonest" : "nearest";
  const range = ["today", "weekend", "week"].includes(req.query.range)
    ? req.query.range
    : "all";

  try {
    const events = await gatherEvents(region);
    const now = Date.now();
    const window = rangeWindow(range, new Date(), regionOffsetMinutes(region), region.timeZone);

    const enriched = events
      .map((e) => ({
        ...e,
        distanceKm: distanceKm(origin.lat, origin.lng, e.lat, e.lng),
        startMs: e.start ? new Date(e.start).getTime() : null,
      }))
      // Only future (or undated) events.
      .filter((e) => e.startMs === null || e.startMs >= now - 6 * 3600 * 1000)
      // Apply the date-range window. Undated events only survive the "all" range.
      .filter((e) => {
        if (!window) return true; // "all"
        if (e.startMs === null) return false;
        return e.startMs >= window.min && e.startMs <= window.max;
      });

    enriched.sort((a, b) => {
      if (sort === "soonest") {
        return timeRank(a, b) || distRank(a, b);
      }
      // "nearest": closest first, ties broken by soonest.
      return distRank(a, b) || timeRank(a, b);
    });

    res.json({
      origin,
      region: publicRegion(region),
      // False when the caller sent a coordinate outside the UK. The app uses
      // it to say "showing London, VenTrack covers the UK" rather than silently
      // pretending the user is in the capital.
      inMarket,
      sort,
      range,
      count: enriched.length,
      sources: [...new Set(enriched.map((e) => e.source))],
      events: enriched,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// AI surfaces. Both are shut and harmless when AI_API_KEY is unset, which is
// the same bargain every keyed source in this app makes.
// ---------------------------------------------------------------------------

/// Natural language search over the region's own feed.
///
/// The model only ever picks from events this server already returned, so the
/// worst it can do is choose badly. It cannot introduce an event, and
/// ai/search.js discards any id that was not in what it was sent.
///
/// `ok: false` is not an error, it is the client's signal to fall back to the
/// literal search it already has. An unconfigured key, a model failure and a
/// timeout all land there, so search never gets worse than it is today.
app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "");
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng);
  const region = hasOrigin ? resolveRegion(lat, lng) : DEFAULT_REGION;
  const origin = hasOrigin && isInMarket(lat, lng) ? { lat, lng } : { lat: region.lat, lng: region.lng };

  try {
    const events = await gatherEvents(region);
    const out = await aiSearch(events, q);
    if (!out.ok) {
      return res.json({ ok: false, usedAI: out.usedAI, query: q, count: 0, events: [] });
    }

    // Map ids back here rather than trusting anything the model returned as an
    // event. The reason line is the only new text that reaches the client.
    const byId = new Map(events.map((e) => [e.id, e]));
    const matched = out.matches
      .map((m) => {
        const e = byId.get(m.id);
        return e ? { ...e, distanceKm: distanceKm(origin.lat, origin.lng, e.lat, e.lng), reason: m.reason } : null;
      })
      .filter(Boolean);

    res.json({
      ok: true,
      usedAI: true,
      query: q,
      region: publicRegion(region),
      count: matched.length,
      events: matched,
    });
  } catch (err) {
    console.warn("[search]", err?.message || err);
    res.json({ ok: false, usedAI: false, query: q, count: 0, events: [] });
  }
});

/// Somebody spotted an event and sent the text in. Extract it, place it, queue it.
///
/// Geocoding is not optional and not best-effort: §4 of AI-DISCOVERY.md rules
/// that an event nobody can place is an event we do not ship, because distance
/// is the whole premise of the app. A candidate that will not geocode is
/// refused here rather than stored with a town-centre pin.
app.post("/api/submissions", async (req, res) => {
  if (!aiConfigured()) {
    return res.status(503).json({ ok: false, reason: "ai-not-configured" });
  }
  const body = req.body || {};
  const text = String(body.text || "");
  const sourceUrl = String(body.sourceUrl || "");
  if (!text.trim()) return res.status(400).json({ ok: false, reason: "no-text" });

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const region = Number.isFinite(lat) && Number.isFinite(lng) ? resolveRegion(lat, lng) : DEFAULT_REGION;

  try {
    const extracted = await extractEvent(text, { sourceUrl });
    if (!extracted.ok) {
      return res.status(422).json({ ok: false, reason: "not-an-event", rejected: extracted.rejected });
    }

    const placed = await geocodePlace(extracted.candidate.venue, {
      regionLat: region.lat,
      regionLng: region.lng,
    });
    if (!placed.ok) {
      return res.status(422).json({ ok: false, reason: "cannot-place", detail: placed.reason });
    }

    const result = submissions.submit({
      ...extracted.candidate,
      lat: placed.lat,
      lng: placed.lng,
      regionId: region.id,
      // Anonymous is allowed and cannot corroborate, which is what stops one
      // person publishing their own submission by sending it twice.
      submitter: String(body.submitter || ""),
    });

    res.json({
      ok: true,
      id: result.id,
      status: result.status,
      confidence: extracted.confidence,
      precision: placed.precision,
      candidate: extracted.candidate,
    });
  } catch (err) {
    console.error("[submissions]", err?.message || err);
    res.status(500).json({ ok: false, reason: "extraction-failed" });
  }
});

/// A reader saying an event is wrong. Deliberately unauthenticated and
/// deliberately one-directional: a report can only ever remove something from
/// the feed, never add one, so the worst an abuser achieves is hiding an
/// unverified listing that nobody had corroborated.
app.post("/api/submissions/:id/report", (req, res) => {
  const out = submissions.report(String(req.params.id || ""));
  res.json({ ok: true, ...out });
});

// The moderation queue. Token-gated; see moderatorOk above.
app.get("/api/submissions", (req, res) => {
  if (!moderatorOk(req)) return res.status(503).json({ ok: false, reason: "moderation-not-configured" });
  res.json({
    ok: true,
    submissions: submissions.list({
      status: req.query.status ? String(req.query.status) : undefined,
      regionId: req.query.regionId ? String(req.query.regionId) : undefined,
    }),
  });
});

app.post("/api/submissions/:id/moderate", (req, res) => {
  if (!moderatorOk(req)) return res.status(503).json({ ok: false, reason: "moderation-not-configured" });
  const verdict = String((req.body || {}).verdict || "");
  if (verdict !== "approve" && verdict !== "reject") {
    return res.status(400).json({ ok: false, reason: "verdict must be approve or reject" });
  }
  res.json({ ok: true, ...submissions.moderate(String(req.params.id || ""), verdict) });
});

function distRank(a, b) {
  if (a.distanceKm == null && b.distanceKm == null) return 0;
  if (a.distanceKm == null) return 1;
  if (b.distanceKm == null) return -1;
  return a.distanceKm - b.distanceKm;
}
function timeRank(a, b) {
  if (a.startMs == null && b.startMs == null) return 0;
  if (a.startMs == null) return 1;
  if (b.startMs == null) return -1;
  return a.startMs - b.startMs;
}

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`\n  VenTrack UK running at http://localhost:${PORT}`);
  console.log(
    process.env.TM_API_KEY
      ? "  Ticketmaster: ON (live ticketed events enabled)"
      : "  Ticketmaster: OFF. Set TM_API_KEY for full live data (free key: developer.ticketmaster.com)\n"
  );
  console.log(`  Warm regions: ${WARM.map((r) => r.id).join(", ")}`);

  const warmAll = () =>
    WARM.forEach((r) =>
      refreshEvents(r).catch((e) => console.warn(`[cache:${r.id}] warm failed:`, e.message))
    );
  warmAll();
  setInterval(warmAll, CACHE_MS);
});
