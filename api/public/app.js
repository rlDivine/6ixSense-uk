/* ============================================================
   Pulse — what's on across the UK. PWA logic.
   ============================================================ */

// Category palette + glyphs (§3.3). Keyed by lowercase; falls back to generic.
const CATS = {
  "pop-up": { c: "#C77DFF", g: "🎁" },
  "food & drink": { c: "#FF7A59", g: "🍔" },
  festival: { c: "#FBBF24", g: "🎪" },
  music: { c: "#4AA3FF", g: "🎵" },
  "live music": { c: "#38BDF8", g: "🎸" },
  market: { c: "#34D399", g: "🛍️" },
  comedy: { c: "#F472B6", g: "🎤" },
  arts: { c: "#A78BFA", g: "🎨" },
  film: { c: "#FB7185", g: "🎬" },
  tours: { c: "#22D3EE", g: "🚶" },
  sports: { c: "#818CF8", g: "⚽" },
  family: { c: "#FCA5A5", g: "🎡" },
};
function catMeta(cat) {
  return CATS[(cat || "").toLowerCase()] || { c: "#7C8AA0", g: "✨" };
}

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

const state = {
  tab: "discover",
  sort: "nearest",
  range: "all",
  category: "All",
  search: "",
  origin: null,
  events: [],
  region: null,      // the UK town the API built this feed around
  inMarket: true,    // false once we learn the user is outside the UK
  lastLoad: 0,
  saved: store.get("saved", {}),          // id -> event object
  reminders: store.get("reminders", {}),  // id -> bool
  theme: store.get("theme", "dark"),
};

