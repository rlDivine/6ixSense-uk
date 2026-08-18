# VenTrack UK: backend and web app

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
TM_API_KEY=... SKIDDLE_API_KEY=... THESPORTSDB_KEY=... PREDICTHQ_API_KEY=... npm start
```

`server.js` also reads an `api/.env` file if one is present, so the keys can go
there instead. Host-provided environment variables win over it. See
`.env.example`.

## API

| Endpoint | What it does |
|---|---|
| `GET /healthz` | Liveness for the host. Never scrapes. |
| `GET /api/events?lat=&lng=&sort=&range=` | The feed. `sort` is `nearest` or `soonest`, `range` is `all`, `today`, `weekend` or `week`. |
| `GET /api/regions` | The town catalogue, grouped by nation and county. This is what the app's location picker renders. |
| `GET /api/status` | Which optional keys are configured, the id of every curated town, and the cache state of the regions currently held. |
| `GET /api/diag?lat=&lng=` | Runs every source independently, bypassing cache. Count, timing and error per source. |

`/api/events` returns:

```jsonc
{
  "origin":   { "lat": 53.48, "lng": -2.24 },
  "region":   { "id": "manchester", "label": "Manchester", "area": "Greater Manchester",
                "nation": "England", "country": "GB", "timeZone": "Europe/London",
                "unit": "mi", "center": { }, "generic": false },
  "inMarket": true,     // false when the caller's coordinate is outside the UK
  "sort":     "nearest",
  "range":    "all",
  "count":    128,
  "sources":  ["Ticketmaster", "Skiddle", "Football fixtures", "Eventbrite", "Local guide"],
  "events":   [ ]
}
```

`sort` and `range` echo back what the server actually applied, which is not
always what was asked for: an unrecognised value falls back to `nearest` and
`all`. `sources` is not the configured source list. It is the distinct `source`
values of the events in this particular response, so it shrinks when a key is
unset or when the date range filters a source out entirely. `region.generic` is
a legacy field kept so older builds still decode, and is always `false`.

Distances (`distanceKm`) are always sent in kilometres and the clients convert.
Every UK region reports `"unit": "mi"`, so both clients display miles.

## Where the events come from

| Source | Key needed? | How | Covers |
|---|---|---|---|
| **Ticketmaster Discovery** | Free key (`TM_API_KEY`) | REST, pinned to `countryCode=GB` | Concerts, theatre, comedy, arena sport |
| **Skiddle** | Free key (`SKIDDLE_API_KEY`) | REST, queried by lat/lng | UK-only listings: gigs, club nights, festivals, comedy, food |
| **Football fixtures** | Free key (`THESPORTSDB_KEY`) | TheSportsDB REST | Premier League, Championship, League One, League Two and the Scottish Premiership |
| **PredictHQ** | Free key (`PREDICTHQ_API_KEY`) | REST, `within` radius search, `country=GB` | Concerts, festivals, performing arts, expos, community listings, sport |
| **Eventbrite UK** | No | `eventbrite.co.uk` discovery pages, embedded JSON-LD, 11 pages per town | Music, food, comedy, arts, film, sport, family, festivals, pop-ups, free events |
| **Local guide** | No | Built in | Real UK venues with regular programming |
| **Local pages** | Free-tier key (`OPENAI_API_KEY`), plus pages listed in `sources/localscan-seeds.js` | Fetches each listed page, has an LLM extract real upcoming events from it | Whatever the watched pages carry: council sites, individual venues, Facebook Pages |

Ticketmaster is pinned to GB so a radius search from the Kent coast or Northern
Ireland cannot pull in French or Irish listings. Skiddle takes its radius in
miles rather than kilometres, which the source converts and then caps at 30
miles, because the API rejects very large radii. PredictHQ carries no ticket
link and no image, since it is a demand-intelligence feed rather than a
ticketing one, so those cards get drawn category artwork; it sometimes
carries a real description, which is used ahead of the generic fallback text
for exactly that reason. Eventbrite is a per-town scrape of eleven discovery
pages, ten verticals plus the general feed, and a town with no Eventbrite page
contributes nothing rather than failing the request. The guide is national,
and each region takes the slice inside its own radius. Local pages is the
newest and least structured of the seven: see the dedicated section below.

Every keyed source returns nothing when its key is unset, so the whole thing
works with none configured. `GET /api/status` reports which keys are present,
which is the quickest way to explain a thin feed. Skiddle is the one worth
setting first: it is UK-only by design, so its coverage of British nightlife
and gigs runs deeper than a global service's.

### Local pages

`sources/localscan.js` is the source built for the event that will never
appear on any of the other six because it was never meant to be ticketed: a
free afternoon at the local boating pool, a village hall jumble sale. It
fetches every page listed in `sources/localscan-seeds.js` for a region,
strips the HTML down to its title, meta description, `og:*` tags and visible
body text with cheerio, and sends that text to an OpenAI model with a strict
JSON schema asking for real, dated, upcoming events only. With no
`OPENAI_API_KEY` set it does nothing at all and costs nothing, so the seed
list can be grown before the key is ever configured.

Three things are worth knowing before touching it:

- **It costs money per page, so it caches hard.** A page is normally
  re-scraped and re-summarised a handful of times a day (`PAGE_TTL_MS`), not
  on every request, which is deliberately much longer than the 12 minute
  per-region cache the rest of this file runs.
- **The event's `url` is always the page that was scanned, never anything the
  model wrote.** The model is never asked for a link. This is a security
  decision as much as a UX one: page content is untrusted third-party text
  handed to an LLM, and this closes off prompt injection as a route to
  sending a user anywhere. Same idea for `image`: only ever the page's own
  `og:image`, read directly, never described by the model. See the long
  comment at the top of `localscan.js`.
- **Facebook mostly returns nothing usable, on purpose left that way rather
  than worked around.** A plain fetch gets Facebook's JavaScript shell, not a
  signed-in browser's view of the page, so most Facebook Page URLs come back
  too thin to be worth an LLM call and are skipped for that reason before any
  model is called. The one case that reliably works is an individual event's
  own permalink, whose `og:title` / `og:description` have to be server
  rendered for link previews to work in Messenger and WhatsApp.

Coordinates for a scanned event come from OpenStreetMap Nominatim (free, no
key, `countrycodes=gb`), throttled to Nominatim's own one-request-per-second
policy and cached forever per address within the process. An address that
fails to geocode falls back to the region's own centre rather than being
dropped, the same "show something rather than nothing" choice `curated.js`
and `sportsfixtures.js` already make elsewhere in this file.

The seed list grows by hand, or by running `discover-seeds.js`, which
researches regions that already have at least one seed and proposes anything
new it finds as a pull request rather than writing to the file directly. It is
run manually rather than on a schedule, because Render cron services have no
free tier; `api/DEPLOY.md` has the full setup, the token scope it needs, and
the block to restore in `render.yaml` if you ever want it scheduled.

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
clients can explain why. There are no generic worldwide cells, because VenTrack
covers the UK and says so.

Adding a town is one line in `sources/regions.js`. It appears in the app's
picker on the next launch, with no new build.

## Caching

One cache entry per region, 12-minute TTL, stale-while-revalidate: once a region
has anything cached, every request is answered from that cache and the refresh
runs behind it, so nobody waits on a live scrape. The exception is a region
nobody has asked for yet, which has nothing to serve, so the first request to it
does wait for the scrape. That is why the iOS client allows a long timeout on
its first load.

At most 24 regions are held (LRU), with `WARM_REGIONS` (default
`london,manchester,birmingham,glasgow`) kept warm on boot and on the refresh
timer, and exempt from eviction.

## How sorting works

- **Nearest**: straight-line (haversine) distance from your location,
  ascending, with ties broken by soonest start.
- **Soonest**: earliest start first, with ties broken by distance.
- An event whose start time is more than six hours in the past is dropped, so a
  gig that began an hour ago is still listed.
- Events with no fixed date sort last under "Soonest", and only survive the
  "All upcoming" range. Under "Nearest" they sort on distance like anything
  else.
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
  predicthq.js          PredictHQ events intelligence, country=GB (needs a free key)
  eventbrite.js         Eventbrite UK via discovery-page JSON-LD
  curated.js            Built-in guide to real UK venues
  localscan.js          Community pages read by an LLM (needs OPENAI_API_KEY, and seed pages)
  localscan-seeds.js    The pages localscan.js actually watches, per region
  localscan-discover.js Monthly research: proposes new seed pages as a pull request
  util.js               Distance, entity decoding and event normalisation helpers
discover-seeds.js       Seed research, run by hand; proposes new pages as a PR
landing.js              The one dynamic part of the landing page: the App Store call to action
public/                 The marketing site. Everything in here is public
  index.html            Landing page. Self-contained, no external request
  privacy.html          Privacy policy, linked from the App Store listing
  support.html          Support page, linked from the App Store listing
  icon.svg              The site icon (the header mark is inline in index.html)
  sw.js                 Kill switch that unregisters the old web app's service worker
webapp/                 The web app. NOT served unless SERVE_WEB_APP is set
  index.html            Onboarding, the four tabs, the detail sheet
  app.js                Client logic, the inline SVG icon set, the Leaflet map
  styles.css            Theme tokens and layout
  manifest.json         Web app manifest, so the page installs
.env.example            The optional keys, with the signup URL for each
Dockerfile              Node 20 image, the one Render builds
../render.yaml          Render blueprint, at the repository root (see DEPLOY.md)
```

