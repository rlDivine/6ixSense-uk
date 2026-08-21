# VenTrack

**What's on across the UK, right now.** Gigs, festivals, markets, comedy, arts
and free events, anywhere in England, Wales, Scotland or Northern Ireland,
sorted by **how close they are to you** and **how soon they start**.

VenTrack is a UK-market adaptation of the 6ix Sense product. It is a **separate
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
ruby project.rb            # regenerates VenTrack.xcodeproj (needs the xcodeproj gem)
open VenTrack.xcodeproj    # Cmd-R on an iPhone or iPad simulator
```

The app works immediately with no API key. Add free keys for the full live
feed:

```bash
TM_API_KEY=... SKIDDLE_API_KEY=... THESPORTSDB_KEY=... PREDICTHQ_API_KEY=... npm start
```

## What "UK only" means here

This is the substance of the adaptation, not just a rename.

| | 6ix Sense | VenTrack |
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
| **Bundle id** | `com.voice2jobs.6ixsense` | `com.voice2jobs.ventrackuk` |

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
coordinate more than 250 km from any of them is abroad, so VenTrack serves London
and tells the user plainly rather than silently pretending they are in the
capital.

## Where the events come from

| Source | Key needed? | How | Covers |
|---|---|---|---|
| **Ticketmaster Discovery** | Free key (`TM_API_KEY`) | REST, `countryCode=GB` | Concerts, theatre, comedy, arena sport |
| **Skiddle** | Free key (`SKIDDLE_API_KEY`) | REST, queried by lat/lng | UK-only listings: gigs, club nights, festivals, comedy, food. Coordinates and prices in pounds on every result |
| **Football fixtures** | Free key (`THESPORTSDB_KEY`) | TheSportsDB REST | Upcoming fixtures in the Premier League, Championship, League One, League Two and the Scottish Premiership |
| **PredictHQ** | Free key (`PREDICTHQ_API_KEY`) | REST, `within` radius search, `country=GB` | Concerts, festivals, performing arts, expos, community listings, sport |
| **Eventbrite UK** | No | `eventbrite.co.uk` discovery pages, JSON-LD, 13 pages per town | Music, food, **food festivals and food expos**, comedy, arts, film, sport, family, festivals, pop-ups, free events |
| **Local guide** | No | Built in | Real UK venues with regular programming |
| **Local pages** | Free-tier key (`OPENAI_API_KEY`), plus pages actually listed in `sources/localscan-seeds.js` | An LLM reads the community pages that list is pointed at | Whatever those pages carry: a council's "what's on", one venue's own site, a Facebook Page. The one source built to catch the listing that was never meant to be ticketed |
| **Car boot sales** | No | Built in | Real car boot sales and boot fairs UK-wide, with admission, opening time and season |

Every keyed source returns nothing at all when its key is unset, so the app
works with none of them configured. Skiddle is the one worth setting first: it
is UK-only by design, so its coverage of British nightlife and gigs runs deeper
than a global service's. Football is the biggest category the ticketing sources
miss, because most clubs sell through their own box office rather than through
Ticketmaster. PredictHQ is the one source with no ticket link and no image of
its own, so those cards get drawn category artwork like any other listing with
no photo; what it adds is the long tail of expos and community events the
ticketing sources never carry, plus, sometimes, a real description rather than
the generic fallback text.

Local pages is a different shape from the other six. It costs real money per
page scanned, it needs pages to be added by hand to `localscan-seeds.js`
(there is no crawler that finds them on its own), and what it returns is an
LLM's best reading of a webpage rather than a structured feed, so it is listed
last in de-dupe priority: a real ticketed listing for the same event wins.
`api/DEPLOY.md` has the full story, including why automatic discovery of new
pages is a deliberately separate, not-yet-built decision rather than something
bolted onto this.

### Car boot sales and food festivals

Two things people look for on a British weekend that no feed carries properly.

**Food festivals** are on Eventbrite, but not where you would think. The plain
food vertical is mostly tastings, supper clubs and classes, and the plain
festivals vertical is mostly music, so a food festival reliably falls between
them. Eventbrite crosses a category with a *format*, and it is that crossing,
`food-and-drink--festivals` and `food-and-drink--expos`, that actually returns
them. Both are scraped now, ahead of the two plain verticals so they win the
category on de-dupe.

**Car boot sales** are not on any feed at all, and the reason is worth stating
because it is the argument for how they are done here. Ticketmaster and Skiddle
sell tickets; a boot sale is cash at the gate. Eventbrite carries a few dozen
nationally against the several hundred that run. The directories that do list
them publish no JSON-LD, no API and no coordinates, and distance is the whole
premise of this app. Most of all, a boot sale is not an event: it is a
recurrence rule with a season, and any source would have to expand
"every Sunday, Easter to October" into dates itself.

So `api/sources/carboots.js` is a table, the same bargain `curated.js` makes,
and it expands those rules into real dates: weekly, fortnightly against an
anchor date, or the first Sunday of the month; a per-sale season, because most
outdoor sales stop for the winter and the indoor and hardstanding ones do not;
per-date exclusions, because York does not run on racing Saturdays. Times are
when **buyers** are let in, not when sellers set up. A sale whose dates cannot
be stated as a rule is left out rather than guessed at, and the ones left out
are named in the file so nobody re-adds them.

Both land in the existing **Markets** and **Food** buckets rather than new
categories, and `categoryFromTitle` in `api/sources/util.js` puts them there no
matter which source found them: a title that says "car boot sale" or "beer
festival" now beats whatever shelf the source filed it under.

## Design

**Palette.** The Union flag, used with discipline rather than evenly. Navy
(Pantone 280, `#012169`) is the interface colour and carries every selected
state. Red (Pantone 186, `#C8102E`) is reserved for three things: the logo, the
primary action, and anything happening today. Reserving it is what stops the
app looking like a wall of buttons. The dark theme swaps the roles, since
neither flag colour survives a straight lift into a dark interface: it sits on
a neutral slate rather than a darkened flag blue, near white carries the
selected states, and the red is lifted to read against the page.

