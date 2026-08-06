import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { distanceKm } from "./sources/util.js";
import { fetchTicketmaster } from "./sources/ticketmaster.js";
import { fetchSkiddle } from "./sources/skiddle.js";
import { fetchSportsFixtures } from "./sources/sportsfixtures.js";
import { fetchCurated } from "./sources/curated.js";
import { fetchEventbrite } from "./sources/eventbrite.js";
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
  eventbrite: { label: "Eventbrite", run: (r) => fetchEventbrite(r.eventbrite) },
  curated: {
    label: "Local guide",
    run: (r) => Promise.resolve(fetchCurated({ lat: r.lat, lng: r.lng, radiusKm: r.radiusKm })),
  },
};

/// Which optional keys are configured. Reported by /api/status and /api/diag,
/// which is the quickest way to work out why a feed looks thin.
function keyStatus() {
  return {
    TM_API_KEY: !!process.env.TM_API_KEY,
    SKIDDLE_API_KEY: !!process.env.SKIDDLE_API_KEY,
    THESPORTSDB_KEY: !!process.env.THESPORTSDB_KEY,
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
    const window = rangeWindow(range, new Date(), regionOffsetMinutes(region));

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
      // it to say "showing London, Pulse covers the UK" rather than silently
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
  console.log(`\n  Pulse UK running at http://localhost:${PORT}`);
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
