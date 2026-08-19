#!/usr/bin/env node
// Reads every page in localscan-seeds.js and reports what each one actually
// yields, so the list can be pruned on evidence rather than on how promising
// a url looked when a search engine returned it.
//
// This exists because `/api/diag` cannot answer the question. Diag reports per
// SOURCE: it will say localscan returned twelve events for a town, and it
// cannot say which of that town's twenty two pages produced them. A page that
// yields nothing is not visibly broken, it just quietly costs a fetch every
// TTL window for ever, so without per-page numbers there is no way to tell the
// difference between a good list and a list with a long dead tail.
//
// Run it where the internet is open and OPENAI_API_KEY is set. The GitHub
// Actions workflow (.github/workflows/localscan-audit.yml) is the easy way,
// since the key is already a repository secret there. By hand:
//
//   cd api && OPENAI_API_KEY=... node audit-seeds.js
//   cd api && OPENAI_API_KEY=... node audit-seeds.js ramsgate margate
//
// COST. One extraction per page, so a full run over the current list is a few
// hundred distinct urls at about $0.0005 each: well under a dollar. It also
// leaves the cache warm, though only for the process that ran it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditLocalScan } from "./sources/localscan.js";
import { SEEDS } from "./sources/localscan-seeds.js";
import { CITIES } from "./sources/regions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const envFile = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* no .env, which is normal in CI */ }

if (!process.env.OPENAI_API_KEY) {
  console.error("[audit] OPENAI_API_KEY is not set; there is nothing to measure");
  process.exit(1);
}

// The audit is not a request, so the request path's time budgets do not apply.
// Without this a run stops after 70 seconds and reports most of the list as
// unscanned, which would look exactly like a list full of dead pages.
process.env.LOCALSCAN_BUDGET_MS ??= String(6 * 60 * 60 * 1000);

const only = process.argv.slice(2);
const seeded = [...new Set(SEEDS.map((s) => s.regionId))];
const regionIds = only.length ? only.filter((id) => seeded.includes(id)) : seeded;

if (only.length && regionIds.length !== only.length) {
  const missing = only.filter((id) => !seeded.includes(id));
  console.error(`[audit] no seeds for: ${missing.join(", ")}`);
}

console.log(`[audit] ${regionIds.length} town(s), ${SEEDS.length} entries, ` +
            `${new Set(SEEDS.map((s) => s.url)).size} distinct pages`);

// Written after every town, not once at the end. The first full run took over
// an hour and would have produced nothing at all if it had hit the job's
// timeout, because the report was the last thing to happen. Partial results
// from a run that was cut off are still worth having.
const out = process.env.AUDIT_REPORT_PATH;
const jsonPath = out ? out.replace(/\.[^.]+$/, "") + ".json" : null;

const rows = [];
for (const [i, id] of regionIds.entries()) {
  const region = CITIES.find((c) => c.id === id);
  if (!region) continue;
  const found = await auditLocalScan(region);
  rows.push(...found);
  if (jsonPath) fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));
  const yielded = found.filter((r) => r.events > 0).length;
  console.log(`[audit] ${String(i + 1).padStart(3)}/${regionIds.length} ` +
              `${id.padEnd(22)} ${String(yielded).padStart(3)}/${String(found.length).padEnd(3)} pages yielded`);
}

// ---- the report -------------------------------------------------------------
const live = rows.filter((r) => r.events > 0);
const empty = rows.filter((r) => r.events === 0 && !r.thin && !r.error);
const thin = rows.filter((r) => r.thin);
const errored = rows.filter((r) => r.error);
const totalEvents = rows.reduce((n, r) => n + r.events, 0);

const pct = (n) => (rows.length ? Math.round((n / rows.length) * 100) : 0);
const lines = [
  "",
  "================ localscan seed audit ================",
  `pages scanned        ${rows.length}`,
  `events found         ${totalEvents}`,
  "",
  `producing events     ${live.length} (${pct(live.length)}%)`,
  `read but empty       ${empty.length} (${pct(empty.length)}%)`,
  `too thin to read     ${thin.length} (${pct(thin.length)}%)   fetched but almost no text, so no LLM call was made`,
  `failed to fetch      ${errored.length} (${pct(errored.length)}%)`,
  "",
];

const byTown = new Map();
for (const r of rows) {
  if (!byTown.has(r.regionId)) byTown.set(r.regionId, []);
  byTown.get(r.regionId).push(r);
}
const deadTowns = [...byTown.entries()].filter(([, rs]) => rs.every((r) => r.events === 0));
lines.push(`towns where no page produced anything: ${deadTowns.length} of ${byTown.size}`);
if (deadTowns.length) lines.push("  " + deadTowns.map(([t]) => t).join(", "));
lines.push("");

lines.push("--- best pages ---");
for (const r of [...live].sort((a, b) => b.events - a.events).slice(0, 25)) {
  lines.push(`  ${String(r.events).padStart(3)}  ${r.regionId.padEnd(18)} ${r.url}`);
}

lines.push("", "--- dead weight, candidates to prune ---");
for (const r of [...thin, ...errored, ...empty].slice(0, 60)) {
  const why = r.error ? `error: ${r.error}` : r.thin ? "too thin" : "empty";
  lines.push(`  ${r.regionId.padEnd(18)} ${why.padEnd(28)} ${r.url}`);
}
const rest = thin.length + errored.length + empty.length - 60;
if (rest > 0) lines.push(`  ... and ${rest} more`);

const report = lines.join("\n");
console.log(report);

if (out) {
  fs.writeFileSync(out, report);
  console.log(`[audit] written to ${out}`);
}
