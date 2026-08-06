// Curated set of real UK venues with accurate coordinates and their regular
// recurring programming. Dates are computed relative to "today" so the
// "soonest" sort is always meaningful. This guarantees the app shows useful,
// correctly-sorted local listings even with no API key and no live feed, and
// real ticketed events layer on top once a Ticketmaster key is configured.
//
// Unlike the live sources this one is national: the whole table lives in
// memory, and each region takes the slice that falls inside its own radius. A
// town with nothing curated near it simply gets an empty list and leans on
// Ticketmaster and Eventbrite instead.
import { makeEvent, distanceKm } from "./util.js";

// Real venue photos (Wikipedia/Wikimedia Commons) so curated listings show a
// picture too, not just the category mark. Keyed by venue name, and any miss
// falls back to the flat category wash behind the mark.
const VENUE_IMAGES = {
  "Royal Albert Hall": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Royal_Albert_Hall%2C_London_-_Nov_2012.jpg/330px-Royal_Albert_Hall%2C_London_-_Nov_2012.jpg",
  "Southbank Centre": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Royal_Festival_Hall_-_Sept_2007.jpg/330px-Royal_Festival_Hall_-_Sept_2007.jpg",
  "Ronnie Scott's Jazz Club": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Ronnie_Scott%27s_Jazz_Club%2C_Soho%2C_London.jpg/330px-Ronnie_Scott%27s_Jazz_Club%2C_Soho%2C_London.jpg",
  "The 100 Club": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/100_Club_Oxford_Street.jpg/330px-100_Club_Oxford_Street.jpg",
  "Tate Modern": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Tate_Modern_2019.jpg/330px-Tate_Modern_2019.jpg",
  "British Museum": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/British_Museum_from_NE_2.JPG/330px-British_Museum_from_NE_2.JPG",
  "Borough Market": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Borough_Market_-_geograph.org.uk_-_1710766.jpg/330px-Borough_Market_-_geograph.org.uk_-_1710766.jpg",
  "Camden Market": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Camden_Lock_Market_-_geograph.org.uk_-_1710123.jpg/330px-Camden_Lock_Market_-_geograph.org.uk_-_1710123.jpg",
  "BFI Southbank": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/BFI_Southbank_entrance.jpg/330px-BFI_Southbank_entrance.jpg",
  "The Comedy Store": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Comedy_Store_London.jpg/330px-Comedy_Store_London.jpg",
  "Manchester Academy": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Manchester_Academy_-_geograph.org.uk_-_1730236.jpg/330px-Manchester_Academy_-_geograph.org.uk_-_1730236.jpg",
  "Band on the Wall": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Band_on_the_Wall%2C_Manchester.jpg/330px-Band_on_the_Wall%2C_Manchester.jpg",
  "Royal Exchange Theatre": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Royal_Exchange%2C_Manchester.jpg/330px-Royal_Exchange%2C_Manchester.jpg",
  "Cavern Club": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/The_Cavern_Club_-_geograph.org.uk_-_1717086.jpg/330px-The_Cavern_Club_-_geograph.org.uk_-_1717086.jpg",
  "Symphony Hall": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Symphony_Hall%2C_Birmingham.jpg/330px-Symphony_Hall%2C_Birmingham.jpg",
  "Bullring & Grand Central": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Bullring_Birmingham.jpg/330px-Bullring_Birmingham.jpg",
  "Usher Hall": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Usher_Hall_Edinburgh.jpg/330px-Usher_Hall_Edinburgh.jpg",
  "The Stand Comedy Club": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/The_Stand_Comedy_Club%2C_Edinburgh.jpg/330px-The_Stand_Comedy_Club%2C_Edinburgh.jpg",
  "Barrowland Ballroom": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Barrowland_Ballroom%2C_Glasgow.jpg/330px-Barrowland_Ballroom%2C_Glasgow.jpg",
  "King Tut's Wah Wah Hut": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/King_Tut%27s_Wah_Wah_Hut%2C_Glasgow.jpg/330px-King_Tut%27s_Wah_Wah_Hut%2C_Glasgow.jpg",
  "Wales Millennium Centre": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Wales_Millennium_Centre_2019.jpg/330px-Wales_Millennium_Centre_2019.jpg",
  "Ulster Hall": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Ulster_Hall%2C_Belfast.jpg/330px-Ulster_Hall%2C_Belfast.jpg",
};

