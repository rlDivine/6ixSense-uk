// UK car boot sales, the listing category no feed carries.
//
// Every other source here is a fetch. This one is a table, and that is a
// deliberate answer to what car boot sales actually are rather than a shortcut.
// Three things rule out scraping them:
//
//   1. They are not on the ticketing feeds. Ticketmaster and Skiddle sell
//      tickets; a boot sale is cash at the gate. Eventbrite carries a few dozen
//      nationally, against the several hundred that actually run, so wiring it
//      up would look like coverage without being any.
//   2. The directories that do list them (carbootjunction, findcarboot,
//      carbootdirectory) publish no JSON-LD, no API and, critically, no
//      coordinates. Distance is the whole premise of this app, so a source with
//      no coordinates is a source we would have to geocode before we could sort
//      it, on every refresh, for data that changes a few times a season.
//   3. They are recurrence rules, not events. "Every Sunday, Easter to
//      October" is what a boot sale is. Any source would have to expand that
//      into dates itself, which is the work below regardless of where the rule
//      came from.
//
// So the rules live here, with real coordinates, and this file expands them.
// It is the same bargain `curated.js` makes, for the same reason: a table that
// is right beats a scrape that is fragile, and this one needs revisiting once a
// season rather than once a deploy.
//
// Accuracy notes, because a wrong row here sends someone to a field at 6am:
//   - Coordinates are the SITE, not the town centre.
//   - Seasons are per sale. Most outdoor sales run Easter to October and a
//     minority run all year; indoor and hardstanding sites are the ones that
//     genuinely do not stop for winter.
//   - `open` is when BUYERS are let in, not when sellers set up. Sellers are
//     usually two hours earlier and that is not the time to show a buyer.
//   - Sales that run on unpublished or hand-picked dates are left out entirely
//     rather than guessed at. See NOT_LISTED at the bottom of the table.
import { makeEvent, distanceKm } from "./util.js";

// How far ahead to look for a sale's next date. Not how many dates it gets:
// see `occurrences` below, which takes the next one per weekday and stops.
//
// Six weeks, because that is the longest a sale in the table can go between
// dates and still be running: two first-Sundays-of-the-month can be 35 days
// apart. Anything the search does not reach inside six weeks is a sale that is
// out of season, and it should produce nothing rather than a date in November.
const LOOKAHEAD_DAYS = 42;

/// Minutes Europe/London is ahead of UTC at `date` (0 in winter, 60 in BST).
/// Shared shape with curated.js: the server runs in UTC on Render, but every
/// time in the table below is a UK wall-clock time.
function londonOffsetMinutes(date) {
  try {
    const dtf = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  } catch {
    return 0;
  }
}

/// Today's date in London, as {y, m, d} with m 1-12. Expansion walks calendar
/// days, and "which day is it" has to be answered in London, not in UTC: for
/// the hour after midnight BST the two disagree, and a boot sale would either
/// appear a day early or vanish a day late.
function londonToday(now) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(now).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day };
}

/// A UK wall-clock date and time, as a real instant.
function londonInstant(y, m, d, hour, minute) {
  // Guess at UTC, then correct by the offset that actually applies that day.
  const guess = Date.UTC(y, m - 1, d, hour, minute, 0, 0);
  const offset = londonOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000);
}

/// Is month `m` (1-12) inside a season that may wrap the new year?
/// A season of 3-10 is March to October. A season of 11-2 is November to
/// February, which no sale in the table uses but which the comparison has to
/// survive rather than silently return nothing for.
function inSeason(m, startMonth, endMonth) {
  if (startMonth <= endMonth) return m >= startMonth && m <= endMonth;
  return m >= startMonth || m <= endMonth;
}

/// Which occurrence of its weekday within the month a date is: 1 for the first
/// Sunday, 2 for the second, and so on. Used by the monthly sales.
function nthWeekdayOfMonth(day) {
  return Math.floor((day - 1) / 7) + 1;
}

/// Whole days between two calendar dates, ignoring time of day. Used by the
/// fortnightly rule, where "is this one of our Sundays" is a parity question
/// against a known good date.
function daysBetweenUTC(aY, aM, aD, bY, bM, bD) {
  return Math.round((Date.UTC(bY, bM - 1, bD) - Date.UTC(aY, aM - 1, aD)) / 86400000);
}

