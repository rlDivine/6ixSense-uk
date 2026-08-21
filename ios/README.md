# VenTrack: native iOS app (SwiftUI)

A native **SwiftUI** app for iPhone that shows what's on across the
United Kingdom, sorted by how close and how soon. It is a **client** for the
Express backend in [`../api`](../api). The backend does the aggregation and
the distance and time sorting, and the app renders it natively.

> A phone can't scrape event sites on-device, so the architecture is
> **SwiftUI app talking to the VenTrack API**. The backend must be reachable
> while the app runs.

## Open in Xcode

```bash
cd ios
ruby project.rb          # (re)generate VenTrack.xcodeproj from the Swift sources
open VenTrack.xcodeproj
```

`project.rb` needs the `xcodeproj` gem (`gem install xcodeproj`).

**Run it every time, and run it before opening the project.** `VenTrack.xcodeproj`
is generated and is NOT committed, so a fresh clone has no project to open until
you generate one. That is deliberate. It used to be committed, and a stale copy
cost real time: the iPad layout landed with `TARGETED_DEVICE_FAMILY = '1,2'` in
`project.rb` and CI compiled it green, while the committed project still said
`'1'` and referenced none of the new files. Anyone opening it in Xcode built the
old iPhone only app and quite reasonably concluded the iPad layout was broken.

Untracked, `open VenTrack.xcodeproj` fails loudly when you have skipped the
generator. That is a much better failure than silently building last week's app.

Pick an iPhone or iPad simulator and hit Cmd-R. The app supports both: at
compact width it is the phone layout, and at regular width `RootView` hands
over to `Views/iPad/PadRootView`, a NavigationSplitView. See the note on
`TARGETED_DEVICE_FAMILY` in `project.rb`, which explains why the layout and
that setting have to ship together.

## Running on your own iPhone

1. Plug the phone in (or pair it wirelessly: **Window, then Devices and
   Simulators**), unlock it, and tap **Trust** if iOS asks.
2. In Xcode, select the **VenTrack** scheme and your phone as the run
   destination, top left, instead of a simulator.
3. Open the **VenTrack** target's **Signing & Capabilities** tab and check
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

`productionURL` must point at a **VenTrack** deployment. The 6ix Sense backend
serves Toronto and is a different product.

The host still reads `pulse-uk-api`, which is deliberate. That string is the
name of a live Render service, and a Render URL is derived from the service
name, so renaming the service mints a new URL and takes every installed app
offline. Moving to a `ventrack` host means standing up a new service and
carrying its four configured API keys across, which is its own migration.

## What's in the app

| Area | Implementation |
|---|---|
| **Onboarding** | Three mandatory steps: value prop, location priming, interests |
| **Discover** | Nearest/Soonest, date-range pills, category chips, image-led cards with drawn artwork behind a missing photo, pull-to-refresh, Map FAB |
| **Map** | `MKMapView` wrapped in `UIViewRepresentable`, with category-coloured SF Symbol markers, clustering, user location and a bottom card carousel |
| **Event detail** | Hero, key facts, a still venue map from `MKMapSnapshotter` with an Apple Maps directions link, Share, Save, "Get tickets and details" |
| **Saved** | Grouped by date, per-event reminder as a local notification 2h before |
| **Search** | Live filter over title, venue and category, plus date phrases ("this weekend", "25/7") and UK address lookup |
| **Preferences** | Interests, a location picker over all 454 UK towns grouped by nation and county, and the unlock with Restore |
| **Unlock** | One non-consumable in-app purchase. Free covers the town you are in, seven days ahead and three saves |
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

`Design/Theme.swift` holds `VenTrackLogoGeometry`: a map pin with a pulse trace
knocked out of it as a counter, on a 24 by 24 grid, filled even-odd so the trace
reads as a hole. It is a SwiftUI `Shape`, so there is no image asset to keep in
sync at any size.

The trace is the part that pays for keeping the pin. The header draws it at
18pt, which is close to the limit of what survives; go much below that and the
counter fills in. If you put the mark anywhere smaller, check it on a device
rather than on a monitor.

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

That is three copies of the geometry in this directory, and three more outside
it: `api/public/icon.svg`, the inline brand mark in the header of
`api/public/index.html` (the landing page), and the inline mark in
`api/webapp/index.html` (the web app). Six in total, kept in step by hand, so a
change to the shape means editing all six. The landing page one is both the most
easily forgotten and the one the public sees most often.