Leaflet itself is loaded from a CDN by `webapp/index.html`, not bundled, so the
map needs a network connection.

## Why `public/` and `webapp/` are two directories

`public/` is served wholesale by `express.static`. `webapp/` is not, unless
`SERVE_WEB_APP` is set, and it is not set in production.

The web app used to be the site. It is the same product as the iOS app, which
is paid, so anyone who found the backend's URL got the whole thing for nothing
and had no reason to buy anything. The split is the fix: the root is now a
landing page that points at the App Store, and the web app stays in the repo
as a development tool.

Two things this deliberately does not do, both worth knowing:

- **It does not lock down the data.** `/api/events` is still open and
  unauthenticated, because the shipped iOS app calls it with no credentials.
  Anyone can still read the feed directly. Hiding the HTML raises the effort;
  it is not access control.
- **It does not reach browsers that already installed the old web app.** The
  old service worker was cache first on the app shell, so those installs serve
  their own copy and never ask the network. `public/sw.js` is what undoes
  them: a worker at the same URL that deletes every cache, unregisters itself
  and reloads. It has no fetch handler, and there is a test that keeps it that
  way. Do not delete that file, or the old worker stays registered forever.

To run the web app locally:

```bash
SERVE_WEB_APP=1 npm start     # then open http://localhost:3000/app/
```

