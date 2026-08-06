# Deploying the Pulse UK backend to Render

This runs the event API in the cloud so the iOS app, and every App Store user,
pulls from one shared server. Your Mac is no longer involved.

## What's in this folder for deploy
- **Dockerfile**: slim Node 20 image, runs `node server.js`. No headless
  browser, because every source is plain HTTP or JSON, so it fits comfortably
  in 512 MB.
- **render.yaml**: Render blueprint (free plan, Frankfurt, health check at `/healthz`)
- **.dockerignore**: keeps the image small

## One-time setup
1. Push this repo to GitHub.
2. Go to <https://dashboard.render.com> and choose **New**, then **Blueprint**.
3. Connect your GitHub and pick the repo. Render reads `api/render.yaml` and
   creates the **pulse-uk-api** web service.
   *(Set the blueprint's root directory to `api/`. This repo also holds the
   iOS app, which Render should not try to build.)*
4. Click **Apply**. First build takes ~2 min.
5. When it's live, copy the URL (e.g. `https://pulse-uk-api.onrender.com`).

## Add the API keys
In the Render dashboard, open the service, then **Environment**, and add:

```
TM_API_KEY       = your key from developer.ticketmaster.com
SKIDDLE_API_KEY  = your key from skiddle.com/api
THESPORTSDB_KEY  = your key from thesportsdb.com/api.php
```

All three are free and signup is instant for each. Without them the app still
works, falling back to Eventbrite UK and the built-in venue guide, but the feed
is far thinner. Skiddle is the one to set first: it is UK-only, so its coverage
of British gigs and nightlife runs deeper than a global service's.

`GET /api/status` reports which keys the running instance can see, which is the
quickest way to check a deploy picked them up.

Optionally set `WARM_REGIONS` to change which towns stay pre-warmed. The
default is `london,manchester,birmingham,glasgow`.

## Point the app at it
In `ios/Pulse/Services/EventService.swift`, set:

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