## Structure

```
VenTrack/
  Models/Event.swift            Codable models matching the API JSON
  Models/PlaceOverride.swift    Manual location choice and the town catalogue
  Models/Preference.swift       Interest buckets and their keywords
  Models/DateQueryParser.swift  "this weekend", "25/7", "next friday"
  Services/EventService.swift   async URLSession client (baseURL here)
  Services/Store.swift          StoreKit 2: the one non-consumable unlock, and restore
  State/AppState.swift          ObservableObject: fetch, filters, location, saved, reminders, every gate
  Design/Theme.swift            Colour tokens, category palette, VenTrackLogo, date and distance helpers
  Design/CategoryArtwork.swift  The drawn thumbnail for an event with no photo: twelve motifs
  Views/                        VenTrackApp.swift (also holds RootView and MainTabView),
                                OnboardingView, DiscoverView, EventCard, EventMapView,
                                SavedView, SearchView, EventDetailView,
                                PreferencesView, RegionBrowserView, PaywallView, States
  Assets.xcassets/              AppIcon: the three 1024px PNGs and their Contents.json
  Info.plist                    Location usage string and the local-network ATS exceptions
project.rb                      Regenerates VenTrack.xcodeproj
VenTrack.storekit               Local StoreKit config, so the purchase works in the simulator
tools/make_icon.js|.swift       Generates the AppIcon PNGs from VenTrackLogoGeometry
```

## The gate

VenTrack is free to download. One non-consumable purchase unlocks browsing
towns other than the one you are in, looking past the next seven days, and
keeping more than three saved events with reminders. The reasoning, the price
and the App Store Connect setup are in [APPSTORE.md](APPSTORE.md).

Every gate reads one property, `AppState.unlocked`, which `Store` keeps in step.
Views never talk to StoreKit. The checks themselves live at the funnels rather
than at each call site: `setOverride` is the only way to change town, whichever
of the four routes in the user took, so that is where the town check sits.

To work on the purchase flow, point the scheme at the local configuration once:
**Product, Scheme, Edit Scheme, Run, Options, StoreKit Configuration,
VenTrack.storekit**. That lives in the scheme, which Xcode generates, so
`project.rb` cannot set it for you. Without it there is no product, so the
paywall opens with no price on it. **Debug, StoreKit, Manage Transactions**
resets a test purchase so the locked state can be tried again.

## Notes

- Deployment target **iOS 17**, set in `project.rb`. The map is UIKit's
  `MKMapView` behind a `UIViewRepresentable`, not the SwiftUI `Map` view, so
  the clustering and per-annotation styling go through `MKMapViewDelegate`.
- `TARGETED_DEVICE_FAMILY` is `1,2`, and `Views/iPad` holds the regular width
  layout that setting pairs with. The two ship together or not at all. The
  rejection that got 6ix Sense 1.0 (1) turned down under Guideline 4 was
  claiming iPad support the app did not honour: it carried the layout and
  shipped device family `1`, so iPadOS ran it scaled and the layout never
  activated once. There is a third half to the pair, which is a full set of
  iPad screenshots showing the split view rather than a stretched phone. The
  long comment in `project.rb` has the history, and `DESIGN_IPAD.md` has the
  reasoning.
- Bundle id is `com.voice2jobs.ventrackuk`, a new App Store product rather than
  an update to 6ix Sense. It is also distinct from the old
  `com.voice2jobs.pulseuk`, which is the point: VenTrack ships as its own
  listing rather than as an update to the previous one.

## No emoji, no gradients

Every fill in the app is a flat colour. Category washes, the onboarding art and
the map overlay were gradients and are now solid.

Emoji appear in exactly one place: the interest filter chips in
`Models/Preference.swift`, where they make a twelve-item grid scannable at a
glance. Everywhere else, including card placeholders, map markers and empty
states, the app uses SF Symbols through `CategoryGlyph` and `Categories.symbol`.
The artwork in `Design/CategoryArtwork.swift` is drawn from SwiftUI shapes for
the same reason: no image assets, no font dependency, and it takes the category
colour at whatever size the tile happens to be.
