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
//   By the monthly research job (sources/localscan-discover.js, run by the
//   ventrack-uk-localscan-discover Cron Job in render.yaml). It never edits
//   this file directly on main: it proposes candidates in a pull request,
//   which is what "manually or automatically" actually means here. Adding a
//   line still goes through a human clicking merge, it is just that an LLM
//   drafted the line instead of a person. See "Automatic discovery" in
//   DEPLOY.md for the full mechanism, including what it needs configured
//   before it does anything.
export const SEEDS = [
  // Real example, ready for a real URL. Ramsgate is already a region
  // (regions.js CITIES, id "ramsgate"): swap `url` for the Boating Pool's own
  // site or Facebook Page and this starts contributing on the next scan.
  // { regionId: "ramsgate", url: "https://example.org/whats-on", kind: "web", label: "Ramsgate Boating Pool" },

  // --- END SEEDS ---
  // Do not remove or move this line. localscan-discover.js finds it by exact
  // text match and inserts proposed new entries directly above it, in the
  // pull requests it opens. Anything below this line is not part of the
  // array (see the closing bracket next) and would break the file.
];
