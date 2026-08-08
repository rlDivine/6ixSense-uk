/* ============================================================
   Pulse. What's on across the UK. PWA logic.
   ============================================================ */

// Category palette and icons.
//
// Two values per category, because the colour does two jobs with opposite
// needs. As a dot or a wash it sits on the app surface, and the mid-tone hues
// that read well on light greys drop to about 2.5:1 on navy, which is close to
// invisible. As a map pin it is a fill with a white symbol on it, and the
// lifted hues fail that instead. So `c` is the on-surface colour and switches
// with the theme, and `p` is the pin fill and never does.
//
// Anchored on the two flag colours: red for festivals, blue for music.
//
// Icons are inline SVG, not emoji, so they inherit the category colour, stay
// the same weight on every platform, and never depend on an emoji font.
const CATS = {
  "pop-up": { c: "#7A5BA6", d: "#C08CE8", i: "gift" },
  "food & drink": { c: "#B5651D", d: "#E0913F", i: "food" },
  festival: { c: "#C8102E", d: "#F44F63", i: "flag" },
  music: { c: "#2E5AAC", d: "#6E9BF0", i: "note" },
  "live music": { c: "#4A7FD4", d: "#8FBCF5", i: "note" },
  market: { c: "#2E7D6B", d: "#45C4A5", i: "bag" },
  comedy: { c: "#B03060", d: "#EE6E9C", i: "mic" },
  arts: { c: "#6B4FA0", d: "#9B87EC", i: "palette" },
  film: { c: "#A03A5C", d: "#EE7093", i: "film" },
  tours: { c: "#3E7C8C", d: "#5FC0D6", i: "signpost" },
  sports: { c: "#1F5C3D", d: "#4FBE85", i: "ball" },
  family: { c: "#C06A2E", d: "#EFA05C", i: "balloon" },
};
const CAT_FALLBACK = { c: "#5A6580", d: "#98A2BC", i: "ticket" };

// Single-colour line icons on a 24 grid, stroked rather than filled so they
// stay legible at 16px and at 48px without a second set of artwork.
const ICON_PATHS = {
  note: '<circle cx="7" cy="17.4" r="2.6"/><circle cx="18" cy="15.4" r="2.6"/><path d="M9.6 17.4V7l11-2v10.4"/>',
  food: '<path d="M5 3v6.5a2 2 0 0 0 4 0V3M7 9.5V21"/><path d="M17.5 3c-1.6 1.6-2.2 3.2-2.2 5.2 0 1.7.8 3 2.2 3.6V21"/>',
  flag: '<path d="M7 3v18"/><path d="M7 4.5h11l-3 3.75L18 12H7z"/>',
  bag: '<path d="M4.5 8h15l-1.1 12.5h-12.8z"/><path d="M8.7 8V6.2a3.3 3.3 0 0 1 6.6 0V8"/>',
  mic: '<rect x="9.2" y="3" width="5.6" height="10.5" rx="2.8"/><path d="M5.8 11.4a6.2 6.2 0 0 0 12.4 0M12 17.6V21"/>',
  palette: '<path d="M12 3.2a8.8 8.8 0 1 0 0 17.6c1.4 0 2.1-.8 2.1-1.7 0-.7-.6-1.3-.6-2 0-.8.7-1.4 1.6-1.4h1.4a4.4 4.4 0 0 0 4.3-4.4C20.8 6.5 16.9 3.2 12 3.2z"/><circle cx="7.6" cy="10.6" r="1.2"/><circle cx="12" cy="7.6" r="1.2"/><circle cx="16.4" cy="10.6" r="1.2"/>',
  film: '<rect x="3.2" y="5" width="17.6" height="14" rx="2"/><path d="M3.2 12h17.6M8 5v14M16 5v14"/>',
  signpost: '<path d="M12 3v18"/><path d="M12 5.2h6.8l-2 2.4 2 2.4H12z"/><path d="M12 12.4H5.2l2 2.4-2 2.4H12z"/>',
  ball: '<circle cx="12" cy="12" r="8.8"/><path d="M12 3.2v17.6M3.2 12h17.6"/>',
  balloon: '<ellipse cx="12" cy="9.2" rx="5.6" ry="6.2"/><path d="M12 15.4v3.1M10.4 21h3.2"/>',
  gift: '<rect x="3.4" y="8.4" width="17.2" height="12.2" rx="1.6"/><path d="M3.4 12.6h17.2M12 8.4v12.2"/><path d="M12 8.4S10.6 3.4 8.2 3.4a2.5 2.5 0 0 0 0 5zM12 8.4s1.4-5 3.8-5a2.5 2.5 0 0 1 0 5z"/>',
  ticket: '<path d="M4 7.2h16v3a2 2 0 0 0 0 3.6v3H4v-3a2 2 0 0 0 0-3.6z"/><path d="M13.2 7.2v9.6"/>',
};

