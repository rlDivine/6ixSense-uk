// Community pages this source watches, per region.
//
// This is the list that makes the difference between a region showing only
// what ticketing platforms chose to list, and one that also surfaces the free
// solar eclipse watch at the boating pool that nobody put on Ticketmaster.
// Nothing here is guessed. Every entry should be a page you (or a proper
// research pass) have actually looked at and confirmed carries real event
// listings for that town, because localscan.js sends whatever this list
// contains straight to an LLM and pays for every page it fetches.
//
// Format, one object per watched page:
//   regionId  must exactly match an `id` in regions.js CITIES. No fuzzy
//             matching: a typo here is logged and the entry is skipped
//             entirely rather than silently watching nothing, so check the
//             startup log after adding one.
//   url       the page to fetch. Council "what's on" pages, a specific
//             venue's own site, a local paper's listings page, a public
//             Facebook Page or Event permalink.
//   kind      "web" or "facebook". Facebook pages are attempted, but Facebook
//             serves almost no usable HTML to a request that is not a signed
//             in browser, so most facebook entries will quietly contribute
//             nothing most of the time. See the long comment above
//             fetchPage() in localscan.js for why, and for the one case
//             (an individual event's og:* preview tags) where it does work.
//   label     a short human note, not read by any code. Purely so this file
//             stays legible as it grows past a handful of entries.
//
// Growing this list is exactly what the brief for this source is: town by
// town, page by page. Two ways that happens:
//
//   By hand: add a line yourself, following the format above.
//
//   By the research job (sources/localscan-discover.js, run by hand via
//   `node discover-seeds.js`; it is not scheduled, because Render cron has
//   no free tier). It never edits this file directly on main: it proposes
//   candidates in a pull request, which is what "manually or automatically"
//   actually means here. Adding a line still goes through a human clicking
//   merge, it is just that an LLM drafted the line instead of a person. See
//   "Automatic discovery" in DEPLOY.md for the full mechanism.
// STATUS OF THE ENTRIES BELOW, because it matters before anything is billed
// against them. Every url here came back from a real web search, so every
// host is indexed and exists. Several returned dated listings in the search
// results themselves, which is as close to confirmation as was available:
// Ramsgate Day, the Festival of Sound, the Winter Festival, outdoor theatre
// in Ellington Park, the Santus Circus at Lord of the Manor.
//
// What was NOT possible was opening any of them and reading it. The
// environment these were added from cannot reach these hosts at all. So
// treat the list as well sourced rather than verified, and let the first few
// scans sort it out: a page that turns out to be wrong contributes nothing
// and shows up as such, and a page that turns out to be right shows up as
// events with source "Local pages". The list below is grouped by how likely
// each entry is to pay off, so the tail is the first thing to prune.
//
// Rough cost, so it is a decision rather than a surprise. 22 distinct urls,
// each re-read at most twice a day (PAGE_TTL_MS is 12 hours), each sending
// at most MAX_PAGE_CHARS of text to a small model. That is well under a
// dollar a month at gpt-4o-mini prices. It scales with distinct urls, not
// with entries and not with traffic: three regions sharing one page is still
// one read.
//
// One thing was searched for and deliberately NOT added: theboatingpool.com.
// A summary of search results named it as the Boating Pool's website, but a
// search restricted to that domain returned nothing at all, so it appears to
// have been inferred from their hello@theboatingpool.com contact address
// rather than actually indexed. Adding an unresolvable host would cost a
// fetch attempt on every scan window forever and never return anything. If
// that domain does turn out to be real, it is a better entry than the
// Facebook Page below and should replace it.
export const SEEDS = [
  // ---- Thanet wide, shared across the three Thanet regions ----------------
  //
  // Visit Thanet is the district tourism board, and its find-events page
  // covers Ramsgate, Margate and Broadstairs together. Deliberately listed
  // for all three: the per-url cache means this is still one fetch and one
  // LLM call per TTL no matter how many regions share it, and each region
  // gets its own events built from that one extraction.
  { regionId: "ramsgate", url: "https://www.visitthanet.co.uk/whats-on/find-events/", kind: "web", label: "Visit Thanet, what's on" },
  { regionId: "margate", url: "https://www.visitthanet.co.uk/whats-on/find-events/", kind: "web", label: "Visit Thanet, what's on" },
  { regionId: "broadstairs", url: "https://www.visitthanet.co.uk/whats-on/find-events/", kind: "web", label: "Visit Thanet, what's on" },

  // Pub and bar entertainment across the district: quiz nights, open mics,
  // the recurring small stuff no ticketing platform lists.
  { regionId: "ramsgate", url: "https://www.visitthanet.co.uk/whats-on/entertainment/pub-entertainment/", kind: "web", label: "Visit Thanet, pub entertainment" },
  { regionId: "margate", url: "https://www.visitthanet.co.uk/whats-on/entertainment/pub-entertainment/", kind: "web", label: "Visit Thanet, pub entertainment" },

  // The local paper. Runs a recurring "things to see and do in Thanet" piece
  // that is exactly the small, free, community listing the ticketing sources
  // never carry, which is the whole reason this source exists.
  { regionId: "ramsgate", url: "https://theisleofthanetnews.com/", kind: "web", label: "Isle of Thanet News" },
  { regionId: "margate", url: "https://theisleofthanetnews.com/", kind: "web", label: "Isle of Thanet News" },

  // ---- Ramsgate: highest confidence ---------------------------------------
  //
  // These are the ones search returned with real, dated listings attached,
  // so they are the most likely to pay for themselves on the first scan.

  // Ramsgate's own events calendar, as opposed to the district-wide Visit
  // Thanet one above. The stable calendar hub, not the month pages it links
  // to (whats-on-in-ramsgate-august-2026 and so on), which would go stale
  // every month and need editing here forever. Search returned real listings
  // from it: outdoor theatre in Ellington Park, the Santus Circus at Lord of
  // the Manor, the Festival of Sound.
  { regionId: "ramsgate", url: "https://www.visitramsgate.co.uk/ramsgate-events-calendar/", kind: "web", label: "Visit Ramsgate, events calendar" },
  { regionId: "ramsgate", url: "https://www.visitramsgate.co.uk/news-events/", kind: "web", label: "Visit Ramsgate, news and events" },
  { regionId: "ramsgate", url: "https://www.visitramsgate.co.uk/category/event/", kind: "web", label: "Visit Ramsgate, event archive" },
  { regionId: "ramsgate", url: "https://www.visitramsgate.co.uk/festivals/", kind: "web", label: "Visit Ramsgate, festivals" },

  // The town's main venues, on their own sites where they have one. A venue
  // publishing its own diary is the best kind of seed: no aggregator sitting
  // between the listing and us deciding what is worth indexing.
  { regionId: "ramsgate", url: "https://www.thegranvilletheatre.com/whatson", kind: "web", label: "Granville Theatre" },
  { regionId: "ramsgate", url: "https://www.ramsgatemusichall.com/whats-on/", kind: "web", label: "Ramsgate Music Hall" },
  { regionId: "ramsgate", url: "https://ramsgateroyalharbour.co.uk/events/", kind: "web", label: "Ramsgate Royal Harbour" },
  { regionId: "ramsgate", url: "https://www.ellingtonpark.org.uk/events/category/events", kind: "web", label: "Ellington Park" },

  // The council's own page for Ellington Park, which is where the town's
  // outdoor and community events are actually booked and listed.
  { regionId: "ramsgate", url: "https://www.thanet.gov.uk/event-locations/ellington-park/", kind: "web", label: "Thanet council, Ellington Park" },

  // ---- Ramsgate: worth trying, lower confidence ---------------------------
  //
  // Real, indexed pages, but more likely to be a directory than a dated
  // diary. Kept because the cost of a page that returns nothing is one small
  // model call per cache window, and because a directory that does carry
  // dates is exactly the long tail this source exists for. If the logs show
  // these contributing nothing after a few weeks, delete them.
  { regionId: "ramsgate", url: "https://www.visitramsgate.co.uk/music-venues/", kind: "web", label: "Visit Ramsgate, music venues" },
  { regionId: "ramsgate", url: "https://www.visitramsgate.co.uk/category/music-venue/", kind: "web", label: "Visit Ramsgate, music venue archive" },
  { regionId: "ramsgate", url: "https://www.visitramsgate.co.uk/category/event-space/community-hub/", kind: "web", label: "Visit Ramsgate, community hubs" },
  { regionId: "ramsgate", url: "https://www.visitramsgate.co.uk/things-to-do/", kind: "web", label: "Visit Ramsgate, things to do" },
  { regionId: "ramsgate", url: "https://www.visitramsgate.co.uk/activities/", kind: "web", label: "Visit Ramsgate, activities" },
  { regionId: "ramsgate", url: "https://theatreinramsgate.co.uk/", kind: "web", label: "Theatre in Ramsgate" },
  { regionId: "ramsgate", url: "https://www.ticketsource.com/whats-on/ramsgate/ramsgate-community-cinema", kind: "web", label: "Ramsgate Community Cinema" },

  // Gig aggregators covering Ramsgate. These overlap with Skiddle and
  // Ticketmaster by design, so their value here is only the gigs those two
  // miss: pub bands, open mics, one-off nights that never get a ticket link.
  // The feed already de-dupes on title and day, and localscan is last in
  // source priority, so a duplicate resolves to the ticketed copy.
  { regionId: "ramsgate", url: "https://www.lemonrock.com/gigs-in-ramsgate", kind: "web", label: "Lemonrock gig guide, Ramsgate" },
  { regionId: "ramsgate", url: "https://www.useyourlocal.com/pubs-in-ramsgate/with-live-music/", kind: "web", label: "Use Your Local, Ramsgate live music" },

  // ---- Ramsgate: the venue this source was built for ----------------------
  //
  // The Ramsgate Boating Pool, whose free eclipse watch is the example that
  // prompted all of this. Their Facebook Page is the only presence of their
  // own that could be confirmed to exist.
  //
  // Expect it to contribute nothing most of the time, and that is not a bug.
  // Facebook serves a JavaScript shell to a plain server-side fetch rather
  // than a signed-in browser's view, so a Page timeline usually comes back
  // with too few words to be worth reading. localscan.js checks that
  // (isThin) BEFORE calling the model, so a Facebook page that yields
  // nothing costs a fetch and no LLM call at all. It is here because it is
  // nearly free to try and occasionally works: an individual event
  // permalink's og: tags have to be server rendered for Messenger and
  // WhatsApp link previews to work.
  { regionId: "ramsgate", url: "https://www.facebook.com/ramsgateboatingpool/", kind: "facebook", label: "Ramsgate Boating Pool" },

  // --- END SEEDS ---
  // Do not remove or move this line. localscan-discover.js finds it by exact
  // text match and inserts proposed new entries directly above it, in the
  // pull requests it opens. Anything below this line is not part of the
  // array (see the closing bracket next) and would break the file.
];
