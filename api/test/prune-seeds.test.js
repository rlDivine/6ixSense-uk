import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(here, "..", "prune-seeds.js");

// A miniature of the real file: the same one-seed-per-line shape, the same
// "// town, N pages" headers, and the same END SEEDS marker that
// localscan-discover.js locates by exact text.
function seedsFile(entries) {
  const byTown = new Map();
  for (const e of entries) {
    if (!byTown.has(e.regionId)) byTown.set(e.regionId, []);
    byTown.get(e.regionId).push(e);
  }
  const blocks = [...byTown].map(([town, es]) =>
    `  // ${town}, ${es.length} page${es.length === 1 ? "" : "s"}\n` +
    es.map((e) => `  { regionId: "${e.regionId}", url: "${e.url}", kind: "web", label: "x" }, // note`).join("\n")
  );
  return "export const SEEDS = [\n" + blocks.join("\n\n") + "\n\n  // --- END SEEDS ---\n];\n";
}

function run(entries, rows, extraArgs = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prune-"));
  const seedsPath = path.join(dir, "seeds.js");
  const jsonPath = path.join(dir, "audit.json");
  fs.writeFileSync(seedsPath, seedsFile(entries));
  fs.writeFileSync(jsonPath, JSON.stringify(rows));
  let stdout = "", failed = false;
  try {
    stdout = execFileSync(process.execPath, [SCRIPT, jsonPath, ...extraArgs], {
      env: { ...process.env, PRUNE_SEEDS_FILE: seedsPath },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    failed = true;
    stdout = (e.stdout || "") + (e.stderr || "");
  }
  return { stdout, failed, text: fs.readFileSync(seedsPath, "utf8") };
}

const row = (regionId, url, over = {}) =>
  ({ regionId, url, thin: false, why: null, error: null, events: 0, ...over });

test("gone and empty pages go; pages that produced events stay", async () => {
  const entries = [
    { regionId: "ramsgate", url: "https://good.test/a" },
    { regionId: "ramsgate", url: "https://empty.test/b" },
    { regionId: "ramsgate", url: "https://dead.test/c" },
  ];
  const { text } = run(entries, [
    row("ramsgate", "https://good.test/a", { events: 7 }),
    row("ramsgate", "https://empty.test/b"),
    row("ramsgate", "https://dead.test/c", { thin: true, why: "fetch", error: "fetch failed (ENOTFOUND)" }),
  ], ["--write"]);

  assert.match(text, /good\.test/);
  assert.doesNotMatch(text, /empty\.test/);
  assert.doesNotMatch(text, /dead\.test/);
});

test("a page refused or timing out where the audit ran is kept, not pruned", async () => {
  // The distinction that matters most, and the one that nearly cost a pile of
  // good pages. The 19 August audit ran on a GitHub Actions runner, whose
  // address range a great many CDNs block outright, and returned 403 for
  // manchester.gov.uk, the Science Museum and the Tower of London. A 403 there
  // is a fact about the runner, not about the page.
  const entries = [
    { regionId: "manchester", url: "https://blocked.test/events" },
    { regionId: "manchester", url: "https://slow.test/events" },
    { regionId: "manchester", url: "https://throttled.test/events" },
    { regionId: "manchester", url: "https://missing.test/events" },
  ];
  const { text, stdout } = run(entries, [
    row("manchester", "https://blocked.test/events", { thin: true, why: "fetch", error: "localscan fetch 403" }),
    row("manchester", "https://slow.test/events", { thin: true, why: "fetch", error: "This operation was aborted" }),
    row("manchester", "https://throttled.test/events", { thin: true, why: "fetch", error: "localscan fetch 429" }),
    row("manchester", "https://missing.test/events", { thin: true, why: "fetch", error: "localscan fetch 404" }),
  ], ["--write"]);

  assert.match(text, /blocked\.test/, "403 is about the runner, not the page");
  assert.match(text, /slow\.test/, "a timeout is not evidence a page is dead");
  assert.match(text, /throttled\.test/, "429 means we asked too fast");
  assert.doesNotMatch(text, /missing\.test/, "404 is genuinely gone");
  assert.match(stdout, /KEPT: refused or timed out/);
});

test("a thin page is kept by default and removed only when asked for", async () => {
  // The distinction the audit's `why` field exists for. Thin pages cost no LLM
  // call, and several of them are real venues that render listings in
  // JavaScript, so pruning them by default would discard good pages to save
  // nothing.
  const entries = [{ regionId: "ramsgate", url: "https://js-rendered.test/whats-on" }];
  const rows = [row("ramsgate", "https://js-rendered.test/whats-on", { thin: true, why: "thin" })];

  assert.match(run(entries, rows, ["--write"]).text, /js-rendered\.test/);
  assert.doesNotMatch(run(entries, rows, ["--write", "--include-thin"]).text, /js-rendered\.test/);
});

test("a url seeded for two towns survives if it yields for either of them", async () => {
  // Shared district pages are common, and one row per region means a page can
  // look dead for one town and be the best page the other one has.
  const entries = [
    { regionId: "ramsgate", url: "https://district.test/events" },
    { regionId: "margate", url: "https://district.test/events" },
  ];
  const { text } = run(entries, [
    row("ramsgate", "https://district.test/events"),
    row("margate", "https://district.test/events", { events: 9 }),
  ], ["--write"]);

  assert.equal((text.match(/district\.test/g) || []).length, 2, "neither copy should be dropped");
});

test("emptying a town removes its header, and the town is named as needing research", async () => {
  const entries = [
    { regionId: "arbroath", url: "https://invented-one.test/x" },
    { regionId: "arbroath", url: "https://invented-two.test/y" },
    { regionId: "margate", url: "https://real.test/z" },
  ];
  const { text, stdout } = run(entries, [
    row("arbroath", "https://invented-one.test/x", { thin: true, why: "fetch", error: "fetch failed (ENOTFOUND)" }),
    row("arbroath", "https://invented-two.test/y", { thin: true, why: "fetch", error: "fetch failed (ENOTFOUND)" }),
    row("margate", "https://real.test/z", { events: 3 }),
  ], ["--write"]);

  assert.doesNotMatch(text, /arbroath/, "no orphan header for a town watching nothing");
  assert.match(stdout, /need re-researching/);
  assert.match(stdout, /arbroath/);
});

test("the remaining count in each town header is corrected", async () => {
  const entries = [
    { regionId: "margate", url: "https://a.test/1" },
    { regionId: "margate", url: "https://b.test/2" },
    { regionId: "margate", url: "https://c.test/3" },
  ];
  const { text } = run(entries, [
    row("margate", "https://a.test/1", { events: 2 }),
    row("margate", "https://b.test/2"),
    row("margate", "https://c.test/3"),
  ], ["--write"]);

  assert.match(text, /\/\/ margate, 1 page$/m, "singular, and the count matches what is left");
});

test("the END SEEDS marker survives, exactly once", async () => {
  // localscan-discover.js finds it by exact text and inserts above the FIRST
  // occurrence, so losing it or duplicating it silently breaks every future
  // proposal rather than failing loudly.
  const entries = [{ regionId: "margate", url: "https://gone.test/x" }];
  const { text } = run(entries, [row("margate", "https://gone.test/x")], ["--write"]);
  assert.equal((text.match(/--- END SEEDS ---/g) || []).length, 1);
});

test("an audit predating the why field is refused rather than acted on", async () => {
  // Without `why`, an unreachable url is indistinguishable from a thin one, so
  // pruning off such a file would delete real pages. Refusing is the point.
  const entries = [{ regionId: "margate", url: "https://x.test/1" }];
  const stale = [{ regionId: "margate", url: "https://x.test/1", thin: true, error: null, events: 0 }];
  const { failed, stdout, text } = run(entries, stale, ["--write"]);

  assert.ok(failed, "it must exit non-zero");
  assert.match(stdout, /no `why` field/);
  assert.match(text, /x\.test/, "and must not have touched the file");
});

test("without --write nothing is changed", async () => {
  const entries = [{ regionId: "margate", url: "https://gone.test/x" }];
  const { text, stdout } = run(entries, [row("margate", "https://gone.test/x")]);
  assert.match(text, /gone\.test/);
  assert.match(stdout, /dry run/);
});

test("a /api/diag/pages dump is accepted as-is, and unscanned pages are left alone", async () => {
  // The endpoint measures the machine that serves the app; the audit measures a
  // CI runner that CDNs refuse. Feeding the better source in should need no
  // conversion step, because a conversion step is somewhere to get this wrong.
  const entries = [
    { regionId: "margate", url: "https://works.test/whats-on" },
    { regionId: "margate", url: "https://empty.test/whats-on" },
    { regionId: "margate", url: "https://gone.test/whats-on" },
    { regionId: "margate", url: "https://unscanned.test/whats-on" },
  ];
  const dump = { summary: {}, pages: [
    { url: "https://works.test/whats-on", regions: ["margate"], attempts: 4, ok: 4, thin: 0, failed: 0, lastStatus: "ok", events: 6, bestEvents: 9 },
    { url: "https://empty.test/whats-on", regions: ["margate"], attempts: 4, ok: 4, thin: 0, failed: 0, lastStatus: "ok", events: 0, bestEvents: 0 },
    { url: "https://gone.test/whats-on", regions: ["margate"], attempts: 3, ok: 0, thin: 0, failed: 3, lastStatus: "HTTP 404", events: 0, bestEvents: 0 },
    // Never scanned since the last restart. Unproven, not dead: deleting this
    // would be acting on the absence of evidence.
    { url: "https://unscanned.test/whats-on", regions: ["margate"], attempts: 0, ok: 0, thin: 0, failed: 0, lastStatus: null, events: 0, bestEvents: 0 },
  ] };

  const { text, stdout } = run(entries, dump, ["--write"]);

  assert.match(text, /works\.test/, "a page that has produced events stays");
  assert.match(text, /unscanned\.test/, "no evidence is not evidence of no");
  assert.doesNotMatch(text, /empty\.test/, "scanned repeatedly, never yielded");
  assert.doesNotMatch(text, /gone\.test/, "404 is gone");
  assert.match(stdout, /1 not yet scanned and left alone/);
});

test("a /api/diag/pages dump from a cold backend is refused", async () => {
  // Counters reset on restart. Pruning off a dump taken before the first scan
  // would delete the entire list on the strength of nothing having run yet.
  const entries = [{ regionId: "margate", url: "https://x.test/1" }];
  const cold = { summary: {}, pages: [
    { url: "https://x.test/1", regions: ["margate"], attempts: 0, ok: 0, thin: 0, failed: 0, lastStatus: null, events: 0, bestEvents: 0 },
  ] };
  const { failed, stdout, text } = run(entries, cold, ["--write"]);

  assert.ok(failed, "it must exit non-zero");
  assert.match(stdout, /nothing has been scanned/);
  assert.match(text, /x\.test/, "and must not have touched the file");
});

test("a page blocked in production is kept, same as from the audit", async () => {
  const entries = [{ regionId: "manchester", url: "https://blocked.test/events" }];
  const dump = { summary: {}, pages: [
    { url: "https://blocked.test/events", regions: ["manchester"], attempts: 5, ok: 0, thin: 0, failed: 5, lastStatus: "HTTP 403", events: 0, bestEvents: 0 },
  ] };
  assert.match(run(entries, dump, ["--write"]).text, /blocked\.test/);
});
