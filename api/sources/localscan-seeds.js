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

  // --------------------------------------------------------------------------
  // NATIONAL PASS 1: council "what's on" pages, harvested 2026-08-18.
  //
  // Sourced by restricting a web search to gov.uk, which is the trick that
  // makes this work at all: an unrestricted search for "Manchester events"
  // returns Manchester, New Hampshire, and most British town names have an
  // American namesake that outranks them. Every url below came back from a
  // real search against a UK government domain, with a title and summary
  // describing event listings for that town.
  //
  // SAME CAVEAT AS THE RAMSGATE BLOCK, and it has not gone away: none of these
  // could be opened and read. The environment they were added from cannot
  // reach any of these hosts. So they are well sourced rather than verified.
  // A page that turns out to be an archive, a committee-meeting calendar or a
  // dead link contributes nothing and costs one fetch per TTL window until
  // someone prunes it. `GET /api/diag?lat=..&lng=..` for the town is the
  // quickest way to see which of these actually paid off.
  //
  // Councils are the right first seed for a town precisely because they are
  // the least likely to be on Ticketmaster: markets, galas, lantern parades,
  // library talks, switch-ons. One per town is not the target, it is the
  // floor. See "Growing this to every town" in DEPLOY.md.
  { regionId: "coventry", url: "https://www.coventry.gov.uk/whatson", kind: "web", label: "Coventry City Council, what's on" },
  { regionId: "birmingham", url: "https://www.birmingham.gov.uk/site/scripts/events_info.php", kind: "web", label: "Birmingham City Council, this week's events" },
  { regionId: "bradford", url: "https://whatson.bradford.gov.uk/", kind: "web", label: "Bradford District what's on guide" },
  { regionId: "leeds", url: "https://leedsinspired.co.uk/", kind: "web", label: "Leeds Inspired, council-backed listings" },
  { regionId: "leeds", url: "https://www.visitleeds.co.uk/whats-on/", kind: "web", label: "Visit Leeds, what's on" },
  { regionId: "bristol", url: "https://visitbristol.co.uk/whats-on/", kind: "web", label: "Visit Bristol, what's on" },
  { regionId: "sheffield", url: "https://www.whatshappening.co.uk/sheffield/", kind: "web", label: "What's Happening Sheffield" },
  { regionId: "lincoln", url: "https://www.lincoln.gov.uk/homepage/83/events-in-lincoln", kind: "web", label: "City of Lincoln Council events" },
  { regionId: "edinburgh", url: "https://www.edinburgh.gov.uk/events-venues", kind: "web", label: "City of Edinburgh Council, events and venues" },
  { regionId: "aberdeen", url: "https://www.aberdeencity.gov.uk/events/topics/438", kind: "web", label: "Aberdeen City Council, fairs and festivals" },
  { regionId: "dunfermline", url: "https://www.fife.gov.uk/whats-on/whats-on-listing-page", kind: "web", label: "Fife Council what's on" },
  { regionId: "swindon", url: "https://www.swindon.gov.uk/site/scripts/events_info.php?period=full", kind: "web", label: "Swindon Borough Council, all events" },
  { regionId: "bedford", url: "https://www.bedford.gov.uk/leisure-parks-and-sport/arts-and-culture/whats-bedford-borough-hub", kind: "web", label: "What's On Bedford Borough hub" },
  { regionId: "dartford", url: "https://www.dartford.gov.uk/whats-on-in-dartford", kind: "web", label: "Dartford Borough Council events" },
  { regionId: "stockton-on-tees", url: "https://www.stockton.gov.uk/our-events", kind: "web", label: "Stockton-on-Tees Borough Council events" },
  { regionId: "stafford", url: "https://www.staffordbc.gov.uk/leisure-and-culture/whats-on-events", kind: "web", label: "Stafford Borough Council, what's on" },
  { regionId: "aldershot", url: "https://www.rushmoor.gov.uk/whats-on-in-aldershot-and-farnborough/", kind: "web", label: "Rushmoor Borough Council, Aldershot and Farnborough" },
  { regionId: "farnborough", url: "https://www.rushmoor.gov.uk/whats-on-in-aldershot-and-farnborough/", kind: "web", label: "Rushmoor Borough Council, Aldershot and Farnborough" },
  { regionId: "farnham", url: "https://www.farnham.gov.uk/things-to-do/events-organised-by-farnham-town-council/", kind: "web", label: "Farnham Town Council events" },
  { regionId: "godalming", url: "https://godalming-tc.gov.uk/festivals-markets/", kind: "web", label: "Godalming Town Council, festivals and markets" },
  { regionId: "cirencester", url: "https://cirencester.gov.uk/whats-on", kind: "web", label: "Cirencester Town Council, what's on" },
  { regionId: "abingdon", url: "https://www.abingdon.gov.uk/discover-abingdon", kind: "web", label: "Abingdon on Thames Town Council" },
  { regionId: "morecambe", url: "https://www.morecambe.gov.uk/council_events/", kind: "web", label: "Morecambe Town Council events" },
  { regionId: "hertford", url: "https://www.hertford.gov.uk/events-listings/", kind: "web", label: "Hertford Town Council events calendar" },
  { regionId: "warwick", url: "https://www.warwickdc.gov.uk/info/20796/town_centres_and_events", kind: "web", label: "Warwick District Council, town centres and events" },
  { regionId: "trowbridge", url: "https://trowbridge.gov.uk/whats-on-in-trowbridge/", kind: "web", label: "Trowbridge Town Council, what's on" },
  { regionId: "ross-on-wye", url: "https://www.rosstc-herefordshire.gov.uk/digital-event-guide/", kind: "web", label: "Ross-on-Wye Town Council event guide" },
  { regionId: "nelson", url: "https://www.pendle.gov.uk/events", kind: "web", label: "Pendle Borough Council events" },
  { regionId: "cwmbran", url: "https://www.torfaen.gov.uk/en/LeisureParksEvents/Events/Events.aspx", kind: "web", label: "Torfaen County Borough Council events" },

  // --------------------------------------------------------------------------
  // NATIONAL PASS 2: one research agent per town, run 2026-08-18.
  //
  // Sixteen towns, one agent each, every one told to search only UK domains
  // (gov.uk, co.uk, org.uk, ac.uk) and to reject anything not unambiguously
  // the British town. That restriction is the whole reason this is usable:
  // unrestricted, "Manchester events" returns New Hampshire.
  //
  // Each agent was also told to exclude the national ticketing platforms
  // (Ticketmaster, Skiddle, Eventbrite, Ents24, AllEvents and the rest),
  // because those are already separate sources in this app. Watching them here
  // would pay an LLM to rediscover events another source already has, and the
  // de-dupe would then drop them. What is below is what those platforms miss:
  // councils, theatres, museums, universities, markets, parks, local press.
  // All 301 urls passed that filter with nothing rejected.
  //
  // THE SAME CAVEAT AS EVERY BLOCK ABOVE. Nothing here has been opened. The
  // agents could search but not fetch, and this environment cannot reach any
  // of these hosts. Every url is one that literally appeared in a search
  // result with a title and summary describing event listings, and no agent
  // was permitted to construct one. That makes the list well sourced, not
  // verified. `GET /api/diag?lat=..&lng=..` for a town is the fastest way to
  // see which of its pages actually paid off; a page that turns out to be an
  // archive or a dead link contributes nothing and costs one fetch per TTL
  // until it is pruned.
  //
  // Note MAX_SEEDS_PER_REGION in localscan.js is 24. A town listing more than
  // that watches the first 24 in file order.

  // bournemouth, 18 pages
  { regionId: "bournemouth", url: "https://www.fid.bcpcouncil.gov.uk/family-information-directory/whats-on/events-listing", kind: "web", label: "BCP Council Family Information Directory - What's On" },
  { regionId: "bournemouth", url: "https://www.fid.bcpcouncil.gov.uk/family-information-directory/directory/activities/family-activities/community-events?keywords=", kind: "web", label: "BCP Council Community Events directory" },
  { regionId: "bournemouth", url: "https://www.bcpcouncil.gov.uk/leisure-culture-and-local-heritage/local-and-family-history/heritage-zone/events-and-exhibitions", kind: "web", label: "BCP Council Heritage Zone - Events and exhibitions" },
  { regionId: "bournemouth", url: "https://www.bcpcouncil.gov.uk/libraries/bournemouth-music-library/classic-and-light-music-events-in-our-area", kind: "web", label: "Bournemouth Music Library - classical and light music events" },
  { regionId: "bournemouth", url: "https://www.bournemouthpavilion.co.uk/whats-on", kind: "web", label: "Bournemouth Pavilion Theatre - What's On" },
  { regionId: "bournemouth", url: "https://www.bournemouthpavilion.co.uk/whats-on/calendar", kind: "web", label: "Bournemouth Pavilion Theatre - Calendar" },
  { regionId: "bournemouth", url: "https://www.bournemouthpavilion.co.uk/news/autumn-winter-pavilion-2026-2", kind: "web", label: "Bournemouth Pavilion autumn/winter 2026 What's On guide" },
  { regionId: "bournemouth", url: "https://www.bournemouth.co.uk/whats-on", kind: "web", label: "Bournemouth.co.uk official tourist information - What's On" },
  { regionId: "bournemouth", url: "https://www.visitbournemouth.com/", kind: "web", label: "Visit Bournemouth - What's On guide" },
  { regionId: "bournemouth", url: "https://www.bournemouthlifestyle.com/guide/events-guide-whats-on", kind: "web", label: "Bournemouth Lifestyle events guide" },
  { regionId: "bournemouth", url: "https://russellcotes.com/whats-on/", kind: "web", label: "Russell-Cotes Art Gallery & Museum - What's On" },
  { regionId: "bournemouth", url: "https://russellcotes.com/event/", kind: "web", label: "Russell-Cotes Museum - Events listing" },
  { regionId: "bournemouth", url: "https://www.bournemouth.ac.uk/research/get-involved/spotlight-public-lecture-series", kind: "web", label: "Bournemouth University Spotlight Public Lecture Series" },
  { regionId: "bournemouth", url: "https://www.bournemouth.ac.uk/research/get-involved/online-public-lecture-series", kind: "web", label: "Bournemouth University Online Public Lecture Series" },
  { regionId: "bournemouth", url: "https://microsites.bournemouth.ac.uk/cippm/events/public-lectures/", kind: "web", label: "Bournemouth University CIPPM public lectures" },
  { regionId: "bournemouth", url: "https://www.stpetersbournemouth.org.uk/events/wessex-youth-symphony-orchestra-concert/", kind: "web", label: "St Peter's Church Bournemouth - concert event" },
  { regionId: "bournemouth", url: "https://www.uktw.co.uk/Bournemouth/Pavilion-Theatre/V906/", kind: "web", label: "UK Theatre Web - Pavilion Theatre Bournemouth listings" },
  { regionId: "bournemouth", url: "https://www.dorsetlifestyle.co.uk/info/fantastic-shows-at-the-bournemouth-pavilion", kind: "web", label: "Dorset Lifestyle - shows at Bournemouth Pavilion" },

  // brighton, 20 pages
  { regionId: "brighton", url: "https://www.brighton-hove.gov.uk/events", kind: "web", label: "Brighton & Hove City Council - Events" },
  { regionId: "brighton", url: "https://brightondome.org/whats-on/", kind: "web", label: "Brighton Dome - What's On" },
  { regionId: "brighton", url: "https://brightonfestival.org/whats-on/", kind: "web", label: "Brighton Festival - What's On" },
  { regionId: "brighton", url: "https://brightonmuseums.org.uk/whats-on/", kind: "web", label: "Brighton & Hove Museums - What's On" },
  { regionId: "brighton", url: "https://brightonmuseums.org.uk/brighton-museum-art-gallery/whats-on/", kind: "web", label: "Brighton Museum & Art Gallery - What's On" },
  { regionId: "brighton", url: "https://www.bh-arts.org.uk/arts-diary/category/visual-arts-exhibitions/list/", kind: "web", label: "Brighton & Hove Arts Council - Arts Diary" },
  { regionId: "brighton", url: "https://www.visitbrighton.com/whats-on/events-calendar", kind: "web", label: "VisitBrighton - Events Calendar" },
  { regionId: "brighton", url: "https://www.visitbrighton.com/whats-on/festivals", kind: "web", label: "VisitBrighton - Festivals & Events Guide" },
  { regionId: "brighton", url: "https://www.brightoncentre.co.uk/whats-on/", kind: "web", label: "Brighton Centre - What's On" },
  { regionId: "brighton", url: "https://www.komedia.co.uk/whats-on/", kind: "web", label: "Komedia Brighton - What's On" },
  { regionId: "brighton", url: "https://www.attenboroughcentre.com/events", kind: "web", label: "Attenborough Centre for the Creative Arts (ACCA)" },
  { regionId: "brighton", url: "https://www.brightonfringe.org/events/", kind: "web", label: "Brighton Fringe - What's On" },
  { regionId: "brighton", url: "https://www.brightonopenairtheatre.co.uk/whats-on/", kind: "web", label: "Brighton Open Air Theatre - What's On" },
  { regionId: "brighton", url: "https://fabrica.org.uk/whats-on", kind: "web", label: "Fabrica Gallery Brighton - What's On" },
  { regionId: "brighton", url: "https://www.theoldmarket.com/whatsonbydate", kind: "web", label: "The Old Market, Hove - What's On by date" },
  { regionId: "brighton", url: "https://www.concorde2.co.uk/whats-on", kind: "web", label: "Concorde 2 Brighton - What's On" },
  { regionId: "brighton", url: "https://www.brighton.ac.uk/about-us/news-and-events/events/index.aspx", kind: "web", label: "University of Brighton - Events" },
  { regionId: "brighton", url: "https://www.escis.org.uk/event/jubilee-library-brighton-weekly-events/", kind: "web", label: "ESCIS - Jubilee Library Brighton weekly events" },
  { regionId: "brighton", url: "https://tickets.brightonandhovealbion.com/AllEvents.aspx?ViewType=Monthly", kind: "web", label: "Brighton & Hove Albion - All events (monthly)" },
  { regionId: "brighton", url: "https://www.facebook.com/BrightonandHoveCityCouncil/events/", kind: "facebook", label: "Brighton & Hove City Council (Facebook events)" },

  // cambridge, 20 pages
  { regionId: "cambridge", url: "https://www.cambridge.gov.uk/events-and-activities-in-your-community", kind: "web", label: "Cambridge City Council - Events and activities in your community" },
  { regionId: "cambridge", url: "https://www.cambridge.gov.uk/summer-events", kind: "web", label: "Cambridge City Council - Summer events" },
  { regionId: "cambridge", url: "https://www.cornex.co.uk/events", kind: "web", label: "Cambridge Corn Exchange - What's On" },
  { regionId: "cambridge", url: "https://www.artstheatre.co.uk/whats-on/", kind: "web", label: "Cambridge Arts Theatre - What's On" },
  { regionId: "cambridge", url: "https://www.junction.co.uk/whats-on/", kind: "web", label: "Cambridge Junction - What's On" },
  { regionId: "cambridge", url: "https://www.cambridgelivetickets.co.uk/", kind: "web", label: "Cambridge Live Tickets" },
  { regionId: "cambridge", url: "https://www.kettlesyard.cam.ac.uk/whats-on/", kind: "web", label: "Kettle's Yard - What's On" },
  { regionId: "cambridge", url: "https://www.kettlesyard.cam.ac.uk/whats-on-all/", kind: "web", label: "Kettle's Yard - All What's On" },
  { regionId: "cambridge", url: "https://www.botanic.cam.ac.uk/whats-on/", kind: "web", label: "Cambridge University Botanic Garden - Events" },
  { regionId: "cambridge", url: "https://www.fitzmuseum.cam.ac.uk/events", kind: "web", label: "Fitzwilliam Museum - Events" },
  { regionId: "cambridge", url: "https://fitzmuseum.cam.ac.uk/plan-your-visit/exhibitions", kind: "web", label: "Fitzwilliam Museum - Exhibitions and displays" },
  { regionId: "cambridge", url: "https://www.museums.cam.ac.uk/whats-on", kind: "web", label: "University of Cambridge Museums - What's On" },
  { regionId: "cambridge", url: "https://tickets.museums.cam.ac.uk/", kind: "web", label: "University of Cambridge Museums - Events and tickets" },
  { regionId: "cambridge", url: "https://talks.cam.ac.uk/", kind: "web", label: "talks.cam - University of Cambridge talks" },
  { regionId: "cambridge", url: "https://talks.cam.ac.uk/show/index/5462/", kind: "web", label: "talks.cam - Major Public Lectures in Cambridge" },
  { regionId: "cambridge", url: "https://www.cam.ac.uk/public-engagement/public-events", kind: "web", label: "University of Cambridge - Public events" },
  { regionId: "cambridge", url: "https://www.admin.cam.ac.uk/whatson/", kind: "web", label: "University of Cambridge - What's On" },
  { regionId: "cambridge", url: "https://www.lib.cam.ac.uk/whats-on", kind: "web", label: "Cambridge University Library - What's On" },
  { regionId: "cambridge", url: "https://www.public.ast.cam.ac.uk/current-season", kind: "web", label: "Institute of Astronomy Cambridge - Public Talks" },
  { regionId: "cambridge", url: "https://www.opencambridge.cam.ac.uk/events", kind: "web", label: "Open Cambridge - Events" },

  // cheltenham, 8 pages
  { regionId: "cheltenham", url: "https://www.cheltenham.gov.uk/site/scripts/events_info.php?locationID=4", kind: "web", label: "Cheltenham Borough Council - Events" },
  { regionId: "cheltenham", url: "https://www.uktw.co.uk/town/Cheltenham/", kind: "web", label: "UK Theatre Web - Cheltenham theatres what's on" },
  { regionId: "cheltenham", url: "https://www.uktw.co.uk/Cheltenham/Everyman-Theatre/V90/", kind: "web", label: "Everyman Theatre Cheltenham listings (UKTW)" },
  { regionId: "cheltenham", url: "https://www.uktw.co.uk/Cheltenham/Town-Hall/V763828283/", kind: "web", label: "Cheltenham Town Hall listings (UKTW)" },
  { regionId: "cheltenham", url: "https://www.dresscircle.co.uk/theatres/everyman-theatre-cheltenham", kind: "web", label: "Dress Circle - Everyman Theatre Cheltenham" },
  { regionId: "cheltenham", url: "https://showtours.co.uk/whats-on-in-cheltenham/", kind: "web", label: "Showtours - What's on in Cheltenham" },
  { regionId: "cheltenham", url: "https://showtours.co.uk/whats-on-at-cheltenham-everyman-theatre/", kind: "web", label: "Showtours - Cheltenham Everyman Theatre" },
  { regionId: "cheltenham", url: "https://www.visitorplus.co.uk/promo/8307/everyman-theatre-cheltenham/", kind: "web", label: "Visitor+ - Everyman Theatre Cheltenham" },

  // derby, 18 pages
  { regionId: "derby", url: "https://www.visitderby.co.uk/whats-on", kind: "web", label: "Visit Derby - What's On" },
  { regionId: "derby", url: "https://www.visitderby.co.uk/whats-on/today", kind: "web", label: "Visit Derby - What's On Today" },
  { regionId: "derby", url: "https://www.visitderby.co.uk/whats-on/this-week", kind: "web", label: "Visit Derby - What's On This Week" },
  { regionId: "derby", url: "https://www.visitderby.co.uk/whats-on/top-events", kind: "web", label: "Visit Derby - Top Events 2026" },
  { regionId: "derby", url: "https://www.derbylive.co.uk/whats-on/", kind: "web", label: "Derby LIVE - What's On" },
  { regionId: "derby", url: "https://www.derbylive.co.uk/", kind: "web", label: "Derby LIVE" },
  { regionId: "derby", url: "https://derbytheatre.co.uk/whats-on/", kind: "web", label: "Derby Theatre - What's On" },
  { regionId: "derby", url: "https://www.uktw.co.uk/Derby/Derby-Theatre/V1830193620/", kind: "web", label: "UK Theatre Web - Derby Theatre listings" },
  { regionId: "derby", url: "https://derbymuseums.org/museum-of-making/whats-on/", kind: "web", label: "Museum of Making - What's On" },
  { regionId: "derby", url: "https://derbymuseums.org/programmes/", kind: "web", label: "Derby Museums - Programmes" },
  { regionId: "derby", url: "https://www.artsderbyshire.org.uk/whats-on-in-derbyshire/", kind: "web", label: "Arts Derbyshire - What's On" },
  { regionId: "derby", url: "https://www.derby.gov.uk/news/tags/events", kind: "web", label: "Derby City Council - events news" },
  { regionId: "derby", url: "https://www.derby.gov.uk/leisure-and-culture/sport-leisure/", kind: "web", label: "Derby City Council - sport and leisure" },
  { regionId: "derby", url: "https://www.derbyshire.gov.uk/leisure/events/our-events.aspx", kind: "web", label: "Derbyshire County Council - Our Events" },
  { regionId: "derby", url: "https://www.derbion.com/visit-derby/", kind: "web", label: "Derbion - What's on in and around Derby" },
  { regionId: "derby", url: "https://www.derby.ac.uk/events/latest-events/", kind: "web", label: "University of Derby - Latest Events" },
  { regionId: "derby", url: "https://www.derby.ac.uk/events/talks-lectures/", kind: "web", label: "University of Derby - Talks and Lectures" },
  { regionId: "derby", url: "https://www.derby.ac.uk/open-days/", kind: "web", label: "University of Derby - Open Days" },

  // exeter, 20 pages
  { regionId: "exeter", url: "https://exeter.gov.uk/leisure-and-culture/visitor-information/what-s-on-with-visit-exeter/", kind: "web", label: "Exeter City Council - What's On with Visit Exeter" },
  { regionId: "exeter", url: "https://news.exeter.gov.uk/", kind: "web", label: "Exeter City Council News" },
  { regionId: "exeter", url: "https://exeternorthcott.co.uk/whats-on/", kind: "web", label: "Exeter Northcott Theatre - What's On" },
  { regionId: "exeter", url: "https://exeterphoenix.org.uk/events/", kind: "web", label: "Exeter Phoenix - Events" },
  { regionId: "exeter", url: "https://rammuseum.org.uk/whats-on/", kind: "web", label: "RAMM Exeter - What's On" },
  { regionId: "exeter", url: "https://www.exeter-cathedral.org.uk/whats-on/", kind: "web", label: "Exeter Cathedral - What's On" },
  { regionId: "exeter", url: "https://www.exeter-cathedral.org.uk/whats-on/daily-calendar/", kind: "web", label: "Exeter Cathedral - Daily Calendar" },
  { regionId: "exeter", url: "https://www.exetercornexchange.co.uk/book-tickets/all-our-events/", kind: "web", label: "Exeter Corn Exchange - All Our Events" },
  { regionId: "exeter", url: "https://www.exeter.ac.uk/events/", kind: "web", label: "University of Exeter - Events and Seminars" },
  { regionId: "exeter", url: "https://event.exeter.ac.uk/location/whats-on", kind: "web", label: "Event Exeter - What's On" },
  { regionId: "exeter", url: "https://liveevents.exeter.ac.uk/whats-on/", kind: "web", label: "Live @ Exeter - What's On in Exeter" },
  { regionId: "exeter", url: "https://www.exeter.ac.uk/research/publicengagement/eventsandfestivals/", kind: "web", label: "University of Exeter - Public Engagement Events and Festivals" },
  { regionId: "exeter", url: "https://www.visitdevon.co.uk/south-west-devon/exeter/whats-on-in-exeter/", kind: "web", label: "Visit Devon - What's On in Exeter" },
  { regionId: "exeter", url: "https://www.visitsouthdevon.co.uk/whats-on/exeter", kind: "web", label: "Visit South Devon - What's On in Exeter" },
  { regionId: "exeter", url: "https://www.exeterviews.co.uk/exeter-events.php", kind: "web", label: "Exeter Views - Exeter Events Calendar" },
  { regionId: "exeter", url: "https://www.exeterchiefs.co.uk/fixtures/men", kind: "web", label: "Exeter Chiefs - Men's Fixtures" },
  { regionId: "exeter", url: "https://tickethub.sandypark.co.uk/list/events?lang=en", kind: "web", label: "Sandy Park - Schedule of Events" },
  { regionId: "exeter", url: "https://www.thejockeyclub.co.uk/exeter/events-tickets/", kind: "web", label: "Exeter Racecourse - Races, Events & Fixtures" },
  { regionId: "exeter", url: "https://www.librariesunlimited.org.uk/library-events/", kind: "web", label: "Libraries Unlimited - Library Events (Exeter Library)" },
  { regionId: "exeter", url: "https://www.exetertoday.co.uk/news/exeter-living/2067224/5-fun-things-to-do-this-weekend-in-exeter.html", kind: "web", label: "Exeter Today - Things to do this weekend in Exeter" },

  // hull, 14 pages
  { regionId: "hull", url: "https://news.hull.gov.uk/category/whats-on/", kind: "web", label: "Hull City Council - What's On" },
  { regionId: "hull", url: "https://news.hull.gov.uk/tag/events/", kind: "web", label: "Hull CC News - Events archive" },
  { regionId: "hull", url: "https://news.hull.gov.uk/tag/whats-on-hull/", kind: "web", label: "Hull CC News - What's On Hull tag" },
  { regionId: "hull", url: "https://www.eastriding.gov.uk/leisure/events/", kind: "web", label: "East Riding of Yorkshire Council - Events" },
  { regionId: "hull", url: "https://www.hulltheatres.co.uk/", kind: "web", label: "Hull Theatres (New Theatre & City Hall)" },
  { regionId: "hull", url: "https://www.hulltheatres.co.uk/theatre-events?page=2", kind: "web", label: "Hull Theatres - What's on listing" },
  { regionId: "hull", url: "https://www.hulltheatres.co.uk/hull-city-hall", kind: "web", label: "Hull City Hall - venue page" },
  { regionId: "hull", url: "https://www.uktw.co.uk/Hull/Hull-New-Theatre/V934/", kind: "web", label: "UK Theatre Web - Hull New Theatre" },
  { regionId: "hull", url: "https://www.uktw.co.uk/Hull/Hull-City-Hall/V02123462242/", kind: "web", label: "UK Theatre Web - Hull City Hall" },
  { regionId: "hull", url: "https://www.dresscircle.co.uk/theatres/bonus-hull-arena-hull", kind: "web", label: "Dress Circle - Hull Bonus Arena" },
  { regionId: "hull", url: "https://www.gig-guide.co.uk/whats-on/hull", kind: "web", label: "Gig Guide - What's on in Hull" },
  { regionId: "hull", url: "https://artspod.co.uk/venue/hull-new-theatre-and-hull-city-hall/", kind: "web", label: "Artspod - Hull New Theatre & City Hall" },
  { regionId: "hull", url: "https://artinyorkshire.org.uk/venue/ferens-art-gallery/", kind: "web", label: "Art in Yorkshire - Ferens Art Gallery" },
  { regionId: "hull", url: "https://artinyorkshire.org.uk/venue/hull-maritime-museum/", kind: "web", label: "Art in Yorkshire - Hull Maritime Museum" },

  // liverpool, 20 pages
  { regionId: "liverpool", url: "https://liverpool.gov.uk/leisure-and-wellbeing/events/", kind: "web", label: "Liverpool City Council - Events and tourism" },
  { regionId: "liverpool", url: "https://liverpool.gov.uk/libraries/library-events/", kind: "web", label: "Liverpool Libraries - Library events" },
  { regionId: "liverpool", url: "https://liverpool.gov.uk/leisure-and-wellbeing/events/park-events/", kind: "web", label: "Liverpool City Council - Park events and activities" },
  { regionId: "liverpool", url: "https://everymanplayhouse.com/whats-on/", kind: "web", label: "Liverpool Everyman & Playhouse - What's On" },
  { regionId: "liverpool", url: "https://www.unitytheatreliverpool.co.uk/whats-on/", kind: "web", label: "Unity Theatre Liverpool - What's On" },
  { regionId: "liverpool", url: "http://www.royalcourtliverpool.co.uk/whats-on", kind: "web", label: "Liverpool Royal Court - What's On" },
  { regionId: "liverpool", url: "https://liverpoolphil.com/current-events/", kind: "web", label: "Liverpool Philharmonic - What's On" },
  { regionId: "liverpool", url: "https://www.liverpoolmuseums.org.uk/whatson", kind: "web", label: "National Museums Liverpool - What's on" },
  { regionId: "liverpool", url: "https://www.thebluecoat.org.uk/", kind: "web", label: "Bluecoat contemporary arts centre" },
  { regionId: "liverpool", url: "https://liverpoolcathedral.org.uk/whats-on/", kind: "web", label: "Liverpool Cathedral - Upcoming Events" },
  { regionId: "liverpool", url: "https://www.visitliverpool.com/whats-on-in-liverpool/", kind: "web", label: "VisitLiverpool - What's on in Liverpool" },
  { regionId: "liverpool", url: "https://cultureliverpool.co.uk/whats-on/", kind: "web", label: "Culture Liverpool - What's On" },
  { regionId: "liverpool", url: "https://www.liverpool.ac.uk/events/listing/", kind: "web", label: "University of Liverpool - Event listing" },
  { regionId: "liverpool", url: "https://www.mandsbankarena.com/whats-on/", kind: "web", label: "M&S Bank Arena Liverpool - What's On" },
  { regionId: "liverpool", url: "https://www.thejockeyclub.co.uk/aintree/events-tickets/", kind: "web", label: "Aintree Racecourse - Races, Events & Fixtures" },
  { regionId: "liverpool", url: "https://www.nationaltrust.org.uk/visit/liverpool-lancashire/speke-hall/events", kind: "web", label: "Speke Hall - Events" },
  { regionId: "liverpool", url: "https://palmhouse.org.uk/whats-on/", kind: "web", label: "Palm House Sefton Park - What's On" },
  { regionId: "liverpool", url: "https://www.cavernclub.com/whats-on/", kind: "web", label: "The Cavern Club - What's On" },
  { regionId: "liverpool", url: "https://www.atgtickets.com/venues/liverpool-empire/whats-on/", kind: "web", label: "Liverpool Empire Theatre - What's On" },
  { regionId: "liverpool", url: "https://independent-liverpool.co.uk/events/", kind: "web", label: "Independent Liverpool - Events" },

  // london, 20 pages
  { regionId: "london", url: "https://www.london.gov.uk/events", kind: "web", label: "London City Hall (GLA) upcoming events" },
  { regionId: "london", url: "https://www.cityoflondon.gov.uk/events", kind: "web", label: "City of London Corporation events" },
  { regionId: "london", url: "https://www.lbbd.gov.uk/whats-on", kind: "web", label: "Barking & Dagenham Council what's on" },
  { regionId: "london", url: "https://www.bexley.gov.uk/events", kind: "web", label: "London Borough of Bexley events calendar" },
  { regionId: "london", url: "https://www.lbhf.gov.uk/libraries/library-events-and-activities", kind: "web", label: "Hammersmith & Fulham library events" },
  { regionId: "london", url: "https://www.londonmuseum.org.uk/whats-on/", kind: "web", label: "London Museum what's on" },
  { regionId: "london", url: "https://www.iwm.org.uk/visits/iwm-london/whats-on", kind: "web", label: "IWM London what's on" },
  { regionId: "london", url: "https://museumofthehome.org.uk/whats-on/", kind: "web", label: "Museum of the Home what's on" },
  { regionId: "london", url: "https://www.sciencemuseum.org.uk/see-and-do", kind: "web", label: "Science Museum see and do" },
  { regionId: "london", url: "https://www.barbican.org.uk/whats-on", kind: "web", label: "Barbican Centre what's on" },
  { regionId: "london", url: "https://www.southbankcentre.co.uk/whats-on/", kind: "web", label: "Southbank Centre what's on" },
  { regionId: "london", url: "https://www.sadlerswells.com/whats-on/", kind: "web", label: "Sadler's Wells what's on" },
  { regionId: "london", url: "https://www.wigmore-hall.org.uk/whats-on", kind: "web", label: "Wigmore Hall what's on" },
  { regionId: "london", url: "https://www.royalalberthall.com/tickets/calendar", kind: "web", label: "Royal Albert Hall events calendar" },
  { regionId: "london", url: "https://www.alexandrapalace.com/whats-on/", kind: "web", label: "Alexandra Palace what's on" },
  { regionId: "london", url: "https://www.royalparks.org.uk/whats-on", kind: "web", label: "The Royal Parks what's on" },
  { regionId: "london", url: "https://www.hrp.org.uk/tower-of-london/whats-on/", kind: "web", label: "Tower of London what's on" },
  { regionId: "london", url: "https://www.visitlondon.com/things-to-do/whats-on/things-to-do-this-weekend", kind: "web", label: "Visit London what's on this weekend" },
  { regionId: "london", url: "https://londonist.com/things-to-do-in-london-this-week", kind: "web", label: "Londonist things to do this week" },
  { regionId: "london", url: "https://www.ucl.ac.uk/events/all-events", kind: "web", label: "UCL public events calendar" },

  // manchester, 20 pages
  { regionId: "manchester", url: "https://www.manchester.gov.uk/events", kind: "web", label: "Manchester City Council - Events" },
  { regionId: "manchester", url: "https://www.manchester.gov.uk/events/500277/events", kind: "web", label: "Manchester City Council - Events category listing" },
  { regionId: "manchester", url: "https://www.manchester.gov.uk/parks-leisure-and-the-arts/parks-playgrounds-allotments-and-open-spaces/heaton-park/what-to-see-and-do/events-at-heaton-park", kind: "web", label: "Events at Heaton Park (Manchester City Council)" },
  { regionId: "manchester", url: "https://www.manchester.gov.uk/libraries/events-at-central-library", kind: "web", label: "Events at Manchester Central Library" },
  { regionId: "manchester", url: "https://www.visitmanchester.com/whats-on/", kind: "web", label: "Visit Manchester - What's On" },
  { regionId: "manchester", url: "https://www.royalexchange.co.uk/whats-on-manchester/", kind: "web", label: "Royal Exchange Theatre - What's On" },
  { regionId: "manchester", url: "https://theatreinmanchester.co.uk/shows/", kind: "web", label: "Opera House & Palace Theatre Manchester - All Shows" },
  { regionId: "manchester", url: "https://www.bridgewater-hall.co.uk/whats-on/", kind: "web", label: "The Bridgewater Hall - What's On" },
  { regionId: "manchester", url: "https://www.homemcr.org/whats-on", kind: "web", label: "HOME Manchester - What's On" },
  { regionId: "manchester", url: "https://www.whitworth.manchester.ac.uk/whats-on/", kind: "web", label: "Whitworth Art Gallery - What's On" },
  { regionId: "manchester", url: "https://www.museum.manchester.ac.uk/events", kind: "web", label: "Manchester Museum - All Events" },
  { regionId: "manchester", url: "https://www.scienceandindustrymuseum.org.uk/whats-on", kind: "web", label: "Science and Industry Museum - What's On" },
  { regionId: "manchester", url: "https://www.nationalfootballmuseum.com/whatson/", kind: "web", label: "National Football Museum - What's On" },
  { regionId: "manchester", url: "https://www.manchester.ac.uk/about/events/", kind: "web", label: "University of Manchester - Events" },
  { regionId: "manchester", url: "https://www.mmu.ac.uk/news-and-events/events", kind: "web", label: "Manchester Metropolitan University - Events" },
  { regionId: "manchester", url: "https://librarylive.co.uk/events/list/", kind: "web", label: "Library Live - Manchester libraries events list" },
  { regionId: "manchester", url: "https://www.creativetourist.com/the-cultural-calendar/", kind: "web", label: "Creative Tourist - Cultural Calendar" },
  { regionId: "manchester", url: "https://ilovemanchester.com/things-to-do", kind: "web", label: "I Love Manchester - Things to do / events" },
  { regionId: "manchester", url: "https://tickets.lancashirecricket.co.uk/list/events?lang=en", kind: "web", label: "Lancashire Cricket / Emirates Old Trafford - Schedule of events" },
  { regionId: "manchester", url: "https://www.facebook.com/visitmanchester/", kind: "facebook", label: "Visit Manchester (Facebook)" },

  // newcastle, 20 pages
  { regionId: "newcastle", url: "https://www.newcastle.gov.uk/events", kind: "web", label: "Newcastle City Council - Events" },
  { regionId: "newcastle", url: "https://new.newcastle.gov.uk/event-calendar", kind: "web", label: "Newcastle City Council - Calendar of events" },
  { regionId: "newcastle", url: "https://www.newcastle.gov.uk/citylife-news/events", kind: "web", label: "Newcastle City Council - Citylife What's On" },
  { regionId: "newcastle", url: "https://new.newcastle.gov.uk/parks-and-allotments/events-and-activities", kind: "web", label: "Newcastle parks events and activities" },
  { regionId: "newcastle", url: "https://community2.newcastle.gov.uk/apps/all-events?page=3", kind: "web", label: "CityEye - Events in Newcastle" },
  { regionId: "newcastle", url: "https://www.theatreroyal.co.uk/whats-on/", kind: "web", label: "Newcastle Theatre Royal - What's On" },
  { regionId: "newcastle", url: "https://northernstage.co.uk/whats-on/", kind: "web", label: "Northern Stage - What's On" },
  { regionId: "newcastle", url: "https://www.northeastmuseums.org.uk/laing/whats-on", kind: "web", label: "Laing Art Gallery - What's On" },
  { regionId: "newcastle", url: "https://laingartgallery.org.uk/whats-on", kind: "web", label: "North East Museums - What's On" },
  { regionId: "newcastle", url: "https://newcastlegateshead.com/events", kind: "web", label: "NewcastleGateshead - What's On" },
  { regionId: "newcastle", url: "https://www.newcastlegateshead.com/whats-on/a-z/a", kind: "web", label: "NewcastleGateshead - Events A-Z" },
  { regionId: "newcastle", url: "https://newcastlegateshead.com/events/festival", kind: "web", label: "NewcastleGateshead - Festivals and events" },
  { regionId: "newcastle", url: "https://www.visitnewcastle.co.uk/events/", kind: "web", label: "Visit Newcastle - Events" },
  { regionId: "newcastle", url: "https://onlynewcastle.co.uk/events", kind: "web", label: "Only Newcastle - What's On" },
  { regionId: "newcastle", url: "https://www.getintonewcastle.co.uk/whats-on", kind: "web", label: "Get into Newcastle (NE1 BID) - Events" },
  { regionId: "newcastle", url: "https://www.getintonewcastle.co.uk/ne1-events", kind: "web", label: "Get into Newcastle - NE1 Events" },
  { regionId: "newcastle", url: "https://www.newcastle-racecourse.co.uk/whats-on", kind: "web", label: "Newcastle Racecourse - What's On" },
  { regionId: "newcastle", url: "https://www.utilitaarena.co.uk/events", kind: "web", label: "Utilita Arena Newcastle - Events" },
  { regionId: "newcastle", url: "https://www.ncl.ac.uk/university-events/all-events/", kind: "web", label: "Newcastle University - All Events" },
  { regionId: "newcastle", url: "https://www.ncl.ac.uk/university-events/public-lectures/upcoming-lectures/", kind: "web", label: "Newcastle University - Upcoming INSIGHTS Public Lectures" },

  // norwich, 20 pages
  { regionId: "norwich", url: "https://www.norwich.gov.uk/events/this_week", kind: "web", label: "Norwich City Council - Events this week" },
  { regionId: "norwich", url: "https://www.norwich.gov.uk/homepage/406/city_events_calendar", kind: "web", label: "Norwich City Council - City events calendar" },
  { regionId: "norwich", url: "https://www.norwich.gov.uk/thehalls/whats", kind: "web", label: "The Halls Norwich - What's on" },
  { regionId: "norwich", url: "https://www.norwich.gov.uk/culture-and-events", kind: "web", label: "Norwich City Council - Culture and events" },
  { regionId: "norwich", url: "https://norwichartscentre.co.uk/whats-on/", kind: "web", label: "Norwich Arts Centre - What's On" },
  { regionId: "norwich", url: "https://www.visitnorwich.co.uk/whats-on/", kind: "web", label: "Visit Norwich - What's On" },
  { regionId: "norwich", url: "https://visitnorfolk.co.uk/events", kind: "web", label: "Visit Norfolk - Events" },
  { regionId: "norwich", url: "https://norfolk-museums.arttickets.org.uk/norwich-castle-museum-art-gallery", kind: "web", label: "Norwich Castle Museum & Art Gallery - tickets and events" },
  { regionId: "norwich", url: "https://www.n-cas.org.uk/exhibitions", kind: "web", label: "Norfolk Contemporary Art Society - Exhibitions" },
  { regionId: "norwich", url: "https://www.eastangliaartfund.org.uk/exhibitions/current-exhibitions", kind: "web", label: "East Anglia Art Fund - Current exhibitions" },
  { regionId: "norwich", url: "https://nnfestival.org.uk/whats-on/", kind: "web", label: "Norfolk & Norwich Festival - What's on" },
  { regionId: "norwich", url: "https://sainsburycentre.ac.uk/", kind: "web", label: "Sainsbury Centre (UEA Norwich) - Events & Exhibitions" },
  { regionId: "norwich", url: "https://store.uea.ac.uk/conferences-and-events/sainsbury-centre/learning-events", kind: "web", label: "Sainsbury Centre learning events (UEA store)" },
  { regionId: "norwich", url: "https://norwichtheatre.org/whats-on/", kind: "web", label: "Norwich Theatre (Theatre Royal, Playhouse, Stage Two) - What's on" },
  { regionId: "norwich", url: "https://puppettheatre.co.uk/whats-on-2/", kind: "web", label: "Norwich Puppet Theatre - What's On" },
  { regionId: "norwich", url: "https://cathedral.org.uk/whats-on/", kind: "web", label: "Norwich Cathedral - What's On" },
  { regionId: "norwich", url: "https://www.canaries.co.uk/matches/first-team/fixtures", kind: "web", label: "Norwich City FC - First team fixtures" },
  { regionId: "norwich", url: "https://theforumnorwich.co.uk/whats-on", kind: "web", label: "The Forum Norwich - What's On" },
  { regionId: "norwich", url: "https://www.ueaticketbookings.co.uk/whats-on/", kind: "web", label: "UEA Norwich Box Office - What's On" },
  { regionId: "norwich", url: "https://www.whitlinghamadventure.org.uk/events/", kind: "web", label: "Whitlingham Adventure (Whitlingham Country Park) - Family Events" },

  // nottingham, 20 pages
  { regionId: "nottingham", url: "https://www.nottinghamcity.gov.uk/leisure-and-culture/arts-culture-and-events/", kind: "web", label: "Nottingham City Council - Arts, Culture and Events" },
  { regionId: "nottingham", url: "https://www.nottinghamshire.gov.uk/events", kind: "web", label: "Nottinghamshire County Council - Events" },
  { regionId: "nottingham", url: "https://www.visit-nottinghamshire.co.uk/whats-on", kind: "web", label: "Visit Nottinghamshire - What's On" },
  { regionId: "nottingham", url: "https://leftlion.co.uk/events/", kind: "web", label: "LeftLion Nottingham - Events" },
  { regionId: "nottingham", url: "https://www.trch.co.uk/whats-on", kind: "web", label: "Theatre Royal & Royal Concert Hall - What's On" },
  { regionId: "nottingham", url: "https://nottinghamplayhouse.co.uk/whats-on/", kind: "web", label: "Nottingham Playhouse - What's On" },
  { regionId: "nottingham", url: "https://www.lakesidearts.org.uk/whats-on/", kind: "web", label: "Lakeside Arts - What's On" },
  { regionId: "nottingham", url: "https://www.nottinghamcontemporary.org/whats-on/", kind: "web", label: "Nottingham Contemporary - What's On" },
  { regionId: "nottingham", url: "https://www.broadway.org.uk/whats-on/filtered", kind: "web", label: "Broadway Cinema Nottingham - What's On" },
  { regionId: "nottingham", url: "https://www.nationaljusticemuseum.org.uk/museum/whats-on", kind: "web", label: "National Justice Museum - What's On" },
  { regionId: "nottingham", url: "https://wollatonhall.org.uk/category/events/", kind: "web", label: "Wollaton Hall - Events" },
  { regionId: "nottingham", url: "https://www.nottinghamcastle.org.uk/", kind: "web", label: "Nottingham Castle" },
  { regionId: "nottingham", url: "https://nottinghamindustrialmuseum.org.uk/", kind: "web", label: "Nottingham Industrial Museum" },
  { regionId: "nottingham", url: "https://rock-city.co.uk/gig-guide/", kind: "web", label: "Rock City Nottingham - Gig Guide" },
  { regionId: "nottingham", url: "https://www.motorpointarenanottingham.com/whats-on/", kind: "web", label: "Motorpoint Arena Nottingham - What's On" },
  { regionId: "nottingham", url: "https://www.thejockeyclub.co.uk/nottingham/events-tickets/", kind: "web", label: "Nottingham Racecourse - Races, Events & Fixtures" },
  { regionId: "nottingham", url: "https://www.trentbridge.co.uk/cricket/first-xi-fixtures/home.html", kind: "web", label: "Trent Bridge - Fixtures & Results" },
  { regionId: "nottingham", url: "https://www.nottingham.ac.uk/events/events.aspx", kind: "web", label: "University of Nottingham - Events" },
  { regionId: "nottingham", url: "https://www.ntu.ac.uk/about-us/events/upcoming-events", kind: "web", label: "Nottingham Trent University - Upcoming Events" },
  { regionId: "nottingham", url: "https://www.facebook.com/WhatsOnNottingham/", kind: "facebook", label: "What's On Nottingham (Facebook)" },

  // plymouth, 20 pages
  { regionId: "plymouth", url: "https://www.plymouth.gov.uk/whats", kind: "web", label: "Plymouth City Council - What's on" },
  { regionId: "plymouth", url: "https://www.plymouth.gov.uk/events-list", kind: "web", label: "Plymouth City Council - Events list" },
  { regionId: "plymouth", url: "https://www.plymouth.gov.uk/activities-and-events-libraries", kind: "web", label: "Plymouth libraries - activities and events" },
  { regionId: "plymouth", url: "https://library.plymouth.gov.uk/-/activities-and-events", kind: "web", label: "Plymouth Libraries events calendar" },
  { regionId: "plymouth", url: "https://www.visitplymouth.co.uk/whats-on/events", kind: "web", label: "Visit Plymouth events calendar" },
  { regionId: "plymouth", url: "https://www.visitplymouth.co.uk/whats-on/major-events", kind: "web", label: "Visit Plymouth headline events" },
  { regionId: "plymouth", url: "https://www.visitplymouth.co.uk/whats-on/events/community", kind: "web", label: "Visit Plymouth community events" },
  { regionId: "plymouth", url: "https://www.visitplymouth.co.uk/whats-on/events/music-and-dance", kind: "web", label: "Visit Plymouth music, gigs and concerts" },
  { regionId: "plymouth", url: "https://theatreroyal.com/whats-on/", kind: "web", label: "Theatre Royal Plymouth - What's On" },
  { regionId: "plymouth", url: "https://theatreroyal.com/whats-on-today/", kind: "web", label: "Theatre Royal Plymouth - What's on today" },
  { regionId: "plymouth", url: "https://www.theboxplymouth.com/whats-on", kind: "web", label: "The Box Plymouth - What's On" },
  { regionId: "plymouth", url: "https://www.theboxplymouth.com/events/special-events", kind: "web", label: "The Box Plymouth - Special events" },
  { regionId: "plymouth", url: "https://plymouthpavilions.com/whats_on/", kind: "web", label: "Plymouth Pavilions - What's On" },
  { regionId: "plymouth", url: "https://www.barbicantheatre.co.uk/whats-on", kind: "web", label: "Barbican Theatre Plymouth - What's On" },
  { regionId: "plymouth", url: "https://www.plymouth.ac.uk/whats-on/public-events", kind: "web", label: "University of Plymouth public events" },
  { regionId: "plymouth", url: "https://www.marjon.ac.uk/about-marjon/news-and-events/university-events/calendar/", kind: "web", label: "Plymouth Marjon University events calendar" },
  { regionId: "plymouth", url: "https://plymouthalbion.com/fixtures/", kind: "web", label: "Plymouth Albion RFC fixtures" },
  { regionId: "plymouth", url: "https://royalwilliamyard.com/whats-on", kind: "web", label: "Royal William Yard - What's On" },
  { regionId: "plymouth", url: "https://www.national-aquarium.co.uk/experiences-events/", kind: "web", label: "National Marine Aquarium Plymouth - Experiences & Events" },
  { regionId: "plymouth", url: "https://oneplymouth.co.uk/whats-on-in-plymouth/", kind: "web", label: "One Plymouth - What's on in Plymouth" },

  // portsmouth, 23 pages
  { regionId: "portsmouth", url: "https://www.portsmouth.gov.uk/events/", kind: "web", label: "Portsmouth City Council - Events" },
  { regionId: "portsmouth", url: "https://www.portsmouth.gov.uk/services/leisure/beach-and-seafront/events-on-the-seafront/", kind: "web", label: "Portsmouth Council - Events on the seafront" },
  { regionId: "portsmouth", url: "https://www.kingsportsmouth.co.uk/whats-on/", kind: "web", label: "Kings Theatre Portsmouth - What's On" },
  { regionId: "portsmouth", url: "https://www.portsmouthguildhall.org.uk/whats-on/", kind: "web", label: "Portsmouth Guildhall - What's On" },
  { regionId: "portsmouth", url: "https://www.groundlings.co.uk/", kind: "web", label: "Groundlings Theatre Portsmouth" },
  { regionId: "portsmouth", url: "https://www.wedgewood-rooms.co.uk/", kind: "web", label: "The Wedgewood Rooms, Southsea - Listings" },
  { regionId: "portsmouth", url: "https://www.royalnavymuseums.org.uk/visit-us/portsmouth-historic-dockyard/whats-on", kind: "web", label: "Portsmouth Historic Dockyard - What's On" },
  { regionId: "portsmouth", url: "https://www.nmrn.org.uk/events/stargazing-portsmouth-historic-dockyard", kind: "web", label: "National Museum of the Royal Navy - events" },
  { regionId: "portsmouth", url: "https://maryrose.org/whats-on/", kind: "web", label: "Mary Rose Museum - What's On" },
  { regionId: "portsmouth", url: "https://portsmouthmuseums.co.uk/what-to-see-do/events/", kind: "web", label: "Portsmouth Museums - Events" },
  { regionId: "portsmouth", url: "https://spinnakertower.co.uk/plan-your-visit/whats-on/", kind: "web", label: "Spinnaker Tower - What's On" },
  { regionId: "portsmouth", url: "https://www.visitportsmouth.co.uk/whats-on/", kind: "web", label: "Visit Portsmouth - What's On" },
  { regionId: "portsmouth", url: "https://www.visitportsmouth.co.uk/whats-on/festivals/", kind: "web", label: "Visit Portsmouth - Festivals" },
  { regionId: "portsmouth", url: "https://www.visitportsmouth.co.uk/whats-on/theatre/", kind: "web", label: "Visit Portsmouth - Theatre listings" },
  { regionId: "portsmouth", url: "https://www.portsmouth.co.uk/whats-on", kind: "web", label: "The News (Portsmouth) - What's On" },
  { regionId: "portsmouth", url: "https://www.portsmouth.co.uk/whats-on/things-to-do", kind: "web", label: "The News - Things To Do" },
  { regionId: "portsmouth", url: "https://www.port.ac.uk/news-events-and-blogs/events", kind: "web", label: "University of Portsmouth - Events" },
  { regionId: "portsmouth", url: "https://www.portsmouthcathedral.org.uk/whats-on-at-portsmouth-cathedral", kind: "web", label: "Portsmouth Cathedral - What's On" },
  { regionId: "portsmouth", url: "https://www.portsmouthfc.co.uk/tickets/", kind: "web", label: "Portsmouth FC - Tickets and fixtures" },
  { regionId: "portsmouth", url: "https://www.visit-hampshire.co.uk/whats-on/events/events-in-portsmouth", kind: "web", label: "Visit Hampshire - Events in Portsmouth" },
  { regionId: "portsmouth", url: "https://www.facebook.com/lovesouthseauk/", kind: "facebook", label: "Love Southsea (Facebook)" },
  { regionId: "portsmouth", url: "https://www.facebook.com/SouthseaFoodFestival/", kind: "facebook", label: "Southsea Food Festival (Facebook)" },
  { regionId: "portsmouth", url: "https://www.facebook.com/Liveinsouthsea/", kind: "facebook", label: "Live Music in Southsea (Facebook)" },

  // southampton, 20 pages
  { regionId: "southampton", url: "https://www.southampton.gov.uk/news/events/", kind: "web", label: "Southampton City Council - Events" },
  { regionId: "southampton", url: "https://www.southampton.gov.uk/communities/community-events/", kind: "web", label: "Southampton City Council - Community events" },
  { regionId: "southampton", url: "https://www.southampton.gov.uk/culture-leisure-tourism/parks-open-spaces/park-activities/", kind: "web", label: "Southampton parks - Park activities" },
  { regionId: "southampton", url: "https://www.visitsouthampton.co.uk/events/", kind: "web", label: "Visit Southampton - Events" },
  { regionId: "southampton", url: "https://www.visitsouthampton.co.uk/events/theatre-culture/", kind: "web", label: "Visit Southampton - Theatre & Culture" },
  { regionId: "southampton", url: "https://www.visitsouthampton.co.uk/events/live-music/", kind: "web", label: "Visit Southampton - Gigs & Live Music" },
  { regionId: "southampton", url: "https://www.visitsouthampton.co.uk/events/sports/", kind: "web", label: "Visit Southampton - Sporting events" },
  { regionId: "southampton", url: "https://www.visit-hampshire.co.uk/whats-on/events/events-in-southampton", kind: "web", label: "Visit Hampshire - Events in Southampton" },
  { regionId: "southampton", url: "https://godshousetower.org.uk/whats-on/", kind: "web", label: "God's House Tower - What's On" },
  { regionId: "southampton", url: "https://godshousetower.org.uk/exhibitions/", kind: "web", label: "God's House Tower - Exhibitions" },
  { regionId: "southampton", url: "https://www.turnersims.co.uk/whats-on/", kind: "web", label: "Turner Sims Concert Hall - What's On" },
  { regionId: "southampton", url: "https://www.mayflower.org.uk/whats-on/", kind: "web", label: "Mayflower Theatre - What's On" },
  { regionId: "southampton", url: "https://seacitymuseum.co.uk/whats-on/", kind: "web", label: "SeaCity Museum - What's On" },
  { regionId: "southampton", url: "https://seacitymuseum.co.uk/whats-on/events-and-activities/", kind: "web", label: "SeaCity Museum - Events and Activities" },
  { regionId: "southampton", url: "https://tudorhouseandgarden.com/whats-on/", kind: "web", label: "Tudor House & Garden - What's On" },
  { regionId: "southampton", url: "https://joiners.vticket.co.uk/page.php?xPage=upcoming.html", kind: "web", label: "The Joiners - Upcoming gigs" },
  { regionId: "southampton", url: "https://centralhall.org.uk/future-events-at-central-hall-southampton/", kind: "web", label: "Central Hall Southampton - Future events" },
  { regionId: "southampton", url: "https://www.southampton.ac.uk/music/news/events/latest.page", kind: "web", label: "University of Southampton Music - Events" },
  { regionId: "southampton", url: "https://www.facebook.com/SouthamptonCommonForum/events", kind: "facebook", label: "Southampton Common Forum (Facebook events)" },
  { regionId: "southampton", url: "https://www.facebook.com/SeaCityMuseum/", kind: "facebook", label: "SeaCity Museum (Facebook page)" },

    { regionId: "wolverhampton", url: "https://www.wolverhampton.gov.uk/whats-on", kind: "web", label: "Wolverhampton City Council Events" }, // Official council page listing upcoming events in Wolverhampton, providing a comprehensive and regularly updated schedule.
  { regionId: "wolverhampton", url: "https://www.wolverhamptonart.org.uk/whats-on", kind: "web", label: "Wolverhampton Art Gallery Events" }, // Gallery's events page detailing exhibitions and activities, updated regularly to reflect current and upcoming events.
  { regionId: "wolverhampton", url: "https://www.wolverhampton-racecourse.co.uk/whats-on", kind: "web", label: "Wolverhampton Racecourse Events" }, // Racecourse's official page listing upcoming racing events and other activities, with dates extending into the future.
  { regionId: "wolverhampton", url: "https://www.wolverhamptonmusicservice.org.uk/whats-on/", kind: "web", label: "Wolverhampton Music Service Events" }, // Music service's events page featuring concerts and performances, updated regularly with new listings.
  { regionId: "huddersfield", url: "https://hellohuddersfield.co.uk/events/huddersfield-huddle-september-2026/", kind: "web", label: "Huddersfield Huddle: September 2026" }, // A monthly networking event for business owners and decision-makers, scheduled for September 17, 2026, at The Light, Kingsgate, Huddersfield. This event is part of a regular series, indicating it will continue listing future events.
  { regionId: "huddersfield", url: "https://hellohuddersfield.co.uk/events/huddersfeast-2026/", kind: "web", label: "HuddersFeast 2026" }, // A food and drink festival returning to Huddersfield Town Centre on August 22-23, 2026, at St Peter’s Gardens. The event is part of a recurring series, suggesting ongoing future listings.
  { regionId: "huddersfield", url: "https://www.organrecitals.uk/venue/huddersfield-town-hall", kind: "web", label: "Huddersfield Town Hall Organ Recitals" }, // A series of organ recitals scheduled through October 2026, indicating a regular event series.
  { regionId: "huddersfield", url: "https://www.whistlestopvalley.co.uk/events-1", kind: "web", label: "Whistlestop Valley Events" }, // A heritage railway offering events like the Steam and Diesel Gala on September 12-13, 2026, with future events likely to be listed.
  { regionId: "huddersfield", url: "https://www.kirklees.gov.uk/beta/events/index.aspx", kind: "web", label: "Kirklees Council Events" }, // The official events page for Kirklees Council, listing various local events and activities.
  { regionId: "huddersfield", url: "https://www.kirklees.gov.uk/beta/whats-on/index.aspx", kind: "web", label: "Kirklees What's On" }, // A comprehensive listing of events happening across the Kirklees district, including Huddersfield.
  { regionId: "doncaster", url: "https://www.visitdoncaster.com/whats-on/", kind: "web", label: "Visit Doncaster" }, // Official tourism website listing a variety of events in Doncaster, including arts, culture, live events, and more, with events scheduled throughout the year.
  { regionId: "doncaster", url: "https://www.doncaster.gov.uk/whatson", kind: "web", label: "City of Doncaster Council Events" }, // Council's events page providing information on various events organized by the council, including exhibitions, workshops, and community activities.
  { regionId: "doncaster", url: "https://www.doncaster.gov.uk/services/libraries/what-s-on-in-libraries", kind: "web", label: "Doncaster Libraries Events" }, // Library events calendar listing a wide range of events and activities held in Doncaster libraries, including reader groups, storytimes, and advice sessions.
  { regionId: "doncaster", url: "https://www.yourlifedoncaster.co.uk/grid/what-s-on", kind: "web", label: "YourLifeDoncaster Events" }, // Platform listing events and activities for young people in Doncaster, including support groups, sports clubs, and hobby groups.
  { regionId: "sunderland", url: "https://www.sunderland.gov.uk/article/17605/Events", kind: "web", label: "Sunderland City Council Events" }, // Official council page listing various events throughout the year.
  { regionId: "sunderland", url: "https://www.sunderlandculture.org.uk/whats-on/", kind: "web", label: "Sunderland Culture What's On" }, // Comprehensive listings of cultural events, exhibitions, and performances in Sunderland.
  { regionId: "sunderland", url: "https://www.sunderlandinformationpoint.co.uk/whatson", kind: "web", label: "Sunderland Information Point What's On" }, // Community-driven calendar of activities and events in and around Sunderland.
  { regionId: "sunderland", url: "https://www.sunderlandlibraries.co.uk/events", kind: "web", label: "Sunderland Libraries Events" }, // Regularly updated listings of events and activities hosted by Sunderland's libraries.
  { regionId: "sunderland", url: "https://www.whatsoninsunderland.com/", kind: "web", label: "What's On in Sunderland" }, // Local guide featuring upcoming events, attractions, and activities in Sunderland.
  { regionId: "sunderland", url: "https://thebotanist.uk.com/locations/sunderland/whats-on", kind: "web", label: "The Botanist Sunderland Events" }, // Venue-specific listings of live music, happy hours, and other events at The Botanist in Sunderland.
  { regionId: "sunderland", url: "https://www.sunderland.gov.uk/article/25597/Council-refreshes-its-approach-to-events?ccp=true", kind: "web", label: "Sunderland City Council Events Strategy" }, // Council's initiative to refresh and expand its annual events program, indicating ongoing and future events.
  { regionId: "sunderland", url: "https://www.sunderlandculture.org.uk/bright-lights-2026/", kind: "web", label: "Bright Lights Youth Arts Festival 2026" }, // Annual festival celebrating youth talent with workshops and special events, indicating recurring annual event.
  { regionId: "luton", url: "https://www.luton.gov.uk/leisure-parks-culture/Pages/Events.aspx", kind: "web", label: "Luton Borough Council Events" }, // Official council page listing various events in Luton, including the 150th anniversary celebrations.
  { regionId: "luton", url: "https://www.culturetrust.com/index.php/whats-on", kind: "web", label: "The Culture Trust Luton" }, // Local arts and culture organization providing a calendar of upcoming events and exhibitions.
  { regionId: "luton", url: "https://www.lutonacl.ac.uk/news-events/inclusive-job-fair-june-2026.html", kind: "web", label: "Luton Adult Learning Events" }, // Page detailing inclusive job fair events and other community activities.
  { regionId: "reading", url: "https://www.visitthames.co.uk/explore/towns-villages/reading/whats-on/", kind: "web", label: "What's On In Reading" }, // Official tourism website listing a variety of upcoming events in Reading, including festivals, guided tours, and cultural activities.
  { regionId: "milton-keynes", url: "https://www.milton-keynes.gov.uk/libraries/library-events/event-activity-info", kind: "web", label: "Milton Keynes City Council Library Events" }, // This page provides a schedule of regular events across the libraries, including new and upcoming events, children's summer activities, and both bookable and non-bookable activities. It is a standing listings page that will continue to list different events in the coming months.
  { regionId: "milton-keynes", url: "https://www.milton-keynes.gov.uk/events/search", kind: "web", label: "Milton Keynes City Council Events Search" }, // This page allows users to search for events by date, location, and audience, providing a comprehensive list of upcoming events in Milton Keynes. It is a standing listings page that will continue to list different events in the coming months.
  { regionId: "milton-keynes", url: "https://visitmiltonkeynes.org/event/month/2026-08/", kind: "web", label: "Visit Milton Keynes August 2026 Events" }, // This page lists 42 events happening in Milton Keynes in August 2026, including Mega Fun Play, walking groups, and open mic nights. It is a standing listings page that will continue to list different events in the coming months.
  { regionId: "milton-keynes", url: "https://www.destinationmiltonkeynes.co.uk/whats-on", kind: "web", label: "Destination Milton Keynes What's On" }, // This page offers a comprehensive guide to events and attractions in Milton Keynes, including theatre performances, galleries, museums, and live music concerts. It is a standing listings page that will continue to list different events in the coming months.
  { regionId: "milton-keynes", url: "https://mklife.uk/whats-on.html", kind: "web", label: "MK Life What's On" }, // This page provides a local guide to events and festivals in Milton Keynes, including annual highlights and live, up-to-the-minute listings. It is a standing listings page that will continue to list different events in the coming months.
  { regionId: "milton-keynes", url: "https://www.bletchley.org.uk/whats-on?category=Music+and+entertainment", kind: "web", label: "Bletchley What's On - Music and Entertainment" }, // This page lists upcoming music and entertainment events in Bletchley, including Bands on the Green and the Bletchley Big Street Eat. It is a standing listings page that will continue to list different events in the coming months.
  { regionId: "chester", url: "https://www.chester.gov.uk/whats-on", kind: "web", label: "Chester City Council Events" }, // Official council page listing upcoming events in Chester, providing a comprehensive and regularly updated schedule.
  { regionId: "chester", url: "https://www.chester.ac.uk/about/events", kind: "web", label: "University of Chester Events" }, // University's events page featuring public lectures, workshops, and other events open to the community.
  { regionId: "chester", url: "https://www.chesterzoo.org/whats-on", kind: "web", label: "Chester Zoo Events" }, // Zoo's events page listing various activities and special events throughout the year.
  { regionId: "chester", url: "https://www.chestercathedral.com/whats-on", kind: "web", label: "Chester Cathedral Events" }, // Cathedral's events page detailing services, concerts, and other activities.
  { regionId: "chester", url: "https://www.theliverooms.com/whats-on", kind: "web", label: "The Live Rooms Chester" }, // Live music venue's events page showcasing upcoming concerts and performances.
  { regionId: "chester", url: "https://www.alexanderslive.com/whats-on", kind: "web", label: "Alexander's Live Chester" }, // Music venue's events page featuring live performances and events.
  { regionId: "chester", url: "https://www.chester.ac.uk/whats-on", kind: "web", label: "University of Chester Public Events" }, // University's public events page listing lectures, exhibitions, and other community events.
  { regionId: "truro", url: "https://truro.gov.uk/information/events/", kind: "web", label: "Truro City Council Events" }, // Official city council page listing annual events like Easter Trail, Bandstand Concerts, and New Year's Eve Fireworks.
  { regionId: "truro", url: "https://www.whatsonintruro.com/events/", kind: "web", label: "What’s On In Truro" }, // Comprehensive events calendar featuring live music, family events, art & culture, and more, updated regularly.
  { regionId: "truro", url: "https://www.cornwall365.com/events/locations/truro/", kind: "web", label: "Cornwall 365 Truro Events" }, // Curated list of events in Truro, including festivals, live music, exhibitions, and theatre shows.
  { regionId: "truro", url: "https://www.trurochamberofcommerce.com/truro-events/", kind: "web", label: "Truro Chamber of Commerce Events" }, // Events calendar from the local Chamber of Commerce, featuring community events and local business happenings.
  { regionId: "truro", url: "https://www.truropubliclibrary.org/calendar.aspx?CID=23", kind: "web", label: "Truro Public Library Calendar" }, // Library events calendar featuring community events, workshops, and educational programs.
  { regionId: "truro", url: "https://www.truro.gov.uk/information/events/", kind: "web", label: "Truro City Council Events" }, // Official city council page listing annual events like Easter Trail, Bandstand Concerts, and New Year's Eve Fireworks.
  { regionId: "carlisle", url: "https://www.discovercarlisle.co.uk/events/summer-international-market-2/", kind: "web", label: "Summer International Market" }, // A recurring annual event in Carlisle city centre, featuring a variety of international stalls and activities, scheduled for August 27–31, 2026.
  { regionId: "carlisle", url: "https://www.discovercarlisle.co.uk/events/valais-blacknose-beauties-national-show-and-sale/", kind: "web", label: "Valais Blacknose Beauties National Show and Sale" }, // A two-day event celebrating the Valais Blacknose sheep, including official sheep grading, showing, and a national sale, taking place on August 21–22, 2026.
  { regionId: "carlisle", url: "https://www.thebrickyardonline.com/event/crypta-plus-support-tbc/", kind: "web", label: "Crypta plus Void Below" }, // A live music event featuring Crypta and support act Void Below, scheduled for August 11, 2026, at The Brickyard in Carlisle.
  { regionId: "carlisle", url: "https://www.thebrickyardonline.com/event/waterlines-iridium-co-headline-show/", kind: "web", label: "Waterlines & Iridium Co-Headline Show" }, // A live music event featuring Waterlines and Iridium, with support from Eversio and Knuckleduster, taking place on September 4, 2026, at The Brickyard in Carlisle.
  { regionId: "carlisle", url: "https://www.amplifycarlisle.co.uk/", kind: "web", label: "Amplify Carlisle" }, // A platform listing upcoming gigs, club nights, and comedy events in Carlisle, including the Waterlines & Iridium co-headline show on September 4, 2026.
  { regionId: "durham", url: "https://www.durhamcathedral.co.uk/calendar", kind: "web", label: "Durham Cathedral Calendar" }, // A comprehensive calendar of events at Durham Cathedral, including services, tours, and exhibitions, with listings extending into December 2026.
  { regionId: "durham", url: "https://www.thisisdurham.com/whats-on", kind: "web", label: "This is Durham - What's On" }, // A guide to events and festivals in Durham, featuring live music, theatre, cultural events, and family-friendly activities, with listings for 2026.
  { regionId: "durham", url: "https://www.visitcountydurham.org/eventscalendar/", kind: "web", label: "Visit County Durham Events Calendar" }, // An archive of events in County Durham, including festivals, exhibitions, and seasonal celebrations, with listings for 2026.
  { regionId: "durham", url: "https://www.thisisdurham.com/whats-on/whats-on-this-weekend", kind: "web", label: "This is Durham - What's On This Weekend" }, // A weekly guide to events happening in Durham, including festivals, exhibitions, and local markets, with listings for 2026.
  { regionId: "durham", url: "https://durham.ac.uk/things-to-do/whats-on/events-calendar/?month=08&search=month&year=2025", kind: "web", label: "Durham University Events Calendar" }, // A calendar of events at Durham University, including exhibitions and public lectures, with listings for 2025.
  { regionId: "chelmsford", url: "https://citylife.chelmsford.gov.uk/whats-on", kind: "web", label: "Chelmsford City Council What's On" }, // Official events page listing various activities and events happening in Chelmsford, updated regularly.
  { regionId: "chelmsford", url: "https://www.chelmsford.gov.uk/parks-and-allotments/events-in-our-parks/", kind: "web", label: "Chelmsford Parks Events" }, // Details on events held in Chelmsford's parks, including outdoor fitness sessions and park hire information.
  { regionId: "chelmsford", url: "https://www.chelmsfordtheatre.co.uk/events", kind: "web", label: "Chelmsford Theatre Events" }, // Comprehensive listings of upcoming shows, comedy, music, and more at Chelmsford Theatre.
  { regionId: "chelmsford", url: "https://www.chelmsfordtheatre.co.uk/events?from=2026-12-01&to=2026-12-31", kind: "web", label: "Chelmsford Theatre December 2026 Events" }, // Specific event listings for December 2026 at Chelmsford Theatre.
  { regionId: "southend", url: "https://www.southend.gov.uk/events", kind: "web", label: "Southend-on-Sea City Council Events" }, // Official council page listing upcoming events in Southend-on-Sea, including festivals and community attractions.
  { regionId: "southend", url: "https://www.southend.gov.uk/business-1/town-centre-management/2", kind: "web", label: "City Centre Management Events" }, // Council page detailing events managed by the city centre team, such as LuminoCity and City Jam.
  { regionId: "southend", url: "https://www.visitessex.com/explore/coastal-destinations/southend-on-sea/events-southend", kind: "web", label: "Visit Essex - Southend Events" }, // Tourism site listing events in Southend-on-Sea, including festivals and local happenings.
  { regionId: "southend", url: "https://www.southendpier.co.uk/whats-on", kind: "web", label: "Southend Pier & Railway Events" }, // Official page listing events hosted at Southend Pier, such as sailing trips and festivals.
  { regionId: "hereford", url: "https://www.herefordshire.gov.uk/events", kind: "web", label: "Herefordshire Council Events" }, // A comprehensive listing of upcoming events in Herefordshire, including exhibitions, workshops, and festivals, maintained by the local council.
  { regionId: "hereford", url: "https://www.visitherefordshire.co.uk/whats-on/medieval-hereford-festival/82b0aace-bb85-464c-965b-cb50f3e876ea", kind: "web", label: "Medieval Hereford Festival" }, // An annual festival featuring medieval re-enactments, crafts, and entertainment, held in Hereford Cathedral Close.
  { regionId: "hereford", url: "https://www.herefordcitylife.co.uk/experience/whats-on/medieval-hereford-festival-2026", kind: "web", label: "Medieval Hereford Festival 2026" }, // Detailed information about the Medieval Hereford Festival, including schedules and activities, provided by Hereford City Life.
  { regionId: "hereford", url: "https://www.herefordcitylife.co.uk/experience/whats-on/medieval-feast-1", kind: "web", label: "Medieval Feast at Hereford Cathedral" }, // An immersive dining experience with medieval-themed entertainment, part of the Medieval Hereford Festival.
  { regionId: "hereford", url: "https://www.courtyard.org.uk/events/blue-the-amp/", kind: "web", label: "Blue at The Amp" }, // A concert by the band Blue, part of The Courtyard's summer events in Hereford.
  { regionId: "hereford", url: "https://www.courtyard.org.uk/events/elkie-brooks/", kind: "web", label: "Elkie Brooks at The Courtyard" }, // A performance by singer Elkie Brooks, hosted at The Courtyard in Hereford.
  { regionId: "gloucester", url: "https://www.gloucestercivictrust.org/gloucester-history-festival/", kind: "web", label: "Gloucester History Festival" }, // A two-week festival from 5 to 20 September 2026 featuring talks, tours, performances, and family events across 30 venues in Gloucester, with a focus on history and culture.
  { regionId: "gloucester", url: "https://www.gloucesterguildhall.co.uk/events/hundred-watt-club-september-2026/", kind: "web", label: "Hundred Watt Club at Gloucester Guildhall" }, // A vintage-inspired burlesque show scheduled for 4 September 2026 at Gloucester Guildhall, offering a variety of performances including burlesque, comedy, and circus acts.
  { regionId: "gloucester", url: "https://www.gloucestercathedral.org.uk/whats-on/80s-anthems-by-candlelight", kind: "web", label: "80s Anthems By Candlelight Concert at Gloucester Cathedral" }, // A concert featuring 80s rock anthems and pop classics performed live by candlelight at Gloucester Cathedral on 4 September 2026.
  { regionId: "gloucester", url: "https://www.gloucestercathedral.org.uk/whats-on/the-music-of-abba-by-candlelight", kind: "web", label: "The Music of ABBA by Candlelight at Gloucester Cathedral" }, // A live performance of ABBA hits by candlelight at Gloucester Cathedral on 8 August 2026.
  { regionId: "watford", url: "https://www.watford.gov.uk/news/article/141/dates-of-watford-s-big-events", kind: "web", label: "Watford Borough Council Events Calendar" }, // Official council page listing upcoming events in Watford, including festivals, markets, and community activities.
  { regionId: "watford", url: "https://www.watford.gov.uk/news/article/1008/expanded-programme-of-events-for-10th-watford-fringe-festival-with-bandstand-outdoor-theatre-and-jiveswing", kind: "web", label: "Watford Fringe Festival Programme" }, // Detailed schedule of the 10th Watford Fringe Festival, featuring theatre, music, and family entertainment.
  { regionId: "st-albans", url: "https://stalbansbf.org.uk/", kind: "web", label: "St Albans Beer & Cider Festival 2026" }, // Annual festival held at the Alban Arena from 23rd to 26th September 2026, featuring over 300 cask ales, craft beers, international brews, ciders, and perries, along with live music and food stalls.
  { regionId: "st-albans", url: "https://www.stalbanscathedral.org/event/bruce-springsteen-by-candlelight", kind: "web", label: "Bruce Springsteen by Candlelight at St Albans Cathedral" }, // Event on 20th August 2026 at 7:30pm, offering a live performance of Bruce Springsteen's greatest hits by candlelight.
  { regionId: "st-albans", url: "https://www.thehorn.co.uk/full-listings/bleak-house", kind: "web", label: "Bleak House at The Horn" }, // Concert on 5th September 2026 at 8:00pm, featuring the St Albans NWOBHM band Bleak House, returning after 45 years.
  { regionId: "st-albans", url: "https://stalbans.thewearecommunity.co.uk/events", kind: "web", label: "Local Events in St Albans" }, // Comprehensive listings of upcoming events in St Albans, including markets, concerts, and community activities.
  { regionId: "st-albans", url: "https://stalbansbf.org.uk/events", kind: "web", label: "Special Events at St Albans Beer & Cider Festival 2026" }, // Details of special events during the festival, including tutored tastings, beer and food matching courses, and live music performances.
  { regionId: "newport-iow", url: "https://newportcarnival.com/whats-on/", kind: "web", label: "Newport Carnival's What's On" }, // Lists annual events like the Main Procession, Illuminated Procession, and Riverfest, indicating a standing listings page.
  { regionId: "newport-iow", url: "https://www.quayarts.org/events/", kind: "web", label: "Quay Arts Events" }, // Offers a variety of events including workshops, exhibitions, and performances, suggesting a regularly updated listings page.
  { regionId: "newport-iow", url: "https://www.iow.guide/towns/newport", kind: "web", label: "IOW Guide: Newport" }, // Provides a comprehensive list of live events and local listings in Newport, updated as organizers publish.
  { regionId: "newport-iow", url: "https://www.iow.guide/next-two-days", kind: "web", label: "IOW Guide: Next 7 Days" }, // Features a chronological feed of upcoming events across the Isle of Wight, including Newport.
  { regionId: "newport-iow", url: "https://www.isleofwight.co.uk/whats-on/", kind: "web", label: "Isle of Wight: What's On Guide" }, // Offers an updated guide to events across the Isle of Wight, including Newport, suitable for all ages and interests.
  { regionId: "newport-iow", url: "https://www.islefindit.org.uk/event/event-calendar", kind: "web", label: "Islefindit: Event Calendar" }, // Lists local events ranging from activities, car boot sales, carnivals, and more, with a filterable search function.
  { regionId: "newport-iow", url: "https://www.waverleyinn.co.uk/events", kind: "web", label: "The Waverley Inn Events" }, // Lists events at The Waverley Inn in Carisbrooke, Newport, indicating a standing listings page.
  { regionId: "canterbury", url: "https://www.canterbury.co.uk/see-and-do/find-events/", kind: "web", label: "Visit Canterbury Events" }, // Official tourism website listing ongoing and upcoming events in Canterbury, updated regularly.
  { regionId: "canterbury", url: "https://www.canterbury-cathedral.org/whats-on/events/", kind: "web", label: "Canterbury Cathedral Events" }, // Official cathedral website featuring a calendar of services, talks, tours, exhibitions, and more.
  { regionId: "canterbury", url: "https://www.canterbury.co.uk/see-and-do/search-for-things-to-do/", kind: "web", label: "Canterbury Attractions" }, // Comprehensive guide to local attractions, including museums, galleries, and heritage sites.
  { regionId: "maidstone", url: "https://www.visitmaidstone.com/whats-on/events-calendar", kind: "web", label: "Visit Maidstone Events Calendar" }, // Comprehensive listing of upcoming events in Maidstone, maintained by the local tourism board.
  { regionId: "maidstone", url: "https://maidstone.gov.uk/home/other-services/events/events-calendar", kind: "web", label: "Maidstone Borough Council Events Calendar" }, // Official events calendar provided by the local council, featuring a variety of community events.
  { regionId: "maidstone", url: "https://maidstone.gov.uk/home/other-services/events/events-in-mote-park", kind: "web", label: "Events in Mote Park" }, // Details of large events held in Mote Park, a central venue in Maidstone.
  { regionId: "maidstone", url: "https://www.visitmaidstone.com/whats-on/maidstone-litfest", kind: "web", label: "Maidstone Literature Festival" }, // Details of the annual literature festival, including dates and participating authors.
  { regionId: "blackpool", url: "https://www.blackpool.gov.uk/Residents/Leisure-and-culture/Events/Whats-on-in-Blackpool.aspx", kind: "web", label: "Blackpool Council Events" }, // Official council page listing upcoming events in Blackpool, ensuring a comprehensive and up-to-date schedule.
  { regionId: "blackpool", url: "https://www.visitblackpool.com/whats-on/", kind: "web", label: "Visit Blackpool Events" }, // Tourism board's 'What's On' page featuring a variety of events, including festivals, shows, and exhibitions.
  { regionId: "blackpool", url: "https://www.blackpooltheatres.com/whats-on", kind: "web", label: "Blackpool Theatres" }, // Listings of performances and shows at Blackpool's theatres, updated regularly to reflect upcoming events.
  { regionId: "blackpool", url: "https://www.blackpoolmuseums.com/whats-on", kind: "web", label: "Blackpool Museums" }, // Museums' events page detailing exhibitions, workshops, and special events throughout the year.
  { regionId: "blackpool", url: "https://www.blackpoolgrand.co.uk/whats-on", kind: "web", label: "Blackpool Grand Theatre" }, // Theatre's 'What's On' page showcasing a range of performances, from plays to concerts, with dates extending months ahead.
  { regionId: "blackpool", url: "https://www.visitblackpool.com/whats-on/world-fireworks-championship-blackpool/", kind: "web", label: "World Fireworks Championship Blackpool" }, // Annual event page detailing dates and information about the fireworks championship, a major attraction in Blackpool.
  { regionId: "blackpool", url: "https://www.blackpoolwintergardens.co.uk/whats-on", kind: "web", label: "Blackpool Winter Gardens" }, // Venue's events page listing concerts, festivals, and other events scheduled throughout the year.
  { regionId: "blackpool", url: "https://www.blackpoolopera.co.uk/whats-on", kind: "web", label: "Blackpool Opera House" }, // Opera house's 'What's On' page featuring upcoming performances and events.
  { regionId: "blackpool", url: "https://www.blackpoolairshow.com/", kind: "web", label: "Blackpool Air Show" }, // Official page for the annual air show, providing dates and details about the event.
  { regionId: "leicester", url: "https://www.leicester.gov.uk/culture-and-sport/festivals-and-events", kind: "web", label: "Leicester City Council Festivals and Events" }, // Official council page listing a wide range of festivals and events throughout the year, including major public events such as Diwali, Caribbean Carnival, Riverside Festival, Old Town Festival, and Christmas in Leicester.
  { regionId: "leicester", url: "https://visitleicester.info/whats-on/festivals/", kind: "web", label: "Visit Leicester Festivals" }, // Tourism board's page detailing Leicester's diverse festival calendar, including the Comedy Festival, Leicester Pride Festival, and Diwali celebrations.
  { regionId: "leicester", url: "https://visitleicester.info/event/the-desi-central-comedy-show/", kind: "web", label: "The Desi Central Comedy Show" }, // Event listing for a comedy show at The Y Theatre on 4th October, part of Leicester's cultural offerings.
  { regionId: "leicester", url: "https://www.leicester.gov.uk/culture-and-sport/festivals-and-events/get-involved-festival", kind: "web", label: "Get Involved in Leicester's Festivals" }, // Council page providing information on how to participate in Leicester's festivals, including opportunities for traders and sponsors.
  { regionId: "harrogate", url: "https://www.harrogate.gov.uk/whats-on", kind: "web", label: "Harrogate Borough Council Events" }, // Official council page listing upcoming events in Harrogate.
  { regionId: "harrogate", url: "https://www.harrogatecivicsociety.org/upcoming-events", kind: "web", label: "Harrogate Civic Society Events" }, // Local society's page detailing upcoming talks and events.
  { regionId: "harrogate", url: "https://www.harrogatecivicsociety.org/hods/the-civic-centre", kind: "web", label: "Harrogate Civic Society Heritage Open Days" }, // Page listing events during Heritage Open Days, including tours of the Civic Centre.
  { regionId: "york", url: "https://www.york.gov.uk/whats-on", kind: "web", label: "City of York Council What's On" }, // Official council page listing upcoming events in York, regularly updated with new events.
  { regionId: "york", url: "https://www.visityork.org/whats-on", kind: "web", label: "Visit York What's On" }, // Tourism board's comprehensive events calendar for York, featuring a wide range of activities and events.
  { regionId: "york", url: "https://www.york.ac.uk/events/", kind: "web", label: "University of York Events" }, // University's public events and lectures calendar, including talks, exhibitions, and performances.
  { regionId: "york", url: "https://www.yorktheatreroyal.co.uk/whats-on", kind: "web", label: "York Theatre Royal What's On" }, // Listings of upcoming performances and events at York Theatre Royal, updated regularly.
  { regionId: "york", url: "https://www.yorkmuseums.org.uk/whats-on/", kind: "web", label: "York Museums Trust Events" }, // Combined events calendar for York's museums, including exhibitions and special events.
  { regionId: "york", url: "https://www.yorkshiremuseum.org.uk/whats-on/", kind: "web", label: "Yorkshire Museum What's On" }, // Museum's events page featuring exhibitions, talks, and workshops.
  { regionId: "york", url: "https://www.jorvikvikingcentre.co.uk/whats-on/", kind: "web", label: "Jorvik Viking Centre Events" }, // Viking centre's events page listing upcoming activities and exhibitions.
  { regionId: "york", url: "https://www.yorkartgallery.org.uk/whats-on/", kind: "web", label: "York Art Gallery Events" }, // Gallery's events page listing exhibitions, workshops, and talks.


  // --------------------------------------------------------------------------
  // NATIONAL SWEEP, 2026-08-19: the rest of the country.
  //
  // Sixteen discovery batches run concurrently, partitioned by
  // LOCALSCAN_DISCOVER_OFFSET so no two researched the same town. 385 towns
  // were searched and 82 of them produced anything at all, which is the
  // honest hit rate for this: a lot of small British towns have no indexed
  // page that lists their events, and the job correctly returns nothing rather
  // than inventing something.
  //
  // Nothing was filtered out of this block on arrival, which is the point of
  // where the rules now live: EXCLUDED_HOSTS, isNotAStandingPage() and the
  // per-host cap run inside localscan-discover.js at validation time, so
  // aggregators, PDFs, finished seasons and sitemap slices were never proposed.
  // The batch before this one needed four removed by hand.
  //
  // STILL NOT VERIFIED, same as every block above. No page here has been
  // opened. Each url came back from a real web search with a summary
  // describing event listings, and no run was permitted to construct one.
  // GET /api/diag?lat=..&lng=.. for a town shows which of its pages pay off.

  // stirling, 7 pages
  { regionId: "stirling", url: "https://www.stirlingfestivaltheatre.com/whats-on", kind: "web", label: "Stirling Festival Theatre Events" }, // Listings of performances and events at the Stirling Festival Theatre.
  { regionId: "stirling", url: "https://www.smithmuseum.scot/events/", kind: "web", label: "Stirling Smith Art Gallery & Museum Events" }, // Event calendar for exhibitions and activities at the Stirling Smith Art Gallery & Museum.
  { regionId: "stirling", url: "https://www.historicenvironment.scot/visit/all/stirling-castle/whats-on/", kind: "web", label: "Stirling Castle Events" }, // Upcoming events and exhibitions at Stirling Castle.
  { regionId: "stirling", url: "https://www.whatsonstirling.co.uk/", kind: "web", label: "What's On Stirling" }, // Comprehensive guide to events and activities in Stirling.
  { regionId: "stirling", url: "https://www.macrobartscentre.org.uk/whats-on", kind: "web", label: "Macrobert Arts Centre What's On" }, // Listings of performances, workshops, and exhibitions at the Macrobert Arts Centre.
  { regionId: "stirling", url: "https://www.facebook.com/StirlingCouncil/", kind: "facebook", label: "Stirling Council Facebook Page" }, // Official Facebook page of Stirling Council, featuring event updates.
  { regionId: "stirling", url: "https://www.facebook.com/StirlingSmithMuseum/", kind: "facebook", label: "Stirling Smith Art Gallery & Museum Facebook Page" }, // Official Facebook page of the Stirling Smith Art Gallery & Museum, sharing event information.

  // belfast, 3 pages
  { regionId: "belfast", url: "https://www.belfastcity.gov.uk/events", kind: "web", label: "Belfast City Council Events" }, // Official council page listing a variety of events across Belfast, including festivals, workshops, and community activities, with events scheduled throughout the year.
  { regionId: "belfast", url: "https://visitbelfast.com/whats-on/seasonal/", kind: "web", label: "Visit Belfast Seasonal Events" }, // Tourism board's page highlighting seasonal events in Belfast, featuring festivals, markets, and cultural celebrations, with events planned for different times of the year.
  { regionId: "belfast", url: "https://www.belfastcity.gov.uk/Events?category=97&fromDate=&toDate=", kind: "web", label: "Belfast City Council Business Events" }, // Council's page dedicated to business-related events, including workshops and networking opportunities, with events listed for the coming months.

  // colchester, 3 pages
  { regionId: "colchester", url: "https://www.colchester.gov.uk/museums/whats-on", kind: "web", label: "Colchester Museums What's On" }, // Events calendar for Colchester's museums, including Hollytrees Museum and Colchester Castle, listing upcoming exhibitions and activities.
  { regionId: "colchester", url: "https://www.colchesterartscentre.com/whats-on", kind: "web", label: "Colchester Arts Centre What's On" }, // Events calendar for Colchester Arts Centre, featuring live music, theatre, and other performances.
  { regionId: "colchester", url: "https://www.colchester.ac.uk/events", kind: "web", label: "Colchester Institute Events" }, // Public events and lectures hosted by Colchester Institute, including talks, workshops, and exhibitions.

  // basildon, 4 pages
  { regionId: "basildon", url: "https://www.towngatetheatre.co.uk/", kind: "web", label: "Towngate Theatre" }, // Official website of Basildon's primary theatre, listing upcoming events and performances.
  { regionId: "basildon", url: "https://www.basildon.gov.uk/events", kind: "web", label: "Basildon Borough Council Events" }, // Official council page providing information on local events and activities.
  { regionId: "basildon", url: "https://www.basildonforbusiness.com/news/creative-tech-fest-returns-bigger-bolder-and-packed-with-possibilities/", kind: "web", label: "Creative Tech Fest" }, // Article detailing the annual Creative Tech Fest event in Basildon, including dates and activities.
  { regionId: "basildon", url: "https://www.basildonforbusiness.com/news/basildon-council-thanks-residents-attending-winter-warmer-wellness-day/", kind: "web", label: "Winter Warmer Wellness Day" }, // Article thanking residents for attending the Winter Warmer Wellness Day, with event details and dates.

  // harlow, 5 pages
  { regionId: "harlow", url: "https://www.harlow.gov.uk/events/town-show", kind: "web", label: "Harlow Town Show" }, // A major annual event in Harlow, returning this August Bank Holiday weekend with a supersized programme of family entertainment, live music, and community celebration. The event is free to attend and details are available on the council's official page.
  { regionId: "harlow", url: "https://www.harlow.gov.uk/events-calendar?page=2", kind: "web", label: "Harlow Council Events Calendar" }, // A comprehensive calendar maintained by Harlow Council, listing various community events, including the upcoming Harlow Town Show and other local activities.
  { regionId: "harlow", url: "https://library-events.essex.gov.uk/event?id=353699", kind: "web", label: "Read To The Beat - Musical Instrument Discovery" }, // An event hosted by Essex Libraries, offering children the opportunity to explore various musical instruments. Scheduled for Thursday, 13 August 2026, at Harlow Library.
  { regionId: "harlow", url: "https://library-events.essex.gov.uk/event?id=353597", kind: "web", label: "Harlow Rock School Drum Workshop 3" }, // A drum workshop for children, part of the Summer Reading Challenge 'Read to the Beat'. Scheduled for Thursday, 6 August 2026, at Harlow Library.
  { regionId: "harlow", url: "https://happeningnext.com/event/rock-andamp-roots-festival-eid3a0d72ghnu", kind: "web", label: "Rock & Roots Festival at The Wild Retreat" }, // A unique Western-themed festival featuring country, blues, jazz, soul, and funk music, along with activities like rodeo riding and line dancing. Scheduled for 7th–9th August 2026 at The Wild Retreat, Harlow.

  // clacton-on-sea, 2 pages
  { regionId: "clacton-on-sea", url: "https://www.tendringdc.gov.uk/content/armed-forces-events", kind: "web", label: "Armed Forces Events" }, // Lists annual civic events in Clacton-on-Sea, including services and ceremonies, indicating a standing events page.
  { regionId: "clacton-on-sea", url: "https://www.tendringdc.gov.uk/leisure/visitor-information-centre", kind: "web", label: "Visitor Information Centre" }, // Provides information on local events and attractions, suggesting a standing events page.

  // braintree, 2 pages
  { regionId: "braintree", url: "https://www.braintree.gov.uk/leisure-culture-parks/braintree-weekly-market", kind: "web", label: "Braintree Weekly Market" }, // A traditional market held every Wednesday and Saturday in Braintree town centre, offering local food, drink, gifts, and more. This standing listing provides ongoing details about the market's operations and offerings.
  { regionId: "braintree", url: "https://www.braintree.gov.uk/braintreestreetmarket", kind: "web", label: "Braintree Street Market" }, // A monthly street market featuring local organisations and community groups, with dates scheduled throughout the year. The page lists upcoming market dates and details, serving as a standing listing for future events.

  // oldham, 4 pages
  { regionId: "oldham", url: "https://www.oldham.gov.uk/events", kind: "web", label: "Oldham Council Events" }, // Official council page listing upcoming events in Oldham.
  { regionId: "oldham", url: "https://hla.oldham.gov.uk/whats-on/", kind: "web", label: "Oldham Libraries and Heritage Events" }, // Comprehensive listings of events at Oldham's libraries and heritage sites.
  { regionId: "oldham", url: "https://www.shawandcromptonparishcouncil.co.uk/oldham-whats-on-guide/", kind: "web", label: "Shaw and Crompton Parish Council 'What's On' Guide" }, // Local parish council's guide to events across Oldham.
  { regionId: "oldham", url: "https://www.oldham.gov.uk/news/201256/whats_on_oldham", kind: "web", label: "Oldham Council 'What's On' News" }, // Council's news section featuring upcoming events in Oldham.

  // northampton, 7 pages
  { regionId: "northampton", url: "https://www.northampton.ac.uk/events", kind: "web", label: "University of Northampton Events" }, // University's public events and lectures calendar, featuring a variety of academic and cultural events.
  { regionId: "northampton", url: "https://www.royalandderngate.co.uk/whats-on", kind: "web", label: "Royal & Derngate Theatre Events" }, // Listings of performances and events at Northampton's main theatre, updated regularly.
  { regionId: "northampton", url: "https://www.northamptonmuseumandartgallery.org/whats-on", kind: "web", label: "Northampton Museum & Art Gallery Events" }, // Museum's events page featuring exhibitions, workshops, and talks.
  { regionId: "northampton", url: "https://www.visitnorthampton.co.uk/whats-on", kind: "web", label: "Visit Northampton Events" }, // Tourism board's comprehensive events calendar for the area.
  { regionId: "northampton", url: "https://www.northamptonchron.co.uk/whats-on", kind: "web", label: "Northampton Chronicle & Echo What's On" }, // Local newspaper's events section, covering a wide range of activities.
  { regionId: "northampton", url: "https://www.facebook.com/VisitNorthampton", kind: "facebook", label: "Visit Northampton Facebook Page" }, // Official tourism board's Facebook page, regularly updated with local events.
  { regionId: "northampton", url: "https://www.facebook.com/royalderngate", kind: "facebook", label: "Royal & Derngate Theatre Facebook Page" }, // Theatre's Facebook page with event listings and updates.

  // morpeth, 7 pages
  { regionId: "morpeth", url: "https://morpeth.net/events/morpeth-farmers-market-september-2026", kind: "web", label: "Morpeth Farmers Market" }, // Monthly market held on the first Saturday of each month, listing events for September 2026.
  { regionId: "morpeth", url: "https://www.whaltonvillageshow.com/", kind: "web", label: "Whalton Village Show" }, // Annual village show scheduled for 19 September 2026, featuring various activities and entertainment.
  { regionId: "morpeth", url: "https://morpeth.net/events", kind: "web", label: "Morpeth.net Events" }, // Comprehensive listings of upcoming events in Morpeth and the North East, including Party in the Park Morpeth 2026 on 28 August 2026.
  { regionId: "morpeth", url: "https://www.nationaltrust.org.uk/visit/north-east/wallington/events/a7b89efb-932c-4153-b7b7-7411055676ff", kind: "web", label: "Live Music at Wallington" }, // Live music events at Wallington House and Courtyard, with performances scheduled throughout August and September 2026.
  { regionId: "morpeth", url: "https://www.nwt.org.uk/events?category%5B54%5D=54", kind: "web", label: "Northumberland Wildlife Trust Events" }, // Guided walks and nature events in Northumberland, including those near Morpeth, with dates extending into September 2026.
  { regionId: "morpeth", url: "https://burghaminternationalhorsetrials.ticketsrv.co.uk/tickets/77", kind: "web", label: "Burgham International Horse Trials" }, // Equestrian event held on 1 August 2026 at Burgham Park, Morpeth.
  { regionId: "morpeth", url: "https://www.carevents.com/uk/events/druridge-bay-festival/", kind: "web", label: "Druridge Bay Festival" }, // Festival featuring live music and camping at Druridge Bay Country Park from 10 to 13 September 2026.

  // oxford, 10 pages
  { regionId: "oxford", url: "https://www.oxford.gov.uk/events-oxford/whats-coming-oxford-events", kind: "web", label: "Oxford City Council Events" }, // Official council page listing upcoming events in Oxford, including annual festivals and activities, updated regularly.
  { regionId: "oxford", url: "https://www.obga.ox.ac.uk/whats-on", kind: "web", label: "Oxford Botanic Garden and Arboretum Events" }, // University-run gardens offering a range of events and activities, including family days and seasonal fairs, with listings updated regularly.
  { regionId: "oxford", url: "https://www.glam.ox.ac.uk/whats-on", kind: "web", label: "Gardens, Libraries & Museums What's On" }, // Comprehensive listings of events across Oxford's gardens, libraries, and museums, including family activities and exhibitions, updated regularly.
  { regionId: "oxford", url: "https://events.ox.ac.uk/event-calendar", kind: "web", label: "Oxford University Events Calendar" }, // University-wide calendar featuring a variety of events, including lectures, workshops, and public talks, with listings updated regularly.
  { regionId: "oxford", url: "https://www.hsm.ox.ac.uk/whats-on", kind: "web", label: "History of Science Museum Events" }, // Museum offering talks, workshops, and family-friendly activities, with events updated regularly.
  { regionId: "oxford", url: "https://www.parks.ox.ac.uk/event", kind: "web", label: "University Parks Events" }, // Listings of events held in University Parks, including charity events and open-air entertainment, updated regularly.
  { regionId: "oxford", url: "https://www.csad.ox.ac.uk/events-0", kind: "web", label: "Centre for the Study of Ancient Documents Events" }, // Academic department hosting lectures and seminars, with events updated regularly.
  { regionId: "oxford", url: "https://www.botanic-garden.ox.ac.uk/whats-on?page-364961=0", kind: "web", label: "Oxford Botanic Garden and Arboretum Events" }, // University-run gardens offering a range of events and activities, including family days and seasonal fairs, with listings updated regularly.
  { regionId: "oxford", url: "https://www.paediatrics.ox.ac.uk/upcoming-events", kind: "web", label: "Department of Paediatrics Events" }, // Academic department hosting training courses and seminars, with events updated regularly.
  { regionId: "oxford", url: "https://www.ox.ac.uk/admissions/undergraduate/access-oxford/outreach-events", kind: "web", label: "Oxford University Outreach Events" }, // University-hosted events for prospective students, including higher education fairs and student conferences, with listings updated regularly.

  // oakham, 5 pages
  { regionId: "oakham", url: "https://discoveroakham.co.uk/upcoming-events/", kind: "web", label: "Discover Oakham Events" }, // A comprehensive list of upcoming events in Oakham, including festivals, workshops, and performances, updated regularly.
  { regionId: "oakham", url: "https://oakhamtowncouncil.gov.uk/events/", kind: "web", label: "Oakham Town Council Events" }, // Official events calendar from Oakham Town Council, featuring community events, fairs, and seasonal activities.
  { regionId: "oakham", url: "https://www.achurchnearyou.com/church/10798/service-and-events/events-regular/", kind: "web", label: "All Saints Church Oakham Events" }, // Regular services and special events at All Saints Church, including Holy Communion and Choral Evensong.
  { regionId: "oakham", url: "https://www.artsfortheheartofengland.co.uk/what-s-on", kind: "web", label: "Arts for the Heart of England Events" }, // Listings of cultural events in Oakham, such as concerts and festivals, organized by local arts groups.
  { regionId: "oakham", url: "https://www.rutlandandstamfordsound.co.uk/events/event/the-amber-squad-live-in-oakham/", kind: "web", label: "The Amber Squad Live in Oakham" }, // Event details for The Amber Squad's performance at Victoria Hall, Oakham, including date, time, and ticket information.

  // telford, 7 pages
  { regionId: "telford", url: "https://www.telford.gov.uk/events", kind: "web", label: "Telford & Wrekin Council Events" }, // Official council page listing upcoming events in Telford and Wrekin, including the Telford Balloon Fiesta and other community events.
  { regionId: "telford", url: "https://www.visittelford.co.uk/whats-on", kind: "web", label: "Visit Telford What's On" }, // Tourism board's page featuring a calendar of events in Telford, including festivals, exhibitions, and family activities.
  { regionId: "telford", url: "https://www.tictelford.com/whats-on", kind: "web", label: "Telford International Centre Events" }, // Venue's events page listing conferences, exhibitions, and entertainment events held at the Telford International Centre.
  { regionId: "telford", url: "https://www.malthousepub.co.uk/whats-on", kind: "web", label: "The Malthouse Pub Ironbridge Events" }, // Local pub's events page featuring live music, artisan markets, and community gatherings in Ironbridge.
  { regionId: "telford", url: "https://www.telfordtheatre.com/whats-on", kind: "web", label: "The Place Theatre Telford" }, // Theatre's listings page showcasing upcoming performances, comedy shows, and community events.
  { regionId: "telford", url: "https://www.telford.ac.uk/events", kind: "web", label: "Telford College Public Events" }, // College's events page listing public lectures, workshops, and community events open to the public.
  { regionId: "telford", url: "https://www.telford.ac.uk/whats-on", kind: "web", label: "Telford College What's On" }, // College's events page featuring public lectures, workshops, and community events open to the public.

  // shrewsbury, 4 pages
  { regionId: "shrewsbury", url: "https://www.shrewsburytowncouncil.gov.uk/latest-events/", kind: "web", label: "Shrewsbury Town Council Events" }, // Official events page listing various activities in Shrewsbury, including concerts and charity runs, with dates extending into September 2026.
  { regionId: "shrewsbury", url: "https://www.shropshire.gov.uk/committee-services/mgCalendarAgendaView.aspx?C=127R&CID=127&D=12&DD=2026&M=6&MR=0&OT=R", kind: "web", label: "Shropshire Council Southern Planning Committee Calendar" }, // Public calendar of council meetings, including dates for the Southern Planning Committee, with sessions scheduled through May 2027.
  { regionId: "shrewsbury", url: "https://www.shrewsburytowncouncil.gov.uk/food-festival-fringe-events-at-shrewsbury-market-hall/", kind: "web", label: "Shrewsbury Food Festival Fringe Events" }, // Details of fringe events at Shrewsbury Market Hall supporting the Shrewsbury Food Festival, including gourmet demonstrations and art exhibitions.
  { regionId: "shrewsbury", url: "https://www.shropshire.gov.uk/committee-services/mgCalendarAgendaView.aspx?C=-1&CID=0&DD=2026&M=3&MR=1&OT=", kind: "web", label: "Shropshire Council Calendar" }, // Comprehensive calendar of council meetings and events, including Southern Planning Committee sessions, with dates through May 2027.

  // salisbury, 8 pages
  { regionId: "salisbury", url: "https://www.salisburycitycouncil.gov.uk/whats-on", kind: "web", label: "Salisbury City Council Events" }, // Official city council page listing upcoming events in Salisbury, regularly updated.
  { regionId: "salisbury", url: "https://www.salisburycathedral.org.uk/whats-on", kind: "web", label: "Salisbury Cathedral Events" }, // Official cathedral page listing events, services, and exhibitions, regularly updated.
  { regionId: "salisbury", url: "https://www.salisburyplayhouse.com/whats-on", kind: "web", label: "Salisbury Playhouse Events" }, // Official theatre page listing performances and events, regularly updated.
  { regionId: "salisbury", url: "https://www.salisburymuseum.org.uk/whats-on", kind: "web", label: "Salisbury Museum Events" }, // Official museum page listing exhibitions and events, regularly updated.
  { regionId: "salisbury", url: "https://www.visitwiltshire.co.uk/whats-on", kind: "web", label: "Visit Wiltshire Events" }, // Official tourism board page listing events in Salisbury and surrounding areas, regularly updated.
  { regionId: "salisbury", url: "https://www.salisburyjournal.co.uk/whats-on/", kind: "web", label: "Salisbury Journal What's On" }, // Local newspaper's events section listing upcoming events in Salisbury, regularly updated.
  { regionId: "salisbury", url: "https://www.facebook.com/SalisburyCityCouncil/events", kind: "facebook", label: "Salisbury City Council Facebook Events" }, // Official city council Facebook page listing upcoming events in Salisbury, regularly updated.
  { regionId: "salisbury", url: "https://www.facebook.com/SalisburyCathedral/events", kind: "facebook", label: "Salisbury Cathedral Facebook Events" }, // Official cathedral Facebook page listing events, services, and exhibitions, regularly updated.

  // st-austell, 4 pages
  { regionId: "st-austell", url: "https://staustellartstheatre.org.uk/whats-on/", kind: "web", label: "St Austell Arts Theatre" }, // Local arts theatre providing a calendar of upcoming performances and events.
  { regionId: "st-austell", url: "https://staustellu3a.org/ecwd_calendar/calendar", kind: "web", label: "St Austell U3A Calendar" }, // University of the Third Age's calendar featuring various community events and activities.
  { regionId: "st-austell", url: "https://www.intocornwall.com/engine/azabout_events.asp?guide=St+Austell", kind: "web", label: "Into Cornwall Guide: St Austell Events" }, // Comprehensive guide listing annual events and festivals in and around St Austell.
  { regionId: "st-austell", url: "https://www.intocornwall.com/engine/azabout_events.asp?guide=St+Austell+-+Fowey+Area", kind: "web", label: "Into Cornwall Guide: St Austell - Fowey Area Events" }, // Comprehensive guide listing annual events and festivals in and around St Austell and Fowey.

  // bude, 8 pages
  { regionId: "bude", url: "https://www.bude-stratton.gov.uk/events/", kind: "web", label: "Bude-Stratton Town Council Events" }, // Official council page listing upcoming events in Bude and Stratton, providing a comprehensive and regularly updated schedule.
  { regionId: "bude", url: "https://www.thecastlebude.co.uk/whats-on/", kind: "web", label: "The Castle Bude Events" }, // Venue hosting a variety of events throughout the year, including talks, workshops, and community activities, with a regularly updated events calendar.
  { regionId: "bude", url: "https://www.visitbude.info/events/list/", kind: "web", label: "Visit Bude Events" }, // Tourism website offering a comprehensive list of upcoming events in Bude, regularly updated to reflect current happenings.
  { regionId: "bude", url: "https://www.whalesborough.co.uk/events/", kind: "web", label: "Whalesborough Events" }, // Local venue hosting seasonal events, including family days and live music, with a regularly updated events page.
  { regionId: "bude", url: "https://www.budefolk.com/welcome/calendar", kind: "web", label: "Bude Folk Club Calendar" }, // Local folk club providing a calendar of upcoming events, including music sessions and performances, regularly updated.
  { regionId: "bude", url: "https://www.intocornwall.com/engine/azabout_events.asp?guide=Bude", kind: "web", label: "Into Cornwall Bude Events" }, // Comprehensive guide listing annual events in Bude, including festivals and local celebrations, with detailed information.
  { regionId: "bude", url: "https://www.cornwall365.com/events/locations/bude/", kind: "web", label: "Cornwall 365 Bude Events" }, // Platform listing events happening in Bude, including performances and festivals, with a regularly updated events calendar.
  { regionId: "bude", url: "https://www.meetup.com/find/gb--bude/", kind: "web", label: "Meetup Bude Events" }, // Platform listing various local events and group activities in Bude, including outdoor adventures and social gatherings.

  // looe, 6 pages
  { regionId: "looe", url: "https://cornwall365.com/events/locations/looe/", kind: "web", label: "Cornwall 365 What's On" }, // A comprehensive events calendar for Looe, Cornwall, listing various events throughout the year.
  { regionId: "looe", url: "https://granitehenge.com/local-events", kind: "web", label: "Granite Henge Local Events" }, // Provides a list of local events and festivals in Looe and surrounding areas, including annual highlights.
  { regionId: "looe", url: "https://www.portbyhan.com/events/", kind: "web", label: "Portbyhan Hotel Events" }, // Lists upcoming events hosted at the Portbyhan Hotel in Looe, including concerts and community events.
  { regionId: "looe", url: "https://www.visitlooe.co.uk/events/", kind: "web", label: "Visit Looe Events" }, // Official tourism website listing events in Looe, including markets, author events, and live music.
  { regionId: "looe", url: "https://www.intocornwall.com/engine/azabout_events.asp?guide=Looe", kind: "web", label: "Into Cornwall Events in Looe" }, // Offers a selection of events in and around Looe, including annual events and festivals.
  { regionId: "looe", url: "https://www.appforcornwall.com/whats-on", kind: "web", label: "App for Cornwall - What's On" }, // Provides information on events happening in Cornwall, including the Looe Lugger Regatta.

  // kendal, 7 pages
  { regionId: "kendal", url: "https://www.breweryarts.co.uk/whats-on/", kind: "web", label: "Brewery Arts Centre" }, // A multi-purpose arts complex in Kendal offering a year-round programme of theatre, music, comedy, films, lectures, and exhibitions, along with workshops and classes.
  { regionId: "kendal", url: "https://kendalmuseum.org.uk/activities-at-kendal-museum/", kind: "web", label: "Kendal Museum" }, // A local museum in Kendal featuring collections of local archaeology, history, geology, and natural history, with a changing programme of temporary exhibitions, events, walks, and talks.
  { regionId: "kendal", url: "https://lakelandarts.org.uk/whats-on-2/", kind: "web", label: "Lakeland Arts" }, // A charity inspiring individuals through arts and heritage, offering a range of events and exhibitions at venues like Abbot Hall Art Gallery in Kendal.
  { regionId: "kendal", url: "https://visit-kendal.co.uk/culture/", kind: "web", label: "Visit Kendal - Culture" }, // Provides information on Kendal's vibrant cultural scene, including events, festivals, galleries, museums, and art centres.
  { regionId: "kendal", url: "https://www.kendalmuseum.org.uk/category/news-and-events/", kind: "web", label: "Kendal Museum - News and Events" }, // Features news and events related to Kendal Museum, including exhibitions and talks.
  { regionId: "kendal", url: "https://www.lakelandarts.org.uk/whats-on-2/", kind: "web", label: "Lakeland Arts - What's On" }, // Lists upcoming events and exhibitions at Lakeland Arts venues, including Abbot Hall Art Gallery in Kendal.
  { regionId: "kendal", url: "https://www.visitcumbria.com/sl/brewery-arts-centre/", kind: "web", label: "Brewery Arts Centre - Visit Cumbria" }, // Provides information on the Brewery Arts Centre in Kendal, including its history and events.

  // barrow-in-furness, 5 pages
  { regionId: "barrow-in-furness", url: "https://www.barrowbc.gov.uk/residents/leisure-and-events", kind: "web", label: "Leisure and Events | Westmorland and Furness Council" }, // This page provides information on local attractions, arts and culture venues, and sports and leisure centres in Barrow-in-Furness, offering a comprehensive overview of ongoing and upcoming events.
  { regionId: "barrow-in-furness", url: "https://barrowtowncouncil.gov.uk/events-committee/", kind: "web", label: "Events Committee - Barrow Town Council" }, // This page lists recent and upcoming events organized by the Barrow Town Council, including community festivals and initiatives, with updates and agendas for future events.
  { regionId: "barrow-in-furness", url: "https://barrowtowncouncil.gov.uk/category/events/", kind: "web", label: "Events - Barrow Town Council" }, // This section provides updates on various events organized by the Barrow Town Council, including community festivals and initiatives, with recent news and agendas for future events.
  { regionId: "barrow-in-furness", url: "https://visitbarrow.org.uk/events/autumn-fest/", kind: "web", label: "Autumn Fest - Visit Barrow" }, // This page details the Autumn Fest event held in Barrow town centre, featuring family activities, workshops, and entertainment, indicating it is an annual event.
  { regionId: "barrow-in-furness", url: "https://www.aboutbritain.com/towns/barrow-in-furness.asp", kind: "web", label: "Barrow-in-Furness - Things to Do Near Me | AboutBritain.com" }, // This page offers information on attractions, museums, and heritage sites in Barrow-in-Furness, providing details on places to visit and events.

  // whitehaven, 7 pages
  { regionId: "whitehaven", url: "https://www.rosehilltheatre.co.uk/whitehaven-weekender", kind: "web", label: "Whitehaven Weekender" }, // A two-day festival on 29-30 August 2026, featuring music, creativity, and community events at Whitehaven Harbourside. Free events across the weekend, with a small booking fee for Sunday’s main music zone.
  { regionId: "whitehaven", url: "https://www.thedoggydeli.uk/event-diary", kind: "web", label: "Whitehaven Market" }, // A monthly market held on the 3rd Saturday of each month, including 19 September 2026, at King Street, Whitehaven. Organized by Cumberland Council.
  { regionId: "whitehaven", url: "https://thebeacon-whitehaven.co.uk/whats-on/festival-of-archaeology/", kind: "web", label: "Festival of Archaeology at The Beacon Museum" }, // A festival celebrating archaeology with various events, including workshops and talks, at The Beacon Museum, Whitehaven. No booking required; just turn up.
  { regionId: "whitehaven", url: "https://thebeacon-whitehaven.co.uk/whats-on/pet-encounters-2/", kind: "web", label: "Pet Encounters at The Beacon Museum" }, // Interactive animal encounter sessions for children on 13 and 27 August 2026 at The Beacon Museum, Whitehaven. Tickets required.
  { regionId: "whitehaven", url: "https://www.alk.org.uk/events/alk-agm-weekend-2026/", kind: "web", label: "ALK AGM Weekend 2026" }, // Annual General Meeting and associated events from 25 to 28 September 2026, including lighthouse tours and a dinner at Seacote Hotel, St Bees, near Whitehaven.
  { regionId: "whitehaven", url: "https://www.westernlakedistrict.com/events/whitehaven-weekender/", kind: "web", label: "Whitehaven Weekender on Western Lake District" }, // Information about the Whitehaven Weekender festival, including dates, location, and ticket details.
  { regionId: "whitehaven", url: "https://www.eventim.co.uk/event/wipeout-whitehaven-civic-hall-20824244/", kind: "web", label: "Whitehaven Wipeout at Whitehaven Civic Hall" }, // Event scheduled for 5 September 2026 at Whitehaven Civic Hall. Tickets available.

  // penrith, 7 pages
  { regionId: "penrith", url: "https://www.discoverpenrith.co.uk/whats-on/", kind: "web", label: "Discover Penrith" }, // Comprehensive listings of upcoming events in Penrith, including theatre productions, concerts, festivals, and more, suitable for all ages and interests.
  { regionId: "penrith", url: "https://www.penrithtowncouncil.gov.uk/events/", kind: "web", label: "Penrith Town Council Events" }, // Official events page of Penrith Town Council, featuring a calendar of local events and activities.
  { regionId: "penrith", url: "https://www.mycommunitypenrith.co.uk/events", kind: "web", label: "My Community Penrith" }, // Community-driven events and activities in Penrith, including summer balls, wrestling events, and fun days.
  { regionId: "penrith", url: "https://penrithartsandculture.co.uk/", kind: "web", label: "Penrith Arts and Culture" }, // Central hub for cultural and artistic events in Penrith, offering information on local arts, theatre, music, and festivals.
  { regionId: "penrith", url: "https://www.visiteden.co.uk/explore-eden/the-eden-valley/penrith/events-and-exploring-in-penrith/", kind: "web", label: "Visit Eden - Penrith Events" }, // Guide to events and activities in Penrith, including annual festivals, markets, and outdoor activities.
  { regionId: "penrith", url: "https://www.timeoutdoors.com/events/runs/10k-runs/penrith", kind: "web", label: "Time Outdoors - Penrith Runs" }, // Listings of upcoming running events in Penrith, including trail runs and marathons.
  { regionId: "penrith", url: "https://www.cumbrianeye.co.uk/events/eden/penrith-events.htm", kind: "web", label: "Cumbrian Eye - Penrith Events" }, // Local events calendar for Penrith, including markets, live entertainment, and major events like the Winter Droving and Agricultural Show.

  // keswick, 8 pages
  { regionId: "keswick", url: "https://www.keswick.org/whats-on/events-in-and-around-keswick", kind: "web", label: "Keswick.org Events Calendar" }, // Official visitor website for Keswick, providing a comprehensive events calendar with listings for various events in and around Keswick.
  { regionId: "keswick", url: "https://keswickmuseum.org.uk/whats-on/", kind: "web", label: "Keswick Museum What's On" }, // Official page of Keswick Museum listing current and upcoming exhibitions and events.
  { regionId: "keswick", url: "https://keswick-music-society.org.uk/whats-new/current-season/", kind: "web", label: "Keswick Music Society Concerts" }, // Listings of concerts for the 2026-27 season at St. John's Church, Keswick.
  { regionId: "keswick", url: "https://sustainablekeswick.org.uk/whats-on/", kind: "web", label: "Sustainable Keswick Events" }, // Events run by Sustainable Keswick and other local organisations, including Green Get Togethers and Green Screens.
  { regionId: "keswick", url: "https://www.thelakesguide.co.uk/events", kind: "web", label: "The Lakes Guide Events Calendar" }, // Updated weekly calendar of events across the Lake District, including Keswick.
  { regionId: "keswick", url: "https://another.place/the-lake/events", kind: "web", label: "Another Place Hotel Events" }, // Event calendar for Another Place, The Lake, featuring live music, quiz nights, art installations, and more.
  { regionId: "keswick", url: "https://keswickcottages.co.uk/experience-type/whats-on/", kind: "web", label: "Keswick Cottages What's On" }, // Listings of local events and activities, including Keswick Park Run and Lakeland Trails.
  { regionId: "keswick", url: "https://porchcottage.com/keswick/whats-on/", kind: "web", label: "Porch Cottage Keswick Events" }, // Guide to annual events and festivals in Keswick, including Theatre by the Lake and Keswick Film Festival.

  // ulverston, 6 pages
  { regionId: "ulverston", url: "https://ulverstoncouncil.org.uk/whats-on/", kind: "web", label: "Ulverston Town Council Events" }, // Official council page listing upcoming events in Ulverston.
  { regionId: "ulverston", url: "https://ulverston.com/events/", kind: "web", label: "Ulverston News Events Calendar" }, // Comprehensive community events calendar for Ulverston.
  { regionId: "ulverston", url: "https://ulverstongolf.co.uk/events/", kind: "web", label: "Ulverston Golf Club Events" }, // Golf club's events page with upcoming tournaments and social events.
  { regionId: "ulverston", url: "https://www.jambase.com/venue/the-coro", kind: "web", label: "The Coro Concerts" }, // Concert calendar for The Coro in Ulverston.
  { regionId: "ulverston", url: "https://ulverston.com/items/category/seasonal-events/month/", kind: "web", label: "Ulverston News Seasonal Events" }, // Seasonal events calendar for Ulverston.
  { regionId: "ulverston", url: "https://www.achurchnearyou.com/church/7343/service-and-events/", kind: "web", label: "St Mary w Holy Trinity Church Events" }, // Church's events and services listings.

  // buxton, 10 pages
  { regionId: "buxton", url: "https://www.buxtoncrescentexperience.com/whats-on", kind: "web", label: "Buxton Crescent Experience" }, // Offers a calendar of events and exhibitions at the historic Buxton Crescent, providing a standing list of activities throughout the year.
  { regionId: "buxton", url: "https://www.buxtonoperahouse.org.uk/whats-on/calendar/", kind: "web", label: "Buxton Opera House" }, // Features a comprehensive calendar of performances and events at the historic Buxton Opera House, with listings extending several months ahead.
  { regionId: "buxton", url: "https://www.buxtonmarkets.co.uk/whats-on/", kind: "web", label: "Buxton Markets" }, // Provides a schedule of regular and special markets held in Buxton, including dates for the Craft, Quirky & Vintage Markets and Food & Drink Special Markets.
  { regionId: "buxton", url: "https://www.transitionbuxton.co.uk/events-calendar/", kind: "web", label: "Transition Buxton Events Calendar" }, // Lists upcoming events and regular meetings organized by Transition Buxton, with dates extending into 2026.
  { regionId: "buxton", url: "https://thevaultbuxton.co.uk/events/", kind: "web", label: "The Vault Buxton" }, // Offers a calendar of events, including weekly specials and upcoming events, with listings extending into late August 2026.
  { regionId: "buxton", url: "https://www.visitbuxton.co.uk/plan-your-visit/whats-on-when/", kind: "web", label: "Visit Buxton - What's On When" }, // Provides a month-by-month calendar of events and festivals in Buxton, with listings extending into 2026.
  { regionId: "buxton", url: "https://paviliongardens.co.uk/events/", kind: "web", label: "Pavilion Gardens Buxton" }, // Hosts over 100 fairs and events annually, with a calendar of upcoming events including markets and fairs.
  { regionId: "buxton", url: "https://www.buxtonflowerpottrail.co.uk/", kind: "web", label: "Buxton Flowerpot Trail" }, // An annual event featuring creative flowerpot displays throughout Buxton, with information on the upcoming trail.
  { regionId: "buxton", url: "https://www.visitbuxton.co.uk/festivals/other-festivals-annual-events/", kind: "web", label: "Visit Buxton - Other Festivals & Annual Events" }, // Lists annual events in Buxton, including the Buxton Antiques Fair and Heritage Open Days, with dates extending into 2026.
  { regionId: "buxton", url: "https://www.buxtonopera.co.uk/whats-on", kind: "web", label: "Buxton Opera Company" }, // Provides a schedule of upcoming performances and events by the Buxton Opera Company, with listings extending into 2026.

  // glossop, 5 pages
  { regionId: "glossop", url: "https://crystalballroomglossop.com/", kind: "web", label: "Crystal Ballroom Glossop" }, // Offers a variety of live music and events weekly, with listings extending several months ahead.
  { regionId: "glossop", url: "https://empireglossop.co.uk/venue/empire-glossop/", kind: "web", label: "Empire Glossop" }, // Hosts a range of events including tribute acts and themed nights, with schedules available for the upcoming months.
  { regionId: "glossop", url: "https://www.glossopmarkethall.co.uk/events/trivial-persecution-with-the-barry-bros", kind: "web", label: "Glossop Market Hall" }, // Features regular events like 'Trivial Persecution with The Barry Bros.', with dates scheduled months in advance.
  { regionId: "glossop", url: "https://www.bullsheadglossop.com/whats-on", kind: "web", label: "The Bulls Head" }, // Hosts weekly quiz nights and occasional special events, with listings available for the coming months.
  { regionId: "glossop", url: "https://www.shazam.com/event/venue/aba8aafa-e728-473a-a80c-256ec422c6d4", kind: "web", label: "The Globe Inn, Glossop" }, // Lists upcoming concerts and events, with schedules extending several months ahead.

  // barnstaple, 5 pages
  { regionId: "barnstaple", url: "https://www.barnstaple.co.uk/whats-on", kind: "web", label: "Barnstaple Town Council 'What's On' Page" }, // This page provides a comprehensive list of upcoming events in Barnstaple, including arts, culture, and community activities, and is regularly updated with new listings.
  { regionId: "barnstaple", url: "https://barnstaplemuseum.org.uk/whats-on/", kind: "web", label: "Museum of Barnstaple and North Devon 'What's On' Page" }, // This page lists current and upcoming exhibitions and events at the museum, offering a variety of cultural experiences.
  { regionId: "barnstaple", url: "https://www.thebestof.co.uk/local/barnstaple/events/", kind: "web", label: "TheBestOf Barnstaple Events Page" }, // This page features a curated list of local events, including festivals, live music, and community gatherings, with details on dates and venues.
  { regionId: "barnstaple", url: "https://www.chooseyourevent.co.uk/whats-on-in-barnstaple", kind: "web", label: "ChooseYourevent Barnstaple Listings" }, // This page provides a calendar of events happening in Barnstaple, including charity events, live music, and community activities, with options to filter by date and category.
  { regionId: "barnstaple", url: "https://www.barnstaple.co.uk/event-type/entertainment-nightlife", kind: "web", label: "Barnstaple Entertainment & Nightlife Events" }, // This page lists upcoming entertainment and nightlife events in Barnstaple, including live music, comedy shows, and other performances.

  // totnes, 5 pages
  { regionId: "totnes", url: "https://www.totnestowncouncil.gov.uk/our-services/civic-hall/civic-hall-calendar/", kind: "web", label: "Totnes Town Council Civic Hall Calendar" }, // This is the official events calendar for the Civic Hall, maintained by the Totnes Town Council, listing various events held at the venue.
  { regionId: "totnes", url: "https://www.visitsouthdevon.co.uk/whats-on/totnes", kind: "web", label: "Visit South Devon - Totnes Events" }, // A comprehensive listing of events happening in Totnes, provided by the local tourism board, covering a wide range of activities.
  { regionId: "totnes", url: "https://www.bayhorsetotnes.com/upcoming-events", kind: "web", label: "Bay Horse Totnes Upcoming Events" }, // The Bay Horse pub in Totnes regularly hosts live music and other events, with a detailed calendar of upcoming activities.
  { regionId: "totnes", url: "https://healthsourcetotnes.uk/whats-on/", kind: "web", label: "HealthSource Totnes Events Calendar" }, // HealthSource Totnes offers a variety of health and wellness events, workshops, and classes, with an up-to-date events calendar.
  { regionId: "totnes", url: "https://www.totnes-today.co.uk/", kind: "web", label: "Totnes Times" }, // The local newspaper's website, featuring a 'What's On' section with listings of upcoming events in Totnes.

  // amersham, 7 pages
  { regionId: "amersham", url: "https://visitamersham.org.uk/business/amersham-heritage-day/", kind: "web", label: "Visit Amersham Heritage Day" }, // Tourism board's page detailing the Heritage Day event on 6th September 2026.
  { regionId: "amersham", url: "https://www.amershamsociety.org/events/", kind: "web", label: "The Amersham Society Events" }, // Local society's events page with listings from August to November 2026.
  { regionId: "amersham", url: "https://amershammuseum.org/events/month/2026-08/", kind: "web", label: "Amersham Museum Events" }, // Museum's events calendar for August 2026, including workshops and exhibitions.
  { regionId: "amersham", url: "https://www.madsquirrelamersham.co.uk/events", kind: "web", label: "Mad Squirrel Amersham Events" }, // Venue's events page listing live music and other events in August 2026.
  { regionId: "amersham", url: "https://bbf.uk.com/event/simply-networking-Sep-2026", kind: "web", label: "Simply Networking - September 2026" }, // Networking event in Amersham on 16th September 2026.
  { regionId: "amersham", url: "https://chilternchamber.org/event/chamber-chatter-14th-september-2026-meet-up/", kind: "web", label: "Chamber Chatter 14th September 2026" }, // Informal networking session in Amersham on 14th September 2026.
  { regionId: "amersham", url: "https://visitchesham.org.uk/event/chesham-classic-bus-running-day-2026/", kind: "web", label: "Chesham Classic Bus Running Day 2026" }, // Event in nearby Chesham on 26th September 2026, featuring classic bus rides.

  // high-wycombe, 1 page
  { regionId: "high-wycombe", url: "https://www.wycombe.gov.uk/pages/Events/Events.aspx", kind: "web", label: "Wycombe District Council Events" }, // Official council page listing upcoming events in High Wycombe and surrounding areas.

  // marlow, 8 pages
  { regionId: "marlow", url: "https://www.mymarlow.co.uk/events-calendar/", kind: "web", label: "My Marlow Events Calendar" }, // A comprehensive calendar of upcoming events in Marlow, including regular and one-off events, maintained by a local community website.
  { regionId: "marlow", url: "https://www.mymarlow.co.uk/events-calendar-full/", kind: "web", label: "My Marlow Full Events Calendar" }, // An extended version of the My Marlow Events Calendar, providing detailed listings of events in Marlow.
  { regionId: "marlow", url: "https://www.marlowsociety.org.uk/events-talks-walks/", kind: "web", label: "The Marlow Society Events" }, // Organizes a diverse calendar of events, including visits, history talks, and guided walks, with a schedule extending into September 2026.
  { regionId: "marlow", url: "https://www.visitthames.co.uk/explore/towns-villages/marlow/whats-on/", kind: "web", label: "Visit Thames Marlow Events" }, // Lists key events in Marlow for 2026, including Swan Upping, Remembrance Service, and Santa's Fun Run.
  { regionId: "marlow", url: "https://thebotanist.uk.com/locations/marlow/whats-on", kind: "web", label: "The Botanist Marlow Events" }, // Features weekly events such as live music, happy hour, and brunch specials, with listings extending into December 2026.
  { regionId: "marlow", url: "https://www.thechequersmarlow.co.uk/whats-on/", kind: "web", label: "The Chequers Marlow Events" }, // Offers information on live music sessions and other events at The Chequers pub in Marlow.
  { regionId: "marlow", url: "https://www.shillingridge.co.uk/local-area/whats-on", kind: "web", label: "Shillingridge Glamping Local Events" }, // Provides a roundup of local events and attractions in and around Marlow for 2026, including farmers' markets and festivals.
  { regionId: "marlow", url: "https://www.dementiaactionmarlow.org/calendar", kind: "web", label: "Dementia Action Marlow Calendar" }, // Lists upcoming events and regular social activities in Marlow, including cafes and movement sessions.

  // chesham, 5 pages
  { regionId: "chesham", url: "https://www.chesham.gov.uk/council_events/", kind: "web", label: "Chesham Town Council Events" }, // Official council page listing upcoming events in Chesham, including markets, festivals, and community activities.
  { regionId: "chesham", url: "https://visitchesham.org.uk/whats-on/", kind: "web", label: "Visit Chesham Events" }, // Tourism board's 'What's On' page featuring a calendar of events in Chesham and surrounding villages.
  { regionId: "chesham", url: "https://cheshamhub.co.uk/", kind: "web", label: "CheshamHub Events" }, // Local community website providing a 'What's On' section with details of upcoming events in Chesham.
  { regionId: "chesham", url: "https://www.jnl-art.com/events", kind: "web", label: "JNL-Art Events in Chesham" }, // Art workshops and events hosted at Chesham Town Hall, with dates extending into 2026.
  { regionId: "chesham", url: "https://www.chilternchamber.org/events/category/chesham/", kind: "web", label: "Chiltern Chamber Events in Chesham" }, // Business networking events and meet-ups in Chesham, with dates scheduled into December 2026.

  // peterborough, 2 pages
  { regionId: "peterborough", url: "https://discoverpeterborough.co.uk/events-calendar/", kind: "web", label: "Discover Peterborough Events Calendar" }, // Official city events calendar listing a variety of events throughout the year.
  { regionId: "peterborough", url: "https://www.whatsoninpeterborough.com/events", kind: "web", label: "What's On in Peterborough Events Calendar" }, // Regularly updated events calendar featuring live music, family events, art & culture, and more.

  // ellesmere-port, 6 pages
  { regionId: "ellesmere-port", url: "https://www.cheshirewestandchester.gov.uk/residents/leisure-parks-and-events/markets/ellesmere-port-market", kind: "web", label: "Ellesmere Port Market" }, // Official market page listing regular market days and events, indicating ongoing activities.
  { regionId: "ellesmere-port", url: "https://canalrivertrust.org.uk/things-to-do/museums-and-attractions/national-waterways-museum-ellesmere-port/events", kind: "web", label: "National Waterways Museum Events" }, // Museum's events page detailing upcoming exhibitions and activities, suggesting a continuous schedule.
  { regionId: "ellesmere-port", url: "https://www.oldhallfarmpub.co.uk/whats-on", kind: "web", label: "The Old Hall Farm Pub Events" }, // Pub's events calendar showcasing regular events and offers, indicating recurring activities.
  { regionId: "ellesmere-port", url: "https://www.cheshirewestandchester.gov.uk/news/ellesmere-port-flea-market-reopening-with-music-events-and-markets?date=3-June-2026", kind: "web", label: "Ellesmere Port Flea Market Reopening Events" }, // Council's announcement of reopening events and markets, suggesting ongoing community activities.
  { regionId: "ellesmere-port", url: "https://www.pinderscircus.com/event-details/ellesmere-port-2026-07-08-19-00", kind: "web", label: "Pinder's Circus at Whitby Park" }, // Circus event page for July 2026, suggesting scheduled performances.
  { regionId: "ellesmere-port", url: "https://www.ellesmere-port-news.com/ellesmere-port-s-event-calendar", kind: "web", label: "Ellesmere Port News Event Calendar" }, // Local news outlet's event calendar listing various upcoming events in the area.

  // wilmslow, 8 pages
  { regionId: "wilmslow", url: "https://www.wilmslow.co.uk/events/", kind: "web", label: "Wilmslow.co.uk Events" }, // A comprehensive events calendar for Wilmslow, listing various upcoming events throughout the year.
  { regionId: "wilmslow", url: "https://www.wilmslowarttrail.co.uk/", kind: "web", label: "Wilmslow Art Trail" }, // An annual contemporary art fair showcasing artists from around the North West, held on the first weekend in October.
  { regionId: "wilmslow", url: "https://www.wilmslow.co.uk/events/detail/9160/wilmslow-street-fest", kind: "web", label: "Wilmslow Street Fest" }, // A free-to-attend celebration of music, entertainment, and global street food, returning on 4th September 2026.
  { regionId: "wilmslow", url: "https://woodcraftbyowen.co.uk/event/wilmslow-artisan-market/", kind: "web", label: "Wilmslow Artisan Market" }, // A monthly market featuring handcrafted goods and artisanal foods, with upcoming dates on 19th September and 17th October 2026.
  { regionId: "wilmslow", url: "https://www.runningcalendar.co.uk/event/wilmslow-autumn-triathlon/", kind: "web", label: "Wilmslow Autumn Triathlon" }, // An annual triathlon event held on 20th September 2026, featuring swim, bike, and run segments.
  { regionId: "wilmslow", url: "https://www.heswilmslow.co.uk/events", kind: "web", label: "Humane Education Society Events" }, // A series of fundraising events, including the Autumn Fair on 27th September 2026.
  { regionId: "wilmslow", url: "https://wilmslowswaybetter.co.uk/events/categories/market/", kind: "web", label: "Wilmslow Artisan Market Schedule" }, // A listing of upcoming Artisan Market dates, including 19th September and 17th October 2026.
  { regionId: "wilmslow", url: "https://www.antiques-atlas.com/antique_fair/shepherd_williams/or2983", kind: "web", label: "Wilmslow Antiques, Vintage & Collectors Fair" }, // An antiques fair scheduled for 31st August 2026, with additional dates on 13th September and 1st November 2026.

  // st-ives, 6 pages
  { regionId: "st-ives", url: "https://www.stivesseptemberfestival.co.uk/", kind: "web", label: "St Ives September Festival" }, // A two-week festival from 12th to 26th September 2026, featuring music, arts, and cultural events across various venues in St Ives.
  { regionId: "st-ives", url: "https://www.cornwallwildlifetrust.org.uk/events/2026-08-01-national-marine-week-st-ives-rockpool-ramble", kind: "web", label: "National Marine Week - St Ives Rockpool Ramble" }, // A guided rockpool walk on 1st August 2026 at Smeaton’s Pier, uncovering marine wildlife along the shoreline.
  { regionId: "st-ives", url: "https://www.cornwallwildlifetrust.org.uk/events/2026-08-01-national-marine-week-st-ives-beach-clean", kind: "web", label: "National Marine Week - St Ives Beach Clean" }, // A community beach clean event on 1st August 2026 at Harbour Beach, supporting marine wildlife and keeping Cornwall’s beaches clean.
  { regionId: "st-ives", url: "https://www.thecornexchange.org.uk/events-page/", kind: "web", label: "St Ives Corn Exchange Events" }, // A venue hosting various events, including 'Screen St Ives: Sentimental Value' on 3rd September 2026.
  { regionId: "st-ives", url: "https://www.cornishsecrets.co.uk/guide/cornish-festivals-events/", kind: "web", label: "Cornish Festivals and Events Guide" }, // A comprehensive guide listing various festivals and events in Cornwall, including the St Ives September Festival from 12th to 26th September 2026.
  { regionId: "st-ives", url: "https://www.forevercornwall.co.uk/cornwall-festivals-and-events-2026", kind: "web", label: "Cornwall Festivals Guide 2026" }, // A guide to Cornwall's festivals and events in 2026, featuring the St Ives September Festival from 12th to 26th September 2026.

  // bodmin, 10 pages
  { regionId: "bodmin", url: "https://www.bodminairfield.co.uk/event-list", kind: "web", label: "Bodmin Airfield Events" }, // A dedicated page listing upcoming events at Bodmin Airfield, including the Cornwall Strut Fly-In on 12th September 2026.
  { regionId: "bodmin", url: "https://www.bodminjail.org/events/brick-history/", kind: "web", label: "Brick History at Bodmin Jail" }, // An exhibition running from 24th June to 8th September 2026, showcasing LEGO® recreations of historical events.
  { regionId: "bodmin", url: "https://cornwall365.com/events/locations/bodmin/", kind: "web", label: "Cornwall 365 What's On in Bodmin" }, // A comprehensive list of events in Bodmin, including workshops, performances, and festivals.
  { regionId: "bodmin", url: "https://fis.cornwall.gov.uk/SynergyWeb/CornwallFIS/Whatsoneastcornwall.aspx", kind: "web", label: "Family Information Service Cornwall - East Cornwall Events" }, // A regularly updated page listing family-friendly events in East Cornwall, including Bodmin.
  { regionId: "bodmin", url: "https://www.bodminkeep.org.uk/whats-on/events/flamm-2026-keepers", kind: "web", label: "Flamm 2026: Keepers at Bodmin Keep" }, // An exhibition running from 28th February to 1st March 2026, part of Cornwall’s biennial contemporary visual art festival.
  { regionId: "bodmin", url: "https://www.visitnewquay.org/whats-on/the-scarlet-pimpernel-at-cardinham-woods-p3461353", kind: "web", label: "The Scarlet Pimpernel at Cardinham Woods" }, // A performance held from 15th July to 1st August 2026 in Cardinham Woods, near Bodmin.
  { regionId: "bodmin", url: "https://www.voicenewspapers.co.uk/news/gorsedh-festival-returns-to-bodmin-after-29-year-absence-932152", kind: "web", label: "Gorsedh Festival in Bodmin" }, // A festival celebrating Cornish heritage with a week of cultural events in Bodmin from 1st to 6th September 2026.
  { regionId: "bodmin", url: "https://www.bodmin.gov.uk/whats-on", kind: "web", label: "Bodmin Town Council Events" }, // The official events page of Bodmin Town Council, listing upcoming local events.
  { regionId: "bodmin", url: "https://www.facebook.com/BodminTownCouncil", kind: "facebook", label: "Bodmin Town Council Facebook Page" }, // The official Facebook page of Bodmin Town Council, featuring updates on local events.
  { regionId: "bodmin", url: "https://www.facebook.com/BodminKeep", kind: "facebook", label: "Bodmin Keep Facebook Page" }, // The official Facebook page of Bodmin Keep: Cornwall's Army Museum, listing events and exhibitions.

  // basingstoke, 7 pages
  { regionId: "basingstoke", url: "https://www.inbasingstoke.co.uk/whats-on", kind: "web", label: "In Basingstoke" }, // Local events calendar featuring a variety of activities in Basingstoke.
  { regionId: "basingstoke", url: "https://www.basingstoke.gov.uk/whats-on", kind: "web", label: "Basingstoke and Deane Borough Council" }, // Official council page listing community events and activities.
  { regionId: "basingstoke", url: "https://www.naturalbasingstoke.org.uk/events/", kind: "web", label: "Natural Basingstoke" }, // Listings of nature-related events and activities in Basingstoke.
  { regionId: "basingstoke", url: "https://www.basingstokeirishsociety.co.uk/events", kind: "web", label: "Basingstoke Irish Society" }, // Events hosted by the local Irish community, including live music and cultural events.
  { regionId: "basingstoke", url: "https://www.basingstokeblues.co.uk/events", kind: "web", label: "Basingstoke Blues Club" }, // Listings of blues music events and concerts in Basingstoke.
  { regionId: "basingstoke", url: "https://www.whatsoninbasingstoke.com/events", kind: "web", label: "What's On In Basingstoke" }, // Comprehensive events calendar for Basingstoke, including arts, music, and community events.
  { regionId: "basingstoke", url: "https://www.bcat.org.uk/events/", kind: "web", label: "Basingstoke Community Arts Together" }, // Listings of community arts events and performances in Basingstoke.

  // andover, 4 pages
  { regionId: "andover", url: "https://www.thelights.org.uk/", kind: "web", label: "The Lights Andover" }, // The Lights Andover is a venue hosting various events throughout the year, including performances and community activities. Their 'What's On' page provides a standing list of upcoming events.
  { regionId: "andover", url: "https://www.testvalley.gov.uk/communityandleisure/markets/andover?displaypref=large", kind: "web", label: "Andover Markets" }, // Test Valley Borough Council's Andover Markets page lists recurring markets such as 'Second Sundays' and 'Chantry Centre pop-up market', providing dates and details for each event.
  { regionId: "andover", url: "https://andover-tc.gov.uk/meetings/upcoming", kind: "web", label: "Andover Town Council Meetings" }, // Andover Town Council's 'Upcoming Meetings' page lists scheduled council meetings, including dates and locations, serving as a standing listing of civic events.
  { regionId: "andover", url: "https://www.testvalley.gov.uk/news/2026/may/andover-gardening-fair-returns-to-the-high-street-this-weekend", kind: "web", label: "Andover Gardening Fair" }, // Test Valley Borough Council's page about the Andover Gardening Fair provides details about the annual event, including dates and activities, serving as a standing listing.

  // eastleigh, 4 pages
  { regionId: "eastleigh", url: "https://www.arroweastleigh.co.uk/events/", kind: "web", label: "The Arrow" }, // The Arrow's events page lists upcoming events such as live music and charity fun days, indicating a standing listings page.
  { regionId: "eastleigh", url: "https://eastleigh-tc.gov.uk/", kind: "web", label: "Eastleigh Town Council" }, // Eastleigh Town Council's website provides information on local events and activities, serving as a standing listings page.
  { regionId: "eastleigh", url: "https://eastleigh.online/whats-on/", kind: "web", label: "Eastleigh Online Events Guide" }, // Eastleigh Online offers a comprehensive events guide with listings for various local events, indicating a standing listings page.
  { regionId: "eastleigh", url: "https://eastleigh-tc.gov.uk/news/eastleigh-active-is-open-for-bookings/", kind: "web", label: "Eastleigh Active" }, // Eastleigh Active provides information on ongoing and upcoming activities, serving as a standing listings page.

  // gosport, 5 pages
  { regionId: "gosport", url: "https://www.discovergosport.co.uk/find-events/", kind: "web", label: "Discover Gosport Events" }, // A comprehensive events calendar listing various activities in Gosport, including festivals, live music, arts, culture, markets, and community celebrations. This page is regularly updated and provides a broad overview of upcoming events.
  { regionId: "gosport", url: "https://www.gosportactivitycentre.co.uk/events", kind: "web", label: "GoSport Activity Centre Events" }, // Lists upcoming events at the GoSport Activity Centre, such as 'Big Adventure' days and other community activities. The page includes events scheduled for the coming months, indicating it is a standing listings page.
  { regionId: "gosport", url: "https://www.holytrinitygosport.org.uk/events", kind: "web", label: "Holy Trinity Church Gosport Events" }, // Provides a calendar of events hosted by Holy Trinity Church, including concerts, community lunches, and other activities. The page lists events through December 2026, suggesting it is a standing listings page.
  { regionId: "gosport", url: "https://www.gosportcommunityassociation.com/event", kind: "web", label: "Gosport Community Association Events" }, // Features a range of events hosted by the Gosport Community Association, such as coffee mornings, organ club meetings, and comedy nights. The page includes events scheduled for the coming months, indicating it is a standing listings page.
  { regionId: "gosport", url: "https://www.gosport.gov.uk/", kind: "web", label: "Gosport Borough Council" }, // The official website of Gosport Borough Council, which may provide information on local events and community activities. While specific event listings are not directly available, the site serves as a central hub for local information.

  // ryde, 8 pages
  { regionId: "ryde", url: "https://www.ryde-tc.gov.uk/whats-on/", kind: "web", label: "Ryde Town Council Events" }, // Official events page listing upcoming events in Ryde, maintained by the town council.
  { regionId: "ryde", url: "https://www.visitryde.co.uk/whats-on/", kind: "web", label: "Visit Ryde Events" }, // Tourism board's events page featuring a calendar of events in Ryde.
  { regionId: "ryde", url: "https://www.ventnorbotanic.co.uk/whats-on", kind: "web", label: "Ventnor Botanic Garden Events" }, // Botanic garden's events page listing upcoming activities and exhibitions.
  { regionId: "ryde", url: "https://www.ventnortheatre.co.uk/whats-on", kind: "web", label: "Ventnor Theatre Events" }, // Local theatre's events page showcasing performances and shows.
  { regionId: "ryde", url: "https://www.ventnorartsclub.com/whats-on", kind: "web", label: "Ventnor Arts Club Events" }, // Arts club's events page featuring exhibitions, workshops, and performances.
  { regionId: "ryde", url: "https://www.ventnorfilm.co.uk/whats-on", kind: "web", label: "Ventnor Film Society Events" }, // Film society's events page listing upcoming screenings and film-related events.
  { regionId: "ryde", url: "https://www.ventnorlibrary.co.uk/whats-on", kind: "web", label: "Ventnor Library Events" }, // Library's events page featuring talks, workshops, and community events.
  { regionId: "ryde", url: "https://www.ventnortowncouncil.org.uk/whats-on", kind: "web", label: "Ventnor Town Council Events" }, // Town council's events page listing community activities and local events.

  // dereham, 1 page
  { regionId: "dereham", url: "https://www.breckland.gov.uk/article/25972/Statement-following-meeting-on-26-March-2026", kind: "web", label: "Breckland Council Statement" }, // Official statement from Breckland Council regarding the Dereham Taskforce meeting on 26 March 2026.

  // scarborough, 7 pages
  { regionId: "scarborough", url: "https://www.scarborough.gov.uk/whats-on", kind: "web", label: "Scarborough Borough Council What's On" }, // Official council page listing upcoming events in Scarborough.
  { regionId: "scarborough", url: "https://www.scarboroughspa.co.uk/whats-on", kind: "web", label: "Scarborough Spa What's On" }, // Venue hosting a variety of events throughout the year.
  { regionId: "scarborough", url: "https://www.scarborougharts.com/programs-calendar", kind: "web", label: "Scarborough Arts Programs Calendar" }, // Arts organization listing community events and programs.
  { regionId: "scarborough", url: "https://www.scarboroughfair.uk/", kind: "web", label: "The Scarborough Fair" }, // Year-round program of arts, heritage, and sporting events.
  { regionId: "scarborough", url: "https://www.scarboroughschools.org/events", kind: "web", label: "Scarborough Public Schools Events" }, // School district calendar highlighting key happenings.
  { regionId: "scarborough", url: "https://www.scarboroughmaine.org/stay-connected/calendar", kind: "web", label: "Town of Scarborough Calendar" }, // Official town calendar with council and committee meetings.
  { regionId: "scarborough", url: "https://www.scarboroughmaine.org/stay-connected/calendar/monthly-calendar", kind: "web", label: "Scarborough Monthly Calendar" }, // Monthly calendar of town events and meetings.

  // rushden, 6 pages
  { regionId: "rushden", url: "https://www.rushdentowncouncil.gov.uk/events1", kind: "web", label: "Rushden Town Council Events" }, // Official events calendar listing various community events throughout the year.
  { regionId: "rushden", url: "https://www.rushdentowncouncil.gov.uk/local-events", kind: "web", label: "Rushden Town Council What's On" }, // Comprehensive listing of upcoming events in Rushden, including community activities and entertainment.
  { regionId: "rushden", url: "https://www.rushdenspiritualistchurch.co.uk/calendar.php", kind: "web", label: "Rushden Independent Spiritualist Church Calendar" }, // Regularly updated calendar of services and events at the church, including mediumship demonstrations and spiritual workshops.
  { regionId: "rushden", url: "https://www.rushdenlakes.com/events", kind: "web", label: "Rushden Lakes Events" }, // Ongoing events at Rushden Lakes, including SEN & Autism Friendly Sessions and Home Education Hangouts.
  { regionId: "rushden", url: "https://www.northantslife.co.uk/venue/rushden-athletic-club/", kind: "web", label: "Rushden Athletic Club Events" }, // Listings of events at Rushden Athletic Club, including Thursday Night Quiz and other activities.
  { regionId: "rushden", url: "https://www.perto.com/gb/rushden-40918/the-general-three-hills-brewing-taproom-1003806/", kind: "web", label: "The General, Three Hills Brewing Taproom Events" }, // Upcoming events at The General, including Soundbitez 2.0 on 1 August 2026.

  // dartmouth, 1 page
  { regionId: "dartmouth", url: "https://www.dartmouthgroups.dartmouth.edu/calendar", kind: "web", label: "Dartmouth Groups Calendar" }, // A calendar featuring events from Dartmouth's student organizations and offices, offering a standing listing of campus events.

  // ilfracombe, 5 pages
  { regionId: "ilfracombe", url: "https://www.visitdevon.co.uk/explore/cities-towns-and-villages/ilfracombe/whats-on-in-ilfracombe/", kind: "web", label: "Visit Devon - Ilfracombe Events" }, // Provides a comprehensive list of upcoming events in Ilfracombe, including festivals, art trails, and maritime celebrations, with details on dates and activities.
  { regionId: "ilfracombe", url: "https://www.dilkhusahotelilfracombe.co.uk/whats-on/", kind: "web", label: "Dilkhusa Grand Hotel - Ilfracombe Events" }, // Lists major events in Ilfracombe, such as the Ilfracombe Carnival and Sea Ilfracombe Maritime Festival, with dates and descriptions.
  { regionId: "ilfracombe", url: "https://www.achurchnearyou.com/church/9009/service-and-events/events-all/", kind: "web", label: "Holy Trinity Church - Ilfracombe Events" }, // Offers a calendar of regular events, including bell ringing practice and the Farmer's Market, with specific dates and times.
  { regionId: "ilfracombe", url: "https://northdevonresort.com/events-at-north-devon-resort/", kind: "web", label: "North Devon Resort - Ilfracombe Events" }, // Features upcoming events like The Big North Devon Soul Weekender and Ilfracombe Legends of Rock 2026, with dates and event details.
  { regionId: "ilfracombe", url: "https://www.visitilfracombe.co.uk/events/category/ilfracombe/list/", kind: "web", label: "Visit Ilfracombe - Ilfracombe Events" }, // Provides a calendar of events in Ilfracombe, including cinema screenings and other local happenings, with dates and descriptions.

  // poole, 8 pages
  { regionId: "poole", url: "https://www.poole.gov.uk/whats-on", kind: "web", label: "Poole Borough Council Events" }, // Official council page listing upcoming events in Poole, providing a comprehensive and regularly updated calendar.
  { regionId: "poole", url: "https://www.pooletourism.com/whats-on/festivals", kind: "web", label: "Poole Tourism Festivals" }, // Tourism website detailing annual festivals and events in Poole, offering a broad overview of local happenings.
  { regionId: "poole", url: "https://www.poolelifestyle.co.uk/guide/what-s-on-guide-by-month-1", kind: "web", label: "Poole Lifestyle Events Calendar" }, // Local guide providing a month-by-month breakdown of events in Poole, including festivals and community activities.
  { regionId: "poole", url: "https://www.thepowerhousepoole.org/events", kind: "web", label: "The Power House Poole Events" }, // Community center listing regular arts and crafts sessions, brunches, and evening gatherings, with events scheduled through August 2026.
  { regionId: "poole", url: "https://www.achurchnearyou.com/church/9402/service-and-events/", kind: "web", label: "SML Poole Church Services and Events" }, // Church website detailing regular Sunday services and events, providing a standing listing of weekly activities.
  { regionId: "poole", url: "https://branches.pcuk.org/poole/calendar/", kind: "web", label: "Poole & District Pony Club Calendar" }, // Pony club calendar listing rallies, trainings, and competitions, offering a standing list of equestrian events.
  { regionId: "poole", url: "https://www.resortdorset.com/events/Poole/", kind: "web", label: "Resort Dorset Poole Events" }, // Regional tourism site listing a variety of events in Poole, including festivals, music, and family activities.
  { regionId: "poole", url: "https://poolenow.com/", kind: "web", label: "PooleNow Local Events" }, // Local news and events site providing weekly updates on happenings in Poole, including festivals and community events.

  // weymouth, 8 pages
  { regionId: "weymouth", url: "https://www.weymouthtowncouncil.gov.uk/organiser/we-are-weymouth-uk-2/", kind: "web", label: "We Are Weymouth UK - Weymouth Town Council" }, // This page provides a comprehensive events calendar for Weymouth, listing over 150 events throughout the year, including family festivals, sporting challenges, and art and craft shows. It is a standing listings page that will continue to list events in the coming months.
  { regionId: "weymouth", url: "https://www.weymouthtowncouncil.gov.uk/organiser/dorset-council-2/", kind: "web", label: "Dorset Council - Weymouth Town Council" }, // This page features events organized by Dorset Council in Weymouth, including dog-friendly health walks and other community activities. It is a standing listings page that will continue to list events in the coming months.
  { regionId: "weymouth", url: "https://www.love-weymouth.co.uk/events/weymouth/", kind: "web", label: "Weymouth Events 2023 - Weymouth Tourist Information" }, // This page provides a calendar of events in Weymouth, including food fairs, live music, sporting events, and theatre performances. It is a standing listings page that will continue to list events in the coming months.
  { regionId: "weymouth", url: "https://www.dorsetcouncil.gov.uk/libraries-history-culture/libraries/library-events?cur=3&delta=4&libraryId=279415", kind: "web", label: "Library events in Dorset - Dorset Council" }, // This page lists upcoming events at Dorset Council libraries, including book chats, workshops, and other community activities. It is a standing listings page that will continue to list events in the coming months.
  { regionId: "weymouth", url: "https://www.achurchnearyou.com/church/9293/service-and-events/events-all/", kind: "web", label: "Events - St Mary's, Weymouth - A Church Near You" }, // This page lists regular events at St Mary's Church in Weymouth, including Monday Brunch and Tuesday Coffee & Cake sessions. It is a standing listings page that will continue to list events in the coming months.
  { regionId: "weymouth", url: "https://www.seacrestweymouth.co.uk/whats-on/", kind: "web", label: "What’s On in Weymouth – Seacrest" }, // This page provides an events calendar for Weymouth, including festivals, live music, and shows. It is a standing listings page that will continue to list events in the coming months.
  { regionId: "weymouth", url: "https://www.weymouthconservativeclub.co.uk/calendar/", kind: "web", label: "EVENTS CALENDAR | Weymouth Conservative Club" }, // This page lists upcoming events at the Weymouth Conservative Club, including meat raffles and quiz nights. It is a standing listings page that will continue to list events in the coming months.
  { regionId: "weymouth", url: "https://www.thesandcombe.co.uk/events/", kind: "web", label: "Events - The Sandcombe Guest House" }, // This page provides a calendar of events in Weymouth, including bike and classic car nights, folk festivals, and regattas. It is a standing listings page that will continue to list events in the coming months.

  // bridlington, 4 pages
  { regionId: "bridlington", url: "https://bridlingtonpriory.co.uk/events/proms-at-the-priory-2026/", kind: "web", label: "Bridlington Priory Events" }, // A historic church hosting regular events, including concerts and recitals, with listings available for several months.
  { regionId: "bridlington", url: "https://www.bridspa.com/event-details/?entry=08-highropes", kind: "web", label: "Bridlington Spa High Ropes Events" }, // An adventure park offering high ropes courses, with events scheduled throughout the year.
  { regionId: "bridlington", url: "https://www.visiteastyorkshire.co.uk/race-the-waves/whats-on/", kind: "web", label: "Race the Waves Events" }, // An annual motoring event featuring vintage vehicles racing on the beach, with listings available for several months.
  { regionId: "bridlington", url: "https://www.mccyorkshire.co.uk/event/bridlington-royal-yacht-club-2026-09/", kind: "web", label: "Bridlington Royal Yacht Club Events" }, // A yacht club hosting various events, including rallies and races, with listings available for several months.

  // barnsley, 6 pages
  { regionId: "barnsley", url: "https://www.barnsley.gov.uk/services/community-and-volunteering/whats-on-in-your-local-area/", kind: "web", label: "Barnsley Community Events" }, // Council's community events calendar featuring weekly activities and events funded by local area councils, with listings through November 2026.
  { regionId: "barnsley", url: "https://visitbarnsley.co.uk/whats-on", kind: "web", label: "Visit Barnsley Events" }, // Tourism website showcasing a variety of events in Barnsley, including exhibitions, markets, and festivals, with events listed through February 2027.
  { regionId: "barnsley", url: "https://www.theglassworksbarnsley.com/events/", kind: "web", label: "The Glass Works Barnsley Events" }, // Events calendar for The Glass Works Barnsley, featuring markets and special events, with listings through November 2026.
  { regionId: "barnsley", url: "https://www.experience-barnsley.com/whats-on", kind: "web", label: "Experience Barnsley Museum Events" }, // Museum's events page listing exhibitions and activities, including the 'Cleopatra and the Queens of Egypt' exhibition running through February 2027.
  { regionId: "barnsley", url: "https://www.yorkshire.com/barnsley/events", kind: "web", label: "Yorkshire.com Barnsley Events" }, // Comprehensive list of events in Barnsley, including live music, theatre, and festivals, with events listed through October 2026.
  { regionId: "barnsley", url: "https://www.stayhappening.com/barnsley", kind: "web", label: "StayHappening Barnsley Events" }, // Event listing site featuring upcoming events in Barnsley, including comedy shows, live music, and theatre performances, with events listed through October 2026.

  // rotherham, 2 pages
  { regionId: "rotherham", url: "https://www.rotherham.gov.uk/events", kind: "web", label: "Rotherham Borough Council Events" }, // Official council page listing upcoming events in Rotherham, expected to be updated regularly.
  { regionId: "rotherham", url: "https://www.rotherham.gov.uk/whats-on", kind: "web", label: "Rotherham Borough Council What's On" }, // Council's 'What's On' page featuring a variety of local events, regularly updated.

  // lowestoft, 9 pages
  { regionId: "lowestoft", url: "https://www.waveney.gov.uk/events", kind: "web", label: "Waveney District Council Events" }, // Official council page listing upcoming events in the Lowestoft area, expected to be updated regularly.
  { regionId: "lowestoft", url: "https://www.lowestofttowncouncil.gov.uk/events", kind: "web", label: "Lowestoft Town Council Events" }, // Town council's events page providing information on local happenings, likely to be updated periodically.
  { regionId: "lowestoft", url: "https://www.theberneyarms.co.uk/whats-on", kind: "web", label: "The Berney Arms Events" }, // Local pub listing upcoming events, including live music and community gatherings, with regular updates.
  { regionId: "lowestoft", url: "https://www.lowestoftmuseum.org.uk/whats-on", kind: "web", label: "Lowestoft Museum Events" }, // Museum's events page detailing exhibitions and activities, updated to reflect ongoing and upcoming events.
  { regionId: "lowestoft", url: "https://www.lowestoftarts.org.uk/whats-on", kind: "web", label: "Lowestoft Arts Centre Events" }, // Arts centre's listings of performances and workshops, regularly updated to showcase local talent.
  { regionId: "lowestoft", url: "https://www.lowestoft.co.uk/whats-on", kind: "web", label: "Lowestoft.co.uk Events" }, // Local community website featuring a calendar of events in Lowestoft, updated to include various local happenings.
  { regionId: "lowestoft", url: "https://www.lowestoftjournal.co.uk/whats-on", kind: "web", label: "Lowestoft Journal What's On" }, // Local newspaper's events section providing information on upcoming events in the area, updated regularly.
  { regionId: "lowestoft", url: "https://www.facebook.com/LowestoftEvents", kind: "facebook", label: "Lowestoft Events Facebook Page" }, // Community-run Facebook page listing local events, with regular updates and community engagement.
  { regionId: "lowestoft", url: "https://www.facebook.com/LowestoftArtsCentre", kind: "facebook", label: "Lowestoft Arts Centre Facebook Page" }, // Arts centre's official Facebook page sharing information on upcoming events and activities.

  // dorking, 4 pages
  { regionId: "dorking", url: "https://www.molevalley.gov.uk/leisure-culture/dorking-markets/", kind: "web", label: "Mole Valley District Council Markets" }, // Provides information on Dorking's Friday Market and other seasonal events, indicating ongoing market activities.
  { regionId: "dorking", url: "https://circulardorking.org.uk/events/", kind: "web", label: "Circular Dorking Events" }, // Lists upcoming events in Dorking, including festivals and community activities, suggesting regular event planning.
  { regionId: "dorking", url: "https://whitehorsedorking.com/whats-on/", kind: "web", label: "The White Horse Dorking Events" }, // Details regular events at The White Horse pub, such as quiz nights and live music, indicating ongoing programming.
  { regionId: "dorking", url: "https://www.hellodorking.com/whats-happening-in-dorking-17th-19th-april-2026/", kind: "web", label: "Hello Dorking Events" }, // Provides a detailed list of events happening in Dorking over a specific weekend, indicating regular event updates.

  // mansfield, 5 pages
  { regionId: "mansfield", url: "https://www.mansfield.gov.uk/whats", kind: "web", label: "Mansfield District Council What's On" }, // Council's 'What's On' page featuring a variety of local events and attractions, including leisure centres, museums, and theatres.
  { regionId: "mansfield", url: "https://www.mansfieldpalacetheatre.co.uk/whats-on", kind: "web", label: "Mansfield Palace Theatre What's On" }, // Theatre's events calendar showcasing performances and shows scheduled throughout the year.
  { regionId: "mansfield", url: "https://www.mansfieldmuseum.org.uk/whats-on", kind: "web", label: "Mansfield Museum What's On" }, // Museum's events page listing exhibitions, workshops, and special events.
  { regionId: "mansfield", url: "https://www.visitmansfieldandashfield.co.uk/whats-on", kind: "web", label: "Visit Mansfield and Ashfield What's On" }, // Tourism board's events calendar highlighting local happenings, festivals, and attractions.
  { regionId: "mansfield", url: "https://www.mansfieldtownfc.co.uk/fixtures", kind: "web", label: "Mansfield Town FC Fixtures" }, // Football club's fixture list for upcoming matches, providing dates and venues.

  // newark-on-trent, 10 pages
  { regionId: "newark-on-trent", url: "https://www.newark-sherwooddc.gov.uk/whats-on/", kind: "web", label: "Newark and Sherwood District Council What's On" }, // Official council page listing upcoming events in the Newark and Sherwood district, regularly updated with new events.
  { regionId: "newark-on-trent", url: "https://www.newark.gov.uk/whats-on", kind: "web", label: "Newark Town Council Events" }, // Official town council page providing information on local events in Newark, updated regularly.
  { regionId: "newark-on-trent", url: "https://www.newarkpalace.co.uk/whats-on", kind: "web", label: "Newark Palace Theatre What's On" }, // Listings of upcoming performances and events at the Palace Theatre in Newark, updated regularly.
  { regionId: "newark-on-trent", url: "https://www.newarkcastle.com/whats-on", kind: "web", label: "Newark Castle Events" }, // Official page listing events and activities at Newark Castle, updated regularly.
  { regionId: "newark-on-trent", url: "https://www.visitnewark.co.uk/whats-on", kind: "web", label: "Visit Newark-on-Trent Events" }, // Tourism board's page listing upcoming events in Newark-on-Trent, updated regularly.
  { regionId: "newark-on-trent", url: "https://www.newarkadvertiser.co.uk/whats-on", kind: "web", label: "Newark Advertiser What's On" }, // Local newspaper's events section listing upcoming events in Newark-on-Trent, updated regularly.
  { regionId: "newark-on-trent", url: "https://www.newarkmarket.co.uk/whats-on", kind: "web", label: "Newark Market Events" }, // Market's page listing upcoming events and activities, updated regularly.
  { regionId: "newark-on-trent", url: "https://www.newark.ac.uk/events", kind: "web", label: "Newark College Public Events" }, // College's page listing public events and lectures, updated regularly.
  { regionId: "newark-on-trent", url: "https://www.newarkandnottingham.ac.uk/events", kind: "web", label: "Newark and Nottingham College Events" }, // College's page listing public events and lectures, updated regularly.
  { regionId: "newark-on-trent", url: "https://www.newarkleisure.com/whats-on", kind: "web", label: "Newark Leisure Centre Events" }, // Leisure centre's page listing upcoming events and activities, updated regularly.

  // whitchurch, 10 pages
  { regionId: "whitchurch", url: "https://whitchurchrotary.org.uk/events/latest-events", kind: "web", label: "Whitchurch Rotary Club Events" }, // Lists upcoming events organized by the Rotary Club, including car boot sales and concerts, with dates extending into October 2026.
  { regionId: "whitchurch", url: "https://whitchurchrotary.org.uk/events/car-boot-sales", kind: "web", label: "Whitchurch Rotary Car Boot Sales" }, // Provides dates and details for monthly car boot sales from April to October 2026.
  { regionId: "whitchurch", url: "https://www.whitchurch-heritage.co.uk/", kind: "web", label: "Whitchurch Heritage Centre" }, // Offers information on exhibitions and events related to the town's history, with free entry.
  { regionId: "whitchurch", url: "https://www.achurchnearyou.com/church/4623/service-and-events/", kind: "web", label: "Whitchurch St Alkmunds Church Events" }, // Lists regular services and special events, including Sunday worship and seasonal services.
  { regionId: "whitchurch", url: "https://www.achurchnearyou.com/church/4544/service-and-events/", kind: "web", label: "Tilstock Christ Church Events" }, // Provides details on Sunday worship services and special events at Tilstock Christ Church.
  { regionId: "whitchurch", url: "https://next.shropshire.gov.uk/libraries/find-a-library/whitchurch-library/friday-friends/", kind: "web", label: "Whitchurch Library Friday Friends" }, // Details on a social group meeting every Friday, offering activities and refreshments.
  { regionId: "whitchurch", url: "https://next.shropshire.gov.uk/property-services/markets-in-shropshire/whitchurch/", kind: "web", label: "Whitchurch Market" }, // Information on the indoor market held every Friday and the farmers' market on the first Saturday of each month.
  { regionId: "whitchurch", url: "https://www.shropshirestar.com/news/local-hubs/north-shropshire/whitchurch/2026/02/12/whitchurch-food-and-drink-festival-set-for-return-this-year/", kind: "web", label: "Whitchurch Food & Drink Festival" }, // Announcement of the festival's return in May 2026, featuring local businesses, street food, and live music.
  { regionId: "whitchurch", url: "https://www.shropshirelive.com/entertainment/2026/02/12/whitchurch-food-drink-festival-set-to-return-this-may/", kind: "web", label: "Whitchurch Food & Drink Festival Details" }, // Details about the festival's schedule, activities, and organizers.
  { regionId: "whitchurch", url: "https://www.shropshirelive.com/news/2026/05/20/success-for-whitchurch-food-drink-festival-as-thousands-visit/", kind: "web", label: "Whitchurch Food & Drink Festival Success" }, // Report on the successful turnout and activities at the festival in May 2026.

  // clevedon, 3 pages
  { regionId: "clevedon", url: "https://clevedon.gov.uk/events/list", kind: "web", label: "Clevedon Town Council Events" }, // Official council page listing upcoming meetings and events, updated regularly.
  { regionId: "clevedon", url: "https://www.clevedon.cc/whats-on", kind: "web", label: "Clevedon Community Centre Events" }, // Community centre's 'What's On' page featuring local events and activities.
  { regionId: "clevedon", url: "https://sustainableclevedon.org/greenshift26", kind: "web", label: "Green Shift Festival 2026" }, // Annual festival organized by Sustainable Clevedon, promoting sustainability through various events.

  // burnham-on-sea, 3 pages
  { regionId: "burnham-on-sea", url: "https://www.burnham-on-sea.com/whats-on", kind: "web", label: "Burnham-On-Sea.com What's On" }, // A comprehensive, regularly updated guide to local events in Burnham-On-Sea and Highbridge, featuring a variety of community activities and festivals.
  { regionId: "burnham-on-sea", url: "https://burnhaminformation.com/whats-on", kind: "web", label: "Burnham-on-Sea Information Centre Events" }, // The official tourist information centre's events calendar, listing major annual events and festivals in Burnham-on-Sea and Highbridge.
  { regionId: "burnham-on-sea", url: "https://www.burnham-on-sea.com/calendar/whats-on-in-burnham-on-sea/", kind: "web", label: "Burnham-On-Sea.com Events Calendar" }, // An extensive calendar of local events, including regular community activities and special events in Burnham-On-Sea.

  // dover, 3 pages
  { regionId: "dover", url: "https://www.destinationdover.org/whats-on-calendar/", kind: "web", label: "Destination Dover What's On Calendar" }, // Tourism board's calendar featuring upcoming events, festivals, and activities in Dover, Kent.
  { regionId: "dover", url: "https://www.dover.gov.uk/Community/Home.aspx", kind: "web", label: "Dover District Council Community & Events" }, // Council's community page with information on local events, community groups, and safety initiatives.
  { regionId: "dover", url: "https://theatersonline.com/whats-on/dover/", kind: "web", label: "Theatres Online - What's On in Dover" }, // Listings of shows and performances in Dover, including venues and event details.

  // folkestone, 7 pages
  { regionId: "folkestone", url: "https://folkestoneevents.co.uk/", kind: "web", label: "Folkestone Events" }, // A comprehensive guide to upcoming events in Folkestone, including music gigs, art exhibitions, and community workshops. The site regularly updates its listings, ensuring a standing list of events.
  { regionId: "folkestone", url: "https://www.creativefolkestone.org.uk/folkestone-quarterhouse/quarterhouse-events/", kind: "web", label: "Quarterhouse Events" }, // The official events page for the Quarterhouse, Folkestone's premier arts venue, listing a variety of performances and workshops. The page is regularly updated with upcoming events.
  { regionId: "folkestone", url: "https://folkestonemusic.co.uk/gig-guide/calendar/", kind: "web", label: "Folkestone Music Town Gig Guide" }, // A calendar of live music events in Folkestone, including band performances, DJ sets, and open mic nights. The guide is updated regularly, providing a standing list of music events.
  { regionId: "folkestone", url: "https://folkestoneinsider.co.uk/whats-on/", kind: "web", label: "Folkestone Insider What's On" }, // A local guide featuring a calendar of events in Folkestone, including music, dance, and family events. The site is updated regularly with new listings.
  { regionId: "folkestone", url: "https://folke.life/folkestone/events/", kind: "web", label: "Folkelife Events" }, // A platform showcasing events in Folkestone, including festivals, markets, and cultural activities. The site provides a regularly updated list of events.
  { regionId: "folkestone", url: "https://www.folkestonetheatre.co.uk/venues/leas-cliff-hall", kind: "web", label: "Leas Cliff Hall What's On" }, // The official events page for Leas Cliff Hall, Folkestone's main theatre venue, listing upcoming shows, concerts, and performances. The page is regularly updated with new events.
  { regionId: "folkestone", url: "https://folkestoneinsider.co.uk/events/calendar/music-events/", kind: "web", label: "Folkestone Insider Music Events" }, // A calendar of music and dance events in Folkestone, including live performances and workshops. The site is updated regularly with new listings.

  // ashford, 8 pages
  { regionId: "ashford", url: "https://www.ashford.gov.uk/things-to-do/", kind: "web", label: "Ashford Borough Council - Things To Do" }, // Official council page listing ongoing events and activities in Ashford, ensuring up-to-date information for residents and visitors.
  { regionId: "ashford", url: "https://www.loveashford.com/", kind: "web", label: "Love Ashford" }, // Council-facilitated platform promoting Ashford Town Centre, featuring a comprehensive events calendar and local business information.
  { regionId: "ashford", url: "https://www.revelationashford.co.uk/", kind: "web", label: "Revelation Ashford" }, // Ashford's premier music and arts venue, offering a variety of events including music, theatre, and workshops throughout the year.
  { regionId: "ashford", url: "https://www.coach-works.co.uk/", kind: "web", label: "Coachworks Ashford" }, // Live music venue hosting regular events and performances, contributing to the local cultural scene.
  { regionId: "ashford", url: "https://www.harperscafe.org/events", kind: "web", label: "Harper's Cafe Ashford" }, // Community-focused cafe offering a range of events, workshops, and activities for all ages.
  { regionId: "ashford", url: "https://www.bonnycravat.co.uk/events", kind: "web", label: "Bonny Cravat Pub Ashford" }, // Local pub featuring live music nights, quiz events, and themed meals, fostering community engagement.
  { regionId: "ashford", url: "https://www.createashford.co.uk/", kind: "web", label: "Create Music Village" }, // Initiative supporting grassroots music scene in Ashford, organizing gigs, workshops, and community events.
  { regionId: "ashford", url: "https://www.ashford.gov.uk/events", kind: "web", label: "Ashford Borough Council - Events and Promotions" }, // Official council page providing information on local events, promotions, and community activities.

  // tunbridge-wells, 5 pages
  { regionId: "tunbridge-wells", url: "https://visittunbridgewells.com/events/", kind: "web", label: "Visit Tunbridge Wells Events" }, // Official tourism website listing upcoming events in Royal Tunbridge Wells, updated regularly.
  { regionId: "tunbridge-wells", url: "https://www.royalwells.co.uk/upcoming-events/", kind: "web", label: "Royal Wells Hotel Events" }, // Hotel's events page featuring upcoming events and activities.
  { regionId: "tunbridge-wells", url: "https://www.clarendons.uk/area-guides/estate-agents-tunbridge-wells/whats-happening-in-tunbridge-wells", kind: "web", label: "Clarendons Estate Agents Events" }, // Local estate agent's guide to events and happenings in Tunbridge Wells.
  { regionId: "tunbridge-wells", url: "https://www.wealdradio.co.uk/events-guide/event/live-music-rebel-diamond/", kind: "web", label: "Weald Radio Live Music Events" }, // Local radio station's listings of live music events in the area.
  { regionId: "tunbridge-wells", url: "https://mytunbridgewells.com/events/", kind: "web", label: "My Tunbridge Wells Events" }, // Local guide providing information on upcoming events in Tunbridge Wells.

  // gravesend, 10 pages
  { regionId: "gravesend", url: "https://www.gravesham.gov.uk/whats-on", kind: "web", label: "Gravesham Borough Council Events" }, // Official council page listing various upcoming events in Gravesham, including festivals, exhibitions, and community activities.
  { regionId: "gravesend", url: "https://www.visitgravesend.co.uk/events", kind: "web", label: "Visit Gravesend Events" }, // Local tourism board's events page featuring a calendar of activities, festivals, and attractions in Gravesend.
  { regionId: "gravesend", url: "https://www.gravesendgurdwara.org.uk/events", kind: "web", label: "Guru Nanak Darbar Gurdwara Events" }, // Local Gurdwara's events page listing religious and cultural events, including the annual Vaisakhi Procession.
  { regionId: "gravesend", url: "https://www.gravesendregatta.org.uk/", kind: "web", label: "Gravesend Regatta" }, // Official website of the Gravesend Regatta, providing information on the annual rowing event and associated festivities.
  { regionId: "gravesend", url: "https://www.gravesendtheatre.co.uk/whats-on", kind: "web", label: "Gravesend Theatre Events" }, // Local theatre's events page listing upcoming performances, shows, and community events.
  { regionId: "gravesend", url: "https://www.gravesendmuseum.org.uk/whats-on", kind: "web", label: "Gravesend Museum Events" }, // Museum's events page featuring exhibitions, talks, and workshops related to Gravesend's history.
  { regionId: "gravesend", url: "https://www.gravesendgolfclub.co.uk/whats-on", kind: "web", label: "Gravesend Golf Club Events" }, // Golf club's events page listing tournaments, social events, and community activities.
  { regionId: "gravesend", url: "https://www.gravesendlibrary.co.uk/whats-on", kind: "web", label: "Gravesend Library Events" }, // Library's events page featuring book clubs, workshops, and educational programs.
  { regionId: "gravesend", url: "https://www.gravesendartscentre.co.uk/whats-on", kind: "web", label: "Gravesend Arts Centre Events" }, // Arts centre's events page listing performances, exhibitions, and workshops.
  { regionId: "gravesend", url: "https://www.gravesendtownpier.co.uk/whats-on", kind: "web", label: "Gravesend Town Pier Events" }, // Town pier's events page featuring maritime events, markets, and community gatherings.

  // deal, 9 pages
  { regionId: "deal", url: "https://www.whitecliffscountry.org.uk/whats-on", kind: "web", label: "White Cliffs Country What's On" }, // A comprehensive events calendar for the Dover District, including Deal, featuring a variety of local events.
  { regionId: "deal", url: "https://www.kentmomi.org/events", kind: "web", label: "Kent Museum of the Moving Image Events" }, // The museum's events page lists upcoming exhibitions and performances, providing a standing list of events.
  { regionId: "deal", url: "https://www.astor-theatre.co.uk/whats-on", kind: "web", label: "Astor Theatre What's On" }, // Theatre's events page detailing upcoming performances and exhibitions, offering a standing list of events.
  { regionId: "deal", url: "https://www.dealmusicandarts.com/", kind: "web", label: "Deal Music & Arts" }, // Organization's website listing annual festivals and events, providing a standing list of cultural activities.
  { regionId: "deal", url: "https://www.visitkent.co.uk/whats-on", kind: "web", label: "Visit Kent What's On" }, // Kent County Council's tourism website featuring a calendar of events across the county, including Deal.
  { regionId: "deal", url: "https://www.deal.gov.uk/whats-on", kind: "web", label: "Deal Town Council What's On" }, // Official town council page listing local events and activities, offering a standing list of community happenings.
  { regionId: "deal", url: "https://www.dealpier.co.uk/whats-on", kind: "web", label: "Deal Pier What's On" }, // Deal Pier's events page detailing upcoming activities and performances, providing a standing list of events.
  { regionId: "deal", url: "https://www.dealparishcouncil.co.uk/whats-on", kind: "web", label: "Deal Parish Council What's On" }, // Parish council's page listing local events and community activities, offering a standing list of happenings.
  { regionId: "deal", url: "https://www.dealcastle.co.uk/whats-on", kind: "web", label: "Deal Castle What's On" }, // Historic castle's events page detailing upcoming exhibitions and activities, providing a standing list of events.

  // skelmersdale, 5 pages
  { regionId: "skelmersdale", url: "https://skelmersdaleprizeband.org/events", kind: "web", label: "Skelmersdale Prize Band Events" }, // Lists upcoming concerts and events organized by the Skelmersdale Prize Band, including dates and venues.
  { regionId: "skelmersdale", url: "https://www.skelmersdaleheritage.org.uk/", kind: "web", label: "Skelmersdale Heritage Society" }, // Provides information on local heritage events, including meetings and talks, with dates and locations.
  { regionId: "skelmersdale", url: "https://www.lancashire.police.uk/area/your-area/lancashire/west-lancashire/skelmersdale-south/meetings-and-events/top-reported-crimes-in-this-area", kind: "web", label: "Skelmersdale South Police Events" }, // Lists community events organized by the local police, such as family support days and walkabouts, with dates and venues.
  { regionId: "skelmersdale", url: "https://www.lancashire.police.uk/area/your-area/lancashire/west-lancashire/skelmersdale-north/meetings-and-events/top-reported-crimes-in-this-area", kind: "web", label: "Skelmersdale North Police Events" }, // Provides information on community events organized by the local police, including dates and locations.
  { regionId: "skelmersdale", url: "https://www.liverpooltheatres.com/things-to-do/skelmersdale", kind: "web", label: "Liverpool Theatres - Skelmersdale" }, // Offers a list of events happening in Skelmersdale, including theatre performances and other cultural events, with dates and venues.

  // clitheroe, 2 pages
  { regionId: "clitheroe", url: "https://www.ribblevalley.gov.uk/events/event/602/echo-weekender", kind: "web", label: "ECHO Weekender" }, // A two-day music festival in Clitheroe, featuring live artists, DJs, tribute acts, street food, bars, and immersive entertainment. Scheduled for 22nd-23rd August 2026, making it a standing listing.
  { regionId: "clitheroe", url: "https://www.ribblevalley.gov.uk/events/event/614/clitheroe-food-festival", kind: "web", label: "Clitheroe Food Festival" }, // An annual event showcasing local and award-winning food and drink producers, attracting over 25,000 visitors. Scheduled for 8th August 2026, making it a standing listing.

  // bedworth, 5 pages
  { regionId: "bedworth", url: "https://www.uktheatre.org/bedworth/bedworth-civic-hall/v127/", kind: "web", label: "UK Theatre Bedworth Civic Hall" }, // Venue page with current and forthcoming events at Bedworth's Civic Hall, including concerts and theatre performances.
  { regionId: "bedworth", url: "https://www.nuneatonandbedworth.gov.uk/downloads/file/2598/agenda-08062026", kind: "web", label: "Believe in Bedworth Board Agenda" }, // Document detailing upcoming community events and projects in Bedworth, including the Christmas lights switch-on scheduled for 21st November 2026.
  { regionId: "bedworth", url: "https://www.bedworth-society.co.uk/", kind: "web", label: "The Bedworth Society" }, // Local society hosting monthly public meetings and events from September to June, featuring guest speakers and community activities.
  { regionId: "bedworth", url: "https://www.facebook.com/BedworthCivicHall", kind: "facebook", label: "Bedworth Civic Hall Facebook Page" }, // Official Facebook page of Bedworth Civic Hall, providing updates on upcoming events and community activities.
  { regionId: "bedworth", url: "https://www.facebook.com/BedworthLibrary", kind: "facebook", label: "Bedworth Library Facebook Page" }, // Official Facebook page of Bedworth Library, listing events and activities for all ages.

  // dudley, 4 pages
  { regionId: "dudley", url: "https://www.dudley.gov.uk/see-and-do/events/", kind: "web", label: "Dudley Council Events" }, // Official council page listing a variety of events throughout the year, including Armed Forces Day, Vintage Transport Fair, and Christmas events.
  { regionId: "dudley", url: "https://www.dudley.gov.uk/things-to-do/events-in-the-area/", kind: "web", label: "Dudley Council Events in the Area" }, // Council page detailing events in the Dudley borough, such as Armed Forces Day, Vintage Transport Fair, and Christmas events.
  { regionId: "dudley", url: "https://www.dudleyzoo.org.uk/events/whats-on-at-dzc/", kind: "web", label: "Dudley Zoo and Castle Events" }, // Official page listing seasonal events at Dudley Zoo and Castle, including Easter half term, St George’s Day, and family fun weekends.
  { regionId: "dudley", url: "https://www.dudleycanaltrust.org.uk/events/", kind: "web", label: "Dudley Canal and Caverns Events" }, // Official page listing events at Dudley Canal and Caverns, including Halloween and Christmas events.

  // worthing, 5 pages
  { regionId: "worthing", url: "https://worthingtowncentre.co.uk/whats-on/", kind: "web", label: "Worthing Town Centre BID" }, // Lists upcoming events in Worthing, including markets, festivals, and live music, with dates extending into November 2026.
  { regionId: "worthing", url: "https://www.shazam.com/en-gb/event/venue/I2FF8C019D26B7A25", kind: "web", label: "The Factory Live" }, // Provides a calendar of upcoming concerts and events at The Factory Live, with listings through November 2026.
  { regionId: "worthing", url: "https://www.shazam.com/event/venue/8dccbc4c-c38b-4c32-ad87-1c677d823e4e", kind: "web", label: "The Venue Worthing" }, // Offers a schedule of upcoming concerts and events at The Venue Worthing, with dates extending into October 2026.
  { regionId: "worthing", url: "https://stayhappening.com/worthing", kind: "web", label: "StayHappening Worthing" }, // Aggregates various events in Worthing, including festivals, concerts, and community activities, with listings through November 2026.
  { regionId: "worthing", url: "https://happeningnext.com/worthing", kind: "web", label: "HappeningNext Worthing" }, // Provides a comprehensive list of upcoming events in Worthing, including live music, festivals, and community gatherings, with dates extending into November 2026.

  // loughborough, 5 pages
  { regionId: "loughborough", url: "https://www.fosse107.co.uk/loughborough/events/", kind: "web", label: "Fosse 107 Loughborough Events" }, // A local community magazine providing a calendar of upcoming events in Loughborough, including exhibitions, fairs, and music in the park.
  { regionId: "loughborough", url: "https://www.lboro.ac.uk/sport/events/", kind: "web", label: "Loughborough University Sport Events" }, // The university's official page listing sporting events and fixtures, including matches and competitions, with events scheduled throughout the year.
  { regionId: "loughborough", url: "https://www.britinfo.net/uk/events.php?cc=CBP", kind: "web", label: "Britinfo Loughborough Events" }, // A directory of events in and around Loughborough, including comedy clubs, workshops, and seasonal festivals, with listings for the upcoming year.
  { regionId: "loughborough", url: "https://www.thebestof.co.uk/local/loughborough/events/", kind: "web", label: "The Best of Loughborough Events" }, // A local guide featuring upcoming events in Loughborough, including performances, workshops, and community activities, with events listed for the coming months.
  { regionId: "loughborough", url: "https://www.loughborough.ac.uk/sport/events/", kind: "web", label: "Loughborough University Sport Events" }, // The university's official page listing sporting events and fixtures, including matches and competitions, with events scheduled throughout the year.

  // leyland, 10 pages
  { regionId: "leyland", url: "https://www.southribble.gov.uk/events", kind: "web", label: "South Ribble Borough Council Events" }, // Official council page listing upcoming events in Leyland and surrounding areas, regularly updated with new events.
  { regionId: "leyland", url: "https://leylandtc.org.uk/events", kind: "web", label: "Leyland Town Council Events" }, // Official town council page providing information on local events, updated regularly.
  { regionId: "leyland", url: "https://www.leyland.co.uk/whats-on", kind: "web", label: "Leyland Town Centre What's On" }, // Local tourism board's page listing events in Leyland, updated with new events.
  { regionId: "leyland", url: "https://www.leylandfestival.co.uk/whats-on", kind: "web", label: "Leyland Festival Events" }, // Annual festival's page listing events, updated with new events.
  { regionId: "leyland", url: "https://www.leylandartsfestival.co.uk/whats-on", kind: "web", label: "Leyland Arts Festival Events" }, // Arts festival's page listing events, updated with new events.
  { regionId: "leyland", url: "https://www.leylandmuseums.co.uk/whats-on", kind: "web", label: "Leyland & District Historical Society Events" }, // Museum's page listing upcoming events, updated regularly.
  { regionId: "leyland", url: "https://www.leylandlibrary.co.uk/whats-on", kind: "web", label: "Leyland Library Events" }, // Library's page listing events, updated regularly.
  { regionId: "leyland", url: "https://www.leylandmarket.co.uk/whats-on", kind: "web", label: "Leyland Market Events" }, // Market's page listing events, updated regularly.
  { regionId: "leyland", url: "https://www.leylandrfc.co.uk/fixtures", kind: "web", label: "Leyland Rugby Club Fixtures" }, // Rugby club's page listing fixtures, updated regularly.
  { regionId: "leyland", url: "https://www.leylandfc.co.uk/fixtures", kind: "web", label: "Leyland Football Club Fixtures" }, // Football club's page listing fixtures, updated regularly.

  // cromer, 5 pages
  { regionId: "cromer", url: "https://visitcromer.org.uk/calendar/", kind: "web", label: "Visit Cromer Calendar" }, // Official tourism website providing a comprehensive calendar of events throughout the year, including major annual events like the Cromer Carnival and Cromer Pier Show.
  { regionId: "cromer", url: "https://www.cromerpier.co.uk/whats-on/", kind: "web", label: "Cromer Pier What's On" }, // Official Cromer Pier website listing upcoming events, including the Cromer Pier Show and other performances.
  { regionId: "cromer", url: "https://www.cromercrabandlobsterfestival.co.uk/events/all.html", kind: "web", label: "Cromer Crab and Lobster Festival Events" }, // Official festival website detailing events such as the Crab and Lobster Festival and the World Pier Crabbing Championships.
  { regionId: "cromer", url: "https://cromer-artspace.uk/whats-on/", kind: "web", label: "Cromer Artspace What's On" }, // Local artspace listing exhibitions, workshops, and talks, including the 'Colourful Souls' exhibition.
  { regionId: "cromer", url: "https://www.thisiscromer.co.uk/whatson", kind: "web", label: "This Is Cromer What's On" }, // Community website providing a list of upcoming events in Cromer, including the Cromer Carnival and New Year's Day Fireworks.

  // glasgow, 3 pages
  { regionId: "glasgow", url: "https://www.cca-glasgow.com/programme", kind: "web", label: "CCA Glasgow" }, // Centre for Contemporary Arts providing a comprehensive programme of events, exhibitions, and performances.
  { regionId: "glasgow", url: "https://www.mctcc.scot/category/meetings/", kind: "web", label: "Merchant City and Trongate Community Council" }, // Community council's meetings and events, including minutes and upcoming gatherings.
  { regionId: "glasgow", url: "https://www.glasgow.gov.uk/whats-on", kind: "web", label: "Glasgow City Council" }, // City council's official 'What's On' page featuring a range of events and activities.

  // bognor-regis, 3 pages
  { regionId: "bognor-regis", url: "https://www.bognorregis.gov.uk/_virDir/CoreContents/Events/Display.aspx?Id=25544", kind: "web", label: "Proms In The Park 2026" }, // Details of the Proms In The Park event held on 13 June 2026, including live music and Proms classics.
  { regionId: "bognor-regis", url: "https://www.bognorregismusic.org.uk/", kind: "web", label: "Bognor Regis Music Club" }, // Club hosting various music events, including performances by Akiko Ross and Yuriko & Kenji Luc in October 2026.
  { regionId: "bognor-regis", url: "https://www.bognorregismc.co.uk/club-calendar", kind: "web", label: "Bognor Regis Motor Club Calendar" }, // Club calendar listing various events, including Grass Autotests and Goodwood Revival in September 2026.

  // shoreham-by-sea, 7 pages
  { regionId: "shoreham-by-sea", url: "https://www.ropetacklecentre.co.uk/whats-on/", kind: "web", label: "Ropetackle Arts Centre" }, // A multi-award-winning venue hosting a variety of events, including music, comedy, and children's shows. Their 'What's On' page provides a comprehensive list of upcoming events.
  { regionId: "shoreham-by-sea", url: "https://www.longshorepubshoreham.co.uk/publife", kind: "web", label: "The Longshore Shoreham by Sea" }, // A local pub offering a range of events, including live entertainment and themed party nights. Their 'PubLife' page lists current and upcoming events.
  { regionId: "shoreham-by-sea", url: "https://www.crownandanchorshoreham.co.uk/whats-on", kind: "web", label: "Crown & Anchor" }, // A riverside pub known for its live music gigs and special events. Their 'What's On' page details upcoming events and activities.
  { regionId: "shoreham-by-sea", url: "https://www.meetup.com/cities/gb/p6/shoreham-by-sea/outdoors-adventure/", kind: "web", label: "Meetup: Outdoors & Adventure in Shoreham-by-Sea" }, // A platform listing various outdoor and adventure events in Shoreham-by-Sea, including hiking, cycling, and other activities.
  { regionId: "shoreham-by-sea", url: "https://www.meetup.com/cities/gb/p6/shoreham-by-sea/tech/", kind: "web", label: "Meetup: Tech Events in Shoreham-by-Sea" }, // A platform listing technology-related events in Shoreham-by-Sea, such as workshops, talks, and networking events.
  { regionId: "shoreham-by-sea", url: "https://www.timeoutdoors.com/events/10k-runs/shoreham-by-sea", kind: "web", label: "10K Runs in Shoreham-by-Sea" }, // A listing of upcoming 10K running events in Shoreham-by-Sea, including dates, locations, and registration details.
  { regionId: "shoreham-by-sea", url: "https://www.folkmaster.com/", kind: "web", label: "Folkmaster" }, // Organizes regular folk music events in Shoreham-by-Sea, including monthly sessions and an annual mini folk festival.

  // castleford, 8 pages
  { regionId: "castleford", url: "https://museumsandcastles.wakefield.gov.uk/whats-on/", kind: "web", label: "Wakefield Museums and Castles What's On" }, // Lists ongoing and upcoming events at various museums and castles in the Wakefield district, including Castleford Museum.
  { regionId: "castleford", url: "https://www.castlefordtigers.com/match-centre", kind: "web", label: "Castleford Tigers Match Centre" }, // Provides fixtures and results for Castleford Tigers rugby league matches, including home games at the OneBore Stadium.
  { regionId: "castleford", url: "https://www.castlefordtigers.com/article/421/introducing-the-castleford-10k", kind: "web", label: "Castleford 10K Event Details" }, // Details about the inaugural Castleford 10K race scheduled for 20th September 2026, including registration information.
  { regionId: "castleford", url: "https://www.stallfinder.com/event/artisan-street-fayre-junction-32-castleford-monthly/259700/", kind: "web", label: "Artisan Street Fayre at Junction 32" }, // Monthly artisan street fayre held at Junction 32 Shopping Outlet in Castleford, featuring independent traders and handmade goods.
  { regionId: "castleford", url: "https://www.wakefield.gov.uk/markets/wakefield-market-events", kind: "web", label: "Wakefield Market Events" }, // Comprehensive list of markets and events across the Wakefield district, including Castleford, such as car boot sales and artisan markets.
  { regionId: "castleford", url: "https://experiencewakefield.co.uk/event/4-hour-boat-trips-from-castleford/", kind: "web", label: "4-Hour Boat Trips from Castleford" }, // Offers four-hour boat trips from Castleford, providing a unique experience on the canal aboard the historic Apollo.
  { regionId: "castleford", url: "https://www.facebook.com/CastlefordTigersRLFC", kind: "facebook", label: "Castleford Tigers Facebook Page" }, // Official Facebook page of Castleford Tigers, featuring updates on matches, events, and community activities.
  { regionId: "castleford", url: "https://www.facebook.com/CastlefordMuseum", kind: "facebook", label: "Castleford Museum Facebook Page" }, // Official Facebook page of Castleford Museum, providing updates on exhibitions, events, and activities.

  // evesham, 7 pages
  { regionId: "evesham", url: "https://www.visitevesham.co.uk/whats-on/", kind: "web", label: "Visit Evesham What's On" }, // Official tourism website listing upcoming events in Evesham, updated regularly.
  { regionId: "evesham", url: "https://www.eveshamtowncouncil.gov.uk/events/", kind: "web", label: "Evesham Town Council Events" }, // Official town council events calendar, providing information on local meetings and activities.
  { regionId: "evesham", url: "https://www.honeybournevillagehall.org/groups/weekly-calendar/", kind: "web", label: "Honeybourne Village Hall Weekly Calendar" }, // Community hall offering a variety of regular groups and activities, with an updated weekly schedule.
  { regionId: "evesham", url: "https://www.eveshamdistrictpensionersassociation.co.uk/events", kind: "web", label: "Evesham & District Pensioner's Association Events" }, // Local association hosting regular events for pensioners, with a calendar of upcoming activities.
  { regionId: "evesham", url: "https://www.walkevesham.uk/events/", kind: "web", label: "Evesham Welcomes Walkers Events" }, // Organization promoting walking events in Evesham, featuring a list of upcoming walks and festivals.
  { regionId: "evesham", url: "https://www.thevalleyshopping.co.uk/whatson/christmas-penguin-trail", kind: "web", label: "The Valley Evesham Christmas Penguin Trail" }, // Annual festive event featuring a trail of hand-built brick penguins, with details for the 2025-2026 season.
  { regionId: "evesham", url: "https://www.happeningnext.com/evesham/parties", kind: "web", label: "Evesham Parties Events" }, // Event listing site featuring parties and social events in Evesham, with a calendar of upcoming gatherings.

  // inverness, 8 pages
  { regionId: "inverness", url: "https://www.explore-inverness.com/whats-on/", kind: "web", label: "Explore Inverness - What's On" }, // Provides information on local events, including live music, arts, and cultural happenings, with details on venues and regular events.
  { regionId: "inverness", url: "https://www.ironworksvenue.com/event/", kind: "web", label: "Ironworks Music Venue" }, // Lists upcoming music, comedy, and other events at the Ironworks venue in Inverness, with events scheduled through December 2026.
  { regionId: "inverness", url: "https://www.invernesscathedral.org/events/", kind: "web", label: "Inverness Cathedral Events" }, // Offers a calendar of services and events at Inverness Cathedral, including choral evensongs and other services.
  { regionId: "inverness", url: "https://www.gaskhouse.co.uk/events-calendar/", kind: "web", label: "Gask House Events Calendar" }, // Features a calendar of local events in and around Strathnairn, Inverness, and Loch Ness, including arts, crafts, and food events.
  { regionId: "inverness", url: "https://www.ticketfairy.com/events-in-inverness", kind: "web", label: "Ticket Fairy - Inverness Events" }, // Provides a list of upcoming events in Inverness, including concerts, festivals, and other activities.
  { regionId: "inverness", url: "https://www.inverness.fyi/", kind: "web", label: "Inverness.fyi" }, // A local guide to events, gigs, markets, and more in Inverness, updated daily from public sources.
  { regionId: "inverness", url: "https://www.lochnessmarathon.com/", kind: "web", label: "Loch Ness Marathon" }, // Official website for the annual Loch Ness Marathon, held in Inverness, with information on the marathon and related events.
  { regionId: "inverness", url: "https://www.redhothighlandfling.com/", kind: "web", label: "Red Hot Highland Fling" }, // Official website for the annual New Year's Eve concert in Inverness, featuring information on the event and related festivities.

  // arbroath, 10 pages
  { regionId: "arbroath", url: "https://www.arbroath.gov.uk/whats-on", kind: "web", label: "Arbroath Town Council Events" }, // Official events page listing upcoming activities in Arbroath, maintained by the town council.
  { regionId: "arbroath", url: "https://www.visitangus.com/whats-on", kind: "web", label: "Visit Angus Events" }, // Tourism board's events page featuring a variety of local happenings in Arbroath and surrounding areas.
  { regionId: "arbroath", url: "https://www.arbroathherald.co.uk/whats-on", kind: "web", label: "Arbroath Herald What's On" }, // Local newspaper's events section providing information on upcoming events in Arbroath.
  { regionId: "arbroath", url: "https://www.arbroathmuseums.co.uk/whats-on", kind: "web", label: "Arbroath Museums Events" }, // Museums' events page listing exhibitions and activities in Arbroath.
  { regionId: "arbroath", url: "https://www.arbroaththeatre.co.uk/whats-on", kind: "web", label: "Arbroath Theatre Events" }, // Theatre's events page showcasing upcoming performances and shows in Arbroath.
  { regionId: "arbroath", url: "https://www.arbroathlibrary.co.uk/events", kind: "web", label: "Arbroath Library Events" }, // Library's events page listing workshops, talks, and other activities in Arbroath.
  { regionId: "arbroath", url: "https://www.arbroathcommunitycentre.co.uk/whats-on", kind: "web", label: "Arbroath Community Centre Events" }, // Community centre's events page featuring local happenings and activities.
  { regionId: "arbroath", url: "https://www.arbroathgolfclub.co.uk/whats-on", kind: "web", label: "Arbroath Golf Club Events" }, // Golf club's events page listing tournaments and social events in Arbroath.
  { regionId: "arbroath", url: "https://www.arbroathharbour.co.uk/events", kind: "web", label: "Arbroath Harbour Events" }, // Harbour's events page showcasing maritime-related activities and festivals.
  { regionId: "arbroath", url: "https://www.arbroathchamber.co.uk/events", kind: "web", label: "Arbroath Chamber of Commerce Events" }, // Chamber of Commerce's events page listing business and community events in Arbroath.

  // paisley, 6 pages
  { regionId: "paisley", url: "https://paisley.is/events/", kind: "web", label: "Paisley.is Events" }, // Comprehensive listings of upcoming events in Paisley, maintained by the local community.
  { regionId: "paisley", url: "https://paisley.org.uk/events/", kind: "web", label: "Paisley.org.uk Events" }, // Detailed calendar of events in Paisley, including festivals, workshops, and community activities.
  { regionId: "paisley", url: "https://www.uglyduckpaisley.com/what-s-on", kind: "web", label: "The Ugly Duck What's On" }, // Regularly updated schedule of events at The Ugly Duck venue in Paisley, featuring live music and other activities.
  { regionId: "paisley", url: "https://www.whatsoninpaisley.com/events", kind: "web", label: "What's On in Paisley Events" }, // Curated list of events in Paisley, including live music, family events, and cultural activities.
  { regionId: "paisley", url: "https://www.renfrewshire.gov.uk/article/10535/Events-in-Renfrewshire", kind: "web", label: "Renfrewshire Council Events" }, // Official events calendar for Renfrewshire, including major events in Paisley and surrounding areas.
  { regionId: "paisley", url: "https://www.paisleyfirst.com/events/", kind: "web", label: "Paisley First Events" }, // Events calendar for Paisley town centre, featuring local festivals, markets, and community events.

  // hamilton, 4 pages
  { regionId: "hamilton", url: "https://hamilton-park.co.uk/?source=racingfixtures", kind: "web", label: "Hamilton Park Racecourse" }, // Official website listing upcoming horse racing events and live entertainment at Hamilton Park Racecourse.
  { regionId: "hamilton", url: "https://hamiltonourtown.co.uk/whats-happening/", kind: "web", label: "Hamilton Our Town - What's Happening" }, // Local news and event updates for Hamilton, including festivals, markets, and community activities.
  { regionId: "hamilton", url: "https://www.historicenvironment.scot/visit/all/bothwell-castle/whats-on/", kind: "web", label: "Bothwell Castle - What's On" }, // Event listings for Bothwell Castle, including health walks and other activities.
  { regionId: "hamilton", url: "https://www.historicenvironment.scot/visit/all/skara-brae/whats-on/", kind: "web", label: "Skara Brae - What's On" }, // Event listings for Skara Brae, including evening tours and other activities.

  // --- END SEEDS ---
  // Do not remove or move this line. localscan-discover.js finds it by exact
  // text match and inserts proposed new entries directly above it, in the
  // pull requests it opens. Anything below this line is not part of the
  // array (see the closing bracket next) and would break the file.
];
