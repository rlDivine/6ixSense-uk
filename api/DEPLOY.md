# Deploying the VenTrack UK backend to Render

This runs the event API in the cloud so the iOS app, and every App Store user,
pulls from one shared server. Your Mac is no longer involved.

## What's in this folder for deploy
- **Dockerfile**: slim Node 20 image, runs `node server.js`. No headless
  browser, because every source is plain HTTP or JSON, so it fits comfortably
  in 512 MB.
- **.dockerignore**: keeps the image small

The blueprint itself, **render.yaml**, lives at the repository root, not in
here: Render's Blueprint flow only reads it from the root, and a copy inside
`api/` would never be found.

## One-time setup
1. Push this repo to GitHub, branch `main`.
2. Go to <https://dashboard.render.com> and choose **New**, then **Blueprint**.
3. Connect your GitHub and pick the repo and the `main` branch. Render reads
   `render.yaml` **from the repository root** and creates the **pulse-uk-api**
   web service. That name is the app's old one and is kept on purpose; see
   [The service name](#the-service-name-stays-pulse-uk-api) below.
   `dockerContext` in that file points down into `api/`, so the image only ever
   contains the backend, not the iOS app.
4. Render prompts for the keys below; paste them in, or leave them blank and
   set them later in **Environment**.
5. Click **Apply**. First build takes ~2 min.
6. When it's live, copy the URL (e.g. `https://pulse-uk-api.onrender.com`).

## Add the API keys
In the Render dashboard, open the service, then **Environment**, and add:

```
TM_API_KEY         = your key from developer.ticketmaster.com
SKIDDLE_API_KEY    = your key from skiddle.com/api
THESPORTSDB_KEY    = your key from thesportsdb.com/api.php
PREDICTHQ_API_KEY  = your access token from control.predicthq.com
```

All four are free and signup is instant for each (PredictHQ's token generates
immediately once you have an account). Without them the app still works,
falling back to Eventbrite UK and the built-in venue guide, but the feed is far
thinner. Skiddle is the one to set first: it is UK-only, so its coverage of
British gigs and nightlife runs deeper than a global service's.

### A fifth key, and it isn't free: OPENAI_API_KEY

```
OPENAI_API_KEY = your API key from platform.openai.com
```

This one is different from the four above in a way worth being deliberate
about. The other four are free tiers of ticketing and listings APIs: setting
one on costs nothing and only ever adds coverage. `OPENAI_API_KEY` powers
`api/sources/localscan.js`, which reads community pages (council sites,
venues, Facebook Pages) with an LLM to find events that never reach any
ticketing platform at all, the free eclipse watch at the local boating pool
being the example that motivated building it. Every page it reads costs a
small, real amount of money on the account this key belongs to.

Two things bound that cost, and both matter:

- **No seed pages, no cost.** `api/sources/localscan-seeds.js` ships with an
  empty list. Setting this key alone does not turn anything on: a region only
  gets scanned once a page is actually added to that file for its region id.
  There is no crawler here that goes looking for pages on its own.
- **Pages are cached for hours, not minutes.** Once a page is added, it is
  actually re-fetched and re-summarised a handful of times a day, not on
  every request. See `PAGE_TTL_MS` in `localscan.js`.

If you don't want this cost at all, simply leave `OPENAI_API_KEY` unset. The
source returns nothing and the rest of the app is unaffected, the same as any
other keyed source left blank.

### Adding a page to watch

Open `api/sources/localscan-seeds.js` and add one line per page:

```js
{ regionId: "ramsgate", url: "https://example.org/whats-on", kind: "web", label: "Ramsgate Boating Pool" },
```

`regionId` has to exactly match an `id` in `sources/regions.js`'s `CITIES`
list (Ramsgate is already a region; check the file for the id of any other
town). A typo is logged and that one entry is skipped at startup, which is
worth checking the log for after adding one, rather than something that fails
loudly. Commit the file and redeploy, or push to `main` if `autoDeploy` is on.

### Why there's no automatic discovery yet

The obvious next step is a job that finds new pages to watch on its own
rather than waiting for someone to add them by hand, and it deserves an honest
answer rather than a half-built version of it.

Discovering pages by watching what real users actually visit would need this
app to collect usage data it does not collect today, and the current privacy
answers (see `ios/APPSTORE.md`) say plainly that it collects none beyond
location for distance sorting. Adding that tracking is a real decision with
real privacy policy consequences, not something to slip in as a side effect
of a scanner feature.

Discovering pages by searching the web on a schedule is more honest to build,
but it is also a new, separate integration: every search API worth using
(Google's Custom Search JSON API, Bing's) needs its own key, and a job that
finds candidate pages should propose them for a person to check before they
start being scanned and billed against, not add them automatically. Spam,
wrong-town results and adult content are all real outcomes of an unsupervised
web search feeding straight into an LLM extraction pipeline pointed at a real
app. That is worth building properly, as its own piece of work, once the
manual seed list above has proven the extraction side is worth trusting.

`GET /api/status` reports which keys the running instance can see, which is the
quickest way to check a deploy picked them up.

Optionally set `WARM_REGIONS` to change which towns stay pre-warmed. The
default is `london,manchester,birmingham,glasgow`.

## The service name stays `pulse-uk-api`

The product was renamed from Pulse to VenTrack. The Render service was not, and
that is deliberate rather than an oversight.

On Render, `name:` in `render.yaml` is the service's identity and the source of
its public hostname. This service is live at `https://pulse-uk-api.onrender.com`
with the four API keys set on it, and the iOS app's `productionURL` is pinned to
that exact host. Editing the string does not relabel the running service: the
blueprint would create a *second* service on a *different* URL, and every
shipped client would keep calling a host that is no longer being deployed to.

So the old name is correct wherever it appears in these instructions, and every
`pulse-uk-api.onrender.com` URL here is a real address rather than a leftover.

Renaming it for real is a migration rather than a tidy-up, and it takes all
four of these steps:

1. Create a new Render service under the new name, from the same blueprint.
2. Copy the four API keys (`TM_API_KEY`, `SKIDDLE_API_KEY`, `THESPORTSDB_KEY`,
   `PREDICTHQ_API_KEY`) across to it and confirm with `GET /api/status`.
3. Update `productionURL` in `ios/VenTrack/Services/EventService.swift` to the
   new host and ship that build.
4. Accept the new URL, and keep the old service running until enough users have
   taken the new build, since older installs will keep calling the old host.

Until someone does all four on purpose, leave `name: pulse-uk-api` alone.

## Point the app at it
In `ios/VenTrack/Services/EventService.swift`, set:

```swift
private static let productionURL = "https://pulse-uk-api.onrender.com"
```

Rebuild (Cmd-R). That is it: works on cellular, anywhere, Mac closed.

## Checking it's healthy

```bash
curl https://pulse-uk-api.onrender.com/healthz          # {"ok":true}, never scrapes
curl "https://pulse-uk-api.onrender.com/api/status"     # cache state per region
curl "https://pulse-uk-api.onrender.com/api/diag?lat=53.48&lng=-2.24"   # per-source timings for Manchester
```

`/api/diag` is the one to reach for when the feed looks thin: it runs every
source independently, bypassing the cache, and reports the count, timing and
error for each.

## Notes
- **Free plan** spins down after about 15 minutes idle, and the next request
  cold-starts in roughly 30 to 60 seconds. For a shipped app, change
  `plan: free` to `plan: starter` (about $7/mo) in `render.yaml` for always-on.
- Requests are always served from cache and refreshed in the background, so a
  user request never waits on a live scrape. Cache TTL is 12 minutes.
- At most 24 regions are cached at once (LRU), with the warm regions exempt.
  A county town ages out and re-warms on the next request from that area.
