// Research pass: finds new community pages worth watching, for towns that
// already have at least one, and proposes them as a pull request rather than
// writing to localscan-seeds.js directly. Run by discover-seeds.js, invoked
// by hand rather than on a schedule (Render cron services have no free tier,
// so that block was removed from render.yaml; see DEPLOY.md). Nothing in the
// normal request path (server.js) touches this file.
//
// SCOPE. By default this still only researches regions that already watch at
// least one page, which grows coverage somebody has started rather than going
// looking for towns on its own. LOCALSCAN_DISCOVER_SCOPE=unseeded or =all
// widens it to the whole country, and LOCALSCAN_DISCOVER_TARGET sets how many
// pages a region should end up with.
//
// Sweeping all 457 towns is therefore supported, but it is batched rather than
// done in one run, and the reason is review rather than cost: 457 regions at
// 20 candidates each is a nine thousand line pull request, and a proposal
// nobody can read is the same as a direct commit with extra steps. Each run
// takes LOCALSCAN_DISCOVER_LIMIT regions, skips any that already meet the
// target, and opens its own PR, so running it repeatedly walks forward through
// the country. LOCALSCAN_DISCOVER_DRY_RUN prints the plan and the cost
// estimate without spending anything. See "Growing this to every town" in
// DEPLOY.md.
//
// WHY A PULL REQUEST AND NOT A DIRECT COMMIT. A monthly job that writes
// straight to the file a live server reads is a monthly job that can put a
// wrong-town result, a spam page, or worse straight in front of real users
// with nobody having looked at it. Proposing a PR means the addition still
// needs a human to click merge, same as it would if you'd typed the line
// yourself, and gives that human the model's own stated reasoning to check
// it against rather than just a bare URL.
//
// TWO THINGS IN HERE ARE BUILT AGAINST DOCUMENTED, STABLE SURFACES BUT COULD
// NOT BE EXERCISED AGAINST A LIVE ACCOUNT FROM THIS ENVIRONMENT, WHICH HAS NO
// OUTBOUND NETWORK. Both are worth a real run before trusting the output:
//   - the OpenAI Responses API call in searchForCandidates(), specifically
//     the web_search tool and the shape of what comes back. See the long
//     comment above extractResponseText() for exactly what is uncertain and
//     why the parsing is written as defensively as it is.
//   - the commented-out Render Cron Job block kept in render.yaml for anyone
//     who later wants this scheduled: its field names (schedule,
//     dockerCommand) are written from documentation, not confirmed against a
//     live Blueprint deploy.
// The GitHub REST calls below are not in that category. Creating a ref,
// updating file contents through the Contents API and opening a pull request
// are long-stable, well-documented endpoints, used here in their plainest
// form with no library beyond fetch.
import { fetchWithTimeout } from "./util.js";
import { SEEDS } from "./localscan-seeds.js";
import { CITIES } from "./regions.js";

const SEEDS_FILE_PATH = "api/sources/localscan-seeds.js";
const END_MARKER = "// --- END SEEDS ---";
const DISCOVER_MODEL = process.env.LOCALSCAN_DISCOVER_MODEL || "gpt-4o-mini";
const REPO_OWNER = process.env.GITHUB_REPO_OWNER || "rlDivine";
const REPO_NAME = process.env.GITHUB_REPO_NAME || "6ixSense-uk";
const BASE_BRANCH = process.env.GITHUB_BASE_BRANCH || "main";
// A page a research pass proposes twice is treated as the same candidate, so
// a repeat monthly run does not keep proposing something already sitting in
// an unmerged PR or already added to the seed list.
//
// How many pages a region should end up watching. Raising this raises the
// running cost of every scan of that region for ever, not just the cost of
// the research run, so it is a deliberate number: see the cost note in
// DEPLOY.md before changing it.
const TARGET_PER_REGION = Number(process.env.LOCALSCAN_DISCOVER_TARGET ?? 5);

// How many regions one run is allowed to research. This is the safety valve,
// and the reason it is small by default is not cost, it is review: 457
// regions at 20 candidates each is a nine thousand line pull request, which
// nobody reads, which defeats the entire point of proposing rather than
// committing. Batches of this size stay reviewable, and because the scope
// filter below skips regions that already meet the target, running it
// repeatedly walks forward through the country on its own.
const REGIONS_PER_RUN = Number(process.env.LOCALSCAN_DISCOVER_LIMIT ?? 25);

// Rough cost of one region's research call, in US dollars, for the estimate
// printed before anything is spent. A web_search-backed Responses call is
// dominated by the search tool rather than the tokens; this is deliberately a
// pessimistic round number rather than a precise one, because the point of it
// is to stop somebody starting a 457 region run without knowing it is not
// free, not to invoice them.
const EST_COST_PER_REGION_USD = 0.03;