// The table.
//
// days:      weekday numbers it runs on, 0=Sunday .. 6=Saturday
// open:      [hour, minute] buyers are admitted, UK local
// season:    [startMonth, endMonth], 1-12 inclusive. [1, 12] means all year.
// every:     "week" (default), "fortnight" (needs `anchor`), or "month"
//            (needs `nth`)
// anchor:    "YYYY-MM-DD", a date the sale is known to have run, for parity
// nth:       for `every: "month"`, which occurrence of the weekday, 1 = first
// skipMonths: months inside the season it does not run (1-12)
// skipDates: "YYYY-MM-DD" dates it is known not to run (racing fixtures etc.)
// admission: what a BUYER pays to get in
// note:      anything a person needs before setting off. Surfaced as the
//            event's description, which the clients already render.
const BOOT_SALES = [
  // ---- London and the South East ------------------------------------------
  { name: "Battersea Boot", venue: "Harris Academy Battersea", address: "401 Battersea Park Road, London SW11 5AP", lat: 51.4732, lng: -0.1595, days: [0], open: [13, 30], season: [1, 12], admission: "50p", url: "https://batterseaboot.com/", note: "London's Sunday afternoon boot sale, 1.30pm to 5pm. Early entry 11.30am £5, noon £3. Closed over Christmas and New Year." },
  { name: "Capital Car Boot Sale", venue: "Pimlico Academy", address: "Lupus Street, London SW1V 3AT", lat: 51.4882, lng: -0.1372, days: [0], open: [10, 0], season: [1, 12], admission: "£1 from 11.30am", url: "https://www.capitalcarboot.com/", note: "Early entry £7. Closed Easter, Christmas, New Year and the late August bank holiday." },
  { name: "Chiswick Car Boot Sale", venue: "Chiswick School", address: "Staveley Road, Chiswick, London W4 3UN", lat: 51.4819, lng: -0.2598, days: [0], open: [6, 30], season: [1, 12], every: "month", nth: 1, skipMonths: [1], admission: "£1", url: "https://chiswickcarbootsale.com/", note: "First Sunday of the month only, every month except January." },
  { name: "Princess May Car Boot Sale", venue: "Princess May School", address: "Princess May Road, Stoke Newington, London N16 8DF", lat: 51.5528, lng: -0.0774, days: [0, 6], open: [7, 30], season: [1, 12], admission: "Free", url: "https://www.londoncarboot.com/selling/princess-may-school/", note: "Hardstanding, so it runs in all weather. Second-hand goods only." },
  { name: "Hounslow Heath Car Boot Sale", venue: "Hounslow Heath", address: "Staines Road, Hounslow TW4 5DS", lat: 51.4597, lng: -0.3968, days: [0, 4, 6], open: [6, 0], season: [2, 10], admission: "£2 Sun, £1 Thu and Sat", url: "http://www.hounslowheathcarboot.co.uk/", note: "Runs Thursday, Saturday, Sunday and bank holiday Mondays. Sunday entry £3 before 8.30am." },
  { name: "Hook Road Arena Car Boot Sale", venue: "Hook Road Arena", address: "Hook Road, Epsom KT19 8QG", lat: 51.3559, lng: -0.2755, days: [0], open: [7, 0], season: [8, 11], admission: "£1 after 8.30am", url: "https://www.hookcarbootsale.com/", note: "Late summer and autumn only; the arena is in other use earlier in the year. Up to 900 stalls. Weather dependent, recorded message on 07788 132977." },
  { name: "Nut Hill Car Boot Sale", venue: "Nut Hill Fruit Farm", address: "A3 southbound, Send, near Guildford GU23 7LW", lat: 51.2694, lng: -0.5263, days: [0], open: [7, 30], season: [4, 10], admission: "£2", url: "https://www.nuthillcarbootsale.co.uk/", note: "Access from the A3 southbound carriageway only. Does not run on bank holiday Mondays." },
  { name: "Denham Giant Car Boot Sale", venue: "Denham Roundabout", address: "A40, Denham, Buckinghamshire UB9 5PG", lat: 51.5703, lng: -0.4852, days: [6], open: [6, 0], season: [3, 11], admission: "Check on the day", url: "https://giantcarboot.co.uk/locations/denham/", note: "Grass site. Ring 07947 121336 on the morning in poor weather." },
  { name: "Ford Airfield Sunday Market and Car Boot", venue: "Ford Airfield", address: "Ford, near Arundel, West Sussex BN18 0FL", lat: 50.8159, lng: -0.5874, days: [0], open: [9, 0], season: [1, 12], admission: "Free", url: "https://fordairfieldmarket.co.uk/", note: "Runs every week of the year whatever the weather. Sellers from 6am, public from 9am." },
  { name: "Ashford Market Boot Fair", venue: "Ashford Market, Orbital Park", address: "Orbital Park, Ashford, Kent TN24 0HB", lat: 51.1273, lng: 0.8905, days: [0, 6], open: [7, 0], season: [1, 12], admission: "Free", url: "https://ashfordmarket.co.uk/", note: "On the livestock market's hardstanding, so it runs year round." },
  { name: "Farm Boys Country Boot Sale", venue: "Middle Field, Fox Hounds Lane", address: "Southfleet, near Gravesend, Kent DA13 9LH", lat: 51.4235, lng: 0.3195, days: [0], open: [10, 0], season: [2, 12], admission: "£2, £1 from 11am", url: "https://www.facebook.com/farmboyscountrybootsale/", note: "A late morning boot fair, unusual for Kent. £1 car park charge on top of entry." },
  { name: "Brenzett Thrift Farm Boot Fair", venue: "Brenzett Thrift Farm", address: "Straight Lane, Brenzett, Romney Marsh, Kent TN29 9QT", lat: 51.0025, lng: 0.8478, days: [0, 6], open: [7, 0], season: [1, 12], admission: "Check on the day", url: "https://www.facebook.com/brenzettthriftfarmbootfair/", note: "One of the few Kent boot fairs running both Saturday and Sunday all year." },
  { name: "Boreham Car Boot Sale", venue: "Boreham General Farms", address: "Main Road, Boreham, Chelmsford, Essex CM3 3HJ", lat: 51.7564, lng: 0.5243, days: [0], open: [7, 0], season: [3, 11], admission: "50p", url: "https://www.facebook.com/BorehamCarBootsale/", note: "At A12 junction 19. Field site, so it is cancelled in very wet weather." },
  { name: "Barleylands Car Boot Sale", venue: "Barleylands Farm Park", address: "Barleylands Road, Billericay, Essex CM11 2UD", lat: 51.6012, lng: 0.4455, days: [0], open: [10, 0], season: [1, 12], admission: "£1 before noon", url: "https://www.barleylands.co.uk/", note: "A late morning start. Sundays and bank holidays, year round." },
  { name: "Weyhill Car Boot Sale", venue: "Weyhill Showground", address: "Weyhill, Andover, Hampshire SP11 0PP", lat: 51.2178, lng: -1.5433, days: [0], open: [8, 0], season: [4, 10], admission: "Under £1", url: "https://weyhillcarboot.co.uk/", note: "The biggest boot sale in the Andover area. 8am to noon, free parking." },

  // ---- East of England ----------------------------------------------------
  { name: "Stonham Barns Sunday Car Boot", venue: "Stonham Barns Park", address: "Pettaugh Road, Stonham Aspal, Stowmarket, Suffolk IP14 6AT", lat: 52.1887, lng: 1.1382, days: [0], open: [7, 0], season: [3, 10], admission: "Free", url: "https://www.stonhambarns.co.uk/whats-on/stonham-car-boot-every-sunday/", note: "East Anglia's best known boot sale. An extra Thursday sale runs from around May to October." },
  { name: "Fordham Car Boot Sale", venue: "Market Field, Collins Hill", address: "Fordham, Ely, Cambridgeshire CB7 5PD", lat: 52.3070, lng: 0.3948, days: [0], open: [7, 0], season: [4, 10], every: "fortnight", anchor: "2026-04-12", admission: "£1", url: "https://fordhamcarbootsales.co.uk/", note: "Alternate Sundays only, not weekly. The 2026 season runs 12 April to 11 October; the dated list is on the site. Under-16s free." },
  { name: "Harford Car Boot Sale", venue: "Harford Park and Ride", address: "Ipswich Road, Norwich NR4 6DY", lat: 52.5962, lng: 1.2751, days: [0], open: [5, 30], season: [3, 11], admission: "Free", url: "https://www.facebook.com/harfordcarboot/", note: "Norwich's main Sunday boot sale, on park and ride hardstanding. A very early start." },

  // ---- South West ---------------------------------------------------------
  { name: "Exeter Sunday Market and Car Boot Sale", venue: "The Matford Centre", address: "Matford Park Road, Marsh Barton, Exeter EX2 8FD", lat: 50.6978, lng: -3.5239, days: [0], open: [8, 0], season: [1, 12], admission: "Free", url: "https://exeter.gov.uk/people-and-communities/facilities-and-events/markets/sunday-market-car-boot-sale/", note: "Run by Exeter City Council. All-weather hardstanding, free parking, dogs on leads welcome. 8am to 2pm." },
  { name: "Bristol Sunday Market and Car Boot Sale", venue: "Bristol Fruit Market", address: "Albert Crescent, St Philips, Bristol BS2 0YQ", lat: 51.4450, lng: -2.5694, days: [0], open: [9, 0], season: [1, 12], admission: "Free", url: "https://theplattgroup.co.uk/bristol-sunday-market-and-car-boot-sale/", note: "9am to 3pm every Sunday, year round, on the wholesale fruit market site." },
  { name: "St Columb Major Car Boot Sale", venue: "Car Boots Cornwall", address: "A39, St Columb Major, Cornwall TR8 4JA", lat: 50.4254, lng: -4.9465, days: [0], open: [14, 0], season: [1, 12], admission: "£1", url: "https://carbootscornwall.co.uk/locations", note: "An afternoon sale, buyers from 2pm. Sundays and bank holidays except Christmas. Children free." },
  { name: "Mitchell Car Boot Sale", venue: "Car Boots Cornwall", address: "Mitchell, near Newquay, Cornwall TR8 5FD", lat: 50.3555, lng: -5.0026, days: [6], open: [12, 0], season: [1, 12], admission: "£1", url: "https://carbootscornwall.co.uk/locations", note: "Saturday afternoon sale, buyers from noon. Children free." },
  { name: "Prockters Farm Car Boot Sale", venue: "Prockters Farm", address: "Blundells Lane, Monkton Heathfield, Taunton TA2 8QN", lat: 51.0428, lng: -3.0548, days: [0], open: [10, 0], season: [3, 10], admission: "Check on the day", url: "https://www.facebook.com/proctersfarmcarboot/", note: "Taunton's biggest, 300 plus stalls, 10am to 1pm. Dogs are not permitted." },

  // ---- Midlands -----------------------------------------------------------
  { name: "eboot Lea Marston Car Boot Sale", venue: "Lea Marston", address: "Haunch Lane, Lea Marston, Sutton Coldfield B76 0BY", lat: 52.5467, lng: -1.7027, days: [0, 6], open: [5, 0], season: [1, 12], admission: "£2 per car", url: "https://www.eboot.co.uk/", note: "The main Birmingham area boot sale, open 52 weeks a year, 5am to 1pm." },
  { name: "Croft Car Boot", venue: "Croft Car Boot field", address: "Broughton Road, Stoney Stanton, Leicester LE9 4JA", lat: 52.5461, lng: -1.2695, days: [0], open: [5, 30], season: [3, 10], admission: "£1", url: "http://www.croftboot.com/", note: "Family run since the 1970s, around 100 stalls. Sundays and bank holiday Mondays. Children free." },
  { name: "Colwick Car Boot and Market", venue: "Nottingham Racecourse", address: "Colwick Park, Colwick Road, Nottingham NG2 4BE", lat: 52.9458, lng: -1.1046, days: [0], open: [8, 30], season: [1, 12], admission: "£1", url: "https://www.nottinghammarkets.com/market/colwick/", note: "Run by Nottingham City Council. Around 220 sellers. Does not run when the racecourse has a fixture, so check before travelling." },
  { name: "Mercia Car Boot", venue: "Mercia car park", address: "Lockhurst Lane, Foleshill, Coventry CV6 5PD", lat: 52.4279, lng: -1.5034, days: [0], open: [8, 0], season: [1, 12], admission: "£1, 50p from 11.30am", url: "http://www.merciacarboot.com/", note: "Hardstanding car park, so it runs in most weather. No booking needed." },
  { name: "Oldcotes Car Boot and Sunday Market", venue: "Oldcotes", address: "A634 Blyth Road, Oldcotes, Worksop S81 8JE", lat: 53.3893, lng: -1.0997, days: [0], open: [5, 30], season: [1, 12], admission: "Free", url: "https://www.facebook.com/oldcotescarboot/", note: "The main large Sunday sale for the Sheffield, Doncaster and Worksop area. 5.30am to 2.30pm." },

  // ---- North West ---------------------------------------------------------
  { name: "New Smithfield Sunday Market and Car Boot", venue: "New Smithfield Market", address: "Whitworth Street East, Openshaw, Manchester M11 2WJ", lat: 53.4715, lng: -2.1763, days: [0], open: [7, 0], season: [1, 12], admission: "Free, £2.75 parking", url: "https://www.manchester.gov.uk/online-directories/markets-directories/market-traders-information-directories/markets-in-manchester/sunday-market-and-car-boot/sunday-market-and-car-boot", note: "Run by Manchester City Council. 7am to 2pm, last entry 1.30pm. Parking is card only. Pedestrian access via Whitworth Street East." },
  { name: "Bowlee Car Boot Sale and Market", venue: "Bowlee Community Park", address: "Heywood Old Road, Middleton, Manchester M24 4SB", lat: 53.5594, lng: -2.2315, days: [0], open: [6, 0], season: [4, 10], admission: "Free", url: "https://www.rochdale.gov.uk/carboot", note: "Run by Rochdale Council. One of Greater Manchester's largest, 6am to 1.30pm. Sundays and bank holiday Mondays." },
  { name: "Clitheroe Car Boot Sale", venue: "Clitheroe Auction Mart", address: "Lincoln Way, Clitheroe, Lancashire BB7 1QD", lat: 53.8769, lng: -2.3780, days: [0], open: [8, 0], season: [1, 12], admission: "Check on the day", url: "https://www.clitheroe-carboot.co.uk/", note: "Two indoor barns plus an outdoor yard, so it runs whatever the weather. Up to 225 stalls, free parking. 8am to 12.30pm." },
  { name: "Whyndyke Farm Car Boot Sale", venue: "Whyndyke Farm", address: "Preston New Road, Marton, Blackpool FY4 4XQ", lat: 53.7965, lng: -2.9854, days: [0], open: [8, 0], season: [4, 9], admission: "Free", url: "https://www.facebook.com/whyndykecarboot/", note: "At M55 junction 4. Weather dependent, the operator confirms on Facebook. Free entry and parking." },
  { name: "Car Bootle", venue: "Car Bootle", address: "Trinity Road, Bootle, Liverpool L20", lat: 53.4493, lng: -2.9916, days: [0], open: [6, 0], season: [1, 12], admission: "Check on the day", url: "https://www.facebook.com/p/Car-Bootle-CAR-BOOT-SALE-Liverpools-Best-Car-Boot-100063769292060/", note: "Every Sunday all year, 6am to noon, around 120 pitches." },

  // ---- Yorkshire and the North East ---------------------------------------
  { name: "York Racecourse Car Boot Sale", venue: "York Racecourse", address: "Knavesmire Road, York YO23 1EX", lat: 53.9407, lng: -1.0923, days: [6], open: [7, 0], season: [3, 10], skipDates: ["2026-05-23", "2026-06-13", "2026-06-27", "2026-07-11", "2026-07-25", "2026-08-22", "2026-10-10"], admission: "Free", url: "https://yorkcarboot.com/", note: "Saturdays only, and not on racing Saturdays. Arrive 7 to 7.30am, finishes 1pm. Free parking after 8am." },
  { name: "Wetherby Racecourse Car Boot Sale", venue: "Wetherby Racecourse", address: "York Road, Wetherby, Leeds LS22 5EJ", lat: 53.9319, lng: -1.3585, days: [0], open: [7, 0], season: [3, 10], admission: "£1", url: "https://www.nationalcarbootsales.co.uk/", note: "The largest Sunday boot sale in the Leeds area. Does not run on racing days, so check the racecourse fixture list first." },
  { name: "Walton Street Market and Car Boot", venue: "Walton Street Market", address: "Walton Street, Hull HU3 6JB", lat: 53.7451, lng: -0.3739, days: [3], open: [6, 30], season: [1, 12], admission: "Free", url: "https://theplattgroup.co.uk/walton-street-market-hull/", note: "A Wednesday sale, not a weekend one. Weekly all year, buyers from 6.30am." },
  { name: "Blaydon Car Boot Sale", venue: "Blaydon Rugby Club", address: "Hexham Road, Swalwell, Newcastle upon Tyne NE16 3BN", lat: 54.9546, lng: -1.6913, days: [0], open: [5, 0], season: [3, 10], admission: "£1, 50p seniors", url: "http://www.blaydonrfc.co.uk/car-boot-sale/", note: "Tyneside's main Sunday sale, 5am to around noon. Pitches first come, first served. Children free." },
  { name: "Tranwell Airfield Car Boot Sale", venue: "Tranwell Airfield", address: "Tranwell, Morpeth, Northumberland NE61 3FR", lat: 55.1345, lng: -1.7368, days: [0], open: [10, 30], season: [4, 10], admission: "£1 per car", url: "https://www.nobles-promotions.co.uk/page17.html", note: "A late morning sale on a former wartime airfield. Early entry 10.30am £5, general entry around midday. Firm concrete standing. Assistance dogs only." },

  // ---- Wales --------------------------------------------------------------
  { name: "Cardiff Car Boot Sale", venue: "Cardiff Fruit and Vegetable Market", address: "Lewis Road, Leckwith, Cardiff CF11 8BA", lat: 51.4679, lng: -3.1992, days: [0, 6], open: [7, 30], season: [1, 12], admission: "Free", url: "https://www.facebook.com/splottoriginal/", note: "Cardiff's best known boot sale. Sunday 7.30am to 1pm; Saturday starts later, 9.30am." },
  { name: "High Street Car Boot Sale", venue: "High Street multistorey car park", address: "The Strand, Swansea SA1 1LE", lat: 51.6220, lng: -3.9426, days: [0], open: [6, 0], season: [1, 12], admission: "Free", url: "https://www.facebook.com/Highstreetcarbootsaleswansea/", note: "Swansea's biggest undercover sale, inside a multistorey car park, so it runs rain or shine. 6am to noon." },
  { name: "Rhyl Car Boot Sale", venue: "Rhyl Showfield", address: "Rhuddlan Road, Rhyl, Denbighshire LL18 2RG", lat: 53.3079, lng: -3.4701, days: [0, 6], open: [6, 0], season: [3, 10], admission: "Check on the day", url: "https://rhylcarboot.com/", note: "North Wales' biggest weekend market. Saturday 6am to noon, Sunday 6am to 12.30pm." },
  { name: "Tir Prince Market and Car Boot", venue: "Tir Prince Leisure Park", address: "Sandbank Road, Towyn, Abergele, Conwy LL22 9EL", lat: 53.3052, lng: -3.5338, days: [0, 6], open: [6, 0], season: [3, 10], admission: "Check on the day", url: "https://www.tirprince.co.uk/markets/", note: "Over 400 stalls and parking for 1,000 vehicles. Gates open 6am. Saturdays run a longer season than Sundays." },

  // ---- Scotland -----------------------------------------------------------
  { name: "Errol Sunday Market and Car Boot", venue: "Errol Airfield", address: "Errol, Perth PH2 7TB", lat: 56.4042, lng: -3.1933, days: [0], open: [7, 15], season: [1, 12], admission: "Free", url: "https://errolsundaymarket.co.uk/", note: "Scotland's largest Sunday market and car boot, between Perth and Dundee. Gates open for queuing at 6.30am, entry closes 10am. Free parking, no booking." },
  { name: "Blochairn Car Boot Sale", venue: "Glasgow Wholesale Markets", address: "130 Blochairn Road, Glasgow G21 2DU", lat: 55.8683, lng: -4.2141, days: [0], open: [6, 0], season: [1, 12], admission: "Free", url: "https://www.citypropertyglasgow.co.uk/markets/car-boot/", note: "Run by City Property Glasgow, just off M8 junction 14. 6am to 3pm, year round." },
  { name: "Edinburgh Corn Exchange Car Boot Sale", venue: "Edinburgh Corn Exchange", address: "10 New Market Road, Edinburgh EH14 1RJ", lat: 55.9268, lng: -3.2474, days: [0, 6], open: [7, 15], season: [1, 12], admission: "Free", url: "https://edinburghcarbootsale.com/", note: "Indoor and covered, so it runs both days all year apart from Christmas and New Year. Buyers from 7.15am Saturday, 7.45am Sunday." },
  { name: "Thainstone Sunday Market and Car Boot", venue: "Thainstone Agricultural Centre", address: "Thainstone, Inverurie, Aberdeenshire AB51 5XZ", lat: 57.2551, lng: -2.3701, days: [0], open: [7, 0], season: [1, 12], admission: "Free", url: "https://thainstoneevents.co.uk/", note: "The main car boot for the Aberdeen area, about 17 miles north west of the city. 7am to 3pm, with occasional exceptions when the mart is in other use." },

  // ---- Northern Ireland ---------------------------------------------------
  { name: "Belfast Car Boot Sale", venue: "Shorts Sports and Recreation Club", address: "Aircraft Park, Holywood Road, Belfast BT4 1SJ", lat: 54.6129, lng: -5.8639, days: [0], open: [9, 0], season: [1, 12], admission: "Free", url: "https://www.facebook.com/belfastcarboot/", note: "Every Sunday all year, 9am to noon. No alcohol, tobacco, vapes or fireworks." },
  { name: "Nutts Corner Sunday Market", venue: "Nutts Corner", address: "48a Moira Road, Crumlin, County Antrim BT29 4SJ", lat: 54.6355, lng: -6.1547, days: [0], open: [7, 0], season: [1, 12], admission: "Check on the day", url: "https://www.facebook.com/nuttscornersundaymarket/", note: "Northern Ireland's best known Sunday market and car boot, near Belfast International Airport. 7am to 4pm." },
  { name: "The Vale Centre Car Boot Sale", venue: "The Vale Centre", address: "Clooney Road, Greysteel, Londonderry BT47 3GE", lat: 55.0336, lng: -7.1247, days: [0], open: [7, 30], season: [1, 12], admission: "50p", url: "https://collectireland.com/ni-car-boot-sales/", note: "Every Sunday year round, buyers from 7.30am." },
];