**Layout.** Editorial rather than boxy. The place is a page title rather than a
caption, dates sit above each title as a letter-spaced overline instead of a
sticker on the thumbnail, and distance is quiet reference detail in the footer
rather than a large number competing with the event name.

**No gradients.** Every fill in both clients is a flat colour. Category washes,
hero scrims, the loading skeleton and the map overlay were all gradients and
are now solid.

**No emoji**, apart from the iOS interest filter chips, where they earn their
place by making a twelve-item grid scannable. They are the only ones in either
client: the web app has none at all. Everywhere else the app uses SF Symbols on
iOS and inline SVG on the web, so nothing depends on an emoji font or shifts
weight between platforms.

**Cards with no photograph.** Plenty of listings arrive without a usable image,
and those rows used to lose their thumbnail entirely, which made a feed drawn
from image-less sources look broken rather than sparse. They now get drawn
artwork instead: one composition per category in the category's own colour, over
its wash, with the category mark in the corner. The layout varies per event but
is derived from the event id, so a card does not reshuffle as you scroll.
`ios/VenTrack/Design/CategoryArtwork.swift` sets out the twelve motifs and the
reasoning; the web client follows it.

**Logo.** A map pin with a pulse trace knocked out of it as a counter, drawn as
a single even-odd filled path. The pin is deliberate: the previous mark was a
dot under two rising arcs and read as a wifi symbol. The cost is that a
knocked-out counter is harder to hold at small sizes than separated shapes are,
and at 18pt in a header the trace is near the limit of what survives. See
[`DESIGN.md`](DESIGN.md) for the full trade.

One geometry, six implementations kept in step by hand:

- `ios/VenTrack/Design/Theme.swift`, `VenTrackLogoGeometry`, the in-app mark
- `ios/tools/make_icon.js`, which generates the three App Store icon PNGs
  (`node tools/make_icon.js`)
- `ios/tools/make_icon.swift`, the CoreGraphics twin of that tool, for running
  on a Mac
- `api/public/icon.svg`, the site and home screen icon
- the inline `<svg>` in the header of `api/public/index.html`, the landing page,
  which is the one the public actually sees
- the inline `<svg>` in the brand strip of `api/webapp/index.html`, the web app

## Designing

[`DESIGN.md`](DESIGN.md) is the brief for anyone taking the interface further:
the audience, the palette and the reasoning behind it, the type scale, every
screen and what it has to show, the hard constraints, and an explicit list of
what is still deliberately a placeholder. The mark is settled; the wordmark
beside it is not.

## Deploying

`render.yaml`, at the repository root, is a Render blueprint (Frankfurt
region, the closest Render runs to the UK). Once deployed, point the iOS app at
it via `productionURL` in `ios/VenTrack/Services/EventService.swift`.

The service it creates is named `pulse-uk-api`, which is the app's old name and
is left that way deliberately: on Render the name is the service's identity and
its hostname, not a piece of branding, so renaming it would mint a second
service on a different URL rather than relabel the running one.

See [`api/DEPLOY.md`](api/DEPLOY.md) for the full walkthrough, including what a
real rename of that service would involve.

## Before you ship

- **Set the API keys** in the Render dashboard. Without them the feed is the
  curated guide plus Eventbrite only.
- **Point `EventService.productionURL`** at your deployed backend. It currently
  reads `https://pulse-uk-api.onrender.com`, which is where `render.yaml` puts
  it. That host keeps the old product name on purpose, and the two strings have
  to match, so change neither on its own.
- **Register `com.voice2jobs.ventrackuk`** in App Store Connect. VenTrack is a
  new product, not an update to 6ix Sense, so it needs its own listing.
- **Check the mark at the smallest size you ship it at.** The knocked-out pulse
  trace is close to its limit at 18pt, so anything smaller needs looking at on a
  device rather than on a monitor.
- **Have the privacy policy reviewed.** `api/public/privacy.html` describes
  what the app actually does and points at the ICO, but it has not been through
  a solicitor and should be before launch.