// weekday: 0=Sun .. 6=Sat. Returns ISO for the next occurrence at the given
// hour. Times are UK local by intent; the server runs in UTC on Render, so the
// hour is applied in Europe/London and converted back.
function nextOccurrence(weekday, hour = 19, minute = 0) {
  const now = new Date();
  // Minutes Europe/London is ahead of UTC right now (0 in winter, 60 in BST).
  const offsetMin = londonOffsetMinutes(now);
  // Work in "London wall-clock time expressed as UTC", then shift back.
  const wall = new Date(now.getTime() + offsetMin * 60000);
  const d = new Date(
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), hour, minute, 0, 0)
  );
  let add = (weekday - d.getUTCDay() + 7) % 7;
  if (add === 0 && d.getTime() - offsetMin * 60000 <= now.getTime()) add = 7;
  d.setUTCDate(d.getUTCDate() + add);
  return new Date(d.getTime() - offsetMin * 60000).toISOString();
}

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

// Real, regularly-programmed UK venues, spread across the nations so the guide
// has something to say outside London. `day` is the weekday the listing
// recurs on; `hour` is the local start time.
const VENUES = [
  // ---- London -------------------------------------------------------------
  { title: "Classical concert", category: "Music", venue: "Royal Albert Hall", address: "Kensington Gore, London SW7 2AP", lat: 51.5010, lng: -0.1774, day: 5, hour: 19, url: "https://www.royalalberthall.com/" },
  { title: "Concert programme", category: "Music", venue: "Southbank Centre", address: "Belvedere Rd, London SE1 8XX", lat: 51.5055, lng: -0.1160, day: 4, hour: 19, url: "https://www.southbankcentre.co.uk/" },
  { title: "Late jazz set", category: "Music", venue: "Ronnie Scott's Jazz Club", address: "47 Frith St, London W1D 4HT", lat: 51.5133, lng: -0.1319, day: 6, hour: 20, url: "https://www.ronniescotts.co.uk/" },
  { title: "Live band night", category: "Music", venue: "The 100 Club", address: "100 Oxford St, London W1D 1LL", lat: 51.5164, lng: -0.1355, day: 3, hour: 20, url: "https://www.the100club.co.uk/" },
  { title: "Indie gig", category: "Music", venue: "O2 Academy Brixton", address: "211 Stockwell Rd, London SW9 9SL", lat: 51.4657, lng: -0.1148, day: 5, hour: 19, url: "https://www.academymusicgroup.com/o2academybrixton/" },
  { title: "Stand-up showcase", category: "Comedy", venue: "The Comedy Store", address: "1a Oxendon St, London SW1Y 4EE", lat: 51.5100, lng: -0.1329, day: 6, hour: 20, url: "https://thecomedystore.co.uk/" },
  { title: "Free gallery late", category: "Arts", venue: "Tate Modern", address: "Bankside, London SE1 9TG", lat: 51.5076, lng: -0.0994, day: 5, hour: 18, url: "https://www.tate.org.uk/visit/tate-modern" },
  { title: "Exhibition & talks", category: "Arts", venue: "British Museum", address: "Great Russell St, London WC1B 3DG", lat: 51.5194, lng: -0.1270, day: 4, hour: 18, url: "https://www.britishmuseum.org/" },
  { title: "Repertory screening", category: "Film", venue: "BFI Southbank", address: "Belvedere Rd, London SE1 8XT", lat: 51.5069, lng: -0.1149, day: 2, hour: 18, url: "https://whatson.bfi.org.uk/" },
  { title: "Street food market", category: "Food & Drink", venue: "Borough Market", address: "8 Southwark St, London SE1 1TL", lat: 51.5055, lng: -0.0910, day: 6, hour: 10, url: "https://boroughmarket.org.uk/" },
  { title: "Weekend market", category: "Market", venue: "Camden Market", address: "Camden Lock Pl, London NW1 8AF", lat: 51.5416, lng: -0.1465, day: 0, hour: 11, url: "https://www.camdenmarket.com/" },

  // ---- Rest of England ----------------------------------------------------
  { title: "Live music night", category: "Music", venue: "Manchester Academy", address: "Oxford Rd, Manchester M13 9PR", lat: 53.4640, lng: -2.2320, day: 5, hour: 19, url: "https://manchesteracademy.net/" },
  { title: "Jazz, soul & world set", category: "Music", venue: "Band on the Wall", address: "25 Swan St, Manchester M4 5JZ", lat: 53.4855, lng: -2.2354, day: 4, hour: 20, url: "https://bandonthewall.org/" },
  { title: "In-the-round production", category: "Arts", venue: "Royal Exchange Theatre", address: "St Ann's Sq, Manchester M2 7DH", lat: 53.4820, lng: -2.2450, day: 3, hour: 19, url: "https://www.royalexchange.co.uk/" },
  { title: "Live at the Cavern", category: "Music", venue: "Cavern Club", address: "10 Mathew St, Liverpool L2 6RE", lat: 53.4073, lng: -2.9873, day: 6, hour: 20, url: "https://www.cavernclub.com/" },
  { title: "Orchestral evening", category: "Music", venue: "Symphony Hall", address: "Broad St, Birmingham B1 2EA", lat: 52.4790, lng: -1.9092, day: 4, hour: 19, url: "https://bmusic.co.uk/symphony-hall" },
  { title: "City centre market", category: "Market", venue: "Bullring & Grand Central", address: "Bullring, Birmingham B5 4BU", lat: 52.4776, lng: -1.8940, day: 6, hour: 10, url: "https://bullring.co.uk/" },
  { title: "Gig night", category: "Music", venue: "Leeds O2 Academy", address: "55 Cookridge St, Leeds LS2 3AW", lat: 53.8014, lng: -1.5455, day: 5, hour: 19, url: "https://www.academymusicgroup.com/o2academyleeds/" },
  { title: "Live show", category: "Music", venue: "Sheffield Leadmill", address: "6 Leadmill Rd, Sheffield S1 4SE", lat: 53.3785, lng: -1.4670, day: 6, hour: 20, url: "https://leadmill.co.uk/" },
  { title: "Live music", category: "Music", venue: "Rock City", address: "8 Talbot St, Nottingham NG1 5GG", lat: 52.9560, lng: -1.1530, day: 5, hour: 19, url: "https://rock-city.co.uk/" },
  { title: "Harbourside programme", category: "Festival", venue: "Bristol Harbourside", address: "Anchor Rd, Bristol BS1 5DB", lat: 51.4490, lng: -2.5990, day: 6, hour: 12, url: "https://visitbristol.co.uk/" },
  { title: "Seafront live night", category: "Music", venue: "Concorde 2", address: "Madeira Dr, Brighton BN2 1EN", lat: 50.8195, lng: -0.1249, day: 5, hour: 20, url: "https://www.concorde2.co.uk/" },
  { title: "Northern Stage production", category: "Arts", venue: "Sage Gateshead", address: "St Mary's Sq, Gateshead NE8 2JR", lat: 54.9603, lng: -1.6003, day: 4, hour: 19, url: "https://theglasshouseicm.org/" },
  { title: "Chamber concert", category: "Music", venue: "Oxford Sheldonian Theatre", address: "Broad St, Oxford OX1 3AZ", lat: 51.7548, lng: -1.2554, day: 3, hour: 19, url: "https://www.sheldonian.ox.ac.uk/" },
  { title: "Evening recital", category: "Music", venue: "Cambridge Corn Exchange", address: "3 Parsons Ct, Cambridge CB2 3QE", lat: 52.2036, lng: 0.1213, day: 4, hour: 19, url: "https://www.cambridgelivetrust.co.uk/cornex" },
  { title: "Historic city walk", category: "Tours", venue: "York Minster", address: "Deangate, York YO1 7HH", lat: 53.9622, lng: -1.0819, day: 0, hour: 11, url: "https://yorkminster.org/" },

  // ---- Wales --------------------------------------------------------------
  { title: "Theatre & musicals", category: "Arts", venue: "Wales Millennium Centre", address: "Bute Pl, Cardiff CF10 5AL", lat: 51.4650, lng: -3.1630, day: 4, hour: 19, url: "https://www.wmc.org.uk/" },
  { title: "Live music", category: "Music", venue: "Clwb Ifor Bach", address: "11 Womanby St, Cardiff CF10 1BR", lat: 51.4810, lng: -3.1810, day: 6, hour: 20, url: "https://clwb.net/" },
  { title: "Arena show", category: "Music", venue: "Swansea Arena", address: "Oystermouth Rd, Swansea SA1 3BX", lat: 51.6180, lng: -3.9430, day: 5, hour: 19, url: "https://swansea-arena.co.uk/" },

  // ---- Scotland -----------------------------------------------------------
  { title: "Concert evening", category: "Music", venue: "Usher Hall", address: "Lothian Rd, Edinburgh EH1 2EA", lat: 55.9470, lng: -3.2050, day: 4, hour: 19, url: "https://www.usherhall.co.uk/" },
  { title: "Stand-up night", category: "Comedy", venue: "The Stand Comedy Club", address: "5 York Pl, Edinburgh EH1 3EB", lat: 55.9560, lng: -3.1900, day: 5, hour: 20, url: "https://www.thestand.co.uk/" },
  { title: "Live at the Barras", category: "Music", venue: "Barrowland Ballroom", address: "244 Gallowgate, Glasgow G4 0TT", lat: 55.8556, lng: -4.2361, day: 6, hour: 19, url: "https://barrowland-ballroom.co.uk/" },
  { title: "New band night", category: "Music", venue: "King Tut's Wah Wah Hut", address: "272a St Vincent St, Glasgow G2 5RL", lat: 55.8634, lng: -4.2661, day: 3, hour: 20, url: "https://www.kingtuts.co.uk/" },
  { title: "Highland music session", category: "Music", venue: "Eden Court", address: "Bishops Rd, Inverness IV3 5SA", lat: 57.4740, lng: -4.2320, day: 5, hour: 19, url: "https://eden-court.co.uk/" },

  // ---- Northern Ireland ---------------------------------------------------
  { title: "Concert night", category: "Music", venue: "Ulster Hall", address: "34 Bedford St, Belfast BT2 7FF", lat: 54.5940, lng: -5.9330, day: 4, hour: 19, url: "https://ulsterhall.co.uk/" },
  { title: "Live session", category: "Music", venue: "The Limelight", address: "17 Ormeau Ave, Belfast BT2 8HD", lat: 54.5930, lng: -5.9310, day: 6, hour: 20, url: "https://www.limelightbelfast.com/" },
  { title: "Walled city tour", category: "Tours", venue: "Derry City Walls", address: "Society St, Derry BT48 6PJ", lat: 54.9970, lng: -7.3200, day: 0, hour: 11, url: "https://www.derrystrabane.com/" },
];

/// The curated venues near one region. `radiusKm` matches the radius the live
/// sources search, so the guide never drops a venue from a neighbouring town
/// that Ticketmaster would happily have returned.
export function fetchCurated({ lat, lng, radiusKm = 50 } = {}) {
  const near =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? VENUES.filter((v) => {
          const d = distanceKm(lat, lng, v.lat, v.lng);
          return d != null && d <= radiusKm;
        })
      : VENUES;

  return near.map((v, i) =>
    makeEvent({
      id: `curated-${v.venue.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i}`,
      title: `${v.title} at ${v.venue}`,
      category: v.category,
      start: nextOccurrence(v.day, v.hour),
      venue: v.venue,
      address: v.address,
      lat: v.lat,
      lng: v.lng,
      url: v.url,
      image: VENUE_IMAGES[v.venue] || "",
      source: "Local guide",
    })
  );
}
