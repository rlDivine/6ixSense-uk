// The one place this app talks to a language model.
//
// Everything the AI plan asks for, search over a region's feed, extraction of
// an event out of a post somebody shared, needs the same four things: a key
// that may not be set, a timeout, a retry that does not make a rate limit
// worse, and an answer whose shape can be relied on without the caller picking
// through it. Written per feature that is four copies of the parsing, and the
// parsing is the part that goes subtly wrong.
//
// Two decisions here had an obvious-looking alternative, so both are named:
//
//   1. Structured output comes from a TOOL, not from prose. The tempting route
//      is to ask for "JSON only" and JSON.parse the reply. It fails in a dozen
//      shallow ways, fenced code blocks, a "Sure, here you go" preamble,
//      trailing commentary, smart quotes, a trailing comma, and every one of
//      them becomes a repair heuristic somebody has to maintain. Worse, those
//      heuristics are most likely to fire on the replies that are least
//      trustworthy, which is how a refusal or a half-thought gets salvaged into
//      a plausible-looking event. Declaring a single tool whose input_schema IS
//      the caller's schema, and forcing it with tool_choice, moves the
//      constraining into the API: what comes back is already a JSON value.
//   2. The schema is then checked HERE, again, by hand. Forcing a tool makes a
//      wrong shape unlikely, not impossible: a response truncated by max_tokens
//      arrives as a tool_use block that simply stops, and a model can still put
//      a number where a date string goes or invent a category outside the
//      vocabulary. AI_DISCOVERY.md is blunt about what that costs, "somebody
//      drives to it", so this returns a validated object or it throws. There
//      is deliberately no third outcome where the caller gets something
//      half-checked and has to remember to look.
//
// A validation library would do step 2 in one line. It is not worth a
// dependency: the schemas this app writes are the makeEvent shape and small
// wrappers around it, and the subset below covers them with fifty lines that
// can be read in one sitting.
import { fetchWithTimeout } from "../sources/util.js";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";

// The forced tool exists only as a shape to fill in, so the name is for the
// model's benefit and nothing else reads it, except the response parser, which
// matches on it rather than taking the first tool_use block it sees.
const TOOL_NAME = "emit_result";
const TOOL_DESCRIPTION =
  "Return the result. Call this exactly once, and put the whole answer in its arguments.";

// One retry, and a short wait before it.
//
// Deliberately ignoring the Retry-After header the API sends with a 429: it is
// routinely tens of seconds, which is longer than the whole budget a scheduled
// extraction pass gives one page, and honouring it would turn a rate limit into
// a stalled worker. A quick second attempt catches the ordinary case (a burst
// of parallel calls colliding), and anything worse is better reported to the
// caller than waited out here.
const RETRY_BACKOFF_MS = 400;