// Interface icons, same treatment as the category ones. Everything that used
// to be an emoji is drawn here instead, so nothing in the interface depends on
// the platform's emoji font or shifts weight between Android and iOS.
const UI_ICONS = {
  calendar: '<rect x="3.2" y="5" width="17.6" height="16" rx="2"/><path d="M3.2 10h17.6M8 3v4M16 3v4"/>',
  offline: '<path d="M5 12.5a9.9 9.9 0 0 1 14 0M8.2 15.8a5.3 5.3 0 0 1 7.6 0"/><circle cx="12" cy="19.2" r="1.1"/><path d="M3 3l18 18"/>',
  bookmark: '<path d="M6 3.6h12a.6.6 0 0 1 .6.6v16.2l-6.6-3.8-6.6 3.8V4.2a.6.6 0 0 1 .6-.6z"/>',
  bell: '<path d="M18 9.4a6 6 0 1 0-12 0c0 5.1-2 6.4-2 6.4h16s-2-1.3-2-6.4z"/><path d="M13.7 19.4a2 2 0 0 1-3.4 0"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="M15.7 15.7 21 21"/>',
  home: '<path d="M3.6 10.4 12 3.4l8.4 7v9.2a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4z"/><path d="M9.4 21v-8h5.2v8"/>',
  map: '<path d="M9 3.4 3.4 6v14.6L9 18l6 2.6 5.6-2.6V3.4L15 6z"/><path d="M9 3.4V18M15 6v14.6"/>',
  pin: '<path d="M12 21s7-6.9 7-11.4A7 7 0 0 0 5 9.6C5 14.1 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 6.8V12l3.6 2.2"/>',
  refresh: '<path d="M20.4 12a8.4 8.4 0 1 1-2.5-6"/><path d="M20.4 4.2V10h-5.8"/>',
  external: '<path d="M14 4h6v6M20 4l-8.4 8.4"/><path d="M18 14.4V19a1.6 1.6 0 0 1-1.6 1.6H5A1.6 1.6 0 0 1 3.4 19V7.6A1.6 1.6 0 0 1 5 6h4.6"/>',
  check: '<path d="M4.8 12.6 9.8 17.6 19.2 6.8"/>',
  tag: '<path d="M11.2 3.4h9.4v9.4l-8.8 8.8L2.4 12.2z"/><circle cx="16.4" cy="7.6" r="1.3"/>',
  down: '<path d="M12 4.4v15.2"/><path d="m6.4 13.6 5.6 6 5.6-6"/>',
  back: '<path d="M19.6 12H4.4"/><path d="m10.6 5.4-6.2 6.6 6.2 6.6"/>',
  close: '<path d="M5.4 5.4 18.6 18.6M18.6 5.4 5.4 18.6"/>',
};

/// One interface icon, at `size` px, inheriting the current text colour unless
/// a colour is given.
function uiIcon(name, size = 18, color) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true"
    stroke="${color || "currentColor"}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${
    UI_ICONS[name] || ""}</svg>`;
}

/// The category's colours and icon. `c` is resolved for the current theme, so
/// callers never have to think about it; `p` is the pin fill, which does not
/// change with the theme because a white symbol sits on it either way.
function catMeta(cat) {
  const m = CATS[(cat || "").toLowerCase()] || CAT_FALLBACK;
  return { c: state.theme === "dark" ? m.d : m.c, p: m.c, i: m.i };
}

/// One category icon, at `size` px, in `color` (defaults to the category's own).
function catIcon(cat, size = 20, color) {
  const m = catMeta(cat);
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true"
    stroke="${color || m.c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${
    ICON_PATHS[m.i] || ICON_PATHS.ticket}</svg>`;
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

