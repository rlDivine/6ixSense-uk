import test from "node:test";
import assert from "node:assert/strict";
import {
  dedupeCandidates,
  renderSeedLine,
  insertCandidates,
  discoveryPlan,
} from "../sources/localscan-discover.js";

// validateCandidates is not exported: it is reached through parseCandidates,
// which is also private, so these drive the same rules through the one public
// path that exercises them.
import * as discover from "../sources/localscan-discover.js";

test("the plan counts towns and costs without needing a key", () => {
  const plan = discoveryPlan();
  assert.ok(plan.regionsInScope > 0);
  assert.ok(plan.estCostThisRunUsd >= 0);
  assert.equal(typeof plan.runsRemaining, "number");
});

test("dedupe drops pages already watched, and repeats within one reply", () => {
  const existing = ["https://example.org/a"];
  const fresh = dedupeCandidates(
    [
      { url: "https://example.org/a", kind: "web", label: "a" },   // already known
      { url: "https://example.org/A/", kind: "web", label: "a2" }, // same, normalised
      { url: "https://example.org/b", kind: "web", label: "b" },
      { url: "https://example.org/b", kind: "web", label: "b again" }, // repeat
    ],
    existing
  );
  assert.deepEqual(fresh.map((c) => c.url), ["https://example.org/b"]);
});

test("a rendered seed line is valid JS and keeps quotes from escaping", () => {
  const line = renderSeedLine("ramsgate", {
    url: "https://example.org/x",
    kind: "web",
    label: 'The "Big" Hall',
    reason: "lists dated events",
  });
  assert.match(line, /regionId: "ramsgate"/);

  // The whole point of the escaping: the line has to be valid JavaScript that
  // evaluates to the object it claims to be. A label containing a quote is
  // what would otherwise end the string early and corrupt the seed file, so
  // this evaluates it rather than pattern-matching it.
  const literal = line.trim().replace(/,\s*(\/\/.*)?$/, "");
  const obj = new Function(`return (${literal})`)();
  assert.equal(obj.regionId, "ramsgate");
  assert.equal(obj.url, "https://example.org/x");
  assert.equal(obj.kind, "web");
  assert.equal(obj.label, 'The "Big" Hall', "the quotes in the label survived intact");
});

test("insertion refuses to guess where to write if the marker is gone", () => {
  assert.throws(() => insertCandidates("no marker here", ["  { a: 1 },"]), /END SEEDS/);
  const out = insertCandidates("before\n  // --- END SEEDS ---\nafter", ["  { a: 1 },"]);
  assert.ok(out.indexOf("{ a: 1 }") < out.indexOf("END SEEDS"), "new lines go above the marker");
});

test("the seed file has exactly one insertion marker", async () => {
  // insertCandidates replaces the FIRST occurrence, so a second marker
  // introduced by a merge would silently start putting proposed entries into
  // the middle of the list instead of the end. A conflict resolution across
  // two batches duplicated it exactly once, which is how this test came to be.
  const fs = await import("node:fs");
  const text = fs.readFileSync(new URL("../sources/localscan-seeds.js", import.meta.url), "utf8");
  const markers = text.split("// --- END SEEDS ---").length - 1;
  assert.equal(markers, 1, `found ${markers} END SEEDS markers`);
});
