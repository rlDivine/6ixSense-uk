# Pulse 🇬🇧

**What's on across the UK, right now.** Gigs, festivals, markets, comedy, arts
and free events — anywhere in England, Wales, Scotland or Northern Ireland —
sorted by **how close they are to you** and **how soon they start**.

Pulse is a UK-market adaptation of the 6ix Sense product. It is a **separate
app**, not a rebuild of that one: different name, different bundle id,
different backend, different catalogue. The 6ix Sense repositories
(`6ix-sense-api`, `6ix-sense-ios`) are the read-only source of the design and
are not modified by anything in here.

```
api/    Node/Express backend + the installable web app (PWA)
ios/    Native SwiftUI app for iPhone and iPad
```

---

## Quick start

```bash
# 1. Backend
cd api
npm install
npm start                # http://localhost:3000 — API + web app

# 2. iOS app
cd ../ios
ruby project.rb          # regenerates Pulse.xcodeproj (needs the xcodeproj gem)
open Pulse.xcodeproj     # ⌘R on an iPhone or iPad simulator
```

The app works immediately with no API key. Add a free
[Ticketmaster key](https://developer.ticketmaster.com/) for the full live
firehose:

```bash
TM_API_KEY=your_key_here npm start
```

---

## What "UK only" means here

This is the substance of the adaptation, not just a rename.

| | 6ix Sense | Pulse |
|---|---|---|
| **Market** | Toronto, plus a UK catalogue | United Kingdom, exclusively |
| **Regions** | Toronto + UK towns + generic worldwide cells | 454 curated UK towns; no generic cells |
| **Default region** | Toronto | London |
| **Out of market** | Falls back to a generic geo cell | Falls back to London, and the app says why |
| **Distances** | km in Canada, miles in the UK | Miles everywhere |
| **Dates** | `en-CA`, `7/25` = 25 July | `en-GB`, `25/7` = 25 July |
| **Prices** | `$39 CAD` | `£39` |
| **Sources** | Ticketmaster, SeatGeek, Eventbrite.ca, NOW Toronto, City of Toronto open data, Toronto venue guide | Ticketmaster (`countryCode=GB`), Eventbrite.co.uk, UK venue guide |
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
coordinate more than 250 km from any of them is abroad — Pulse serves London
and tells the user plainly, rather than silently pretending they're in the
capital.

---

## Where the events come from

| Source | Key needed? | How | Covers |
|---|---|---|---|
| **Ticketmaster Discovery** | Free key (`TM_API_KEY`) | REST, `countryCode=GB` | Concerts, theatre, comedy, sport across the UK |
| **Eventbrite UK** | No | `eventbrite.co.uk` discovery pages → JSON-LD, 6 verticals | Music, food & drink, festivals, pop-ups, free events |
| **Local guide** | No | Built in | Real UK venues with regular programming |

The guide is national and each region takes the slice inside its own radius, so
a town with no live listings still has something to show — and the whole app
works with no keys configured at all.

---

## Brand

Pulse's mark is a pulse traced across a ring. One geometry, three
implementations, all kept in step deliberately:

- `ios/Pulse/Design/Theme.swift` — `PulseMarkGeometry`, the in-app glyph
- `ios/tools/make_icon.js` — generates the three App Store icon PNGs
  (`node tools/make_icon.js`); `make_icon.swift` is the CoreGraphics twin for
  running on a Mac
- `api/public/icon.svg` — the web/PWA icon

Brand red is `#FF6251` on both platforms.

---

## Deploying

`api/render.yaml` is a Render blueprint (service `pulse-uk-api`, Frankfurt
region — the closest Render runs to the UK). Once deployed, point the iOS app
at it via `productionURL` in `ios/Pulse/Services/EventService.swift`.

See [`api/DEPLOY.md`](api/DEPLOY.md) for the full walkthrough.

---

## Before you ship

- **Set `TM_API_KEY`** in the Render dashboard — without it the feed is the
  curated guide plus Eventbrite only.
- **Point `EventService.productionURL`** at your deployed backend. It currently
  reads `https://pulse-uk-api.onrender.com`, which is where `render.yaml` will
  put it, but the hostname is only real once you've deployed.
- **Register `com.voice2jobs.pulseuk`** in App Store Connect. Pulse is a new
  product, not an update to 6ix Sense, so it needs its own listing.
- **Have the privacy policy reviewed.** `api/public/privacy.html` describes
  what the app actually does and points at the ICO, but it has not been through
  a solicitor and should be before launch.
