# Pulse

**What's on across the UK, right now.** Gigs, festivals, markets, comedy, arts
and free events, anywhere in England, Wales, Scotland or Northern Ireland,
sorted by **how close they are to you** and **how soon they start**.

Pulse is a UK-market adaptation of the 6ix Sense product. It is a **separate
app**, not a rebuild of that one: different name, different bundle id,
different backend, different catalogue. The 6ix Sense repositories
(`6ix-sense-api`, `6ix-sense-ios`) are the read-only source of the design and
are not modified by anything in here.

```
api/    Node/Express backend and the installable web app (PWA)
ios/    Native SwiftUI app for iPhone and iPad
```

## Quick start

```bash
# 1. Backend
cd api
npm install
npm start                # http://localhost:3000, API and web app

# 2. iOS app
cd ../ios
ruby project.rb          # regenerates Pulse.xcodeproj (needs the xcodeproj gem)
open Pulse.xcodeproj     # Cmd-R on an iPhone or iPad simulator
```

The app works immediately with no API key. Add free keys for the full live
feed:

```bash
TM_API_KEY=... SKIDDLE_API_KEY=... THESPORTSDB_KEY=... npm start
```

## What "UK only" means here

This is the substance of the adaptation, not just a rename.

| | 6ix Sense | Pulse |
|---|---|---|
| **Market** | Toronto, plus a UK catalogue | United Kingdom, exclusively |
| **Regions** | Toronto, UK towns, generic worldwide cells | 454 curated UK towns, no generic cells |
| **Default region** | Toronto | London |
| **Out of market** | Falls back to a generic geo cell | Falls back to London, and the app says why |
| **Distances** | km in Canada, miles in the UK | Miles everywhere |
| **Dates** | `en-CA`, `7/25` is 25 July | `en-GB`, `25/7` is 25 July |
| **Prices** | `$39 CAD` | `£39` |
| **Address search** | Global geocoding | Biased to the UK and rejects non-GB hits, so "Newport" is Wales, not Rhode Island |
| **Sport keywords** | hockey, basketball, baseball | football, rugby, cricket, netball, darts, snooker |
| **Warm regions** | `toronto,london` | `london,manchester,birmingham,glasgow` |
| **Bundle id** | `com.voice2jobs.6ixsense` | `com.voice2jobs.pulseuk` |

Everything Toronto-specific was **removed**, not left dormant: the SeatGeek,
NOW Toronto and City of Toronto sources are gone, along with the Nominatim
geocoder that only existed to place NOW Toronto's addresses.

### Coverage

454 towns and cities: at least one per ceremonial county in England, per
principal area in Wales, per council area in Scotland and per traditional
county in Northern Ireland, plus the larger towns people actually search for.
The app's location picker groups them by nation and county and filters as you
type, so finding Kidderminster takes two taps.

A coordinate anywhere in the country resolves to its nearest listed town. A
coordinate more than 250 km from any of them is abroad, so Pulse serves London
and tells the user plainly rather than silently pretending they are in the
capital.

## Where the events come from

| Source | Key needed? | How | Covers |
|---|---|---|---|
| **Ticketmaster Discovery** | Free key (`TM_API_KEY`) | REST, `countryCode=GB` | Concerts, theatre, comedy, arena sport |
| **Skiddle** | Free key (`SKIDDLE_API_KEY`) | REST, queried by lat/lng | UK-only listings: gigs, club nights, festivals, comedy, food. Coordinates and prices in pounds on every result |
| **Football fixtures** | Free key (`THESPORTSDB_KEY`) | TheSportsDB REST | Upcoming fixtures for the English leagues and the Scottish Premiership |
| **Eventbrite UK** | No | `eventbrite.co.uk` discovery pages, JSON-LD, 11 verticals | Music, food, comedy, arts, film, sport, family, festivals, pop-ups, free events |
| **Local guide** | No | Built in | Real UK venues with regular programming |

Every keyed source returns nothing at all when its key is unset, so the app
works with none of them configured. Skiddle is the one worth setting first: it
is UK-only by design, so its coverage of British nightlife and gigs runs deeper
than a global service's. Football is the biggest category the ticketing sources
miss, because most clubs sell through their own box office rather than through
Ticketmaster.

## Design

**Palette.** The Union flag: Pantone 280 blue (`#012169`), Pantone 186 red
(`#C8102E`) and white. Neither flag colour survives a straight lift into a dark
interface, so the dark theme sits on a navy derived from the blue and lifts the
red enough to clear contrast checks on it. The light theme uses both flag
colours as they are.

**No gradients.** Every fill in both clients is a flat colour. Category washes,
hero scrims, the loading skeleton and the map overlay were all gradients and
are now solid.

**No emoji**, apart from the interest filter chips, where they earn their place
by making a twelve-item grid scannable. Everywhere else the app uses SF Symbols
on iOS and inline SVG on the web, so nothing depends on an emoji font or shifts
weight between platforms.

**Logo.** A flat map pin with a knocked-out centre. It is deliberately a
placeholder, built so it can be replaced without anything else changing. One
geometry, three implementations kept in step:

- `ios/Pulse/Design/Theme.swift`, `PulseLogoGeometry`, the in-app mark
- `ios/tools/make_icon.js`, which generates the three App Store icon PNGs
  (`node tools/make_icon.js`); `make_icon.swift` is the CoreGraphics twin for
  running on a Mac
- `api/public/icon.svg`, the web and PWA icon

## Deploying

`api/render.yaml` is a Render blueprint (service `pulse-uk-api`, Frankfurt
region, the closest Render runs to the UK). Once deployed, point the iOS app at
it via `productionURL` in `ios/Pulse/Services/EventService.swift`.

See [`api/DEPLOY.md`](api/DEPLOY.md) for the full walkthrough.

## Before you ship

- **Set the API keys** in the Render dashboard. Without them the feed is the
  curated guide plus Eventbrite only.
- **Point `EventService.productionURL`** at your deployed backend. It currently
  reads `https://pulse-uk-api.onrender.com`, which is where `render.yaml` will
  put it, but the hostname is only real once you have deployed.
- **Register `com.voice2jobs.pulseuk`** in App Store Connect. Pulse is a new
  product, not an update to 6ix Sense, so it needs its own listing.
- **Replace the placeholder logo.** It is a competent stand-in, not an
  identity.
- **Have the privacy policy reviewed.** `api/public/privacy.html` describes
  what the app actually does and points at the ICO, but it has not been through
  a solicitor and should be before launch.
