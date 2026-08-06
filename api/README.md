# Pulse UK: backend and web app

Aggregates events from across the United Kingdom and sorts them by **how close
they are to you** and **how soon they start**. Serves both the JSON API the iOS
app consumes and an installable web app (PWA) at the same origin.

## Run

```bash
cd api
npm install
npm start
# open http://localhost:3000
```

Open it on a phone, or resize your browser narrow. The frontend is a
mobile-first PWA you can add to your home screen: onboarding, four tabs, light
and dark themes.

Add free keys for the full live feed:

```bash
TM_API_KEY=... SKIDDLE_API_KEY=... npm start
```

## API

| Endpoint | What it does |
|---|---|
| `GET /healthz` | Liveness for the host. Never scrapes. |
| `GET /api/events?lat=&lng=&sort=&range=` | The feed. `sort` is `nearest` or `soonest`, `range` is `all`, `today`, `weekend` or `week`. |
| `GET /api/regions` | The town catalogue, grouped by nation and county. This is what the app's location picker renders. |
| `GET /api/status` | Cache state per region, and which optional keys are configured. |
| `GET /api/diag?lat=&lng=` | Runs every source independently, bypassing cache. Count, timing and error per source. |

`/api/events` returns:

```jsonc
{
  "origin":   { "lat": 53.48, "lng": -2.24 },
  "region":   { "id": "manchester", "label": "Manchester", "area": "Greater Manchester",
                "nation": "England", "country": "GB", "timeZone": "Europe/London",
                "unit": "mi", "center": { } },
  "inMarket": true,     // false when the caller's coordinate is outside the UK
  "count":    128,
  "sources":  ["Ticketmaster", "Skiddle", "Eventbrite", "Local guide"],
  "events":   [ ]
}
```

Distances (`distanceKm`) are always sent in kilometres and the clients convert.
Every UK region reports `"unit": "mi"`, so both clients display miles.

## Where the events come from

| Source | Key needed? | How | Covers |
|---|---|---|---|
| **Ticketmaster Discovery** | Free key (`TM_API_KEY`) | REST, pinned to `countryCode=GB` | Concerts, theatre, comedy, arena sport |
| **Skiddle** | Free key (`SKIDDLE_API_KEY`) | REST, queried by lat/lng | UK-only listings: gigs, club nights, festivals, comedy, food |
| **Football fixtures** | Free key (`THESPORTSDB_KEY`) | TheSportsDB REST | English leagues and the Scottish Premiership |
| **Eventbrite UK** | No | `eventbrite.co.uk` discovery pages, embedded JSON-LD, 11 verticals | Music, food, comedy, arts, film, sport, family, festivals, pop-ups, free events |
| **Local guide** | No | Built in | Real UK venues with regular programming |

Ticketmaster is pinned to GB so a radius search from the Kent coast or Northern
Ireland cannot pull in French or Irish listings. Skiddle takes its radius in
miles rather than kilometres, which the source converts. Eventbrite is a
per-town scrape, and a town with no Eventbrite page contributes nothing rather
than failing the request. The guide is national, and each region takes the
slice inside its own radius.

Every keyed source returns nothing when its key is unset, so the whole thing
works with none configured. `GET /api/status` reports which keys are present,
which is the quickest way to explain a thin feed. Skiddle is the one worth
setting first: it is UK-only by design, so its coverage of British nightlife
and gigs runs deeper than a global service's.

### Football fixtures and grounds

TheSportsDB names the ground but does not give its coordinates on the free
tier. A fixture with no position would sort to the bottom of "Nearest" and
never reach the map, so `sources/sportsfixtures.js` carries a table of UK
grounds and drops any fixture it cannot place. Matching is exact first, then
whole-word containment, which is what stops Firhill matching Fir Park. Adding a
ground is one line in that table.

## Regions

454 curated UK towns and cities (`sources/regions.js`): at least one per
ceremonial county in England, per principal area in Wales, per council area in
Scotland and per traditional county in Northern Ireland, plus the larger towns
people search for. Each carries its county, nation, coordinates and Eventbrite
slug.

A request resolves to the **nearest** listed town. More than 250 km from any of
them means the caller is abroad: they get London, and `inMarket: false` so the
clients can explain why. There are no generic worldwide cells, because Pulse
covers the UK and says so.

Adding a town is one line in `sources/regions.js`. It appears in the app's
picker on the next launch, with no new build.

## Caching

One cache entry per region, 12-minute TTL, stale-while-revalidate: a request is
always answered from cache while the refresh happens behind it, so nobody waits
on a live scrape. At most 24 regions are held (LRU), with `WARM_REGIONS`
(default `london,manchester,birmingham,glasgow`) kept warm on boot and on the
refresh timer, and exempt from eviction.

## How sorting works

- **Nearest**: straight-line (haversine) distance from your location,
  ascending, with ties broken by soonest start.
- **Soonest**: earliest start first, with ties broken by distance.
- Past events are filtered out. Events with no fixed date sort to the end and
  only appear under "All upcoming".
- "Today" and "this weekend" are bucketed in `Europe/London`, not in the
  server's UTC, so they mean what someone in Britain means by them.

## Layout

```
server.js               Express API (/api/events, /api/regions, ...) and the static frontend
sources/
  regions.js            The 454-town UK catalogue, resolution, and date-range maths
  ticketmaster.js       Ticketmaster Discovery API, countryCode=GB (needs a free key)
  skiddle.js            Skiddle UK listings (needs a free key)
  sportsfixtures.js     Football fixtures and the UK ground table (needs a free key)
  eventbrite.js         Eventbrite UK via discovery-page JSON-LD
  curated.js            Built-in guide to real UK venues
  util.js               Distance, entity decoding and event normalisation helpers
public/                 PWA (index.html, app.js, styles.css): list and Leaflet map
```

## Design

The palette is the Union flag: Pantone 280 blue, Pantone 186 red and white.
Neither flag colour survives a straight lift into a dark interface, so the dark
theme sits on a navy derived from the blue and lifts the red enough to read on
it. Every value in `public/styles.css` is a flat colour, and there are no
gradients in the stylesheet or in the rendering code.

Nothing in the interface is an emoji. Category marks and interface icons are
inline SVG defined at the top of `public/app.js`, so they inherit the current
colour, hold their weight on every platform, and never depend on an emoji font.

## Deploying

See [DEPLOY.md](DEPLOY.md).
