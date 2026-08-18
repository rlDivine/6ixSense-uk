# VenTrack: App Store submission pack

Everything App Store Connect asks for, written out so it can be pasted in
field by field. Contact details and the support address are the same ones
6ix Sense uses.

No em dashes anywhere in this file, including the copy below.

## Build status

It compiles. Xcode 16.4, iOS 18.5 simulator SDK, arm64 and x86_64, zero errors.
`.github/workflows/ios-build.yml` builds it on a macOS runner on every push
that touches `ios/`, so this stays true rather than being a claim about one
afternoon.

Six warnings, none of which block anything:

- Four are the same deprecation counted once per architecture:
  `traitCollectionDidChange` was deprecated in iOS 17 in favour of the trait
  change registration APIs. It is called in `EventMapView` to re-render the map
  pins when the appearance changes between light and dark. It still works, and
  migrating it changes runtime behaviour that cannot be verified without a
  device, so it is deliberately left alone until after the first release.
- One says no `AppIntents.framework` dependency was found, which is expected:
  the app declares no App Intents.
- One is `ONLY_ACTIVE_ARCH=YES` with multiple architectures, which is an
  artefact of building both slices on a runner rather than for one device.

## App information

| Field | Value |
| --- | --- |
| App name | VenTrack |
| Subtitle | Events near you across the UK |
| Bundle ID | com.voice2jobs.ventrackuk |
| SKU | ventrack-uk-001 |
| Primary language | English (UK) |
| Primary category | Entertainment |
| Secondary category | Travel |
| Copyright | 2026 Voice2Jobs Inc. |
| Contains in-app purchases | Yes, one non-consumable |

Name is 8 characters and the subtitle is 29, both inside Apple's 30 character
limits.

## Pricing and availability

VenTrack is **free to download** with a single **non-consumable in-app
purchase** that unlocks the rest. Not a subscription, and no ads.

| Field | Value |
| --- | --- |
| Business model | Free with one in-app purchase |
| App price | Free |
| In-app purchase | VenTrack Full Unlock, non-consumable |
| Product ID | `com.voice2jobs.ventrackuk.full` |
| Price | £4.99 suggested |
| Availability | United Kingdom only |
| Subscriptions | None |

### Why not paid upfront

Because the coverage is uneven by design and the buyer cannot see that before
paying. `localscan` currently seeds 22 pages for Ramsgate, 3 for Margate, 1 for
Broadstairs and none for the other 451 towns. "The listings others miss" is the
one thing VenTrack does that a browser does not, and it is true in one town.

Charge upfront and a Manchester buyer pays for a promise that returns nothing
extra for Manchester, asks Apple for a refund, which Apple grants readily, and
leaves a one star review. Meanwhile the Ramsgate user who would have paid
happily never finds the app, because a paid app gets almost no organic installs.
Free download plus an unlock puts the trial before the payment, which is the
only order that works when quality varies this much by location.

### What is free and what is not

Free, and deliberately good enough to keep on the phone:

- Wherever the phone is, plus the town the backend resolves for it
- Every category, every source, the map, the event detail, sharing
- The next seven days
- Three saved events

Behind the unlock:

- Any other town: all 454 in the catalogue, plus any address you type, plus
  "search this area" on the map
- The whole calendar instead of the next seven days
- Unlimited saves, and reminders at all

### Do these two things before anything else

1. **Complete Agreements, Tax and Banking.** In App Store Connect under
   Business there is a Paid Applications agreement, separate from the free one
   every account already has. Until it is signed with a bank account and tax
   forms attached, you cannot create a paid in-app purchase at all. This is not
   a warning at submission time; the option simply is not there. Tax forms can
   take a day or two to clear, so start now.
2. **Enrol in the Apple Small Business Program.** Commission drops from 30% to
   15% for anyone under $1M a year. It takes about five minutes and applies
   from the following month. Most first time developers never notice it exists.

What you keep per unlock, after UK VAT and commission:

| Price | At 30% | At 15% (Small Business) |
| --- | --- | --- |
| £2.99 | £1.74 | £2.12 |
| £4.99 | £2.91 | £3.53 |

£4.99 rather than £2.99 because someone who has already used the app and liked
it is a warm buyer. Price sensitivity after the fact is far lower than cold,
which is why freemium unlocks are normally priced above the equivalent paid app.