/* ---- helpers ---- */
/// Only http(s) links are allowed to reach an href or an img src.
///
/// The backend already drops anything else when it builds the event, but saved
/// events are persisted in localStorage and outlive a backend deploy, so a
/// listing saved before that fix would still be sitting on the device. Escaping
/// is no help here: it stops an attribute being broken out of, not a
/// "javascript:" scheme being chosen.
function safeHref(raw) {
  if (!raw || typeof raw !== "string") return "";
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? raw.trim() : "";
  } catch {
    return "";
  }
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function timeStr(iso) {
  if (!iso) return "Time TBA";
  return new Date(iso).toLocaleString("en-GB", { hour: "numeric", minute: "2-digit" });
}
/// The overline above each card title: "TODAY . 19:00", "FRI 8 AUG . 19:00".
/// Returns the label plus whether it is imminent, which is the one place the
/// brand red earns its keep in the list.
function whenLabel(iso) {
  if (!iso) return { text: "Date to be announced", soon: false };
  const d = new Date(iso);
  const days = Math.round((d - new Date()) / 86400000);
  const time = d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days <= 0) return { text: `Today, ${time}`, soon: true };
  if (days === 1) return { text: `Tomorrow, ${time}`, soon: true };
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return { text: `${day}, ${time}`, soon: false };
}

