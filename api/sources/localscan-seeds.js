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
// STATUS OF THE ENTRIES BELOW. These were found by web search and their
// event listings were visible in the search results (Ramsgate Day, the
// Festival of Sound and the Winter Festival all showed up with real dates),
// but they were NOT opened and read directly: the environment they were added
// from cannot reach these hosts. So they are a good starting point rather
// than a verified one. Check the Render logs after the first scan: a page
// that turns out to be wrong shows up as contributing nothing, and a page
// that turns out to be right shows up as events with source "Local pages".
//
// The Ramsgate Boating Pool itself is not here yet. It is the example that
// prompted this whole source, but no page for it turned up in search that
// could be confirmed as its own listings page rather than a mention of it on
// someone else's. If you know its site or Facebook Page, that is the single
// best entry to add next.
export const SEEDS = [
  // Visit Thanet is the district tourism board, and its find-events page
  // covers Ramsgate, Margate and Broadstairs together. Deliberately listed
  // for all three regions: the per-url cache means this is still one fetch
  // and one LLM call per TTL no matter how many regions share it, and each
  // region gets its own events built from that one extraction.
  { regionId: "ramsgate", url: "https://www.visitthanet.co.uk/whats-on/find-events/", kind: "web", label: "Visit Thanet, what's on" },
  { regionId: "margate", url: "https://www.visitthanet.co.uk/whats-on/find-events/", kind: "web", label: "Visit Thanet, what's on" },
  { regionId: "broadstairs", url: "https://www.visitthanet.co.uk/whats-on/find-events/", kind: "web", label: "Visit Thanet, what's on" },

  // The local paper. Runs a recurring "things to see and do in Thanet" piece
  // that is exactly the small, free, community listing the ticketing sources
  // never carry, which is the whole reason this source exists.
  { regionId: "ramsgate", url: "https://theisleofthanetnews.com/", kind: "web", label: "Isle of Thanet News" },
  { regionId: "margate", url: "https://theisleofthanetnews.com/", kind: "web", label: "Isle of Thanet News" },

  // --- END SEEDS ---
  // Do not remove or move this line. localscan-discover.js finds it by exact
  // text match and inserts proposed new entries directly above it, in the
  // pull requests it opens. Anything below this line is not part of the
  // array (see the closing bracket next) and would break the file.
];