// Left out on purpose, so the next person does not re-add them:
//
//   Wembley Sunday Market      Brent Council stop notice, no evidence it came back.
//   Swansea.com Stadium boot   Confirmed ended.
//   Crystal Palace             The operator's own site read "closed for season"
//                              mid-season, so its dates cannot be trusted.
//   Portsmouth and Southsea    Selected Sundays only, published a season at a
//                              time. There is no rule to expand.
//   Hillside, Alton            Only one weak source, and no published times.
//
// The rule for this table: if we cannot say WHICH DAY it runs, it does not go
// in. A boot sale shown on the wrong day is worse than one not shown at all,
// because someone drives to it.

/// Does `sale` run on this London calendar date?
function runsOn(sale, y, m, d, weekday) {
  if (!sale.days.includes(weekday)) return false;
  const [startMonth, endMonth] = sale.season;
  if (!inSeason(m, startMonth, endMonth)) return false;
  if (sale.skipMonths?.includes(m)) return false;

  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (sale.skipDates?.includes(iso)) return false;

  const every = sale.every || "week";
  if (every === "month") {
    return nthWeekdayOfMonth(d) === (sale.nth || 1);
  }
  if (every === "fortnight") {
    // Parity against a date the sale is known to have run. Without an anchor
    // there is no way to tell which of two Sundays is the right one, so the
    // sale is dropped rather than shown on the wrong week.
    if (!sale.anchor) return false;
    const [ay, am, ad] = sale.anchor.split("-").map(Number);
    const delta = daysBetweenUTC(ay, am, ad, y, m, d);
    return delta % 14 === 0;
  }
  return true; // weekly
}

