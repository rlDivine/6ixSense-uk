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

- **The seed list is what costs, and only for towns people actually open.**
  `localscan-seeds.js` now lists about 350 distinct URLs across 47 towns. Cost
  tracks distinct URLs, not entries: one page shared by three regions is still
  one fetch and one extraction per cache window. There is no crawler here that
  adds pages on its own.
- **A town costs nothing until somebody browses it.** localscan only runs for
  a region when that region's feed is being built, so seeding a town is not
  the same as paying for it. The exception is `WARM_REGIONS`, which refresh on
  a timer whether or not anyone asks.
- **Pages are cached for hours, not minutes.** A page is re-fetched and
  re-summarised at most twice a day, not on every request. See `PAGE_TTL_MS`
  in `localscan.js`.

Putting numbers on that, because 350 URLs is a different regime from the 22
this started with, and because the research cost and the running cost are
different things that are easy to conflate.

**Researching a town is one-time.** About $0.0033 a town, so a full sweep of
the country through `discover-seeds.js` is roughly **$1.50**, paid once. That
figure is measured: 427 research calls in the August 2026 sweep came to about
$1.40 on the OpenAI dashboard.

**The pages it finds are a subscription.** At roughly 2,000 input and 400
output tokens per page on gpt-4o-mini, one extraction costs about $0.00054.
A page is fetched at most once a day (`LOCALSCAN_PAGE_TTL_MS`, 24 hours) and
only sent to the model when its content has actually changed, so a typical page
costs about **$0.002 a month**, well under a penny, for as long as it stays in
the list and its town keeps being opened.

| Stage | Distinct URLs | Per month, if every seeded town is browsed daily |
| --- | --- | --- |
| Now | 351 | $0.80 |
| Now, warm regions only | 41 | $0.09 |
| Whole country at ~5 pages a town | 2,285 | $5 |
| Whole country at ~7 pages a town | 3,199 | $7 |

Those figures assume a page is actually re-read about four or five times a
month. Two things make that true rather than the sixty it would otherwise be:

- **An unchanged page is not re-read.** Every scan still fetches the page,
  which is free, and hashes exactly the text that would go to the model. If the
  hash matches the last one, the existing extraction is reused and no LLM call
  is made. Council listings and museum what's-on pages change weekly at best,
  so most fetches cost nothing at all.
- **`LOCALSCAN_PAGE_MAX_AGE_MS`, seven days, bounds that.** The extraction
  prompt is given today's date, so a page saying "this Saturday" is resolved to
  a real date when it is read. Reusing that indefinitely behind an unchanged
  page would let those dates drift into the past, so an extraction is redone
  once a week regardless.

Worst case, a page that genuinely changes every day, is 30 calls a month, which
is still half of what a 12 hour TTL cost.

### Per-seed scan intervals, considered and rejected

The obvious next idea is to tag each seed with how often it changes and scan
council and museum pages twice a week while scanning busier sites daily. It was
modelled over ninety simulated days and it does not pay, because the
unchanged-page check above already took that saving:

| Page changes | 24 hour TTL | Twice weekly | Saving |
| --- | --- | --- | --- |
| Never, or weekly | $0.15/mo | $0.15/mo | none |
| Monthly | $0.18/mo | $0.16/mo | about 2p |
| Daily | $1.03/mo | $0.29/mo | 72% |

A slow-changing page already costs almost nothing to fetch, because fetching is
free and it is never sent to the model. Its whole bill is the weekly forced
re-read, which `LOCALSCAN_PAGE_MAX_AGE_MS` governs and the TTL does not touch.
Scanning it less often reduces fetches, not spend.

Note the tiering that would pay is the opposite of the intuitive one: the
expensive pages are the ones that change *often*, since every change buys a
real extraction. If this is ever worth revisiting, the version to build is
adaptive rather than hand-labelled: measure how often each page actually
changes and back off the ones that churn without yielding new events. That
needs a few weeks of real running first, and `/api/diag` is where that data
shows up. Hand-labelling 350 seeds is work that goes stale and returns nothing
for the page types this source mostly watches.

The second row is the one that describes a quiet app, and it is the floor:
`WARM_REGIONS` refresh on a timer whether or not anybody asks, and nothing else
is billed until somebody opens that town. The lower rows are what success would
cost, which is a problem worth having and not a surprise worth discovering from
a bill.

The dials, in the order worth reaching for:

| Variable | Default | Effect |
| --- | --- | --- |
| `WARM_REGIONS` | four big cities | The only towns billed with no visitor. Set it to the towns you actually have users in, or leave it empty. |
| `LOCALSCAN_PAGE_TTL_MS` | 24 hours | How often a page is fetched at all. Doubling it roughly halves the fetches, though not the LLM cost, which the hash check already governs. |
| `LOCALSCAN_PAGE_MAX_AGE_MS` | 7 days | How long an unchanged page's extraction may be reused. Raising it saves a little more and lets a resolved relative date go staler. |
| `LOCALSCAN_MAX_SEEDS_PER_REGION` | 24 | Caps pages per town. |
| `OPENAI_API_KEY` | unset | Unset it and the source returns nothing at all. |

