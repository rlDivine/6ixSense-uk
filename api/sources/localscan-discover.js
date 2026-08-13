// Monthly research: finds new community pages worth watching, for towns that
// already have at least one, and proposes them as a pull request rather than
// writing to localscan-seeds.js directly. Run by discover-seeds.js, which the
// ventrack-uk-localscan-discover Cron Job in render.yaml invokes on a
// schedule; nothing in the normal request path (server.js) touches this file.
//
// SCOPE, on purpose. This only researches regions that already have at least
// one seed page, not all ~450 towns in regions.js. Researching every town
// every month multiplies the cost of every call below by the length of that
// list, for towns nobody has expressed any interest in growing yet. Widening
// this is one line (searchRegionIds()) once the cost of doing so has been
// thought through, not a default.
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
//   - the Render Cron Job block in render.yaml: the field names for a Docker
//     runtime cron service (schedule, dockerCommand) are written from
//     documentation, not confirmed against a live Blueprint deploy.
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
const MAX_CANDIDATES_PER_REGION = 5;

// ---- which regions to research --------------------------------------------
export function searchRegionIds() {
  return [...new Set(SEEDS.map((s) => s.regionId))];
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
async function searchForCandidates(regionId, existingUrls) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return [];

  const town = regionLabel(regionId);
  const prompt = [
    `Search the web for real, currently active websites or Facebook Pages that list local events for ${town}, UK: a council "what's on" page, a specific venue, a local paper's listings page, a community group.`,
    `Do not suggest any of these, already known: ${existingUrls.length ? existingUrls.join(", ") : "(none yet)"}.`,
    `Only suggest a page you have actually found and that clearly lists specific events, not a general town guide or a page with no event listings.`,
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
  return parseCandidates(text).slice(0, MAX_CANDIDATES_PER_REGION);
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
  const branch = `localscan-candidates-${monthTag}`;

  const base = await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${BASE_BRANCH}`);
  const baseSha = base.object.sha;

  try {
    await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    });
  } catch (e) {
    if (e.status === 422) {
      // Reference already exists: this month's proposal branch is already
      // out there, merged or not. Do not open a second one; that is a human
      // decision (re-run after merging, or leave the job to try again next
      // month) rather than something to paper over automatically.
      console.log(`[localscan-discover] branch ${branch} already exists, skipping`);
      return null;
    }
    throw e;
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

  const regionIds = searchRegionIds();
  const existingUrls = SEEDS.map((s) => s.url);
  const found = new Map();

  // Small concurrency cap: this is a monthly job, not a request path, so
  // there is no latency pressure to justify firing every region's search at
  // once against a paid API.
  let i = 0;
  const workers = Array.from({ length: Math.min(2, regionIds.length) }, async () => {
    while (i < regionIds.length) {
      const regionId = regionIds[i++];
      try {
        const candidates = await searchForCandidates(regionId, existingUrls);
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
  return { prUrl, regionsSearched: regionIds.length, candidatesFound };
}