/// The next date for each weekday the sale runs on, and no more than that.
///
/// The obvious thing is to emit every date in the next month, and it is wrong.
/// The feed's default sort is by distance, and every date of one sale is the
/// same distance away, so they land adjacent: four rows of "Capital Car Boot
/// Sale, 2.2km" one under the other, which reads as a bug in the app rather
/// than as a weekly sale. Taking the next date per weekday gives a sale that
/// runs on Sundays one row, and one that runs Saturday and Sunday two.
///
/// Nothing is lost to the date filters by stopping there. Every range the app
/// offers is eight days or shorter, and a weekly sale's next date is always
/// inside seven, so "today", "this weekend" and "this week" still see it. A
/// fortnightly or monthly sale whose next date falls outside those ranges is
/// correctly absent from them, and still present under "all".
function occurrences(sale, now, lookaheadDays) {
  const out = [];
  const pending = new Set(sale.days);
  const today = londonToday(now);
  for (let i = 0; i <= lookaheadDays && pending.size > 0; i++) {
    // Walk calendar days from today in London. Date.UTC normalises the rollover
    // past a month or year end for us.
    const walk = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const y = walk.getUTCFullYear();
    const m = walk.getUTCMonth() + 1;
    const d = walk.getUTCDate();
    const weekday = walk.getUTCDay();
    if (!pending.has(weekday)) continue;
    if (!runsOn(sale, y, m, d, weekday)) continue;

    const [hour, minute] = sale.open;
    const start = londonInstant(y, m, d, hour, minute);
    // Today's sale is over by the time the doors have been open a while. The
    // server keeps events for six hours past their start, which is about the
    // length of a boot sale, so leave that judgement there rather than making
    // a second, different one here. Note this does NOT clear the weekday from
    // `pending`: this morning's sale being over is exactly when next week's
    // becomes the one worth showing.
    if (start.getTime() < now.getTime() - 6 * 3600 * 1000) continue;
    pending.delete(weekday);
    out.push({ sale, start: start.toISOString(), y, m, d });
  }
  return out;
}

