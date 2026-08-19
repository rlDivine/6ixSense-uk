#!/usr/bin/env node
// Deletes seed entries from localscan-seeds.js on the evidence in an audit
// run, rather than on anyone's judgement of how promising a url looks.
//
//   node prune-seeds.js /path/to/audit.json                 # show what would go
//   node prune-seeds.js /path/to/audit.json --write         # actually remove it
//   node prune-seeds.js audit.json --write --include-thin   # also drop thin pages
//
// WHAT IT REMOVES, and why those and not the others.
//
//   gone         404, 410, or a domain that does not resolve. Nothing is lost
//                by deleting these. Where every url in a town does not
//                resolve, the town was seeded with invented domains and needs
//                re-researching, which this reports but cannot do.
//
//                NOT every failed fetch. A 403, a 429, a 5xx or a timeout is
//                kept, because those describe the machine the audit ran on as
//                much as the page. Run from GitHub Actions, whose addresses a
//                great many CDNs block outright, and manchester.gov.uk, the
//                Science Museum and the Tower of London all come back 403
//                while being perfectly readable from anywhere else.
//
//   empty        the page was fetched, was substantial enough to send to the
//                model, and the model found no events in it. This is the only
//                bucket that costs money on every scan, so it is the one
//                worth clearing out.
//
//   thin         fetched, but almost no text came back, so isThin() stopped
//                it before the model was called. NOT removed by default.
//                These are nearly free, and a good number of them are real
//                venues that render their listings in JavaScript: the tower
//                of london and the science museum both land here. Deleting
//                them would throw away good pages to save nothing. Pass
//                --include-thin only if you have decided against ever
//                fetching those properly.
//
// A page is judged on its best result across the whole audit, not per row. A
// url seeded for two towns produces two rows, and one of them yielding events
// is enough to keep it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Overridable so the tests can run the real thing against a throwaway copy.
// Nothing else sets it.
const SEEDS_FILE = process.env.PRUNE_SEEDS_FILE
  || path.join(__dirname, "sources", "localscan-seeds.js");

const args = process.argv.slice(2);
const write = args.includes("--write");
const includeThin = args.includes("--include-thin");
const jsonPath = args.find((a) => !a.startsWith("--"));