function relDay(iso) {
  if (!iso) return "Date TBA";
  const days = Math.round((new Date(iso) - new Date()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
}
/* --------- distances ---------
   The API always sends kilometres. Britain signs its roads in miles, so that
   is what we show. `distNum` is the bare number, `distStr` adds the unit. */
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
// Bookmark glyph: outline when unsaved, filled accent when saved.
function bmIcon(on) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="${on ? "var(--accent)" : "none"}" stroke="${on ? "var(--accent)" : "currentColor"}" stroke-width="2" stroke-linejoin="round"><path d="M6 3.5h12a.5.5 0 0 1 .5.5v16.2l-6.5-3.8-6.5 3.8V4a.5.5 0 0 1 .5-.5z"/></svg>`;
}
/// Flat tint behind a card image, used when an event has no photo of its own.
/// This replaced a gradient: the category colour alone carries it.
function wash(cat) {
  // The alpha differs by theme because the placeholder glyph is drawn in the
  // same hue on top of this. The light surfaces need the lighter tint for the
  // two to stay apart; on dark there is more room.
  const a = state.theme === "dark" ? "2E" : "1F";   // 0.18 and 0.12
  return `${catMeta(cat).c}${a}`;
}

/* ---- data ---- */
async function load(showSkeleton = true) {
  if (showSkeleton) renderSkeleton();
  const params = new URLSearchParams({ sort: state.sort, range: state.range });
  if (state.origin) { params.set("lat", state.origin.lat); params.set("lng", state.origin.lng); }
  try {
    const res = await fetch(`/api/events?${params}`);
    const data = await res.json();
    state.events = data.events || [];
    state.region = data.region || null;
    // False when the browser reported a position outside the UK. Pulse serves
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

/* ---- category chips ---- */
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

/* ---- rendering ---- */
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
  $("#locLabel").textContent = state.origin && state.inMarket ? "Near you" : placeName();
  $("#pageTitle").textContent = `What's on in ${placeName()}`;
}

function cardHTML(e) {
  const cm = catMeta(e.category);
  const w = whenLabel(e.start);
  const on = state.saved[e.id] ? "on" : "";
  // The icon is laid down first and the photo covers it, so a URL that fails
  // leaves the icon rather than an empty box.
  const img = `<span class="ph-glyph">${catIcon(e.category, 26)}</span>` +
    (e.image ? `<img src="${esc(safeHref(e.image))}" loading="lazy" onerror="this.remove()"/>` : "");
  const dist = distNum(e.distanceKm);
  const bits = [];
  if (dist != null) bits.push(`<span class="dot"></span><span>${dist} mi</span>`);
  if (isFree(e)) bits.push(`<span class="dot"></span><span class="free">Free</span>`);
  else if (e.price) bits.push(`<span class="dot"></span><span>${esc(e.price)}</span>`);
  bits.push(`<span class="dot"></span><span>${esc(e.source)}</span>`);

  // The bookmark is a sibling of the card, not a child of it. A control nested
  // inside a button cannot be reached with a keyboard, which is how it used to
  // be: a span with a click handler, focusable by nobody and named to nobody.
  return `
  <div class="card-wrap">
    <button class="card" data-id="${esc(e.id)}">
      <span class="thumb" style="background:${wash(e.category)}">${img}</span>
      <span class="body">
        <span class="when ${w.soon ? "soon" : ""}">${esc(w.text)}</span>
        <span class="title">${esc(e.title)}</span>
        <span class="venue">${esc(e.venue || placeName())}</span>
        <span class="foot">
          <span class="cat"><i style="background:${cm.c}"></i>${esc(e.category)}</span>
          ${bits.join("")}
        </span>
      </span>
    </button>
    <button class="bookmark ${on}" data-bk="${esc(e.id)}" aria-pressed="${on ? "true" : "false"}"
      aria-label="Save ${esc(e.title)}">${bmIcon(!!state.saved[e.id])}</button>
  </div>`;
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
    `<div class="state"><div class="em">${uiIcon("calendar", 38)}</div><h3>No events match</h3><p>Try another category or widen the date range.</p><button id="resetBtn">Reset filters</button></div>`;
  $("#endcap").textContent = "";
}
function renderError(msg) {
  $("#list").innerHTML =
    `<div class="state"><div class="em">${uiIcon("offline", 38)}</div><h3>Couldn't reach events</h3><p>${esc(msg || "You may be offline.")}</p><button id="retryBtn">Retry</button></div>`;
}

/* ---- Saved ---- */
function renderSaved() {
  const ids = Object.keys(state.saved);
  const el = $("#savedList");
  if (!ids.length) {
    el.innerHTML = `<div class="state"><div class="em">${uiIcon("bookmark", 38)}</div><h3>Nothing saved yet</h3><p>Tap the bookmark on any event to save it here.</p></div>`;
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
      `<div class="remind"><span class="remind-label" id="remlbl-${esc(e.id)}">${uiIcon("bell", 16)} Remind me 2h before</span><button class="switch ${state.reminders[e.id] ? "on" : ""}" data-rem="${esc(e.id)}" role="switch" aria-checked="${state.reminders[e.id] ? "true" : "false"}" aria-labelledby="remlbl-${esc(e.id)}"></button></div>`
    ).join("")
  ).join("");
}

/* --------- Search: date / date-range parsing ---------
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
// Upcoming (or current) Sat and Sun, the same convention as the server's range filter.
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

  // Month-name range: "july 25-27", "jul 25th to 27th". The separator class
  // accepts the dashes a person might actually type, including the ones a
  // phone keyboard substitutes automatically. This is about reading input, not
  // about how the app writes.
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
  return a === b ? a : `${a} to ${b}`;
}

/* ---- Search ---- */
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
    ? `<div class="search-date-chip">${uiIcon("calendar", 15)} ${esc(formatRangeLabel(range))}<button id="clearDateFilter" aria-label="Clear date filter">${uiIcon("close", 15)}</button></div>`
    : "";
  const list = hits.length
    ? hits.map(cardHTML).join("")
    : `<div class="state"><div class="em">${uiIcon("search", 38)}</div><h3>No matches${range ? " for that date" : ` for "${esc(state.search)}"`}</h3><p>Try a venue, artist, category, or a date like "this weekend".</p></div>`;
  res.innerHTML = chip + list;

  const clearBtn = $("#clearDateFilter");
  if (clearBtn) clearBtn.onclick = () => { state.search = rest; $("#searchInput").value = rest; renderSearch(); };
}

/* ---- Map ---- */
let map, layer, tileLayer, youMarker, pins = {};
const tileURL = () =>
  `https://{s}.basemaps.cartocdn.com/${state.theme === "light" ? "light_all" : "dark_all"}/{z}/{x}/{y}{r}.png`;