/// Car boot sales near one region, expanded into real dates.
///
/// Signature matches the other lat/lng sources so server.js can call it the
/// same way. `radiusKm` is the region's own search radius, so a boot sale in
/// the next town along shows up exactly as a Ticketmaster listing there would.
export function fetchCarBoots({ lat, lng, radiusKm = 50, now = new Date(), lookaheadDays = LOOKAHEAD_DAYS } = {}) {
  const near =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? BOOT_SALES.filter((s) => {
          const dist = distanceKm(lat, lng, s.lat, s.lng);
          return dist != null && dist <= radiusKm;
        })
      : BOOT_SALES;

  const events = [];
  for (const sale of near) {
    const slug = sale.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    for (const occ of occurrences(sale, now, lookaheadDays)) {
      const date = `${occ.y}-${String(occ.m).padStart(2, "0")}-${String(occ.d).padStart(2, "0")}`;
      events.push(
        makeEvent({
          // Date is part of the id: two Sundays of the same sale are two
          // events, and the client keys saved events and reminders off the id.
          id: `boot-${slug}-${date}`,
          title: sale.name,
          // "Markets" is the vocabulary's existing bucket for a market or a
          // pop-up, which is what a boot sale is to someone browsing. It also
          // means the category already has a colour and a glyph.
          category: "Markets",
          start: occ.start,
          venue: sale.venue,
          address: sale.address,
          lat: sale.lat,
          lng: sale.lng,
          url: sale.url,
          source: "Car boot sales",
          price: sale.admission,
          // Boot sales have no photo of their own, so the description is the
          // only thing carrying the practical detail: what entry costs, when it
          // actually opens, and whether weather can cancel it.
          description: sale.note || "",
        })
      );
    }
  }
  return events;
}

// Exported for the tests, which check the table itself rather than only the
// events it produces.
export const __table = BOOT_SALES;
