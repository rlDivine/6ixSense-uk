# VenTrack: App Store submission pack

Everything App Store Connect asks for, written out so it can be pasted in
field by field. Contact details and the support address are the same ones
6ix Sense uses.

No em dashes anywhere in this file, including the copy below.

## Before any of this matters

The app has to build and run first. It has never been compiled in the
environment these files were written in, so treat a clean build on your Mac as
step zero, not a formality.

You also need an active Apple Developer Program membership, which is a paid
yearly account. A free personal Apple ID signs a build onto your own phone for
seven days but cannot submit anything.

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

Name is 8 characters and the subtitle is 29, both inside Apple's 30 character
limits.

## URLs

| Field | Value |
| --- | --- |
| Support URL | https://pulse-uk-api.onrender.com/support.html |
| Privacy Policy URL | https://pulse-uk-api.onrender.com/privacy.html |
| Marketing URL | leave blank, or https://voice2jobs.com |

Both of those pages are served by the backend, already carry the VenTrack name,
and point at contact@voice2jobs.com. Apple does check that the privacy policy
URL loads, so confirm the Render service is awake before you submit: on the
free plan it sleeps after about 15 minutes idle and the first request takes
30 to 60 seconds. If a reviewer hits it cold and it times out, that is a
rejection for a reason that has nothing to do with the app. Consider moving to
the paid Starter plan before submitting.

The host is still called `pulse-uk-api` on purpose. See the note in
`render.yaml`.

## Promotional text

Up to 170 characters. This one is 147 and can be changed later without a new
build, which the description cannot.

```
Find what is on near you across the UK tonight, this weekend or any date you pick. Ranked by how close and how soon, with no account and no sign up.
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
Check the feed loads and is sorted by distance. Switch the sort to Soonest. Change the city from Settings and confirm the feed follows it and survives a relaunch. Try a date search such as "this weekend" or "july 25 to 27". Open the map, collapse the tray, reopen it. Save an event, set the reminder, add one to your calendar. Try it in both light and dark appearance.
```

## App Privacy answers

The answers below are what the code actually does. They were checked rather
than assumed: the app imports only Apple frameworks (CoreLocation, MapKit,
SwiftUI, UIKit, UserNotifications, Foundation, QuartzCore), has zero third
party packages, contains no analytics or advertising SDK, and makes no network
request to any host other than its own API.

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

The target is `TARGETED_DEVICE_FAMILY = "1,2"`, meaning iPhone and iPad, so
Apple requires **both** sets. If you would rather ship iPhone only for version
one, change that to `"1"` in `project.rb` and the iPad requirement disappears.

Required sizes:

| Device | Size | How many |
| --- | --- | --- |
| iPhone 6.9 inch | 1320 x 2868 or 1290 x 2796 | 3 to 10 |
| iPad 13 inch | 2064 x 2752 or 2048 x 2732 | 3 to 10, only if you keep iPad support |

Apple scales the 6.9 inch set down for smaller iPhones, so one iPhone set is
enough.

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
```

Please wake the service yourself before submitting, and again if review takes a
few days.

## Things that are not ready

Being straight about what is unfinished, since these are the likely rejection
points rather than anything on the list above:

- **The app has never been compiled.** Nothing below matters until it builds.
- **No screenshots exist yet.** They need a device.
- **The wordmark is set in a system font.** That is fine for review and fine
  for launch, but it is not a designed identity.
- **iPad support is real but has had less testing than iPhone.** If the iPad
  layout is rough, dropping to iPhone only is a one line change and removes a
  whole screenshot set.