/// Is a model key configured?
///
/// Reads one environment variable and nothing else: no handshake with the API,
/// no cached client, no key validation. That is what makes it safe to call on
/// every request, which is how the AI features gate themselves, see the key
/// rule the other sources follow.
export function aiConfigured() {
  return Boolean(process.env.AI_API_KEY);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/// Ask the model for one object, shaped by `schema`.
///
/// Returns the validated object, or null when no key is set. Throws on
/// transport failure, on a status the API is not going to change its mind
/// about, and on output that does not match the schema.
///
/// The null is the missing-key case only, and it is null rather than a throw
/// because an unset key is a deployment without the feature turned on, not a
/// fault. Callers should still gate on aiConfigured() so they can skip building
/// a prompt at all; this is the backstop that keeps a forgotten gate cheap and
/// quiet instead of noisy and networked.
export async function aiJSON({ system, user, schema, maxTokens = 1024, timeoutMs = 20000 }) {
  const key = process.env.AI_API_KEY;
  if (!key) return null;

  const body = JSON.stringify({
    // The model is env-settable because the plan's two features want different
    // ones: search over a few hundred events is cheap and wants the fast model,
    // extraction from raw page text wants the careful one.
    model: process.env.AI_MODEL || DEFAULT_MODEL,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: String(user ?? "") }],
    tools: [{ name: TOOL_NAME, description: TOOL_DESCRIPTION, input_schema: schema }],
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  let res;
  for (let attempt = 0; ; attempt++) {
    // Every attempt gets the full timeout rather than a share of it. A retry
    // happens because the first call was refused, not because it was slow, so
    // the second one has no reason to be given less time to succeed.
    res = await fetchWithTimeout(
      ENDPOINT,
      {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": API_VERSION,
          "content-type": "application/json",
        },
        body,
      },
      timeoutMs
    );
    if (res.ok) break;

    // 429 and 5xx are the API saying "not now". Every other 4xx is the API
    // saying "not like that", a bad key, a schema it will not accept, a
    // request too long, and retrying those buys a second identical failure and
    // a second entry against the rate limit.
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt > 0) throw new Error(`AI ${res.status}`);
    await sleep(RETRY_BACKOFF_MS);
  }

  const data = await res.json();
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const call = blocks.find((b) => b?.type === "tool_use" && b?.name === TOOL_NAME);
  // No tool_use is the shape a refusal takes when a tool is forced: the model
  // answers in prose instead. It is a real outcome, not a transport fault, and
  // it has to be an error rather than an empty object, because an empty object
  // is indistinguishable downstream from "the page had no events on it".
  if (!call) throw new Error("AI returned no tool_use block");

  validate(call.input, schema, "result");
  return call.input;
}

// ---------------------------------------------------------------------------
// A deliberately partial JSON Schema check.
//
// Covers the keywords the app's own schemas use, type (including a union such
// as ["string", "null"], which is how "null beats a guess" is expressed),
// properties, required, additionalProperties: false, items, enum, minItems and
// maxItems, and silently ignores everything else. Ignoring is the right
// failure here rather than throwing on an unknown keyword: a schema carrying a
// `description` or a `format` for the model's benefit is normal, and refusing
// it would make this the thing that breaks.
//
// Unknown keys in the DATA are allowed unless the schema says
// additionalProperties: false, which is what JSON Schema means. A model adding
// a field nobody reads is harmless; a model omitting one everybody reads is
// not, and that is what `required` is for.
// ---------------------------------------------------------------------------

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value, type) {
  // JSON has one number type, so integer is a value check rather than a type
  // one. NaN and Infinity cannot survive JSON at all, but Number.isFinite
  // costs nothing and keeps this honest if it is ever fed a live object.
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeOf(value) === type;
}

function bad(path, message) {
  throw new Error(`AI returned a bad shape: ${path} ${message}`);
}

function validate(value, schema, path) {
  if (!schema || typeof schema !== "object") return; // asserts nothing, so nothing to check

  if (Array.isArray(schema.enum)) {
    // Checked before type, because an enum is the stricter statement and its
    // message ("not one of ...") says more than "expected string" would.
    if (!schema.enum.some((allowed) => allowed === value)) {
      bad(path, `is ${JSON.stringify(value)}, not one of ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}`);
    }
  }

  const types = schema.type == null ? [] : [].concat(schema.type);
  if (types.length && !types.some((t) => matchesType(value, t))) {
    bad(path, `is ${typeOf(value)}, expected ${types.join(" or ")}`);
  }

  if (typeOf(value) === "object") {
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
      // hasOwnProperty rather than a truthiness test: false, 0 and "" are all
      // present, and null is present too, a schema that wants to forbid null
      // says so in `type`, and gets the clearer message for it below.
      if (!Object.prototype.hasOwnProperty.call(value, key) || value[key] === undefined) {
        bad(`${path}.${key}`, "is missing");
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) bad(`${path}.${key}`, "is not in the schema");
      }
    }
    for (const [key, sub] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) validate(value[key], sub, `${path}.${key}`);
    }
  }

  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      bad(path, `has ${value.length} items, needs at least ${schema.minItems}`);
    }
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
      bad(path, `has ${value.length} items, at most ${schema.maxItems} allowed`);
    }
    if (schema.items) value.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`));
  }
}
