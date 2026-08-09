# Finding the events nobody lists

A plan for VenTrack, written around one real example.

> The Boating Pool in Ramsgate is handing out free solar eclipse glasses. They
> announced it in a public post. It is not on Ticketmaster, not on Skiddle, not
> on Eventbrite, and it never will be. It is free, it is run by people who do
> not think of themselves as promoters, and it is exactly the sort of thing
> somebody in Ramsgate would want to know about.

Every source VenTrack has today is a **listings feed**: somebody deliberately
published a structured record of an event so it could be sold or indexed. The
Ramsgate case is the opposite. Nobody published a record. Somebody wrote a
sentence.

That gap is the most valuable thing left to build here, and it is also the one
with the most ways to go wrong. This plan is as much about what not to do.

---

## 1. Where these posts actually live, and what that costs

The honest answer is uncomfortable: **the Boating Pool almost certainly posted
on Facebook**, and Facebook is the single hardest source to reach legitimately.

- Meta removed public event *search* from the Graph API in 2018. There is no
  supported way to ask "what events are near this coordinate".
- A Page's own events are readable only with a Page access token, which the
  Page's admin must grant. That is a real route, but it is opt-in per venue,
  not discovery.
- Scraping Facebook breaches their terms, is aggressively blocked, and the
  scraper libraries that claim otherwise are in a permanent state of being
  broken. Building a product dependency on one is building on sand, and it puts
  the developer account at risk.

**So: no Facebook scraper.** Not as a matter of squeamishness, but because it
cannot be relied on and the failure mode lands on the App Store listing.

The good news is that the Ramsgate class of event is *not* only on Facebook. It
leaks into places that are open, stable and fine to read:

| Where | Why it works |
|---|---|
| District and parish council pages | UK councils publish what's-on, park events and news as a duty. Ramsgate sits under Thanet District Council plus a town council. |
| Local press | KentOnline, Isle of Thanet News and their equivalents run what's-on columns, most with RSS. |
| Library, museum, leisure centre programmes | Council-run venues publish termly programmes as plain pages. |
| Venue's own site | Many venues mirror their Facebook posts to a news page without realising. |
| Reddit, Bluesky, Mastodon | Real APIs, permitted use. Thin for UK local, but free. |
| **The user who saw it** | The strongest signal in the whole system. See Tier 2. |

---

## 2. The architectural change this forces

Everything VenTrack does today is stateless: a request comes in, sources are
fetched live, the result sits in an in-memory cache for twelve minutes, and
nothing survives a restart. That model cannot host an AI pipeline. Language
model calls are too slow to sit in a request, too expensive to repeat per
region, and non-deterministic in a way a user-facing fetch must not be.

Discovery has to become **an offline pipeline that writes to a store**, with
the request path only ever *reading*:

```
scheduled worker ──> crawl ──> extract (LLM) ──> geocode ──> dedupe ──> store
                                                                          │
GET /api/events ──> existing live sources ─────────────────────────┐      │
                                                                    ├──> merge
                                              "discovered" source ──┘  (reads store)
```

The new source behaves like `curated` and `carboots`: a cheap local read that
returns already-shaped events. Nothing in the request path gets slower, and the
LLM never sees a user's request.

Concretely this needs three things the project does not have:

1. **A database.** Postgres. Your Supabase account exists but every project is
   Voice2Jobs and sits in `us-east-2` / `us-west-2`. For a UK-only app handling
   UK users, put this one in the EU — Render Postgres in Frankfurt sits beside
   the existing service, or a fresh Supabase project in an EU region.
2. **A worker.** Render cron or a background worker. The free plan cannot run
   one, so this is the point where the backend moves to a paid tier — which
   `render.yaml` already flags as needed anyway, to stop the 45-second cold
   start users currently hit.
3. **A source registry.** Which URLs to read for which town. This is the part
   that decides whether coverage is real or theatre.

---

## 3. Three tiers, in the order I would build them

### Tier 2 first: user submissions

Counter-intuitively, start here. **The person who saw the post is a better
sensor than any crawler**, and this tier is the only one that solves the
Ramsgate case on day one.

The flow: somebody in Ramsgate sees the Boating Pool post, hits share, picks
VenTrack. An iOS **share extension** receives the text or a screenshot. The
model extracts a structured event, the user confirms or corrects it in one
screen, and it goes in.

Why this is the strongest tier:

- It is unambiguously legitimate. The user is forwarding something they can
  already see, of their own volition. No terms are being circumvented.
- It hits exactly the events that are otherwise invisible, because a human has
  already done the hard part: judging that it matters.
- It is cheap. One model call per submission, not per page per day.
- The share extension makes it a two-tap action from inside Facebook itself,
  which is where the user already is.

The cost is moderation, which is real and must not be hand-waved. See §5.

### Tier 1: the legitimate local crawl

A registry of a handful of URLs per town — council, local paper, library,
leisure centre, two or three big venues. A worker fetches each on a schedule,
and **only pages whose content hash changed** are sent to the model. That one
detail is the difference between a few pounds a day and a few hundred.

Discovery of the URLs themselves is a one-off per town: search, propose,
confirm by hand. 454 towns is too many to start with. Pilot with Thanet.