Running costs are about £76 a year (Render Starter plus OpenAI), or £155
including the developer programme fee. Break even is **22 unlocks a year**, or
44 including the fee. The bar is low. Getting the installs to convert is the
hard part, not the price.

### Creating the in-app purchase

In App Store Connect, under the app, Monetization, In-App Purchases:

| Field | Value |
| --- | --- |
| Type | Non-Consumable |
| Reference Name | VenTrack Full Unlock |
| Product ID | `com.voice2jobs.ventrackuk.full` |
| Display Name | VenTrack, unlocked |
| Description | Browse any of more than 450 UK towns, see the whole calendar rather than the next seven days, and keep as many events as you like with reminders. |

The Product ID must match `Store.productID` in
`ios/VenTrack/Services/Store.swift` exactly. A mismatch is silent: the paywall
opens with no price on it and the button does nothing.

A non-consumable needs a screenshot of the purchase screen for review. Take it
of the paywall sheet, which is what `PaywallView` renders.

### Testing it before it exists

`ios/VenTrack.storekit` is a local StoreKit configuration with the same product
in it, so the whole flow works in the simulator with no App Store Connect
involvement. Point the scheme at it once: **Product, Scheme, Edit Scheme, Run,
Options, StoreKit Configuration, VenTrack.storekit**. That setting lives in the
scheme, which Xcode generates, so `project.rb` cannot set it for you.

With it selected you can buy, and you can reset with **Debug, StoreKit, Manage
Transactions** to test the locked state again. Test at least: buy, relaunch and
confirm it is still unlocked, delete the app and reinstall and use Restore, and
Ask to Buy if you can, since that is the `.pending` path.

### Availability is the UK only

Every region in `sources/regions.js` is a British town, distances are in miles
and the fixture data is domestic football. Someone abroad who installs this gets
an app with nothing near them. Set the territory list to United Kingdom and
widen it later if the data ever supports it.

### If the numbers disappoint

The lever to reach for is the free tier, not the price. Widening what free gets
grows installs and reviews; narrowing it converts more of the ones you have.
Changing £4.99 to £5.99 does neither. Before touching any of it, seed five or
six more towns properly so the differentiator is true somewhere other than
Ramsgate, because right now that is the thing actually limiting the ceiling.

## URLs

| Field | Value |
| --- | --- |
| Support URL | https://pulse-uk-api.onrender.com/support.html |
| Privacy Policy URL | https://pulse-uk-api.onrender.com/privacy.html |
| Marketing URL | https://pulse-uk-api.onrender.com/ |

The marketing URL is the backend's root, which is now a VenTrack landing page
rather than the web app it used to serve. Once the app is on sale, set
`APP_STORE_URL` in the Render environment to the listing's URL and the page's
button will link to it; until then it reads "Coming soon to the App Store" as
plain text, so it is safe to give Apple this URL before launch.

Both of the pages below are served by the backend, already carry the VenTrack name,
and point at contact@voice2jobs.com. Apple does check that the privacy policy
URL loads, so confirm the Render service is awake before you submit. On the
free plan it sleeps after about 15 minutes idle and the first request then
takes 30 to 60 seconds. If a reviewer hits it cold and it times out, that is a
rejection for a reason that has nothing to do with the app.

The backend now pings itself every 10 minutes to stop that happening, which
covers the ordinary case. It does not cover the case that matters most here:
the ping stops while the instance is stopped, so a deploy during review, or any
restart followed by a quiet night, leaves it asleep with nothing to wake it.
Open the URL yourself the morning you submit and again each day review is open,
or move to the paid Starter plan and stop thinking about it. See
`api/DEPLOY.md`.

The host is still called `pulse-uk-api` on purpose. See the note in
`render.yaml`.

## Promotional text

Up to 170 characters. This one is 147 and can be changed later without a new
build, which the description cannot.

```
Free to use where you are. Find what is on near you across the UK tonight or this weekend, ranked by how close and how soon, with no account and no sign up.
```

## Description