// Where the map sits before any events land: central London, matching the
// backend's default region. The first feed re-fits the bounds anyway.
const HOME_VIEW = [51.5074, -0.1278];
function initMap() {
  // Leaflet comes off a CDN. If that request fails there is no map, but the
  // feed, search and saved tabs are all perfectly usable, so swallow it here
  // rather than letting the throw take the rest of init (and the event list)
  // down with it.
  if (typeof L === "undefined") { console.warn("Leaflet unavailable, map disabled"); return; }
  map = L.map("map", { zoomControl: false, attributionControl: false }).setView(HOME_VIEW, 12);
  tileLayer = L.tileLayer(tileURL(), { maxZoom: 19 }).addTo(map);
  layer = L.layerGroup().addTo(map);
}
function pinIcon(e, sel) {
  const cm = catMeta(e.category);
  // The pin is rotated 45 degrees to make its point, so the icon inside has to
  // be rotated back the other way to sit upright.
  return L.divIcon({
    className: "", iconSize: sel ? [38, 38] : [30, 30], iconAnchor: sel ? [19, 38] : [15, 30],
    html: `<div class="pin ${sel ? "sel" : ""}" style="background:${cm.p}"><span>${
      catIcon(e.category, sel ? 19 : 15, "#fff")}</span></div>`,
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
    const w = whenLabel(e.start);
    // Same treatment as the list card: the wash and the category mark go down
    // first and the photo covers them, so a URL that fails leaves the mark
    // rather than an empty box. Event photos fail often enough that this is the
    // common case, not the edge case.
    const banner = `style="background:${wash(e.category)}"`;
    const bimg = e.image ? `<img src="${esc(safeHref(e.image))}" loading="lazy" onerror="this.remove()"/>` : "";
    return `<button class="ccard" data-cid="${esc(e.id)}">
      <span class="cbanner" ${banner}>${catIcon(e.category, 30)}${bimg}
        <span class="cdate">${esc(w.text)}</span>
        <span class="ckm">${distStr(e.distanceKm, "n/a")}</span>
      </span>
      <span class="cb"><span class="ctitle">${esc(e.title)}</span><span class="cmeta">${timeStr(e.start)} · ${esc(e.venue || placeName())}</span>
        <span class="tags"><span class="tag cat">${esc(e.category)}</span>${freeTag(e)}</span>
      </span>
    </button>`;
  }).join("");
}
function selectMapEvent(id) {
  const e = state.events.find((x) => x.id === id);
  if (!e) return;
  Object.entries(pins).forEach(([pid, m]) => m.setIcon(pinIcon(state.events.find((x) => x.id === pid), pid === id)));
  map.flyTo([e.lat, e.lng], 15, { duration: 0.6 });
  // The photo goes in an <img>, not a background-image. A url() inside a style
  // attribute is a CSS context, and esc() cannot protect one: the HTML parser
  // turns &#39; back into a quote before the CSS parser ever sees it, so an
  // image URL could close the url() and set properties of its own. The mark
  // underneath also matches the card and the tray now.
  const pimg = e.image ? `<img src="${esc(safeHref(e.image))}" loading="lazy" onerror="this.remove()"/>` : "";
  const pip = $("#pip");
  pip.innerHTML = `<div class="pip-img" style="background:${wash(e.category)}">${catIcon(e.category, 24)}${pimg}</div><div class="pip-b"><h4>${esc(e.title)}</h4><p>${timeStr(e.start)} · ${esc(e.venue || placeName())} · ${relDay(e.start)}</p></div>`;
  pip.classList.remove("hidden");
  pip.onclick = () => openDetail(id);
}