/* ───────── helpers ───────── */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function dateBadge(iso) {
  if (!iso) return { m: "TBA", d: "·" };
  const x = new Date(iso);
  return { m: x.toLocaleString("en-GB", { month: "short" }), d: x.getDate() };
}
function timeStr(iso) {
  if (!iso) return "Time TBA";
  return new Date(iso).toLocaleString("en-GB", { hour: "numeric", minute: "2-digit" });
}
function relDay(iso) {
  if (!iso) return "Date TBA";
  const days = Math.round((new Date(iso) - new Date()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
}
/* ───────── distances ─────────
   The API always sends kilometres. Britain signs its roads in miles, so that
   is what we show — `distNum` is the bare number and `distStr` adds the unit. */
function toMiles(km) { return km * 0.621371; }
function distNum(km) {
  if (km == null) return null;
  const v = toMiles(km);
  return v < 10 ? v.toFixed(1) : String(Math.round(v));
}
function distStr(km, fallback = "n/a") {
  const v = distNum(km);
  return v == null ? fallback : `${v} mi`;
}
function kmStr(e) {
  const v = distNum(e.distanceKm);
  if (v == null) return `· <small>n/a</small>`;
  return `${v} <small>mi</small>`;
}

/* Where this feed is for, in words. The API names the region it built the feed
   around; before the first response lands we say "the UK" rather than guessing
   at a town. */
function placeName() {
  return (state.region && state.region.label) || "the UK";
}
function isFree(e) { return (e.price || "").toLowerCase() === "free"; }
// Show the green Free badge only when "Free" isn't already the category chip.
function freeTag(e) { return isFree(e) && e.category !== "Free" ? `<span class="tag free">Free</span>` : ""; }
// Neutral price chip on cards when a non-free price is known (e.g. "£39").
function priceTag(e) { return e.price && !isFree(e) ? `<span class="tag">${esc(e.price)}</span>` : ""; }
// Clean bookmark glyph — outline when unsaved, filled accent when saved.
function bmIcon(on) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="${on ? "var(--accent)" : "none"}" stroke="${on ? "var(--accent)" : "currentColor"}" stroke-width="2" stroke-linejoin="round"><path d="M6 3.5h12a.5.5 0 0 1 .5.5v16.2l-6.5-3.8-6.5 3.8V4a.5.5 0 0 1 .5-.5z"/></svg>`;
}
function gradient(cat) {
  const c = catMeta(cat).c;
  return `linear-gradient(135deg, ${c}40, ${c}12)`;
}

/* ───────── data ───────── */
async function load(showSkeleton = true) {
  if (showSkeleton) renderSkeleton();
  const params = new URLSearchParams({ sort: state.sort, range: state.range });
  if (state.origin) { params.set("lat", state.origin.lat); params.set("lng", state.origin.lng); }
  try {
    const res = await fetch(`/api/events?${params}`);
    const data = await res.json();
    state.events = data.events || [];
    state.region = data.region || null;
    // False when the browser reported a position outside the UK — Pulse serves
    // the UK only, so we say so instead of pretending they're in London.
    state.inMarket = data.inMarket !== false;
    state.lastLoad = Date.now();
    buildCats();
    renderAll();
    scheduleReminders();
  } catch (e) {
    renderError(e.message);
  }
}

function visible() {
  let ev = state.events;
  if (state.category === "Free") ev = ev.filter(isFree);
  else if (state.category !== "All") ev = ev.filter((e) => e.category === state.category);
  return ev;
}

/* ───────── category chips ───────── */
function buildCats() {
  const counts = {};
  state.events.forEach((e) => { if (e.category) counts[e.category] = (counts[e.category] || 0) + 1; });
  const free = state.events.filter(isFree).length;
  const ordered = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const chips = ["All"];
  if (free) chips.push("Free");
  chips.push(...ordered.filter((c) => c !== "Free"));
  const row = $("#catRow");
  row.innerHTML = chips.slice(0, 16).map((c) =>
    `<button data-cat="${esc(c)}" class="${c === state.category ? "active" : ""}">${esc(c)}</button>`
  ).join("");
}

/* ───────── rendering ───────── */
function renderAll() {
  renderStatus();
  renderList();
  if (state.tab === "map") renderMap();
  renderSaved();
}

function renderStatus() {
  const items = visible();
  const rl = { all: "upcoming", today: "today", weekend: "this weekend", week: "this week" }[state.range];
  // Someone outside the UK is being shown London, so "near you" would be a lie.
  const where = !state.inMarket ? `in ${placeName()}` : state.origin ? "near you" : `in ${placeName()}`;
  $("#status").textContent = `${items.length} events ${rl} ${where}`;
  const mins = Math.round((Date.now() - state.lastLoad) / 60000);
  $("#updated").textContent = state.lastLoad ? `Updated ${mins === 0 ? "just now" : mins + "m ago"}` : "";
  $("#locLabel").textContent = state.origin && state.inMarket ? "You" : placeName();
  $("#sub").textContent = `in ${placeName()}, right now`;
}

function cardHTML(e) {
  const b = dateBadge(e.start);
  const cm = catMeta(e.category);
  const on = state.saved[e.id] ? "on" : "";
  const img = e.image
    ? `<img src="${esc(e.image)}" loading="lazy" onerror="this.remove()"/>`
    : `<span class="ph-glyph">${cm.g}</span>`;
  return `
  <button class="card" data-id="${esc(e.id)}">
    <span class="thumb" style="background:${gradient(e.category)}">
      ${img}
      <span class="datebadge"><span class="m">${b.m}</span><span class="d">${b.d}</span></span>
    </span>
    <span class="body">
      <span class="title">${esc(e.title)}</span>
      <span class="meta">${timeStr(e.start)} · ${esc(e.venue || placeName())}</span>
      <span class="tags">
        <span class="tag cat">${esc(e.category)}</span>
        <span class="tag">${relDay(e.start)}</span>
        ${freeTag(e)}
        ${priceTag(e)}
      </span>
    </span>
    <span class="rail">
      <span class="bookmark ${on}" data-bk="${esc(e.id)}">${bmIcon(!!state.saved[e.id])}</span>
      <span>
        <span class="km">${kmStr(e)}</span>
        <span class="src">${esc(e.source)}</span>
      </span>
    </span>
  </button>`;
}

function renderList() {
  const items = visible();
  const el = $("#list");
  if (!items.length) { renderEmpty(); return; }
  el.innerHTML = items.map(cardHTML).join("");
  $("#endcap").textContent = `${items.length} events · pull to refresh`;
}

function renderSkeleton() {
  $("#list").innerHTML =
    `<div class="loading-note">Finding events across the UK…<br><small>Merging live listings near you</small></div>` +
    Array.from({ length: 6 }).map(() =>
      `<div class="skel"><div class="shimmer"></div><div class="s2"><div class="l shimmer w70"></div><div class="l shimmer w40"></div><div class="l shimmer"></div></div></div>`
    ).join("");
  $("#status").textContent = "Loading…";
}
function renderEmpty() {
  $("#list").innerHTML =
    `<div class="state"><div class="em">🗓️</div><h3>No events match</h3><p>Try another category or widen the date range.</p><button id="resetBtn">Reset filters</button></div>`;
  $("#endcap").textContent = "";
}
function renderError(msg) {
  $("#list").innerHTML =
    `<div class="state"><div class="em">📡</div><h3>Couldn't reach events</h3><p>${esc(msg || "You may be offline.")}</p><button id="retryBtn">Retry</button></div>`;
}

/* ───────── Saved ───────── */
function renderSaved() {
  const ids = Object.keys(state.saved);
  const el = $("#savedList");
  if (!ids.length) {
    el.innerHTML = `<div class="state"><div class="em">🔖</div><h3>Nothing saved yet</h3><p>Tap the bookmark on any event to save it here.</p></div>`;
    return;
  }
  const items = ids.map((id) => state.saved[id]).filter((e) => e.start === null || new Date(e.start) >= new Date() - 6 * 3.6e6);
  items.sort((a, b) => (new Date(a.start || 8.64e15)) - (new Date(b.start || 8.64e15)));
  const groups = {};
  items.forEach((e) => {
    const key = e.start ? new Date(e.start).toLocaleDateString("en-GB", { weekday: "long", month: "long", day: "numeric" }) : "Date TBA";
    (groups[key] ||= []).push(e);
  });
  el.innerHTML = Object.entries(groups).map(([day, evs]) =>
    `<div class="group-h">${esc(day)}</div>` +
    evs.map((e) => cardHTML(e) +
      `<div class="remind"><span>🔔 Remind me 2h before</span><span class="switch ${state.reminders[e.id] ? "on" : ""}" data-rem="${esc(e.id)}"></span></div>`
    ).join("")
  ).join("");
}

/* ───────── Search: date / date-range parsing ─────────
   Pulls a date or date-range out of free text ("jazz this weekend", "july
   25-27", "next friday") so the search bar can filter by date on top of the
   usual title/venue/category match. */
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
function monthIndex(tok) {
  const t = tok.toLowerCase().slice(0, 3);
  return MONTHS.findIndex((mo) => mo.slice(0, 3) === t);
}
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
// Upcoming (or current) Sat+Sun — same convention as the server's range filter.
function weekendRange(now, next) {
  const day = now.getDay();
  let sat = new Date(now);
  if (day === 0) sat.setHours(0, 0, 0, 0);
  else { sat.setDate(sat.getDate() + ((6 - day + 7) % 7)); sat.setHours(0, 0, 0, 0); }
  if (next) sat.setDate(sat.getDate() + 7);
  const sun = new Date(sat); sun.setDate(sun.getDate() + 1); sun.setHours(23, 59, 59, 999);
  return { min: sat, max: sun };
}
// Returns { range: {min,max}|null, rest: leftover text still matched by title/venue/category }.
function parseDateQuery(raw) {
  const now = new Date();
  const strip = (m) => raw.replace(m, " ").replace(/\s+/g, " ").trim();
  let m;

  m = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (!isNaN(d)) return { range: { min: startOfDay(d), max: endOfDay(d) }, rest: strip(m[0]) };
  }

  // Month-name range: "july 25-27", "jul 25th to 27th"
  m = raw.match(/\b([a-zA-Z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|to|–|—)\s*(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (m && monthIndex(m[1]) !== -1) {
    const mi = monthIndex(m[1]), y = now.getFullYear();
    let d1 = new Date(y, mi, +m[2]), d2 = new Date(y, mi, +m[3]);
    if (endOfDay(d2) < now) { d1.setFullYear(y + 1); d2.setFullYear(y + 1); }
    return { range: { min: startOfDay(d1), max: endOfDay(d2) }, rest: strip(m[0]) };
  }

  // Single month-name date: "july 25", "jul 25th"
  m = raw.match(/\b([a-zA-Z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (m && monthIndex(m[1]) !== -1) {
    const mi = monthIndex(m[1]), y = now.getFullYear();
    let d = new Date(y, mi, +m[2]);
    if (endOfDay(d) < now) d.setFullYear(y + 1);
    return { range: { min: startOfDay(d), max: endOfDay(d) }, rest: strip(m[0]) };
  }

  // Numeric date, read the British way round: "25/7" is the 25th of July.
  m = raw.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) {
    const y = now.getFullYear();
    let d = new Date(y, +m[2] - 1, +m[1]);
    if (!isNaN(d)) {
      if (endOfDay(d) < now) d.setFullYear(y + 1);
      return { range: { min: startOfDay(d), max: endOfDay(d) }, rest: strip(m[0]) };
    }
  }

  m = raw.match(/\b(next\s+)?weekend\b/i);
  if (m) return { range: weekendRange(now, !!m[1]), rest: strip(m[0]) };

  m = raw.match(/\bnext week\b/i);
  if (m) return { range: { min: startOfDay(addDays(now, 7)), max: endOfDay(addDays(now, 13)) }, rest: strip(m[0]) };

  m = raw.match(/\bthis week\b/i);
  if (m) return { range: { min: startOfDay(now), max: endOfDay(addDays(now, 7)) }, rest: strip(m[0]) };

  m = raw.match(/\btoday\b/i);
  if (m) return { range: { min: startOfDay(now), max: endOfDay(now) }, rest: strip(m[0]) };

  m = raw.match(/\btomorrow\b/i);
  if (m) { const d = addDays(now, 1); return { range: { min: startOfDay(d), max: endOfDay(d) }, rest: strip(m[0]) }; }

  // Weekday name, e.g. "friday" (soonest upcoming, today included) / "next friday" (a week further out)
  for (let i = 0; i < WEEKDAYS.length; i++) {
    m = raw.match(new RegExp(`\\b(next\\s+)?${WEEKDAYS[i]}\\b`, "i"));
    if (m) {
      let delta = (i - now.getDay() + 7) % 7;
      if (m[1]) delta += 7;
      const d = addDays(now, delta);
      return { range: { min: startOfDay(d), max: endOfDay(d) }, rest: strip(m[0]) };
    }
  }

  return { range: null, rest: raw };
}
function formatRangeLabel({ min, max }) {
  const opts = { weekday: "short", month: "short", day: "numeric" };
  const a = min.toLocaleDateString("en-GB", opts), b = max.toLocaleDateString("en-GB", opts);
  return a === b ? a : `${a} – ${b}`;
}

/* ───────── Search ───────── */
function renderSearch() {
  const raw = state.search.trim();
  const sug = $("#searchSuggest");
  const res = $("#searchResults");
  if (!raw) {
    res.innerHTML = "";
    const cats = ["Music", "Food & Drink", "Pop-up", "Free", "Today", "This weekend"];
    sug.innerHTML = `<h3>Popular</h3><div class="chips">${cats.map((c) => `<button data-sq="${esc(c)}">${esc(c)}</button>`).join("")}</div>`;
    return;
  }
  sug.innerHTML = "";
  const { range, rest } = parseDateQuery(raw);
  const q = rest.trim().toLowerCase();

  let hits = state.events;
  if (range) hits = hits.filter((e) => e.start && new Date(e.start) >= range.min && new Date(e.start) <= range.max);
  if (q) hits = hits.filter((e) => [e.title, e.venue, e.category].some((f) => (f || "").toLowerCase().includes(q)));

  const chip = range
    ? `<div class="search-date-chip">📅 ${esc(formatRangeLabel(range))}<button id="clearDateFilter" aria-label="Clear date filter">✕</button></div>`
    : "";
  const list = hits.length
    ? hits.map(cardHTML).join("")
    : `<div class="state"><div class="em">🔍</div><h3>No matches${range ? " for that date" : ` for "${esc(state.search)}"`}</h3><p>Try a venue, artist, category, or a date like "this weekend".</p></div>`;
  res.innerHTML = chip + list;

  const clearBtn = $("#clearDateFilter");
  if (clearBtn) clearBtn.onclick = () => { state.search = rest; $("#searchInput").value = rest; renderSearch(); };
}

/* ───────── Map ───────── */
let map, layer, tileLayer, youMarker, pins = {};
const tileURL = () =>
  `https://{s}.basemaps.cartocdn.com/${state.theme === "light" ? "light_all" : "dark_all"}/{z}/{x}/{y}{r}.png`;
// Where the map sits before any events land: central London, matching the
// backend's default region. The first feed re-fits the bounds anyway.
const HOME_VIEW = [51.5074, -0.1278];
function initMap() {
  // Leaflet comes off a CDN. If that request fails there is no map, but the
  // feed, search and saved tabs are all perfectly usable — so swallow it here
  // rather than letting the throw take the rest of init (and the event list)
  // down with it.
  if (typeof L === "undefined") { console.warn("Leaflet unavailable — map disabled"); return; }
  map = L.map("map", { zoomControl: false, attributionControl: false }).setView(HOME_VIEW, 12);
  tileLayer = L.tileLayer(tileURL(), { maxZoom: 19 }).addTo(map);
  layer = L.layerGroup().addTo(map);
}
function pinIcon(e, sel) {
  const cm = catMeta(e.category);
  return L.divIcon({
    className: "", iconSize: sel ? [38, 38] : [30, 30], iconAnchor: sel ? [19, 38] : [15, 30],
    html: `<div class="pin ${sel ? "sel" : ""}" style="background:${cm.c}"><span>${cm.g}</span></div>`,
  });
}
function renderMap() {
  if (!map) return;
  layer.clearLayers(); pins = {};
  const items = visible().filter((e) => e.lat != null && e.lng != null);
  const pts = [];
  items.forEach((e) => {
    const m = L.marker([e.lat, e.lng], { icon: pinIcon(e, false) }).addTo(layer);
    m.on("click", () => selectMapEvent(e.id));
    pins[e.id] = m; pts.push([e.lat, e.lng]);
  });
  if (state.origin) {
    if (youMarker) map.removeLayer(youMarker);
    youMarker = L.marker([state.origin.lat, state.origin.lng], {
      icon: L.divIcon({ className: "", iconSize: [16, 16], html: `<div class="youdot"></div>` }),
    }).addTo(map);
    pts.push([state.origin.lat, state.origin.lng]);
  }
  if (pts.length) map.fitBounds(pts, { padding: [50, 50], maxZoom: 14 });
  renderCarousel(items);
  setTimeout(() => map.invalidateSize(), 50);
}
function renderCarousel(items) {
  $("#carousel").innerHTML = items.slice(0, 40).map((e) => {
    const b = dateBadge(e.start); const cm = catMeta(e.category);
    const banner = e.image ? `style="background-image:url('${esc(e.image)}');background-size:cover;background-position:center"` : `style="background:${gradient(e.category)}"`;
    return `<div class="ccard" data-cid="${esc(e.id)}">
      <div class="cbanner" ${banner}>${e.image ? "" : cm.g}
        <span class="cdate"><span class="m">${b.m}</span><span class="d">${b.d}</span></span>
        <span class="ckm">${distStr(e.distanceKm, "—")}</span>
      </div>
      <div class="cb"><h4>${esc(e.title)}</h4><p>${timeStr(e.start)} · ${esc(e.venue || placeName())}</p>
        <span class="tags"><span class="tag cat">${esc(e.category)}</span>${freeTag(e)}</span>
      </div>
    </div>`;
  }).join("");
}
function selectMapEvent(id) {
  const e = state.events.find((x) => x.id === id);
  if (!e) return;
  Object.entries(pins).forEach(([pid, m]) => m.setIcon(pinIcon(state.events.find((x) => x.id === pid), pid === id)));
  map.flyTo([e.lat, e.lng], 15, { duration: 0.6 });
  const cm = catMeta(e.category);
  const img = e.image ? `style="background-image:url('${esc(e.image)}');background-size:cover;background-position:center"` : `style="background:${gradient(e.category)}"`;
  const pip = $("#pip");
  pip.innerHTML = `<div class="pip-img" ${img}>${e.image ? "" : cm.g}</div><div class="pip-b"><h4>${esc(e.title)}</h4><p>${timeStr(e.start)} · ${esc(e.venue || placeName())} · ${relDay(e.start)}</p></div>`;
  pip.classList.remove("hidden");
  pip.onclick = () => openDetail(id);
}

/* ───────── Detail ───────── */
let miniMap;
function openDetail(id) {
  const e = state.events.find((x) => x.id === id) || state.saved[id];
  if (!e) return;
  const cm = catMeta(e.category);
  const on = state.saved[e.id];
  const hero = e.image ? `<img src="${esc(e.image)}" onerror="this.remove()"/>` : "";
  $("#detail").innerHTML = `
    <div class="hero" style="background:${gradient(e.category)}">${hero}<div class="scrim"></div>${e.image ? "" : cm.g}
      <button class="hbtn back" id="detailBack">←</button>
      <button class="hbtn fav" id="detailFav">${bmIcon(!!on)}</button>
    </div>
    <div class="dscroll">
      <div class="badges"><span class="tag cat">${esc(e.category)}</span>${freeTag(e)}<span class="badge-src">via ${esc(e.source)}</span></div>
      <h2>${esc(e.title)}</h2>
      <p class="desc">${esc(e.description || "Tap “Get tickets / Details” for the full description and tickets from the source.")}</p>
      <div class="facts">
        <div class="fact"><div class="k">📅 When</div><div class="v">${e.start ? new Date(e.start).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) + " · " + timeStr(e.start) : "TBA"}</div></div>
        <div class="fact"><div class="k">📍 Distance</div><div class="v">${distStr(e.distanceKm)}</div></div>
        <div class="fact"><div class="k">🏷️ Price</div><div class="v">${isFree(e) ? "Free" : esc(e.price || "—")}</div></div>
      </div>
      <div class="venue-block">
        <div class="vn">${esc(e.venue || "Venue TBA")}</div>
        <div class="va">${esc(e.address || placeName())}</div>
        ${e.lat != null ? `<div id="miniMap"></div>` : ""}
        ${e.lat != null ? `<a class="dir" href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}" target="_blank" rel="noopener">Directions ↗</a>` : ""}
      </div>
      <div class="secondary-actions">
        <button class="sa" id="saShare">Share</button>
        <button class="sa" id="saCal">Add to calendar</button>
        <button class="sa" id="saSave">${on ? "Saved ✓" : "Save"}</button>
      </div>
    </div>
    <div class="cta"><a href="${esc(e.url || "#")}" target="_blank" rel="noopener">Get tickets / Details ↗</a></div>`;
  $("#detail").classList.remove("hidden");

  if (e.lat != null) {
    setTimeout(() => {
      miniMap = L.map("miniMap", { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false }).setView([e.lat, e.lng], 14);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png").addTo(miniMap);
      L.marker([e.lat, e.lng], { icon: pinIcon(e, true) }).addTo(miniMap);
    }, 60);
  }
  $("#detailBack").onclick = closeDetail;
  $("#detailFav").onclick = () => { toggleSave(e); openDetail(id); };
  $("#saSave").onclick = () => { toggleSave(e); openDetail(id); };
  $("#saShare").onclick = () => shareEvent(e);
  $("#saCal").onclick = () => addToCalendar(e);
}
function closeDetail() {
  if (miniMap) { miniMap.remove(); miniMap = null; }
  $("#detail").classList.add("hidden");
  $("#detail").innerHTML = "";
}

/* ───────── Save / reminders / share / calendar ───────── */
function toggleSave(e) {
  if (state.saved[e.id]) { delete state.saved[e.id]; delete state.reminders[e.id]; }
  else state.saved[e.id] = e;
  store.set("saved", state.saved); store.set("reminders", state.reminders);
  renderList(); renderSaved();
}
function toggleReminder(id) {
  state.reminders[id] = !state.reminders[id];
  store.set("reminders", state.reminders);
  if (state.reminders[id] && "Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
  scheduleReminders();
  renderSaved();
}
const timers = {};
function scheduleReminders() {
  Object.keys(state.reminders).forEach((id) => {
    if (timers[id] || !state.reminders[id]) return;
    const e = state.saved[id];
    if (!e?.start) return;
    const fireAt = new Date(e.start).getTime() - 2 * 3.6e6;
    const delay = fireAt - Date.now();
    if (delay > 0 && delay < 24 * 3.6e6) {
      timers[id] = setTimeout(() => {
        if ("Notification" in window && Notification.permission === "granted")
          new Notification("Starting soon: " + e.title, { body: `${timeStr(e.start)} · ${e.venue || placeName()}` });
      }, delay);
    }
  });
}
async function shareEvent(e) {
  const data = { title: e.title, text: `${e.title} — ${timeStr(e.start)} @ ${e.venue || placeName()}`, url: e.url || location.href };
  if (navigator.share) { try { await navigator.share(data); } catch {} }
  else { await navigator.clipboard?.writeText(`${data.text} ${data.url}`); alert("Link copied"); }
}
function addToCalendar(e) {
  const start = e.start ? new Date(e.start) : new Date();
  const end = new Date(start.getTime() + 2 * 3.6e6);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${fmt(start)}\nDTEND:${fmt(end)}\nSUMMARY:${e.title}\nLOCATION:${e.venue || ""} ${e.address || ""}\nURL:${e.url || ""}\nEND:VEVENT\nEND:VCALENDAR`;
  const a = document.createElement("a");
  a.href = "data:text/calendar;charset=utf8," + encodeURIComponent(ics);
  a.download = (e.title || "event").slice(0, 40) + ".ics";
  a.click();
}

/* ───────── tabs ───────── */
function switchTab(tab) {
  state.tab = tab;
  $$(".tab").forEach((t) => t.classList.add("hidden"));
  $(`#tab-${tab}`).classList.remove("hidden");
  $$("#tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "map") renderMap();
  if (tab === "search") { renderSearch(); setTimeout(() => $("#searchInput").focus(), 50); }
  if (tab === "saved") renderSaved();
}

/* ───────── geolocation ───────── */
function requestLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (p) => { state.origin = { lat: p.coords.latitude, lng: p.coords.longitude }; load(); },
    () => load(),
    { timeout: 7000 }
  );
}
// Recenters the map on the user without refitting to every pin — for when
// you've panned/zoomed away and just want to find yourself again.
function locateMe() {
  if (state.origin && map) {
    map.flyTo([state.origin.lat, state.origin.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    return;
  }
  requestLocation(); // no fix yet — ask, then the normal load()/renderMap() centers on it
}

/* ───────── theme ───────── */
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  $("#themeBtn") && ($("#themeBtn").textContent = state.theme === "dark" ? "◐" : "◑");
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.content = state.theme === "dark" ? "#0E1116" : "#F7F8FA";
  if (tileLayer) tileLayer.setUrl(tileURL()); // swap map tiles to match theme
}

/* ───────── onboarding ───────── */
let obIdx = 0;
function showOnboarding() {
  $("#onboarding").classList.remove("hidden");
  const slides = $$(".ob-slide");
  const upd = () => {
    slides.forEach((s, i) => s.classList.toggle("hidden", i !== obIdx));
    $$("#obDots i").forEach((d, i) => d.classList.toggle("active", i === obIdx));
    $("#obNext").textContent = obIdx === 2 ? "Get started" : "Next";
    if (obIdx === 1) requestLocationOnce();
  };
  upd();
  const finish = () => { store.set("onboarded", true); $("#onboarding").classList.add("hidden"); startApp(); };
  $("#obNext").onclick = () => { if (obIdx < 2) { obIdx++; upd(); } else finish(); };
  $("#obSkip").onclick = finish;
  $("#obLater").onclick = finish;
  $("#obWhy").onclick = () => alert("We compute straight-line distance from your location to each event so we can sort by what's closest. Your location never leaves your device.");
}
let askedLoc = false;
function requestLocationOnce() { if (!askedLoc) { askedLoc = true; requestLocation(); } }

/* ───────── boot ───────── */
function startApp() {
  $("#app").classList.remove("hidden");
  initMap();
  requestLocation(); // refines distance + reloads when ready
  load();            // show results immediately (downtown default)
}

function wireEvents() {
  $("#sortSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.sort = b.dataset.sort;
    $$("#sortSeg button").forEach((x) => x.classList.toggle("active", x === b));
    load(false);
  });
  const rangeHandler = (rowSel) => (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.range = b.dataset.range;
    $$("#rangeRow button, #mapRangeRow button").forEach((x) => x.classList.toggle("active", x.dataset.range === state.range));
    load(false);
  };
  $("#rangeRow").addEventListener("click", rangeHandler());
  $("#mapRangeRow").addEventListener("click", rangeHandler());
  $("#catRow").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.category = b.dataset.cat;
    $$("#catRow button").forEach((x) => x.classList.toggle("active", x === b));
    renderStatus(); renderList(); if (state.tab === "map") renderMap();
  });
  $("#tabbar").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) switchTab(b.dataset.tab); });
  $("#mapFab").onclick = () => switchTab("map");
  $("#locChip").onclick = requestLocation;
  $("#locateBtn").onclick = locateMe;
  $("#refreshBtn").onclick = () => load();
  $("#themeBtn").onclick = () => { state.theme = state.theme === "dark" ? "light" : "dark"; store.set("theme", state.theme); applyTheme(); };

  // Delegated taps: cards, bookmarks, reminders, suggestions, state buttons
  document.body.addEventListener("click", (e) => {
    const bk = e.target.closest("[data-bk]");
    if (bk) { e.stopPropagation(); const ev = state.events.find((x) => x.id === bk.dataset.bk) || state.saved[bk.dataset.bk]; if (ev) toggleSave(ev); return; }
    const rem = e.target.closest("[data-rem]");
    if (rem) { toggleReminder(rem.dataset.rem); return; }
    const cid = e.target.closest("[data-cid]");
    if (cid) { selectMapEvent(cid.dataset.cid); return; }
    const card = e.target.closest(".card");
    if (card) { openDetail(card.dataset.id); return; }
    if (e.target.id === "resetBtn") { state.category = "All"; state.range = "all"; $$("#rangeRow button").forEach((x) => x.classList.toggle("active", x.dataset.range === "all")); buildCats(); load(false); return; }
    if (e.target.id === "retryBtn") { load(); return; }
    const sq = e.target.closest("[data-sq]");
    if (sq) { state.search = sq.dataset.sq; $("#searchInput").value = state.search; renderSearch(); }
  });

  $("#searchInput").addEventListener("input", (e) => { state.search = e.target.value; renderSearch(); });

  // simple pull-to-refresh on Discover
  let startY = 0, pulling = false;
  const sc = $("#discoverScroll");
  sc.addEventListener("touchstart", (e) => { if (sc.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; } });
  sc.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    $("#pullHint").style.height = Math.min(Math.max(dy, 0) / 2, 30) + "px";
  });
  sc.addEventListener("touchend", (e) => {
    if (pulling && (e.changedTouches[0].clientY - startY) > 80) load();
    $("#pullHint").style.height = "0px"; pulling = false;
  });
}

/* ───────── init ───────── */
applyTheme();
wireEvents();
if (store.get("onboarded", false)) {
  state.origin = null;
  $("#app").classList.remove("hidden");
  initMap();
  requestLocation();
  load();
} else {
  showOnboarding();
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