```
VenTrack shows you what is on across the United Kingdom, sorted by how close it is and how soon it starts.

Open it and you get a straight answer to the question "what is on near me", gathered from ticketing platforms, listings sites and official fixture data, in one list rather than six browser tabs.

WHAT IT DOES

Ranks every event by distance from you, or by whatever starts soonest.

Covers all four nations, with more than 450 towns and cities you can switch between. You are not limited to wherever your phone happens to be.

Filters by category: music, clubs, festivals, comedy, football, sport, markets, museums, theatre, film, food and family.

Searches by date or by date range. Type "this weekend", "next friday", "25/7" or "july 25 to 27" and it understands you.

Shows everything on a map, with the upcoming list in a tray you can collapse out of the way when you want the map to yourself.

Saves anything you like, and can remind you two hours before it starts.

Adds an event straight to your calendar, or shares it.

BUILT FOR THE UK, NOT ADAPTED TO IT

Distances in miles. Dates written the way you write them. Prices in pounds. Football fixtures sitting alongside the gigs, because here they are part of the same weekend.

NO ACCOUNT, NO SIGN UP

There is nothing to join. Saved events, reminders and your chosen interests stay on your device. Your location is used to work out how far away things are and for nothing else.

FREE WHERE YOU ARE

VenTrack is free for the town you are in, every category, every source, the map and the next seven days, plus three saved events. One optional purchase unlocks the rest for good: any of more than 450 towns or any address you type, the whole calendar instead of the next seven days, and unlimited saves with reminders. It is a single payment, not a subscription, and there are no ads.
```

## Keywords

100 character limit, comma separated, no spaces after the commas. This is 92.
Do not repeat words already in the app name or subtitle, since Apple indexes
those separately.

```
whats on,gigs,concerts,festivals,near me,tonight,london,manchester,things to do,nightlife,uk
```

## What to Test, for TestFlight

```
Check the feed loads and is sorted by distance. Switch the sort to Soonest. Try a date search such as "this weekend". Open the map, collapse the tray, reopen it. Save an event and add one to your calendar. Try it in both light and dark appearance.

Then the unlock. Before buying: confirm you can save three events and that the fourth offers the unlock instead, that "All upcoming" and the town list show a padlock, and that Settings offers Restore. Buy it, and confirm the padlocks are gone, the town list works and reminders can be switched on. Force quit and relaunch, and confirm it is still unlocked. Delete the app, reinstall, and use Settings, Restore a previous purchase.
```

## App Privacy answers

The answers below are what the code actually does. They were checked rather
than assumed: the app imports only Apple frameworks (CoreLocation, MapKit,
StoreKit, SwiftUI, UIKit, UserNotifications, Foundation, QuartzCore), has zero
third party packages, contains no analytics or advertising SDK, and makes no
network request to any host other than its own API and Apple's.

**The in-app purchase does not add a row to this label.** StoreKit transactions
are between the user and Apple. The app reads whether this Apple Account owns
the unlock and stores a single Bool on the device; it never sends purchase
information anywhere, has no analytics to send it to, and has no account to
attach it to. So "Purchases" stays unchecked, and that is a statement about the
code rather than an omission.

**Do you collect data from this app?** Yes. One item only.

| Question | Answer |
| --- | --- |
| Data type | Location, Precise Location |
| Is it collected? | Yes |
| Used for | App Functionality |
| Linked to the user's identity? | No |
| Used for tracking? | No |

There is no account, so there is no name, email, user ID or device ID to link
anything to. Coordinates go to the API so it can rank results by distance and
are cached in memory by region rather than stored per person.

Answer **No** to every other category: contact info, health, financial,
contacts, user content, browsing history, search history, identifiers,
purchases, usage data and diagnostics.

Set the tracking question to **No**, and do not add App Tracking Transparency.
The app has no IDFA and does not track.

## Age rating questionnaire

Answer **None** to everything except this one:

| Question | Answer |
| --- | --- |
| Alcohol, Tobacco, or Drug Use or References | Infrequent or Mild |

That is the honest answer rather than the flattering one. The app lists club
nights, bars and beer festivals, and the listing text comes from third parties
rather than from us. It lands the rating at 12+.

Two questions worth getting right because they are easy to answer wrongly:

**Unrestricted Web Access: No.** Event links open in Safari through SwiftUI's
`Link`, not in an embedded browser inside the app. Answering Yes here would
push the rating to 17+ for no reason.

**User Generated Content: No.** Nothing in the app lets one user post anything
another user can see.

## Export compliance

Already handled in the Info.plist: `ITSAppUsesNonExemptEncryption` is `false`,
so App Store Connect will not ask you the encryption question on every upload.
The app uses HTTPS and nothing else, which is exempt.

## Screenshots

