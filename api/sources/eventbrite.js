// Eventbrite UK, without a headless browser. Eventbrite retired its public search
// API years ago, but their discovery pages embed a schema.org JSON-LD ItemList
// of Events *in the server-rendered HTML*, so a plain fetch + parse is enough
// (no Chromium, tiny memory footprint).
//
// To cast a wide net ("everything happening locally") we hit ten verticals plus
// the general feed, then merge and de-dupe. The vertical each event came from
// becomes its category, which is what gives the app real Music, Food, Comedy,
// Arts, Film, Sports, Family, Festival, Free and Pop-up filters from a source
// that needs no key at all.
import * as cheerio from "cheerio";
import { makeEvent, fetchWithTimeout } from "./util.js";

// Which Eventbrite site + town to scrape. Regions supply their own
// (see sources/regions.js); London is the default, matching the default region.
const DEFAULT_SITE = { host: "www.eventbrite.co.uk", slug: "united-kingdom--london" };

// Order matters: more specific verticals first so they win on de-dupe.
//
// Each vertical is one cheap HTML fetch with no key, so widening the list is
// the cheapest coverage available to us. Comedy, arts, film, sport and family
// were added because they are strong categories in British listings and the
// app already has filter chips for all of them.
function queriesFor(site) {
  const base = `https://${site.host}/d/${site.slug}`;
  return [
    { category: "Music", url: `${base}/music--events/` },
    { category: "Food & Drink", url: `${base}/food-and-drink--events/` },
    { category: "Festival", url: `${base}/festivals--events/` },
    { category: "Comedy", url: `${base}/performing-and-visual-arts--comedy--events/` },
    { category: "Arts", url: `${base}/performing-and-visual-arts--events/` },
    { category: "Film", url: `${base}/film-and-media--events/` },
    { category: "Sports", url: `${base}/sports-and-fitness--events/` },
    { category: "Family", url: `${base}/family-and-education--events/` },
    { category: "Pop-up", url: `${base}/pop-up/` },
    { category: "Free", url: `${base}/free--events/`, free: true },
    { category: "Things to do", url: `${base}/events/` },
  ];
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function scrapeQuery(q) {
  const res = await fetchWithTimeout(
    q.url,
    { headers: { "User-Agent": UA, Accept: "text/html" } },
    15000
  );
  if (!res.ok) throw new Error(`Eventbrite ${q.category} ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Find the JSON-LD block that is an ItemList of events.
  let items = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    if (items.length) return;
    try {
      const j = JSON.parse($(el).text());
      if (j.itemListElement) items = j.itemListElement.map((x) => x.item).filter(Boolean);
    } catch {
      /* skip malformed block */
    }
  });

  return items.map((it) => {
    const geo = it.location?.geo || {};
    const addr = it.location?.address || {};
    const start = it.startDate
      ? new Date(it.startDate.length <= 10 ? it.startDate + "T19:00:00" : it.startDate).toISOString()
      : null;
    return makeEvent({
      id: `eb-${(it.url || "").split("-").pop() || it.name}`,
      title: it.name,
      category: q.category,
      start,
      venue: it.location?.name || "",
      address: [addr.streetAddress, addr.addressLocality].filter(Boolean).join(", "),
      lat: geo.latitude ? Number(geo.latitude) : null,
      lng: geo.longitude ? Number(geo.longitude) : null,
      url: it.url || "",
      image: it.image || "",
      source: "Eventbrite",
      price: q.free ? "Free" : "",
    });
  });
}

// Run thunks with a small concurrency cap so we don't fire every vertical at
// once. Eleven simultaneous requests to one host is the sort of thing that gets
// an IP rate limited.
async function pool(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]).catch(() => []);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function fetchEventbrite(site = DEFAULT_SITE) {
  if (!site) return []; // region has no Eventbrite city mapped
  const results = await pool(queriesFor(site), 4, (q) => scrapeQuery(q));

  // De-dupe by event URL; first (most specific) query wins the category.
  // A later "Free" hit still upgrades the price to Free.
  const byUrl = new Map();
  for (const list of results) {
    for (const e of list) {
      const key = e.url || e.id;
      if (!byUrl.has(key)) byUrl.set(key, e);
      else if (e.price === "Free") byUrl.get(key).price = "Free";
    }
  }
  return [...byUrl.values()];
}
