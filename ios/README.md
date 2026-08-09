# Pulse: native iOS app (SwiftUI)

A native **SwiftUI** app for iPhone and iPad that shows what's on across the
United Kingdom, sorted by how close and how soon. It is a **client** for the
Express backend in [`../api`](../api). The backend does the aggregation and
the distance and time sorting, and the app renders it natively.

> A phone can't scrape event sites on-device, so the architecture is
> **SwiftUI app talking to the Pulse API**. The backend must be reachable
> while the app runs.

## Open in Xcode

```bash
cd ios
ruby project.rb          # (re)generate Pulse.xcodeproj from the Swift sources
open Pulse.xcodeproj
```

`project.rb` needs the `xcodeproj` gem (`gem install xcodeproj`). The generated
project is committed, so you only need to re-run it after adding or renaming a
Swift file.

Pick an iPhone or iPad simulator and hit Cmd-R.

## Running on your own iPhone

1. Plug the phone in (or pair it wirelessly: **Window, then Devices and
   Simulators**), unlock it, and tap **Trust** if iOS asks.
2. In Xcode, select the **Pulse** scheme and your phone as the run
   destination, top left, instead of a simulator.
3. Open the **Pulse** target's **Signing & Capabilities** tab and check
   **Team**. `project.rb` sets a `DEVELOPMENT_TEAM` value so regenerating the
   project does not blank it, but that value belongs to whoever's Apple
   account it was set from. Pick **your own** team from the dropdown; a free
   personal Apple ID works for on-device testing, no paid membership needed.
   If you want that choice to survive a future `ruby project.rb`, export it
   first: `DEV_TEAM=YOURTEAMID ruby project.rb`.
4. Cmd-R. First run on a new phone, iOS will refuse to launch the app until
   you go to **Settings, General, VPN & Device Management** and trust your
   developer certificate.
5. A free Apple ID's signature expires after 7 days, so the app needs a
   re-run from Xcode roughly weekly, not a fresh install; a paid Apple
   Developer account extends that to a year and unlocks TestFlight.

## Pointing it at a backend

`Services/EventService.swift`:

```swift
private static let productionURL = "https://pulse-uk-api.onrender.com"
private static let macLAN_IP     = "192.168.18.5"
```

- **Production**: leave `productionURL` set. Every device uses it.
- **Local development**: blank out `productionURL` and set `macLAN_IP` to your
  Mac's Wi-Fi IP (`ipconfig getifaddr en0`), then run `npm start` in `../api`.
  HTTP to a LAN IP is permitted via `NSAllowsLocalNetworking` in `Info.plist`.

`productionURL` must point at a **Pulse** deployment. The 6ix Sense backend
serves Toronto and is a different product.

## What's in the app

| Area | Implementation |
|---|---|
| **Onboarding** | Three mandatory steps: value prop, location priming, interests |
| **Discover** | Nearest/Soonest, date-range pills, category chips, image-led cards, pull-to-refresh, Map FAB |
| **Map** | `MKMapView` wrapped in `UIViewRepresentable`, with category-coloured SF Symbol markers, clustering, user location and a bottom card carousel |
| **Event detail** | Hero, key facts, a still venue map from `MKMapSnapshotter` with an Apple Maps directions link, Share, Save, "Get tickets and details" |
| **Saved** | Grouped by date, per-event reminder as a local notification 2h before |
| **Search** | Live filter over title, venue and category, plus date phrases ("this weekend", "25/7") and UK address lookup |
| **Preferences** | Interests, and a location picker over all 454 UK towns, grouped by nation and county |
| **iPad** | A real regular-width layout: `NavigationSplitView` sidebar, adaptive grid, map pane |
| **Design** | Union flag palette, restrained category colours, light and dark (follows system), no gradients |
| **Persistence** | Saved events, reminders, interests and location override in `UserDefaults`. No account. |

## UK specifics

- **Miles** everywhere. The API sends kilometres and `Fmt` converts, following
  the region's declared `unit`.
- **`25/7` is 25 July.** `DateQueryParser` reads numeric dates day first, as
  the web app does.
- **Address search is UK-biased and UK-filtered.** `CLGeocoder` is given a UK
  region and a non-GB result is rejected outright, so "Newport" resolves in
  Wales rather than Rhode Island.
- **Out of market.** Open the app abroad and the backend serves London with
  `inMarket: false`; the app shows a notice explaining that, rather than
  labelling London listings "near you".
- **Sport keywords** are football, rugby, cricket, netball, athletics, boxing,
  darts, snooker and racing, not hockey and baseball. In `Preference.swift`.

## The logo

`Design/Theme.swift` holds `PulseLogoGeometry`: a flat map pin with a knocked
out centre, on a 24 by 24 grid. It is a SwiftUI `Shape`, so there is no image
asset to keep in sync at any size, and it is a deliberate placeholder that can
be swapped without touching anything else.

The App Store icons come from the same geometry:

```bash
node tools/make_icon.js        # writes all three variants into Assets.xcassets
```

`tools/make_icon.swift` is the CoreGraphics equivalent, for regenerating them
from Swift on a Mac. It writes one variant per run rather than all three:

```bash
swift tools/make_icon.swift out.png light      # or dark, or tinted
```

Both produce opaque 1024 by 1024 PNGs with no alpha, as the App Store requires.

## Structure

```
Pulse/
  Models/Event.swift            Codable models matching the API JSON
  Models/PlaceOverride.swift    Manual location choice and the town catalogue
  Models/Preference.swift       Interest buckets and their keywords
  Models/DateQueryParser.swift  "this weekend", "25/7", "next friday"
  Services/EventService.swift   async URLSession client (baseURL here)
  State/AppState.swift          ObservableObject: fetch, filters, location, saved, reminders
  Design/Theme.swift            Colour tokens, category palette, PulseLogo, date and distance helpers
  Views/                        PulseApp.swift (also holds RootView and MainTabView),
                                OnboardingView, DiscoverView, EventCard, EventMapView,
                                SavedView, SearchView, EventDetailView,
                                PreferencesView, RegionBrowserView, States
  Views/iPad/                   Regular-width shell, map pane, sidebar primitives
  Assets.xcassets/              AppIcon: the three 1024px PNGs and their Contents.json
  Info.plist                    Location usage string and the local-network ATS exceptions
project.rb                      Regenerates Pulse.xcodeproj
tools/make_icon.js|.swift       Generates the AppIcon PNGs from PulseLogoGeometry
```

## Notes

- Deployment target **iOS 17**, set in `project.rb`. The map is UIKit's
  `MKMapView` behind a `UIViewRepresentable`, not the SwiftUI `Map` view, so
  the clustering and per-annotation styling go through `MKMapViewDelegate`.
- `TARGETED_DEVICE_FAMILY` must stay `1,2`. Shipping iPhone-only makes iPadOS
  run the app in scaled-compatibility mode, so the `Views/iPad` layout never
  activates, which is what got the 6ix Sense 1.0 (1) build rejected under
  Guideline 4 (Design). Pulse inherits both the layout and the requirement.
- Bundle id is `com.voice2jobs.pulseuk`, a new App Store product rather than an
  update to 6ix Sense.

## No emoji, no gradients

Every fill in the app is a flat colour. Category washes, the onboarding art and
the map overlay were gradients and are now solid.

Emoji appear in exactly one place: the interest filter chips in
`Models/Preference.swift`, where they make a twelve-item grid scannable at a
glance. Everywhere else, including card placeholders, map markers and empty
states, the app uses SF Symbols through `CategoryGlyph` and `Categories.symbol`.