if (!jsonPath) {
  console.error("usage: node prune-seeds.js <audit.json> [--write] [--include-thin]");
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
if (!Array.isArray(rows) || !rows.length) {
  console.error(`[prune] ${jsonPath} holds no audit rows`);
  process.exit(1);
}

// An older audit.json predates the `why` field, so every failed fetch in it is
// indistinguishable from a thin page. Pruning off one of those would delete
// real pages, which is the exact mistake this field was added to prevent.
if (!rows.some((r) => "why" in r)) {
  console.error("[prune] this audit.json has no `why` field, so unreachable urls " +
                "cannot be told apart from pages that are merely thin. Re-run the " +
                "audit on current main before pruning.");
  process.exit(1);
}

// ---- decide, per url ---------------------------------------------------------
const best = new Map();
for (const r of rows) {
  const prev = best.get(r.url);
  if (!prev || r.events > prev.events) best.set(r.url, r);
}

// "Did not answer" is not one thing, and the difference decides whether a url
// is worthless or merely unreachable FROM WHERE THE AUDIT RAN. A GitHub
// Actions runner sits in a cloud IP range that a great many CDNs block on
// sight, so a 403 there says nothing about whether Render can read the page.
// The 19 August run returned 403s for manchester.gov.uk, sciencemuseum.org.uk
// and the Tower of London, none of which are broken in any sense.
//
// Only a page that is genuinely gone, or a domain that never existed, is safe
// to delete on this evidence.
const GONE = /\b(HTTP )?40[48]\b|\b410\b|ENOTFOUND|EAI_AGAIN|ERR_INVALID_URL/;
function classify(r) {
  if (r.events > 0) return "keep";
  if (r.why === "fetch" || r.why === "extract") {
    const msg = String(r.error || "");
    // localscan throws `localscan fetch <status>`, so a bare status number in
    // the message is the HTTP code.
    if (GONE.test(msg) || /localscan fetch 40[48]|localscan fetch 410/.test(msg)) return "gone";
    return "keep-blocked";
  }
  if (r.why === "thin") return includeThin ? "thin" : "keep-thin";
  return "empty";
}

const verdicts = new Map();
for (const [url, r] of best) verdicts.set(url, classify(r));

const KEEP = new Set(["keep", "keep-thin", "keep-blocked"]);
const doomed = new Set([...verdicts].filter(([, v]) => !KEEP.has(v)).map(([u]) => u));

// ---- rewrite the file --------------------------------------------------------
// Line based on purpose. The file is one seed per line by convention, and the
// alternative, parsing and re-emitting the array, would discard the trailing
// comments and the per-town grouping that make it readable by hand.
const original = fs.readFileSync(SEEDS_FILE, "utf8");
const lines = original.split("\n");

const SEED_LINE = /^\s*\{\s*regionId:\s*"([^"]+)",\s*url:\s*"([^"]+)"/;
const TOWN_HEADER = /^(\s*\/\/ )([a-z0-9-]+)(, )(\d+)( pages?)$/;

const removed = [];
let kept = lines.filter((line) => {
  const m = line.match(SEED_LINE);
  if (!m) return true;
  if (!doomed.has(m[2])) return true;
  removed.push({ regionId: m[1], url: m[2], why: verdicts.get(m[2]) });
  return false;
});

// Fix up the "// townname, N pages" headers, and drop the ones whose whole
// block has just gone, so the file does not end up announcing towns it no
// longer watches anything for.
const out = [];
for (let i = 0; i < kept.length; i += 1) {
  const m = kept[i].match(TOWN_HEADER);
  if (!m) { out.push(kept[i]); continue; }
  let n = 0;
  while (i + 1 + n < kept.length && SEED_LINE.test(kept[i + 1 + n])) n += 1;
  if (n === 0) {
    // Take the blank line that separated this block with it.
    if (out.length && out[out.length - 1].trim() === "") out.pop();
    continue;
  }
  out.push(`${m[1]}${m[2]}${m[3]}${n}${n === 1 ? " page" : " pages"}`);
}

// ---- report ------------------------------------------------------------------
const byWhy = new Map();
for (const r of removed) byWhy.set(r.why, (byWhy.get(r.why) || 0) + 1);

const seedCount = (text) => (text.match(new RegExp(SEED_LINE.source, "gm")) || []).length;
console.log(`[prune] ${seedCount(original)} entries before, ${seedCount(out.join("\n"))} after`);
for (const [why, n] of [...byWhy].sort((a, b) => b[1] - a[1])) {
  console.log(`[prune]   ${String(n).padStart(4)} removed as ${why}`);
}
if (!includeThin) {
  const thin = [...verdicts.values()].filter((v) => v === "keep-thin").length;
  console.log(`[prune]   ${String(thin).padStart(4)} thin pages KEPT (--include-thin to remove)`);
}
const blocked = [...verdicts.values()].filter((v) => v === "keep-blocked").length;
if (blocked) {
  console.log(`[prune]   ${String(blocked).padStart(4)} KEPT: refused or timed out where the audit ran ` +
              `(403, 429, 5xx, timeouts). Says nothing about production.`);
}

// Towns left watching nothing need researching again, not pruning. Worth
// naming loudly: a town silently dropping to zero pages looks identical to a
// town that was never seeded.
const before = new Map();
for (const line of lines) {
  const m = line.match(SEED_LINE);
  if (m) before.set(m[1], (before.get(m[1]) || 0) + 1);
}
const after = new Map();
for (const line of out) {
  const m = line.match(SEED_LINE);
  if (m) after.set(m[1], (after.get(m[1]) || 0) + 1);
}
const emptied = [...before.keys()].filter((id) => !after.has(id));
if (emptied.length) {
  console.log(`\n[prune] ${emptied.length} town(s) now watch nothing and need re-researching:`);
  console.log(`  ${emptied.join(", ")}`);
}

if (!write) {
  console.log("\n[prune] dry run. Pass --write to apply.");
  process.exit(0);
}

fs.writeFileSync(SEEDS_FILE, out.join("\n"));
console.log(`\n[prune] wrote ${SEEDS_FILE}`);