This is the part that needs a device and cannot be prepared in advance.

`TARGETED_DEVICE_FAMILY` is `1`, iPhone only, so one set is all Apple asks for.

| Device | Size | How many |
| --- | --- | --- |
| iPhone 6.9 inch | 1320 x 2868 or 1290 x 2796 | 3 to 10 |

Apple scales that set down for smaller iPhones, so there is nothing else to
capture. If iPad support is ever restored, a 13 inch set becomes mandatory
again, and so does an iPad layout worth showing.

Suggested five, in this order, since the first two are what people actually see
in search results:

1. The Discover feed, sorted by Nearest, with the category filters visible
2. The map with the tray open and pins on screen
3. An event detail page
4. The city picker open, showing the spread of UK towns
5. Saved, with a reminder toggled on

Capture them on a real device with Cmd+Shift+4 in the simulator, or on your
phone and airdrop them. Turn off the debug banner and make sure the status bar
looks sensible.

## Build and upload

```bash
cd ios
ruby project.rb
open VenTrack.xcodeproj
```

Then in Xcode:

1. Select **Any iOS Device (arm64)** as the destination, not a simulator.
2. Set the Team under **Signing and Capabilities** to your paid developer team.
3. **Product, then Archive**.
4. In the Organizer window that opens, **Distribute App**, then **App Store
   Connect**, then **Upload**.
5. Wait for the build to finish processing in App Store Connect, which is
   usually 10 to 30 minutes, then attach it to the version.

Version is currently 1.0.0 and build number 1. Every upload needs a build
number higher than the last, so bump `CFBundleVersion` in
`ios/VenTrack/Info.plist` for each new one.

## Review notes

Worth writing in the App Review Information box, since the app talks to a
backend and a reviewer hitting a cold start will otherwise think it is broken:

```
VenTrack needs no account, so there is no demo login.

The app reads from its own backend at https://pulse-uk-api.onrender.com. That service is on a plan that sleeps when idle, so the very first request after a quiet period can take up to a minute to return while it wakes. If the feed appears empty on first launch, please pull to refresh once and it will populate.

Location permission is optional. If it is declined the app still works: it defaults to a UK city and you can change it from Settings, then the gear icon, then Change city.

Event listings come from Ticketmaster, Skiddle, PredictHQ, Eventbrite and public football fixture data, plus a small curated list of well known UK venues.

The app is free for the town you are in, the next seven days and three saved events. One non-consumable purchase, VenTrack Full Unlock, adds the other UK towns, the full date range and unlimited saves with reminders. It can be reached from any padlocked control, and from Settings, which also carries Restore. There is no account, so there is nothing to log in to in order to test it.
```

Open that URL in a browser yourself before submitting, and again each day
review is open. The keep-alive ping in the backend makes this unlikely to
matter, but it cannot restart a service that has already stopped, so a deploy
mid-review can still leave the reviewer with a cold instance.

## Things that are not ready

Being straight about what is unfinished, since these are the likely rejection
points rather than anything on the list above:

- **No screenshots exist yet.** They need a device. One of them has to be of
  the paywall sheet, which App Review requires for a non-consumable.
- **Agreements, Tax and Banking is almost certainly not done.** Without it you
  cannot create a paid in-app purchase at all, so the unlock cannot exist. See
  Pricing and availability above. Along with the screenshots, this is what
  actually stands between here and a submission.
- **The in-app purchase has not been created in App Store Connect.** The code
  is written and testable against `ios/VenTrack.storekit`, but nothing has been
  registered under the real product ID yet, and the app binary and the product
  are reviewed together.
- **The purchase flow has never run against real StoreKit.** It has the local
  configuration to test against, which is not the same thing. Sandbox test on a
  device before submitting, including Restore on a fresh install.
- **It compiles but it has never been through a full manual pass on a device.**
  A green build proves the code is well formed, not that every screen behaves.
  Walk the What to Test list above before you submit.
- **The wordmark is set in a system font.** That is fine for review and fine
  for launch, but it is not a designed identity.
- **The free Render plan can still make a reviewer think the app is broken.**
  Cold starts take 30 to 60 seconds. The keep-alive ping prevents the common
  case, but it cannot wake an instance that has already stopped, and a deploy
  during review does exactly that. The review notes explain it. Paying for
  Starter removes the whole category and is the safer answer for a paid app.
