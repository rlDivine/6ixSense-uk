# Pulse — native iOS app (SwiftUI)

A native **SwiftUI** app for iPhone and iPad that shows what's on across the
United Kingdom, sorted by how close and how soon. It is a **client** for the
Express backend in [`../api`](../api) — the backend does the aggregation and
the distance/time sorting; the app renders it natively.

> A phone can't scrape event sites on-device, so the architecture is
> **SwiftUI app → Pulse API**. The backend must be reachable while the app runs.

## Open in Xcode

```bash
cd ios
ruby project.rb          # (re)generate Pulse.xcodeproj from the Swift sources
open Pulse.xcodeproj
```

`project.rb` needs the `xcodeproj` gem (`gem install xcodeproj`). The generated
project is committed, so you only need to re-run it after adding or renaming a
Swift file.

Pick an iPhone or iPad simulator and hit ⌘R.

## Pointing it at a backend

`Services/EventService.swift`:

```swift
private static let productionURL = "https://pulse-uk-api.onrender.com"
private static let macLAN_IP     = "192.168.18.5"
```

- **Production** — leave `productionURL` set. Every device uses it.
- **Local development** — blank out `productionURL` and set `macLAN_IP` to your
  Mac's Wi-Fi IP (`ipconfig getifaddr en0`), then run `npm start` in `../api`.
  HTTP to a LAN IP is permitted via `NSAllowsLocalNetworking` in `Info.plist`.

`productionURL` must point at a **Pulse** deployment. The 6ix Sense backend
serves Toronto and is a different product.

## What's in the app

| Area | Implementation |
|---|---|
| **Onboarding** | Three mandatory steps — value prop, location priming, interests |
| **Discover** | Nearest/Soonest, date-range pills, category chips, image-led cards, pull-to-refresh, Map FAB |
| **Map** | `MapKit` with category-coloured glyph pins, clustering, user location, PiP preview, bottom card carousel |
| **Event detail** | Hero, key facts, venue mini-map + Apple Maps directions, Share, Save, "Get tickets" |
| **Saved** | Grouped by date, per-event reminder → local notification 2h before |
| **Search** | Live filter over title / venue / category, plus date phrases ("this weekend", "25/7") and UK address lookup |
| **Preferences** | Interests, and a location picker over all 454 UK towns, grouped by nation and county |
| **iPad** | A real regular-width layout — `NavigationSplitView` sidebar, adaptive grid, map pane |
| **Design** | Brand red `#FF6251`, category palette, light + dark (follows system) |
| **Persistence** | Saved events, reminders, interests and location override in `UserDefaults`. No account. |

## UK specifics

- **Miles** everywhere. The API sends kilometres; `Fmt` converts, following the
  region's declared `unit`.
- **`25/7` is 25 July.** `DateQueryParser` reads numeric dates day-first, as
  the web app does.
- **Address search is UK-biased and UK-filtered.** `CLGeocoder` is given a UK
  region and a non-GB result is rejected outright, so "Newport" resolves in
  Wales rather than Rhode Island.
- **Out of market.** Open the app abroad and the backend serves London with
  `inMarket: false`; the app shows a notice explaining that, rather than
  labelling London listings "near you".
- **Sport keywords** are football, rugby, cricket, netball, darts and the rest —
  not hockey and baseball.

## The brand mark

`Design/Theme.swift` holds `PulseMarkGeometry` — a pulse traced across a ring,
on a 24×24 grid. It's a SwiftUI `Shape`, so there is no image asset to keep in
sync at any size.

The App Store icons come from the same geometry:

```bash
node tools/make_icon.js        # writes all three variants into Assets.xcassets
```

`tools/make_icon.swift` is the CoreGraphics equivalent, for regenerating them
from Swift on a Mac. Both produce opaque 1024×1024 PNGs with no alpha channel,
as the App Store requires.

## Structure

```
Pulse/
  Models/Event.swift            Codable models matching the API JSON
  Models/PlaceOverride.swift    Manual location choice + the town catalogue
  Models/Preference.swift       Interest buckets and their keywords
  Models/DateQueryParser.swift  "this weekend", "25/7", "next friday"
  Services/EventService.swift   async URLSession client (baseURL here)
  State/AppState.swift          ObservableObject: fetch, filters, location, saved, reminders
  Design/Theme.swift            Colour tokens, category palette, PulseMark, date/distance helpers
  Views/                        PulseApp, RootView, Onboarding, Discover, EventCard,
                                EventMapView, SavedView, SearchView, EventDetailView,
                                PreferencesView, RegionBrowserView, States
  Views/iPad/                   Regular-width shell, map pane, sidebar primitives
  Info.plist                    Location usage string + localhost ATS exception
project.rb                      Regenerates Pulse.xcodeproj
tools/make_icon.js|.swift       Generates the AppIcon PNGs from PulseMarkGeometry
```

## Notes

- Deployment target **iOS 17** (uses the iOS 17 MapKit SwiftUI APIs).
- `TARGETED_DEVICE_FAMILY` must stay `1,2`. Shipping iPhone-only makes iPadOS
  run the app in scaled-compatibility mode, so the `Views/iPad` layout never
  activates — which is what got the 6ix Sense 1.0 (1) build rejected under
  Guideline 4 (Design). Pulse inherits both the layout and the requirement.
- Bundle id is `com.voice2jobs.pulseuk` — a new App Store product, not an
  update to 6ix Sense.
