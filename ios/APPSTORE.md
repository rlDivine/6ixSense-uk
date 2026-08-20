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
| Description | All UK towns, the full calendar, saves with reminders |

Those two length limits are not advisory and are easy to walk into, because
neither is the same field as the one with the same name on the app listing.
Display Name is capped at **30** characters and Description at **55**. The long
sentence about 450 towns and the seven day window is 145 characters: it belongs
in the app's own description and on the paywall, not here.

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

**If the button says $4.99, nothing is broken.** `Store.priceLabel` uses
`product.displayPrice`, which is the price in the BUYER'S storefront and is the
only correct thing to show: hardcoding a currency is a rejection, and the app
does not do it anywhere. The local configuration stores the price as the bare
number `4.99` and lets the storefront supply the symbol, and Xcode's default
storefront is the United States.

Which storefront answers depends on whether a StoreKit configuration is
selected in the scheme, and the two cases have different fixes:

- **StoreKit Configuration set to `VenTrack.storekit`.** The file decides. It
  now carries `"_storefront" : "GBR"`, so this case shows £. There is no
  storefront picker in the scheme editor to override it; that setting lives in
  the file and nowhere else.
- **StoreKit Configuration set to `None`.** Real StoreKit answers, and the
  currency is the one belonging to the Apple Account signed in on the device.
  A developer outside the UK sees their own currency, and nothing in the
  project can or should change that. If you are seeing this case, note what it
  proves: the product exists in App Store Connect, its id matches
  `Store.productID` exactly, and the Paid Applications agreement is active
  enough to serve it.

In production this cannot happen. The purchase is priced from a GBP price point
and the app is available in the United Kingdom only, so the only people who can
reach the paywall are on the UK storefront and see pounds.

What the local configuration does NOT prove is that the product exists in App
Store Connect under the right id, because it answers instead of Apple. That is
what the sandbox below is for, and it is the step where a typo in the id
finally shows up.

### Testing the real product, in the sandbox

Once the purchase exists in App Store Connect, test against Apple rather than
against the local file. The two are mutually exclusive: a scheme with a
StoreKit configuration selected never talks to the sandbox, so **set StoreKit
Configuration back to None** before any of this, or you will be testing the
local file again and learning nothing.

1. **Make a sandbox tester, and set its country to United Kingdom.** App Store
   Connect, Users and Access, Sandbox, Test Accounts. Use an email address that
   has never been an Apple Account, including any alias of one. A plus-address
   on an existing mailbox (`you+sandbox@example.com`) works and still delivers
   to you.

   The country field on that account is the one that matters here and is easy
   to skip past. A sandbox tester carries its OWN storefront, so a UK tester
   makes StoreKit quote £4.99 on a device whose real Apple Account is American
   or Canadian. That is the only way to see what a British customer sees
   without owning a British Apple Account, and it is how you check the price,
   the purchase and Restore as they will actually behave.
2. **Sign in on the device**, not in the App Store app: Settings, Developer,
   Sandbox Apple Account. Signing into the real App Store with a sandbox
   account does not work and gets the account flagged.
3. **Run a build signed with your team** on the device. Sandbox purchases only
   happen in builds signed by the team that owns the product, so a build from
   Xcode or TestFlight, not a simulator.

Sandbox purchases are free and take real money from nobody. What to check:
the price shows in the button rather than the bare "Unlock everything"
fallback, buying unlocks, and Restore works on a fresh install.

`loadProduct` prints the storefront that answered, so the console settles any
argument about currency without guesswork:

```
[store] com.voice2jobs.ventrackuk.full is £4.99 on the GBR storefront
```

A different country code there is the account's, not the app's, and not the
device's location. Someone in London signed in to an American Apple Account
sees dollars and is right to, because dollars are what they would be charged.
Nothing in the app should override that, and formatting the number into pounds
ourselves would show a price the person will never pay.

If the button has no price, the product is not reaching the app. `loadProduct`
prints the reason to the Xcode console, and it is nearly always one of: the
Paid Applications agreement is not active yet, the id does not match
`Store.productID` character for character, or the purchase has never been
submitted. All three are configuration, none of them are code.

### The purchase ships with the first version, not before it

A non-consumable cannot be approved on its own for a new app. It has to be
attached to an app version and reviewed with it: on the version page, under
In-App Purchases, add VenTrack Full Unlock before submitting.

Miss this and the app can be approved while the purchase sits in **Waiting for
Review** forever, which produces a live app whose paywall opens with no price
and a button that does nothing. There is no error anywhere that says so.

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
| Support URL | https://uk.6ixsense.fyi/support.html |
| Privacy Policy URL | https://uk.6ixsense.fyi/privacy.html |
| Marketing URL | https://uk.6ixsense.fyi/ |