// ---- which regions to research --------------------------------------------

/// Seeds already listed for a region, by id.
function seedCounts() {
  const counts = new Map();
  for (const s of SEEDS) counts.set(s.regionId, (counts.get(s.regionId) || 0) + 1);
  return counts;
}

/// Which regions this run should research, in order, already truncated to
/// REGIONS_PER_RUN.
///
/// Scope, from LOCALSCAN_DISCOVER_SCOPE:
///   "seeded"   (default) only regions that already watch at least one page.
///              Grows coverage somebody has already started, and never goes
///              looking for towns on its own.
///   "unseeded" only regions watching nothing yet. This is the one to use to
///              spread across the country.
///   "all"      every region in regions.js.
///
/// In every scope, a region that already meets TARGET_PER_REGION is skipped,
/// which is what makes repeated runs make progress instead of re-proposing
/// pages for the same few towns for ever. Ordering follows regions.js, which
/// is roughly largest-first, so a partial sweep covers the towns most likely
/// to be opened.
export function searchRegionIds() {
  const scope = (process.env.LOCALSCAN_DISCOVER_SCOPE || "seeded").toLowerCase();
  const counts = seedCounts();

  let ids;
  if (scope === "all") {
    ids = CITIES.map((c) => c.id);
  } else if (scope === "unseeded") {
    ids = CITIES.map((c) => c.id).filter((id) => !counts.has(id));
  } else {
    // Preserve regions.js ordering rather than SEEDS ordering, so "seeded"
    // and "all" walk the country the same way.
    ids = CITIES.map((c) => c.id).filter((id) => counts.has(id));
  }

  return ids.filter((id) => (counts.get(id) || 0) < TARGET_PER_REGION).slice(0, REGIONS_PER_RUN);
}

/// What a full sweep at the current settings would involve. Printed before
/// spending anything, and the whole of what --dry-run reports.
export function discoveryPlan() {
  const scope = (process.env.LOCALSCAN_DISCOVER_SCOPE || "seeded").toLowerCase();
  const counts = seedCounts();
  const all = CITIES.map((c) => c.id);
  const inScope = all.filter((id) => {
    if (scope === "all") return true;
    if (scope === "unseeded") return !counts.has(id);
    return counts.has(id);
  });
  const remaining = inScope.filter((id) => (counts.get(id) || 0) < TARGET_PER_REGION);
  const thisRun = searchRegionIds();
  return {
    scope,
    target: TARGET_PER_REGION,
    perRun: REGIONS_PER_RUN,
    regionsInScope: inScope.length,
    regionsRemaining: remaining.length,
    regionsThisRun: thisRun.length,
    runsRemaining: Math.ceil(remaining.length / Math.max(1, REGIONS_PER_RUN)),
    estCostThisRunUsd: +(thisRun.length * EST_COST_PER_REGION_USD).toFixed(2),
    estCostRemainingUsd: +(remaining.length * EST_COST_PER_REGION_USD).toFixed(2),
  };
}

function regionLabel(regionId) {
  return CITIES.find((c) => c.id === regionId)?.label || regionId;
}

// ---- the research step ------------------------------------------------------
//
// The Responses API, OpenAI's surface for hosted tools including web search,
// rather than Chat Completions (what localscan.js itself uses for plain
// extraction, which needs no tool and so has no reason to use the newer
// surface). Structured output (a json_schema response format) is
// deliberately NOT combined with the web_search tool here: this file could
// not be tested against a live account, and stacking two less-certain
// features multiplies what might silently not work the way documentation
// describes. Instead the prompt itself asks for JSON, and the parsing below
// is written to survive getting prose back anyway.
async function searchForCandidates(regionId, existingUrls, alreadyHave = 0) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return [];

  const town = regionLabel(regionId);
  const prompt = [
    `Search the web for real, currently active websites or Facebook Pages that list local events for ${town}, UK: a council "what's on" page, a specific venue, a local paper's listings page, a community group.`,
    `Do not suggest any of these, already known: ${existingUrls.length ? existingUrls.join(", ") : "(none yet)"}.`,
    `Only suggest a page you have actually found and that clearly lists specific events, not a general town guide or a page with no event listings.`,
    `Find up to ${Math.max(1, TARGET_PER_REGION - alreadyHave)} of them.`,
    `This is a British town: ${town}, United Kingdom. Several UK town names also name a larger American city, so reject anything that is not unambiguously the British one.`,
    `Reply with ONLY a JSON object, no other text, of the exact shape:`,
    `{"candidates": [{"url": "https://...", "kind": "web" or "facebook", "label": "short name", "reason": "one sentence on what you found there and why it looks active"}]}`,
    `If you find nothing worth proposing, reply {"candidates": []}.`,
  ].join(" ");

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: DISCOVER_MODEL,
        tools: [{ type: "web_search" }],
        input: prompt,
      }),
    },
    60000 // a real web search pass is slow; this is not the 20s extraction call
  );
  if (!res.ok) throw new Error(`localscan-discover OpenAI ${res.status}`);
  const data = await res.json();
  const text = extractResponseText(data);
  return parseCandidates(text).slice(0, Math.max(1, TARGET_PER_REGION - alreadyHave));
}

