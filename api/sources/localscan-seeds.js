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

    { regionId: "northampton", url: "https://www.northampton.gov.uk/whats-on", kind: "web", label: "Northampton Borough Council Events" }, // Official council page listing upcoming events in Northampton, updated regularly.
  { regionId: "northampton", url: "https://www.northampton.ac.uk/events", kind: "web", label: "University of Northampton Events" }, // University's public events and lectures calendar, featuring a variety of academic and cultural events.
  { regionId: "northampton", url: "https://www.royalandderngate.co.uk/whats-on", kind: "web", label: "Royal & Derngate Theatre Events" }, // Listings of performances and events at Northampton's main theatre, updated regularly.
  { regionId: "northampton", url: "https://www.northamptonmuseumandartgallery.org/whats-on", kind: "web", label: "Northampton Museum & Art Gallery Events" }, // Museum's events page featuring exhibitions, workshops, and talks.
  { regionId: "northampton", url: "https://www.visitnorthampton.co.uk/whats-on", kind: "web", label: "Visit Northampton Events" }, // Tourism board's comprehensive events calendar for the area.
  { regionId: "northampton", url: "https://www.northamptonchron.co.uk/whats-on", kind: "web", label: "Northampton Chronicle & Echo What's On" }, // Local newspaper's events section, covering a wide range of activities.
  { regionId: "northampton", url: "https://www.facebook.com/VisitNorthampton", kind: "facebook", label: "Visit Northampton Facebook Page" }, // Official tourism board's Facebook page, regularly updated with local events.
  { regionId: "northampton", url: "https://www.facebook.com/royalderngate", kind: "facebook", label: "Royal & Derngate Theatre Facebook Page" }, // Theatre's Facebook page with event listings and updates.
  { regionId: "morpeth", url: "https://morpeth.net/events/morpeth-farmers-market-september-2026", kind: "web", label: "Morpeth Farmers Market" }, // Monthly market held on the first Saturday of each month, listing events for September 2026.
  { regionId: "morpeth", url: "https://www.whaltonvillageshow.com/", kind: "web", label: "Whalton Village Show" }, // Annual village show scheduled for 19 September 2026, featuring various activities and entertainment.
  { regionId: "morpeth", url: "https://morpeth.net/events", kind: "web", label: "Morpeth.net Events" }, // Comprehensive listings of upcoming events in Morpeth and the North East, including Party in the Park Morpeth 2026 on 28 August 2026.
  { regionId: "morpeth", url: "https://www.nationaltrust.org.uk/visit/north-east/wallington/events/a7b89efb-932c-4153-b7b7-7411055676ff", kind: "web", label: "Live Music at Wallington" }, // Live music events at Wallington House and Courtyard, with performances scheduled throughout August and September 2026.
  { regionId: "morpeth", url: "https://www.nwt.org.uk/events?category%5B54%5D=54", kind: "web", label: "Northumberland Wildlife Trust Events" }, // Guided walks and nature events in Northumberland, including those near Morpeth, with dates extending into September 2026.
  { regionId: "morpeth", url: "https://burghaminternationalhorsetrials.ticketsrv.co.uk/tickets/77", kind: "web", label: "Burgham International Horse Trials" }, // Equestrian event held on 1 August 2026 at Burgham Park, Morpeth.
  { regionId: "morpeth", url: "https://www.carevents.com/uk/events/druridge-bay-festival/", kind: "web", label: "Druridge Bay Festival" }, // Festival featuring live music and camping at Druridge Bay Country Park from 10 to 13 September 2026.
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
  { regionId: "oakham", url: "https://discoveroakham.co.uk/upcoming-events/", kind: "web", label: "Discover Oakham Events" }, // A comprehensive list of upcoming events in Oakham, including festivals, workshops, and performances, updated regularly.
  { regionId: "oakham", url: "https://oakhamtowncouncil.gov.uk/events/", kind: "web", label: "Oakham Town Council Events" }, // Official events calendar from Oakham Town Council, featuring community events, fairs, and seasonal activities.
  { regionId: "oakham", url: "https://www.achurchnearyou.com/church/10798/service-and-events/events-regular/", kind: "web", label: "All Saints Church Oakham Events" }, // Regular services and special events at All Saints Church, including Holy Communion and Choral Evensong.
  { regionId: "oakham", url: "https://www.artsfortheheartofengland.co.uk/what-s-on", kind: "web", label: "Arts for the Heart of England Events" }, // Listings of cultural events in Oakham, such as concerts and festivals, organized by local arts groups.
  { regionId: "oakham", url: "https://www.rutlandandstamfordsound.co.uk/events/event/the-amber-squad-live-in-oakham/", kind: "web", label: "The Amber Squad Live in Oakham" }, // Event details for The Amber Squad's performance at Victoria Hall, Oakham, including date, time, and ticket information.
  { regionId: "telford", url: "https://www.telford.gov.uk/events", kind: "web", label: "Telford & Wrekin Council Events" }, // Official council page listing upcoming events in Telford and Wrekin, including the Telford Balloon Fiesta and other community events.
  { regionId: "telford", url: "https://www.visittelford.co.uk/whats-on", kind: "web", label: "Visit Telford What's On" }, // Tourism board's page featuring a calendar of events in Telford, including festivals, exhibitions, and family activities.
  { regionId: "telford", url: "https://www.tictelford.com/whats-on", kind: "web", label: "Telford International Centre Events" }, // Venue's events page listing conferences, exhibitions, and entertainment events held at the Telford International Centre.
  { regionId: "telford", url: "https://www.malthousepub.co.uk/whats-on", kind: "web", label: "The Malthouse Pub Ironbridge Events" }, // Local pub's events page featuring live music, artisan markets, and community gatherings in Ironbridge.
  { regionId: "telford", url: "https://www.telfordtheatre.com/whats-on", kind: "web", label: "The Place Theatre Telford" }, // Theatre's listings page showcasing upcoming performances, comedy shows, and community events.
  { regionId: "telford", url: "https://www.telford.ac.uk/events", kind: "web", label: "Telford College Public Events" }, // College's events page listing public lectures, workshops, and community events open to the public.
  { regionId: "telford", url: "https://www.telford.ac.uk/whats-on", kind: "web", label: "Telford College What's On" }, // College's events page featuring public lectures, workshops, and community events open to the public.
  { regionId: "shrewsbury", url: "https://www.shrewsburytowncouncil.gov.uk/latest-events/", kind: "web", label: "Shrewsbury Town Council Events" }, // Official events page listing various activities in Shrewsbury, including concerts and charity runs, with dates extending into September 2026.
  { regionId: "shrewsbury", url: "https://www.shropshire.gov.uk/committee-services/mgCalendarAgendaView.aspx?C=127R&CID=127&D=12&DD=2026&M=6&MR=0&OT=R", kind: "web", label: "Shropshire Council Southern Planning Committee Calendar" }, // Public calendar of council meetings, including dates for the Southern Planning Committee, with sessions scheduled through May 2027.
  { regionId: "shrewsbury", url: "https://www.shrewsburytowncouncil.gov.uk/food-festival-fringe-events-at-shrewsbury-market-hall/", kind: "web", label: "Shrewsbury Food Festival Fringe Events" }, // Details of fringe events at Shrewsbury Market Hall supporting the Shrewsbury Food Festival, including gourmet demonstrations and art exhibitions.
  { regionId: "shrewsbury", url: "https://www.shropshire.gov.uk/committee-services/mgCalendarAgendaView.aspx?C=-1&CID=0&DD=2026&M=3&MR=1&OT=", kind: "web", label: "Shropshire Council Calendar" }, // Comprehensive calendar of council meetings and events, including Southern Planning Committee sessions, with dates through May 2027.
  { regionId: "salisbury", url: "https://www.salisburycitycouncil.gov.uk/whats-on", kind: "web", label: "Salisbury City Council Events" }, // Official city council page listing upcoming events in Salisbury, regularly updated.
  { regionId: "salisbury", url: "https://www.salisburycathedral.org.uk/whats-on", kind: "web", label: "Salisbury Cathedral Events" }, // Official cathedral page listing events, services, and exhibitions, regularly updated.
  { regionId: "salisbury", url: "https://www.salisburyplayhouse.com/whats-on", kind: "web", label: "Salisbury Playhouse Events" }, // Official theatre page listing performances and events, regularly updated.
  { regionId: "salisbury", url: "https://www.salisburymuseum.org.uk/whats-on", kind: "web", label: "Salisbury Museum Events" }, // Official museum page listing exhibitions and events, regularly updated.
  { regionId: "salisbury", url: "https://www.visitwiltshire.co.uk/whats-on", kind: "web", label: "Visit Wiltshire Events" }, // Official tourism board page listing events in Salisbury and surrounding areas, regularly updated.
  { regionId: "salisbury", url: "https://www.salisburyjournal.co.uk/whats-on/", kind: "web", label: "Salisbury Journal What's On" }, // Local newspaper's events section listing upcoming events in Salisbury, regularly updated.
  { regionId: "salisbury", url: "https://www.facebook.com/SalisburyCityCouncil/events", kind: "facebook", label: "Salisbury City Council Facebook Events" }, // Official city council Facebook page listing upcoming events in Salisbury, regularly updated.
  { regionId: "salisbury", url: "https://www.facebook.com/SalisburyCathedral/events", kind: "facebook", label: "Salisbury Cathedral Facebook Events" }, // Official cathedral Facebook page listing events, services, and exhibitions, regularly updated.

// --- END SEEDS ---
  // Do not remove or move this line. localscan-discover.js finds it by exact
  // text match and inserts proposed new entries directly above it, in the
  // pull requests it opens. Anything below this line is not part of the
  // array (see the closing bracket next) and would break the file.
];