### Tier 3: open platform APIs

Reddit, Bluesky, Mastodon. Genuinely permitted, genuinely thin for UK local
listings, but free and worth having once the pipeline exists.

Plus the one clean route into Facebook: **let a venue connect its own Page.**
A boating pool that wants to be listed can authorise VenTrack to read its Page
events. That is opt-in, supported, and turns a scraping problem into a
partnership.

---

## 4. Making the extraction trustworthy

This is where projects like this usually fail. A model asked to "find events on
this page" will happily return an event that does not exist, on a date it
invented, at a venue it guessed. In an app whose entire promise is *what's on
near you, sorted by how close and how soon*, a hallucinated Saturday afternoon
is worse than an empty feed — somebody drives to it.

The rules I would hold this to, and they are the same rules the car boot table
already follows:

- **Structured output, same shape as `makeEvent`.** Nothing bespoke.
- **Every extracted field carries a verbatim quote** from the source text that
  justifies it. No quote, no field.
- **Null beats a guess.** An event with no date it can quote is dropped, not
  defaulted to 19:00.
- **A second, cheap verification pass** that sees only the quote and the
  extracted value, and answers one question: does this quote actually say this?
  It catches the confident-but-wrong cases the extractor cannot see in itself.
- **No coordinate, no event.** Distance is the app's premise. Postcodes go
  through postcodes.io (free, UK-only, ONS data); known venue names go through
  a per-town gazetteer. Anything unplaceable is dropped rather than pinned to
  the town centre. This is the same call `carboots.js` makes, for the same
  reason.
- **Never outranks a ticketed listing** on a tie.

---

## 5. Saying "we are not sure" out loud

A discovered event is not the same kind of fact as a Ticketmaster listing, and
the app must not pretend otherwise.

- A distinct source label — "Spotted locally" — not folded in with the feeds.
- On the card and the detail screen, a plain line: *unconfirmed, check before
  you travel*, with a link to where it came from.
- **No reminder without a warning.** Waking someone at 8am for an event that
  may not exist is the worst thing this feature could do.
- A one-tap "this isn't right" that pulls it immediately.
- Promotion on corroboration: two independent submissions, or a crawl hit that
  matches a submission, moves an event from unverified to confirmed.

Moderation is the honest cost of Tier 2. At small volume a queue you clear
yourself is fine. It stops being fine quickly, so the promotion rules above
need to exist before the feature is public, not after.

---

## 6. Cost, roughly

Tier 1, at full 454-town scale: ~6 sources per town, once a day, is ~2,700
fetches. With content hashing only ~10% reach the model — 270 extractions a
day, ~4k tokens each, so low single-digit millions of tokens a month. On a
small model that is pounds, not hundreds of pounds.

Tier 2 is one call per submission. Negligible until it is popular, and if it
becomes popular you have a different and better problem.

The real new cost is infrastructure: Render starter plus a Postgres instance.
Call it £15–20/month, and it also fixes the cold start.

---

## 7. The other half of the ask: AI search

You asked for "an AI search function **or** an AI that scans". They are
different features and the search one is far easier — I would ship it first,
because it needs none of the above.

A region's feed is a few hundred events. That is small enough to hand to a
model whole. "Free things to do with the kids this weekend", "somewhere to hear
live jazz", "what's on near the seafront" — the query gets matched against
titles, categories, venues and dates, and returns a ranked subset with a
one-line reason. No new infrastructure, no crawling, no moderation. Days, not
weeks.

It also makes the discovery work more valuable when it lands, because natural
language is how people ask about exactly the informal events Tier 2 surfaces.

---

## 8. Phasing

| Phase | What | Time | New infra |
|---|---|---|---|
| **0** | AI search over the existing feed | days | none |
| **1** | Share extension + user submissions + extraction + moderation queue | 1–2 weeks | one model key |
| **2** | Postgres, worker, Tier 1 crawl piloted on Thanet | 2–4 weeks | DB + paid Render |
| **3** | Scale towns, open APIs, corroboration-based promotion, venue Page opt-in | ongoing | — |

Phase 1 is the one that answers the Boating Pool. Everything after it is about
not needing a human to have noticed first.

---

## 9. Things I would not do

- **Scrape Facebook.** Covered above. Fragile, against terms, and the risk
  lands on your developer account.
- **Publish unverified events without a badge.** The whole value of the app is
  that its answers are actionable.
- **Guess a coordinate** to avoid dropping an event.
- **Run the model in the request path.** It would make every user pay for the
  slowest, least predictable part of the system.
- **Start at 454 towns.** Pilot Thanet, see whether the extraction is any good
  against a place you can check by eye, then scale.

---

## 10. What I need from you

1. **Budget.** Phase 2 needs Render starter plus Postgres, roughly £15–20/month
   on top of a model key. Fine or not?
2. **Moderation.** Are you willing to clear a submission queue daily at first?
   If not, Tier 2 has to launch invite-only or with corroboration required.
3. **Data residency.** Every existing Supabase project is US-region. For UK
   users I would put this one in the EU. Render Postgres in Frankfurt is the
   path of least resistance since the API is already there.
4. **Scope of Phase 0.** Do you want AI search first, given it ships in days
   and needs nothing new? My recommendation is yes.