// The Responses API's JSON shape for where the model's own reply text lives
// has genuinely differed across API versions and SDKs: a top-level
// convenience `output_text` in some, an `output` array of items where a
// `message` item's `content` array holds an `output_text` part in others.
// Trying both, in order, is cheap insurance against calling this on the
// version that is not the one guessed first; it costs nothing when the first
// shape matches, which is the common case.
function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text) return data.output_text;
  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (item?.type !== "message" || !Array.isArray(item.content)) continue;
      const part = item.content.find((c) => c?.type === "output_text" && typeof c.text === "string");
      if (part) return part.text;
    }
  }
  return "";
}

// The model was asked to reply with only JSON, but "only" is a request, not a
// guarantee: this survives a reply wrapped in a sentence or a code fence by
// taking the first {...} block found, rather than requiring an exact match.
function parseCandidates(text) {
  if (!text) return [];
  let raw = text.trim();
  try {
    return validateCandidates(JSON.parse(raw));
  } catch {
    /* fall through to the looser extraction below */
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    return validateCandidates(JSON.parse(match[0]));
  } catch {
    return [];
  }
}

function validateCandidates(parsed) {
  const list = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  const out = [];
  for (const c of list) {
    if (!c || typeof c.url !== "string") continue;
    let parsedUrl;
    try {
      parsedUrl = new URL(c.url);
    } catch {
      continue; // not a real URL; skip rather than propose garbage
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") continue;
    out.push({
      url: c.url.trim(),
      kind: c.kind === "facebook" ? "facebook" : "web",
      label: (typeof c.label === "string" && c.label.trim()) || parsedUrl.hostname,
      reason: (typeof c.reason === "string" && c.reason.trim()) || "",
    });
  }
  return out;
}

// ---- dedupe against what is already known ----------------------------------
function normaliseUrl(url) {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

export function dedupeCandidates(candidates, existingUrls) {
  const known = new Set(existingUrls.map(normaliseUrl));
  const out = [];
  for (const c of candidates) {
    const key = normaliseUrl(c.url);
    if (known.has(key)) continue;
    known.add(key); // also de-dupes the model proposing the same page twice
    out.push(c);
  }
  return out;
}

// ---- rendering a candidate as a line for localscan-seeds.js ----------------
function escapeJsString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function renderSeedLine(regionId, candidate) {
  const parts = [
    `regionId: "${escapeJsString(regionId)}"`,
    `url: "${escapeJsString(candidate.url)}"`,
    `kind: "${candidate.kind}"`,
    `label: "${escapeJsString(candidate.label)}"`,
  ];
  const reasonComment = candidate.reason ? ` // ${candidate.reason.replace(/\n/g, " ")}` : "";
  return `  { ${parts.join(", ")} },${reasonComment}`;
}

export function insertCandidates(fileText, lines) {
  if (!fileText.includes(END_MARKER)) {
    throw new Error(`${SEEDS_FILE_PATH} is missing "${END_MARKER}"; refusing to guess where to insert`);
  }
  return fileText.replace(END_MARKER, `${lines.join("\n")}\n\n${END_MARKER}`);
}

// ---- GitHub: propose the result as a pull request ---------------------------
async function gh(path, opts = {}) {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetchWithTimeout(
    `https://api.github.com${path}`,
    {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        ...opts.headers,
      },
    },
    15000
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`GitHub ${opts.method || "GET"} ${path} -> ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

/// Opens (or skips, if the month's branch already exists) a PR proposing
/// `found`, a Map of regionId -> candidate[]. Returns the PR URL, or null if
/// there was nothing to propose or the branch already existed.
export async function openCandidatesPR(found) {
  const entries = [...found.entries()].filter(([, cands]) => cands.length > 0);
  if (entries.length === 0) return null;
  if (!process.env.GITHUB_TOKEN) {
    console.log("[localscan-discover] GITHUB_TOKEN not set; logging candidates instead of opening a PR");
    for (const [regionId, cands] of entries) {
      for (const c of cands) console.log(`  ${regionId}: ${c.url} (${c.reason})`);
    }
    return null;
  }

  const monthTag = new Date().toISOString().slice(0, 7); // YYYY-MM

  const base = await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${BASE_BRANCH}`);
  const baseSha = base.object.sha;

  // One branch per month was right when this ran once a month. Sweeping the
  // country happens in batches, several in an afternoon, so a taken name now
  // means "find the next one" rather than "stop". The cap is a backstop
  // against a loop, not a real limit anyone should reach in a month.
  let branch = null;
  for (let n = 1; n <= 60; n++) {
    const candidate = n === 1
      ? `localscan-candidates-${monthTag}`
      : `localscan-candidates-${monthTag}-${n}`;
    try {
      await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${candidate}`, sha: baseSha }),
      });
      branch = candidate;
      break;
    } catch (e) {
      if (e.status === 422) continue; // taken; try the next suffix
      throw e;
    }
  }
  if (!branch) {
    console.log("[localscan-discover] 60 proposal branches already open this month; merge or close some first");
    return null;
  }

  const file = await gh(
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SEEDS_FILE_PATH}?ref=${encodeURIComponent(BASE_BRANCH)}`
  );
  const currentText = Buffer.from(file.content, "base64").toString("utf8");

  const lines = [];
  for (const [regionId, cands] of entries) {
    for (const c of cands) lines.push(renderSeedLine(regionId, c));
  }
  const newText = insertCandidates(currentText, lines);

  await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SEEDS_FILE_PATH}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `localscan: propose ${lines.length} candidate page(s) for ${entries.length} region(s)`,
      content: Buffer.from(newText, "utf8").toString("base64"),
      sha: file.sha,
      branch,
    }),
  });

  const body = entries
    .map(([regionId, cands]) => {
      const rows = cands.map((c) => `  - [${c.label}](${c.url})${c.reason ? `: ${c.reason}` : ""}`).join("\n");
      return `**${regionLabel(regionId)}**\n${rows}`;
    })
    .join("\n\n");

  const pr = await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `localscan: ${lines.length} candidate page(s) found for ${entries.length} region(s), ${monthTag}`,
      head: branch,
      base: BASE_BRANCH,
      body: [
        "Proposed by the monthly localscan research job. Nothing here has been checked by a person yet.",
        "Read each page before merging: confirm it is real, active, and actually the town claimed.",
        "",
        body,
      ].join("\n"),
    }),
  });
  return pr.html_url;
}