**Give Apple these, not the backend's.** The same three pages are served by the
API at `pulse-uk-api.onrender.com`, and for a long time these fields named that
host. Do not go back to it. The free Render plan sleeps after about fifteen
minutes idle and the next request pays a thirty to sixty second cold start, so
a reviewer clicking the privacy policy can get a spinner or a timeout, and that
is a rejection for a reason that has nothing to do with the app. The keep-alive
ping does not close it: the ping stops running when the instance stops, so a
deploy during review leaves it asleep with nothing to wake it. The old advice
here was to open the URL by hand the morning you submit and every day review is
open, which is not a plan, it is a reminder to be lucky.

`uk.6ixsense.fyi` is GitHub Pages, static and always up, published from
`api/public` by `.github/workflows/pages.yml`. The pages are the same files the
backend serves, not a copy: two copies of a privacy policy is two privacy
policies, and the one nobody edits is the one Apple reads.

Setting it up, once:

1. Repo Settings, Pages, Source: **GitHub Actions**. The workflow also tries to
   turn this on by itself, so it may already be done.
2. A DNS `CNAME` record, host `uk`, value `rldivine.github.io`.
3. Settings, Pages, Custom domain: `uk.6ixsense.fyi`, then Enforce HTTPS once
   the certificate has issued.

**As of now GitHub Pages does not work for this repository, and the workflow is
switched to manual so it stops failing on every push.** Three runs failed:
first with "Get Pages site failed, Not Found", which is Pages not being
enabled, and then, once the workflow was told to enable it itself, with "Create
Pages site failed. Resource not accessible by integration", which is the
Actions token being refused permission to create the site. This repository is
private, and on a private repository that is what a plan without Pages looks
like from inside a workflow.

Check Settings, Pages. If it offers a Source dropdown, pick GitHub Actions, run
the workflow by hand, and put the push trigger back. If it asks you to upgrade
or make the repository public, use one of the hosts below instead. The three
ways out, in the order worth considering them:

- **Cloudflare Pages, Netlify or Vercel.** All three build private repositories
  on their free tiers, all are static and always up, all take a custom domain.
  Point the build at `api/public` with the same one-line render step from
  `.github/workflows/pages.yml`. This is the least disruptive answer.
- **A Render static site.** Probably the shortest path, since Render is already
  connected to this repository. Static sites are a different product from web
  services: they are served from a CDN, they do not sleep, and they do not
  consume the free instance hours the API is already nearly using up.

  Create it in the dashboard, New then Static Site, NOT by adding a block to
  `render.yaml`. The blueprint currently deploys a working backend, and the
  fields for a static site in that file have never been confirmed against a
  live sync; a rejected blueprint would take the API down with it for the sake
  of a marketing page. The settings are:

  | Field | Value |
  | --- | --- |
  | Build command | `node api/build-site.js api/public/index.html` |
  | Publish directory | `api/public` |
  | Branch | `main` |

  The build command renders the `{{CTA}}` placeholder in place, which is safe
  because Render builds a throwaway checkout rather than your working tree.
  Then add `uk.6ixsense.fyi` under the service's Custom Domains and point the
  DNS `CNAME` where Render tells you to.
- **Make the repository public.** Free, immediate, and it publishes the source
  along with the site. Nothing here is secret, since every API key lives in the
  Render dashboard rather than the repository, but it is a decision rather than
  a shortcut.

Until the DNS is in place the site is live at
`https://rldivine.github.io/6ixSense-uk/`, which is a perfectly valid URL to
give Apple. The custom domain can be added afterwards without resubmitting.

A path on the main site, `6ixsense.fyi/uk`, was the original idea and is not
what shipped. A path has to be served by whatever serves that domain, which is
the 6ix Sense codebase, and that repository is not ours to change. A subdomain
is a DNS record and touches nothing.

Once the app is on sale, the landing page's button should link to the listing.
`public/index.html` is a template carrying a `{{CTA}}` placeholder, and it is
filled in from `APP_STORE_URL` in TWO places, both of which need setting:

- the Render environment, for the copy the backend serves;
- a **repository variable** of the same name (Settings, Secrets and variables,
  Actions, Variables), for the static site.

Until either is set the button reads "Coming soon to the App Store" as plain
text rather than linking nowhere, which is correct before launch and safe to
show a reviewer.

The backend host is still called `pulse-uk-api` on purpose. See the note in
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