If you don't want this cost at all, simply leave `OPENAI_API_KEY` unset. The
source returns nothing and the rest of the app is unaffected, the same as any
other keyed source left blank.

### Growing this to every town

`localscan-discover.js` can sweep the whole country, not just towns that
already watch something. It is batched rather than run in one go, and the
reason is review rather than cost: 457 towns at 20 candidates each is a nine
thousand line pull request, and a proposal nobody reads is a direct commit with
extra steps.

**The easiest way to run it is the Actions tab**, via
`.github/workflows/localscan-discover.yml`. Nothing to install, and no personal
access token to create: Actions mints a scoped, expiring token for the run, and
the workflow asks for exactly the two rights the job needs. The OpenAI key
lives in repository secrets rather than on a laptop.

One-time setup: **Settings, Secrets and variables, Actions, New repository
secret**, named `OPENAI_API_KEY`. Then **Actions, localscan seed discovery, Run
workflow**.

Run it in this order. The first two steps are about proving the job works
before letting it loose, because the OpenAI Responses call in
`localscan-discover.js` was written against documentation and has never been
exercised against a live account.

| Step | scope | limit | dry run | open PR | Costs | What it proves |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | unseeded | 25 | **on** | off | nothing | The plan and the bill are what you expect |
| 2 | unseeded | **1** | off | **off** | ~$0.03 | The API call works and returns usable candidates |
| 3 | unseeded | 25 | off | **on** | ~$0.75 | One reviewable PR. Read it, then merge |
| 4+ | unseeded | 25 | off | on | ~$0.75 each | Repeat until the plan says nothing is left |

Step 2 is the one not to skip. It prints the candidates to the job log instead
of opening a PR, so three pence tells you whether the response parsing works
before you commit to seventeen more runs.

Locally instead, from a checkout:

```bash
cd api
# The plan and the cost. Spends nothing, and needs no key.
LOCALSCAN_DISCOVER_SCOPE=unseeded LOCALSCAN_DISCOVER_TARGET=20 \
  LOCALSCAN_DISCOVER_DRY_RUN=1 node discover-seeds.js

# One batch. Without GITHUB_TOKEN it prints findings instead of opening a PR.
LOCALSCAN_DISCOVER_SCOPE=unseeded LOCALSCAN_DISCOVER_TARGET=20 \
  OPENAI_API_KEY=... GITHUB_TOKEN=... node discover-seeds.js
```

Each run skips towns already at the target, so repeating the command walks
forward through the country on its own, one reviewable PR at a time. Covering
every remaining town costs on the order of a pound in total.
`LOCALSCAN_DISCOVER_LIMIT` changes the batch size and
`LOCALSCAN_DISCOVER_SCOPE=all` revisits seeded towns too.

To run batches **concurrently** rather than one after another, give each one a
different `LOCALSCAN_DISCOVER_OFFSET`. Without it every concurrent run reads
the seed file from the same commit, sees the same towns as unseeded, and
researches the same first 25. Offsets of 0, 25, 50 and so on partition the
country instead.

Expect roughly one town in five to produce anything. In the August 2026 sweep,
385 towns were searched and 82 returned candidates. Many small British towns
have no indexed page listing their events, and the job returns nothing rather
than inventing something.

This uses OpenAI's own `web_search` tool, so it is not subject to whatever
search limits a coding session has, and it can be run repeatedly from any
machine with the repo checked out.

**Merging is still a person's job.** Every proposal arrives unverified, and the
one failure mode to watch for is the wrong town: a great many British place
names are also American cities, and search engines favour the American one. The
PR body carries the model's stated reason for each page, which is what to read
it against.

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

### Automatic discovery, and why it is not scheduled

