# Pulse UK — backend + web app

Aggregates events from across the United Kingdom and sorts them by **how close
they are to you** and **how soon they start**. Serves both the JSON API the
iOS app consumes and an installable web app (PWA) at the same origin.

## Run

```bash
cd api
npm install
npm start
# open http://localhost:3000
```

Open it on a phone (or resize your browser narrow) — the frontend is a
**mobile-first PWA** you can "Add to Home Screen": onboarding, four tabs, light
and dark themes.

Add a free [Ticketmaster key](https://developer.ticketmaster.com/) for the full
live feed:

```bash
TM_API_KEY=your_key_here npm start
```

## API

| Endpoint | What it does |
|---|---|
| `GET /healthz` | Liveness for the host. Never scrapes. |
| `GET /api/events?lat=&lng=&sort=&range=` | The feed. `sort` is `nearest`\|`soonest`, `range` is `all`\|`today`\|`weekend`\|`week`. |
| `GET /api/regions` | The town catalogue, grouped by nation and county — what the app's location picker renders. |
| `GET /api/status` | Cache state per region, and whether the Ticketmaster key is set. |
| `GET /api/diag?lat=&lng=` | Runs every source independently, bypassing cache. Count, timing and error per source. |

`/api/events` returns:

```jsonc
{
  "origin":   { "lat": 53.48, "lng": -2.24 },
  "region":   { "id": "manchester", "label": "Manchester", "area": "Greater Manchester",
                "nation": "England", "country": "GB", "timeZone": "Europe/London",
                "unit": "mi", "center": { … } },
  "inMarket": true,     // false when the caller's coordinate is outside the UK
  "count":    128,
  "sources":  ["Ticketmaster", "Eventbrite", "Local guide"],
  "events":   [ … ]
}
```

Distances (`distanceKm`) are always sent in kilometres; the clients convert.
Every UK region reports `"unit": "mi"`, so both clients display miles.

## Where the events come from

| Source | Key needed? | How | Covers |
|---|---|---|---|
| **Ticketmaster Discovery** | Free key (`TM_API_KEY`) | REST, pinned to `countryCode=GB` | Concerts, theatre, comedy, sport |
| **Eventbrite UK** | No | `eventbrite.co.uk` discovery pages → embedded JSON-LD, 6 verticals | Music, food & drink, festivals, pop-ups, free events |
| **Local guide** | No | Built in | Real UK venues with regular programming |

Ticketmaster is pinned to GB so a radius search from the Kent coast or Northern
Ireland can't pull in French or Irish listings. Eventbrite is a per-town scrape;
a town with no Eventbrite page contributes nothing rather than failing the
request. The guide is national — each region takes the slice inside its radius.

## Regions

454 curated UK towns and cities (`sources/regions.js`): at least one per
ceremonial county in England, per principal area in Wales, per council area in
Scotland and per traditional county in Northern Ireland, plus the larger towns
people search for. Each carries its county, nation, coordinates and Eventbrite
slug.

A request resolves to the **nearest** listed town. More than 250 km from any of
them means the caller is abroad: they get London, and `inMarket: false` so the
clients can explain why. There are no generic worldwide cells — Pulse covers the
UK and says so.

Adding a town is one line in `sources/regions.js`. It appears in the app's
picker on the next launch, with no new build.

## Caching

One cache entry per region, 12-minute TTL, stale-while-revalidate: a request is
always answered from cache while the refresh happens behind it, so nobody waits
on a live scrape. At most 24 regions are held (LRU), with `WARM_REGIONS`
(default `london,manchester,birmingham,glasgow`) kept warm on boot and on the
refresh timer and exempt from eviction.

## How sorting works

- **Nearest** — straight-line (haversine) distance from your location,
  ascending; ties broken by soonest start.
- **Soonest** — earliest start first; ties broken by distance.
- Past events are filtered out; events with no fixed date sort to the end and
  only appear under "All upcoming".
- "Today" and "this weekend" are bucketed in `Europe/London`, not in the
  server's UTC, so they mean what a user in Britain means by them.

## Layout

```
server.js            Express API (/api/events, /api/regions, …) + static frontend
sources/
  regions.js         The 454-town UK catalogue, resolution, and date-range maths
  ticketmaster.js    Ticketmaster Discovery API, countryCode=GB (needs a free key)
  eventbrite.js      Eventbrite UK via discovery-page JSON-LD
  curated.js         Built-in guide to real UK venues
  util.js            distance, entity-decode + event normalisation helpers
public/              PWA (index.html, app.js, styles.css) — list + Leaflet map
```

## Deploying

See [DEPLOY.md](DEPLOY.md).
