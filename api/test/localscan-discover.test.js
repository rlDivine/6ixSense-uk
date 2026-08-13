import test from "node:test";
import assert from "node:assert/strict";

import {
  dedupeCandidates,
  renderSeedLine,
  insertCandidates,
  openCandidatesPR,
} from "../sources/localscan-discover.js";
import { jsonResponse, withEnv, withForbiddenFetch, withStubbedFetch } from "./helpers.js";

test("dedupeCandidates drops anything already known, case and trailing slash insensitive", () => {
  const existing = ["https://Example.test/whats-on/"];
  const candidates = [
    { url: "https://example.test/whats-on", kind: "web", label: "dup", reason: "" },
    { url: "https://example.test/other", kind: "web", label: "new", reason: "" },
  ];
  const out = dedupeCandidates(candidates, existing);
  assert.equal(out.length, 1);
  assert.equal(out[0].label, "new");
});

test("dedupeCandidates also drops a second candidate proposing the same page as the first", () => {
  const candidates = [
    { url: "https://example.test/a", kind: "web", label: "first", reason: "" },
    { url: "https://EXAMPLE.test/a", kind: "web", label: "second", reason: "" },
  ];
  const out = dedupeCandidates(candidates, []);
  assert.equal(out.length, 1);
  assert.equal(out[0].label, "first");
});

test("renderSeedLine escapes quotes so a hostile label or reason cannot break out of the string", () => {
  const line = renderSeedLine("ramsgate", {
    url: "https://example.test/a",
    kind: "web",
    label: 'Trust "Events" Team',
    reason: 'says "free entry"',
  });
  // Valid enough to embed directly inside an array literal and parse back.
  // `export` is module syntax and not legal inside a Function body, unlike
  // in the real file, so this checks the same line with a plain `const`.
  const wrapped = `const X = [\n${line}\n];`;
  const mod = new Function(`${wrapped}\nreturn X;`)();
  assert.equal(mod.length, 1);
  assert.equal(mod[0].label, 'Trust "Events" Team');
  assert.equal(mod[0].regionId, "ramsgate");
});

test("insertCandidates inserts directly above the marker and leaves the rest of the file untouched", () => {
  const file = [
    "export const SEEDS = [",
    "  { regionId: \"a\", url: \"https://a.test\", kind: \"web\", label: \"A\" },",
    "",
    "  // --- END SEEDS ---",
    "];",
    "",
  ].join("\n");
  const out = insertCandidates(file, ['  { regionId: "b", url: "https://b.test", kind: "web", label: "B" },']);
  assert.match(out, /"https:\/\/a\.test"/);
  assert.match(out, /"https:\/\/b\.test"/);
  const aIndex = out.indexOf("a.test");
  const bIndex = out.indexOf("b.test");
  const markerIndex = out.indexOf("--- END SEEDS ---");
  assert.ok(aIndex < bIndex && bIndex < markerIndex, "new entry sits between existing entries and the marker");
});

test("insertCandidates refuses to guess when the marker is missing, rather than silently doing nothing useful", () => {
  assert.throws(() => insertCandidates("export const SEEDS = [];", ["x"]), /END SEEDS/);
});

test("openCandidatesPR makes no network call and returns null when there are nothing but empty lists", async () => {
  await withForbiddenFetch(async () => {
    const url = await openCandidatesPR(new Map([["ramsgate", []]]));
    assert.equal(url, null);
  });
});

test("openCandidatesPR logs instead of calling GitHub when GITHUB_TOKEN is unset", async () => {
  const found = new Map([["ramsgate", [{ url: "https://a.test", kind: "web", label: "A", reason: "" }]]]);
  await withEnv({ GITHUB_TOKEN: undefined }, () =>
    withForbiddenFetch(async () => {
      assert.equal(await openCandidatesPR(found), null);
    })
  );
});

test("openCandidatesPR creates a branch, updates the seeds file and opens a PR, in that order", async () => {
  const found = new Map([
    ["ramsgate", [{ url: "https://a.test/whats-on", kind: "web", label: "A", reason: "looks active" }]],
  ]);
  const seedsFile = [
    "export const SEEDS = [",
    "  // --- END SEEDS ---",
    "];",
    "",
  ].join("\n");

  await withEnv({ GITHUB_TOKEN: "t" }, () =>
    withStubbedFetch(
      (url, opts) => {
        if (url.endsWith("/git/ref/heads/main")) {
          return jsonResponse({ object: { sha: "base-sha" } });
        }
        if (url.endsWith("/git/refs") && opts.method === "POST") {
          const body = JSON.parse(opts.body);
          assert.equal(body.ref, `refs/heads/localscan-candidates-${new Date().toISOString().slice(0, 7)}`);
          assert.equal(body.sha, "base-sha");
          return jsonResponse({ ref: body.ref });
        }
        if (url.includes("/contents/") && (!opts.method || opts.method === "GET")) {
          return jsonResponse({ sha: "file-sha", content: Buffer.from(seedsFile, "utf8").toString("base64") });
        }
        if (url.includes("/contents/") && opts.method === "PUT") {
          const body = JSON.parse(opts.body);
          const decoded = Buffer.from(body.content, "base64").toString("utf8");
          assert.match(decoded, /https:\/\/a\.test\/whats-on/);
          assert.equal(body.sha, "file-sha");
          return jsonResponse({ content: { sha: "new-sha" } });
        }
        if (url.endsWith("/pulls") && opts.method === "POST") {
          const body = JSON.parse(opts.body);
          assert.match(body.body, /looks active/);
          assert.match(body.title, /1 candidate/);
          return jsonResponse({ html_url: "https://github.com/rlDivine/6ixSense-uk/pull/1" });
        }
        throw new Error(`unexpected call: ${opts.method || "GET"} ${url}`);
      },
      async () => {
        const prUrl = await openCandidatesPR(found);
        assert.equal(prUrl, "https://github.com/rlDivine/6ixSense-uk/pull/1");
      }
    )
  );
});

test("openCandidatesPR skips quietly, without touching the file or opening a PR, when this month's branch already exists", async () => {
  const found = new Map([["ramsgate", [{ url: "https://a.test", kind: "web", label: "A", reason: "" }]]]);
  await withEnv({ GITHUB_TOKEN: "t" }, () =>
    withStubbedFetch(
      (url, opts) => {
        if (url.endsWith("/git/ref/heads/main")) return jsonResponse({ object: { sha: "base-sha" } });
        if (url.endsWith("/git/refs") && opts.method === "POST") {
          return jsonResponse({ message: "Reference already exists" }, { ok: false, status: 422 });
        }
        throw new Error(`unexpected call past ref creation: ${opts.method || "GET"} ${url}`);
      },
      async () => {
        assert.equal(await openCandidatesPR(found), null);
      }
    )
  );
});