`api/discover-seeds.js` researches regions and proposes what it finds as a
**pull request** rather than writing to `localscan-seeds.js` directly. By
default it only looks at regions that already watch at least one page, so it
grows coverage you have started rather than going looking for towns on its own.
`LOCALSCAN_DISCOVER_SCOPE` widens that to the whole country: see
[Growing this to every town](#growing-this-to-every-town) above.

The PR step is the point, not ceremony. Nothing is watched or billed against
until a person reads the proposal and merges it, which is the actual answer
to "manually or automatically": an LLM drafts the line, a person still clicks
merge. An unsupervised web search feeding straight into an LLM pipeline
pointed at a real app will eventually surface a wrong-town result or
something worse, and every page added costs money on every scan from then on
whether or not it was worth adding.

**It is not on a schedule, deliberately.** It was originally a Render Cron
Job, and that block has been removed from `render.yaml`, because Render cron
services have no free tier: they need a paid plan and bill a minimum of
roughly a dollar a month per cron service even for a job that runs once and
exits. Leaving the block in meant the next Blueprint sync would try to create
a paid service, which is not something that should happen as a side effect of
syncing an unrelated change. `render.yaml` carries the exact block to restore
if you later decide the cost is worth it.

Run it by hand instead, from a machine with the repo checked out:

```
cd api
OPENAI_API_KEY=... GITHUB_TOKEN=... node discover-seeds.js
```

That does exactly what the scheduled job would have done, including opening
the pull request. `GITHUB_TOKEN` should be a fine grained personal access
token scoped to **only this repository**, with `Contents: Read and write` and
`Pull requests: Read and write` and nothing else. Create one at github.com,
Settings, Developer settings, Fine-grained tokens. Not a classic token: those
are account-wide and this job has no reason to touch anything else you own.

Leave `GITHUB_TOKEN` off entirely and the job still runs and still searches,
it just prints what it found instead of opening a PR. That is a sensible way
to see what it would propose before handing it write access to anything.

`GET /api/status` reports which keys the running instance can see, which is the
quickest way to check a deploy picked them up.

Optionally set `WARM_REGIONS` to change which towns stay pre-warmed. The
default is `london,manchester,birmingham,glasgow`.

## The landing page, and `APP_STORE_URL`

The service's root URL is a landing page, not the app. It used to be the full
web app, which meant anyone who found this hostname got the whole product free
next to a paid iOS app. The web app now lives in `api/webapp/` and is only
served when `SERVE_WEB_APP` is set, which it should not be in production.
`api/README.md` has the reasoning, including what this does not fix.

Set one more variable once the app is on sale:

```
APP_STORE_URL = https://apps.apple.com/gb/app/ventrack/id0000000000
```

Leave it unset until then. The page renders "Coming soon to the App Store" as
plain text rather than a dead button, so it is safe to have live before launch.

**Anyone who opened the old site is still holding a copy of the web app.** Its
service worker cached the app shell and serves from that cache without asking
the network, so deleting the files did not reach them. `api/public/sw.js` is
now a kill switch that unregisters the old worker and clears its caches on the
next visit. Do not delete that file: deleting it leaves the old worker
registered indefinitely.

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

## Keeping the free instance awake

A free instance stops after about 15 minutes with no inbound traffic, and the
next visitor waits 30 to 60 seconds for it to start. `api/keepalive.js` pings
the service's own public URL every 10 minutes so that window never elapses.

**There is nothing to configure.** Render injects `RENDER_EXTERNAL_URL`, the
ping uses it, and the whole thing is inert anywhere else, so it does nothing on
your laptop. `GET /healthz` returns a constant and never touches a source or
the cache, so a ping costs nothing but the request.

The one thing to understand is what it cannot do:

- **It prevents a sleep. It cannot end one.** While the instance is stopped
  this code is not running either, so nothing pings and nothing wakes. Every
  deploy restarts the process, and any restart followed by a quiet spell puts
  the service to sleep with no way back except a real visitor. Only something
  outside the service fixes that.
- **Free instance hours are capped at 750 a month across the workspace.**
  Staying up continuously spends about 744 of them in a 31 day month. That
  fits, but only just, and only for one service: add a second free service and
  both get suspended for the rest of the cycle when the pool runs out.

If you want the service woken as well as kept awake, point a free uptime
monitor at `https://pulse-uk-api.onrender.com/healthz` on a 5 or 10 minute
check. UptimeRobot and cron-job.org both do this on a free tier. That is an
external service so it keeps running while yours is stopped, which is exactly
the gap the internal ping cannot cover.

**A GitHub Actions cron is the wrong tool here, despite being the obvious
one.** This repository is private, so scheduled workflows bill against the
2,000 free Actions minutes a month, and every run is billed at a one minute
minimum however fast it is. A ping every 10 minutes is 4,320 runs a month, so
it costs money before it does anything useful. Every schedule slow enough to
stay inside the allowance is slower than the 15 minute sleep window, which
means it would not keep the service awake anyway. GitHub also disables
scheduled workflows on a repository with 60 days of no activity.

### Switching it off

Set `KEEPALIVE=off` in the Render environment. Do that when you move to the
Starter plan: a paid instance never sleeps, so the ping is just noise in the
log. `KEEPALIVE_INTERVAL_MS` changes the period and `KEEPALIVE_URL` overrides
the target, though neither should be needed.

### The honest version

This works, but paying for it is the supported answer, and for a paid app it is
the right one. Starter is about $7/mo, never sleeps, has no instance-hour cap,
and removes the cold start as a category of problem rather than papering over
it. The ping is worth having while the app is not yet earning; it is not worth
building a monitoring habit around once it is.

## Notes
- **Free plan** spins down after about 15 minutes idle, and the next request
  cold-starts in roughly 30 to 60 seconds. The keep-alive ping above hides most
  of that. For a shipped app, change `plan: free` to `plan: starter` (about
  $7/mo) in `render.yaml` for always-on.
- Requests are always served from cache and refreshed in the background, so a
  user request never waits on a live scrape. Cache TTL is 12 minutes.
- At most 24 regions are cached at once (LRU), with the warm regions exempt.
  A county town ages out and re-warms on the next request from that area.