## The App Store link

The landing page's call to action comes from `APP_STORE_URL`. Set it in the
environment and the button links there. Leave it unset and the page renders
"Coming soon to the App Store" as plain text rather than a link, which is why
the page is safe to have live before the app is actually on sale.

## Design

The palette is the Union flag: Pantone 280 blue (`#012169`), Pantone 186 red
(`#C8102E`) and white.
Neither flag colour survives a straight lift into a dark interface, so the dark
theme sits on a neutral slate rather than a darkened flag blue, and lifts the
red enough to read on it. Every value in `webapp/styles.css` is a flat colour,
and there are no gradients in the stylesheet or in the rendering code. The
landing page carries its own copy of the same two palettes, copied rather than
imported so it stays a single file with no build step.

Nothing in the interface is an emoji. Category marks and interface icons are
inline SVG defined at the top of `webapp/app.js`, so they inherit the current
colour, hold their weight on every platform, and never depend on an emoji font.

An event with no usable photograph is not left with an empty thumbnail. It gets
drawn artwork instead: one composition per category, flat shapes in the category
colour over its wash, with the category mark in the corner, and a layout derived
from the event id so it does not change between renders. The design and the
twelve motifs are set out in `../ios/VenTrack/Design/CategoryArtwork.swift`, which
both clients follow.

The brand mark is an inline `<svg>` in both `public/index.html` and
`webapp/index.html`, not a reference to `public/icon.svg`. All three carry the
same path and all three have to be edited when the mark changes. `icon.svg` is
the site and home screen icon only; the inline ones are what a user looks at.

## Deploying

See [DEPLOY.md](DEPLOY.md).