// ---- entrypoint, called by discover-seeds.js --------------------------------
export async function runDiscovery() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("[localscan-discover] OPENAI_API_KEY not set; nothing to do");
    return { prUrl: null, regionsSearched: 0, candidatesFound: 0 };
  }

  const plan = discoveryPlan();
  console.log(
    `[localscan-discover] scope=${plan.scope} target=${plan.target}/region\n` +
    `  ${plan.regionsInScope} regions in scope, ${plan.regionsRemaining} still short of target\n` +
    `  this run: ${plan.regionsThisRun} region(s), about $${plan.estCostThisRunUsd}\n` +
    `  to finish the sweep: ~${plan.runsRemaining} more run(s), about $${plan.estCostRemainingUsd} total`
  );
  if (process.env.LOCALSCAN_DISCOVER_DRY_RUN) {
    console.log("[localscan-discover] LOCALSCAN_DISCOVER_DRY_RUN set; stopping before spending anything");
    return { prUrl: null, regionsSearched: 0, candidatesFound: 0, plan, dryRun: true };
  }

  const regionIds = searchRegionIds();
  const existingUrls = SEEDS.map((s) => s.url);
  const counts = seedCounts();
  const found = new Map();

  // Small concurrency cap: this is a monthly job, not a request path, so
  // there is no latency pressure to justify firing every region's search at
  // once against a paid API.
  let i = 0;
  const workers = Array.from({ length: Math.min(2, regionIds.length) }, async () => {
    while (i < regionIds.length) {
      const regionId = regionIds[i++];
      try {
        const candidates = await searchForCandidates(regionId, existingUrls, counts.get(regionId) || 0);
        const fresh = dedupeCandidates(candidates, existingUrls);
        if (fresh.length) found.set(regionId, fresh);
      } catch (e) {
        console.warn(`[localscan-discover] ${regionId}: ${e.message}`);
      }
    }
  });
  await Promise.all(workers);

  const candidatesFound = [...found.values()].reduce((n, c) => n + c.length, 0);
  const prUrl = await openCandidatesPR(found);
  return { prUrl, regionsSearched: regionIds.length, candidatesFound, plan };
}