/* ---- Detail ---- */
let miniMap;
function openDetail(id) {
  const e = state.events.find((x) => x.id === id) || state.saved[id];
  if (!e) return;
  const on = state.saved[e.id];
  const hero = e.image ? `<img src="${esc(safeHref(e.image))}" onerror="this.remove()"/>` : "";
  $("#detail").innerHTML = `
    <div class="hero" style="background:${wash(e.category)}">${catIcon(e.category, 54)}${hero}
      <button class="hbtn back" id="detailBack" aria-label="Back">${uiIcon("back", 20)}</button>
      <button class="hbtn fav" id="detailFav" aria-pressed="${on ? "true" : "false"}" aria-label="Save ${esc(e.title)}">${bmIcon(!!on)}</button>
    </div>
    <div class="dscroll">
      <div class="badges"><span class="tag cat">${esc(e.category)}</span>${freeTag(e)}<span class="badge-src">via ${esc(e.source)}</span></div>
      <h2>${esc(e.title)}</h2>
      <p class="desc">${esc(e.description || "Tap “Get tickets and details” for the full description and tickets from the source.")}</p>
      <div class="facts">
        <div class="fact"><div class="k">When</div><div class="v">${e.start ? new Date(e.start).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) + " · " + timeStr(e.start) : "TBA"}</div></div>
        <div class="fact"><div class="k">Distance</div><div class="v">${distStr(e.distanceKm)}</div></div>
        <div class="fact"><div class="k">Price</div><div class="v">${isFree(e) ? "Free" : esc(e.price || "Not listed")}</div></div>
      </div>
      <div class="venue-block">
        <div class="vn">${esc(e.venue || "Venue TBA")}</div>
        <div class="va">${esc(e.address || placeName())}</div>
        ${e.lat != null && typeof L !== "undefined" ? `<div id="miniMap"></div>` : ""}
        ${e.lat != null ? `<a class="dir" href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}" target="_blank" rel="noopener">Directions ${uiIcon("external", 14)}</a>` : ""}
      </div>
      <div class="secondary-actions">
        <button class="sa" id="saShare">Share</button>
        <button class="sa" id="saCal">Calendar</button>
        <button class="sa" id="saSave">${on ? `Saved ${uiIcon("check", 14)}` : "Save"}</button>
      </div>
    </div>
    <div class="cta"><a href="${esc(safeHref(e.url) || "#")}" target="_blank" rel="noopener">Get tickets and details ${uiIcon("external", 15)}</a></div>`;
  $("#detail").classList.remove("hidden");

  // Same guard as initMap: Leaflet comes off a CDN, and losing the venue
  // thumbnail must not take the rest of the detail sheet down with it.
  if (e.lat != null && typeof L !== "undefined") {
    setTimeout(() => {
      miniMap = L.map("miniMap", { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false }).setView([e.lat, e.lng], 14);
      L.tileLayer(tileURL()).addTo(miniMap);
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

/* ---- Save / reminders / share / calendar ---- */
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
  const data = { title: e.title, text: `${e.title}, ${timeStr(e.start)} at ${e.venue || placeName()}`, url: e.url || location.href };
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

/* ---- tabs ---- */
function switchTab(tab) {
  state.tab = tab;
  $$(".tab").forEach((t) => t.classList.add("hidden"));
  $(`#tab-${tab}`).classList.remove("hidden");
  $$("#tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "map") renderMap();
  if (tab === "search") { renderSearch(); setTimeout(() => $("#searchInput").focus(), 50); }
  if (tab === "saved") renderSaved();
}

/* ---- geolocation ---- */
function requestLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (p) => { state.origin = { lat: p.coords.latitude, lng: p.coords.longitude }; load(); },
    () => load(),
    { timeout: 7000 }
  );
}
// Recentres the map on the user without refitting to every pin, for when
// you've panned/zoomed away and just want to find yourself again.
function locateMe() {
  if (state.origin && map) {
    map.flyTo([state.origin.lat, state.origin.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    return;
  }
  requestLocation(); // no fix yet: ask, then the normal load()/renderMap() centres on it
}

/* ---- theme ---- */
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  $("#themeBtn") && ($("#themeBtn").textContent = state.theme === "dark" ? "◐" : "◑");
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.content = state.theme === "dark" ? "#080e1c" : "#f6f7fb";
  if (tileLayer) tileLayer.setUrl(tileURL()); // swap map tiles to match theme
  // Category colours are written into inline styles, so a theme change has to
  // repaint the list rather than relying on the cascade.
  if (state.events.length) renderAll();
}

/* ---- onboarding ---- */
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

/* ---- boot ---- */
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

/* ---- init ---- */
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
