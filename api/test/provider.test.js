import test from "node:test";
import assert from "node:assert/strict";

import { aiConfigured, aiJSON } from "../ai/provider.js";
import { jsonResponse, withEnv, withForbiddenFetch, withStubbedFetch } from "./helpers.js";

// The schema the app actually asks for: one makeEvent-shaped record, with the
// nullable start the plan insists on ("null beats a guess") and a category that
// has to come from the shared vocabulary. Testing against this rather than
// { type: "object" } is the point, the failures worth catching are the ones
// this shape has, not the ones a toy shape has.
const EVENT_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: { type: "string", enum: ["Music", "Markets", "Things to do"] },
          start: { type: ["string", "null"] },
          confidence: { type: "number" },
          venue: {
            type: "object",
            properties: { name: { type: "string" }, postcode: { type: "string" } },
            required: ["name"],
          },
        },
        required: ["title", "category", "start"],
      },
    },
  },
  required: ["events"],
};

function anEvent(overrides = {}) {
  return {
    title: "Free eclipse glasses at the Boating Pool",
    category: "Things to do",
    start: "2026-08-12T14:00:00",
    venue: { name: "Ramsgate Boating Pool", postcode: "CT11 8LS" },
    ...overrides,
  };
}

/// A Messages API response carrying a forced tool call.
function toolUse(input, { name = "emit_result", extraBlocks = [] } = {}) {
  return jsonResponse({
    id: "msg_01",
    type: "message",
    role: "assistant",
    stop_reason: "tool_use",
    content: [...extraBlocks, { type: "tool_use", id: "toolu_01", name, input }],
  });
}

/// Run `run` with a key set and fetch stubbed. Every test goes through here, so
/// no test can reach the network by forgetting something.
async function withAI(handler, run, env = {}) {
  return withEnv({ AI_API_KEY: "test-key", AI_MODEL: undefined, ...env }, () =>
    withStubbedFetch(handler, run)
  );
}

/// The parsed request body of a recorded call.
function bodyOf(call) {
  return JSON.parse(call.opts.body);
}

// ---------------------------------------------------------------------------
// The key gate. Same rule as every other source: no key, no network, no throw.
// ---------------------------------------------------------------------------

test("with no key, aiConfigured is false and aiJSON returns null without calling out", async () => {
  await withEnv({ AI_API_KEY: undefined }, () =>
    withForbiddenFetch(async () => {
      assert.equal(aiConfigured(), false);
      assert.equal(await aiJSON({ user: "anything", schema: EVENT_SCHEMA }), null);
    })
  );
});

test("an empty key is an unset key, not a key that will 401", async () => {
  // Render sets declared-but-unfilled environment variables to "", and sending
  // that would spend a request to be told what we already knew.
  await withEnv({ AI_API_KEY: "" }, () =>
    withForbiddenFetch(async () => {
      assert.equal(aiConfigured(), false);
      assert.equal(await aiJSON({ user: "anything", schema: EVENT_SCHEMA }), null);
    })
  );
});

test("aiConfigured only reads the environment, so it is safe to call per request", async () => {
  await withEnv({ AI_API_KEY: "test-key" }, () =>
    withForbiddenFetch(async () => {
      for (let i = 0; i < 100; i++) assert.equal(aiConfigured(), true);
    })
  );
});

// ---------------------------------------------------------------------------
// The request. Getting any of this wrong is a 400 in production and nothing in
// the tests, so it is asserted field by field.
// ---------------------------------------------------------------------------

test("the request is a Messages API call with the documented headers", async () => {
  await withAI(
    () => toolUse({ events: [] }),
    async (calls) => {
      await aiJSON({ system: "You extract UK events.", user: "page text", schema: EVENT_SCHEMA });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
      assert.equal(calls[0].opts.method, "POST");
      const h = calls[0].opts.headers;
      assert.equal(h["x-api-key"], "test-key");
      assert.equal(h["anthropic-version"], "2023-06-01");
      assert.equal(h["content-type"], "application/json");
      // The key travels in x-api-key, never in an Authorization bearer header
      // and never in the query string, where it would land in access logs.
      assert.ok(!("Authorization" in h) && !("authorization" in h));
      assert.ok(!calls[0].url.includes("test-key"));
    }
  );
});

test("the schema is sent as a forced tool, not asked for in prose", async () => {
  // The whole reason this module exists. If tool_choice ever loosens to "auto",
  // the model may answer in prose and the parse becomes guesswork again.
  await withAI(
    () => toolUse({ events: [] }),
    async (calls) => {
      await aiJSON({ user: "page text", schema: EVENT_SCHEMA });
      const body = bodyOf(calls[0]);
      assert.equal(body.tools.length, 1, "exactly one tool, so there is nothing to choose between");
      assert.deepEqual(body.tools[0].input_schema, EVENT_SCHEMA, "the caller's schema is sent verbatim");
      assert.deepEqual(body.tool_choice, { type: "tool", name: body.tools[0].name });
      assert.equal(body.messages.length, 1);
      assert.deepEqual(body.messages[0], { role: "user", content: "page text" });
      assert.equal(body.system, undefined, "no system prompt was asked for, so none is sent");
      // No prose instruction to reply in JSON: the tool is the contract.
      assert.doesNotMatch(JSON.stringify(body.messages), /json/i);
    }
  );
});

test("system, maxTokens and the model default carry through", async () => {
  await withAI(
    () => toolUse({ events: [] }),
    async (calls) => {
      await aiJSON({ system: "Be literal.", user: "u", schema: EVENT_SCHEMA });
      assert.equal(bodyOf(calls[0]).system, "Be literal.");
      assert.equal(bodyOf(calls[0]).model, "claude-sonnet-4-6");
      assert.equal(bodyOf(calls[0]).max_tokens, 1024);

      await aiJSON({ user: "u", schema: EVENT_SCHEMA, maxTokens: 4096 });
      assert.equal(bodyOf(calls[1]).max_tokens, 4096);
    }
  );
});

test("AI_MODEL overrides the default", async () => {
  await withAI(
    () => toolUse({ events: [] }),
    async (calls) => {
      await aiJSON({ user: "u", schema: EVENT_SCHEMA });
      assert.equal(bodyOf(calls[0]).model, "claude-haiku-4-5");
    },
    { AI_MODEL: "claude-haiku-4-5" }
  );
});

test("a stalled call is aborted at the timeout and not retried", async () => {
  // Every network call in this app goes through fetchWithTimeout, which is
  // visible from here as an abort signal that fires on its own. Without it a
  // scheduled extraction pass stops on one unresponsive host and the events it
  // was going to write never appear, with nothing in the logs to say why.
  //
  // The stub honours the signal, which real fetch does; a stub that merely
  // never resolved would hang this test instead of failing it.
  await withAI(
    (url, opts) =>
      new Promise((_, reject) => {
        opts.signal.addEventListener("abort", () => reject(new Error("This operation was aborted")));
      }),
    async (calls) => {
      const started = Date.now();
      await assert.rejects(aiJSON({ user: "u", schema: EVENT_SCHEMA, timeoutMs: 50 }), /aborted/);
      assert.ok(Date.now() - started < 2000, "the timeout was not the thing that ended the call");
      assert.equal(calls.length, 1, "a timeout was retried");
      assert.equal(calls[0].opts.signal.aborted, true);
    }
  );
});

// ---------------------------------------------------------------------------
// The happy path.
// ---------------------------------------------------------------------------

test("a valid tool_use response comes back as the parsed object", async () => {
  const payload = { events: [anEvent(), anEvent({ title: "Boot sale", category: "Markets", start: null })] };
  const out = await withAI(
    () => toolUse(payload),
    () => aiJSON({ user: "page text", schema: EVENT_SCHEMA })
  );
  assert.deepEqual(out, payload);
  // A nullable field really is allowed to be null: dropping an event for
  // having no date it could quote is the plan's rule, and the extractor needs
  // a way to say so.
  assert.equal(out.events[1].start, null);
});

test("the tool call is found even when the model narrates first", async () => {
  const out = await withAI(
    () =>
      toolUse(
        { events: [anEvent()] },
        { extraBlocks: [{ type: "text", text: "I found one event on this page." }] }
      ),
    () => aiJSON({ user: "u", schema: EVENT_SCHEMA })
  );
  assert.equal(out.events.length, 1);
});

test("fields the schema does not mention are passed through untouched", async () => {
  // JSON Schema's default, and the right one: a model volunteering a field
  // nobody reads is harmless. Omitting one everybody reads is what `required`
  // is for, and that is asserted below.
  const out = await withAI(
    () => toolUse({ events: [anEvent({ quote: "free glasses from 2pm" })], notes: "one page" }),
    () => aiJSON({ user: "u", schema: EVENT_SCHEMA })
  );
  assert.equal(out.events[0].quote, "free glasses from 2pm");
  assert.equal(out.notes, "one page");
});

// ---------------------------------------------------------------------------
// Malformed output. This is the failure the module exists to prevent: a
// confident, plausible-looking object with the wrong shape reaching the feed,
// where a hallucinated Saturday afternoon gets somebody in a car.
// ---------------------------------------------------------------------------

test("a missing required key throws instead of returning a hollow event", async () => {
  const { title, ...noTitle } = anEvent();
  await assert.rejects(
    withAI(
      () => toolUse({ events: [noTitle] }),
      () => aiJSON({ user: "u", schema: EVENT_SCHEMA })
    ),
    /bad shape.*events\[0\]\.title.*missing/
  );
});

test("a missing required key at the top level throws", async () => {
  await assert.rejects(
    withAI(
      () => toolUse({ notes: "nothing found" }),
      () => aiJSON({ user: "u", schema: EVENT_SCHEMA })
    ),
    /bad shape.*result\.events.*missing/
  );
});

test("a required key present but explicitly null still counts as present", async () => {
  // `required` is about the key, `type` is about the value. Conflating them
  // would make the nullable start unusable, since the extractor has to be able
  // to say "no date" out loud.
  const out = await withAI(
    () => toolUse({ events: [anEvent({ start: null })] }),
    () => aiJSON({ user: "u", schema: EVENT_SCHEMA })
  );
  assert.equal(out.events[0].start, null);
});

test("a wrong-typed field throws, naming the path", async () => {
  const cases = [
    [anEvent({ title: 42 }), /events\[0\]\.title is number, expected string/],
    [anEvent({ start: 1786000000 }), /events\[0\]\.start is number, expected string or null/],
    [anEvent({ confidence: "high" }), /events\[0\]\.confidence is string, expected number/],
    [anEvent({ venue: "Ramsgate Boating Pool" }), /events\[0\]\.venue is string, expected object/],
    [anEvent({ venue: { postcode: "CT11 8LS" } }), /events\[0\]\.venue\.name is missing/],
  ];
  for (const [event, message] of cases) {
    await assert.rejects(
      withAI(
        () => toolUse({ events: [event] }),
        () => aiJSON({ user: "u", schema: EVENT_SCHEMA })
      ),
      message,
      JSON.stringify(event)
    );
  }
});

test("a value outside an enum throws, so an invented category never reaches the chips", async () => {
  // The categories are also the design's colour table. A "Fireworks" that no
  // chip and no palette entry knows about is exactly the kind of wrong that
  // looks fine in a log and broken on a phone.
  await assert.rejects(
    withAI(
      () => toolUse({ events: [anEvent({ category: "Fireworks" })] }),
      () => aiJSON({ user: "u", schema: EVENT_SCHEMA })
    ),
    /events\[0\]\.category is "Fireworks", not one of/
  );
});

test("the wrong container type throws rather than being coerced", async () => {
  await assert.rejects(
    withAI(
      () => toolUse({ events: anEvent() }),
      () => aiJSON({ user: "u", schema: EVENT_SCHEMA })
    ),
    /result\.events is object, expected array/
  );
});

test("a truncated tool_use is caught by the same check, not returned half-filled", async () => {
  // What a response cut short by max_tokens looks like: the block is there, the
  // object is not finished. Nothing else in the response says so usefully.
  await assert.rejects(
    withAI(
      () =>
        jsonResponse({
          stop_reason: "max_tokens",
          content: [{ type: "tool_use", name: "emit_result", input: { events: [{ title: "Ramsgate" }] } }],
        }),
      () => aiJSON({ user: "u", schema: EVENT_SCHEMA })
    ),
    /bad shape.*events\[0\]\.category is missing/
  );
});

test("integer, minItems and additionalProperties are enforced too", async () => {
  const schema = {
    type: "object",
    properties: {
      matches: { type: "array", items: { type: "integer" }, minItems: 1, maxItems: 3 },
      pick: { type: "object", properties: { id: { type: "string" } }, additionalProperties: false },
    },
    required: ["matches"],
  };
  const run = (input) =>
    withAI(
      () => toolUse(input),
      () => aiJSON({ user: "u", schema })
    );

  assert.deepEqual(await run({ matches: [1, 2] }), { matches: [1, 2] });
  await assert.rejects(run({ matches: [1.5] }), /matches\[0\] is number, expected integer/);
  await assert.rejects(run({ matches: [] }), /matches has 0 items, needs at least 1/);
  await assert.rejects(run({ matches: [1, 2, 3, 4] }), /matches has 4 items, at most 3/);
  await assert.rejects(
    run({ matches: [1], pick: { id: "a", rank: 2 } }),
    /pick\.rank is not in the schema/
  );
});

test("no tool_use block throws, because an empty object would read as 'no events here'", async () => {
  // A forced tool can still be dodged: the model answers in prose. Returning {}
  // for that is indistinguishable downstream from a page that genuinely had
  // nothing on it, which is a silent hole in coverage.
  const bodies = [
    { content: [{ type: "text", text: "I cannot help with that." }] },
    { content: [] },
    {},
    { content: [{ type: "tool_use", name: "some_other_tool", input: { events: [] } }] },
  ];
  for (const body of bodies) {
    await assert.rejects(
      withAI(
        () => jsonResponse(body),
        () => aiJSON({ user: "u", schema: EVENT_SCHEMA })
      ),
      /no tool_use block/,
      JSON.stringify(body)
    );
  }
});

// ---------------------------------------------------------------------------
// Transport. One retry, and only where a retry can help.
// ---------------------------------------------------------------------------

test("a non-ok status throws with the status in the message", async () => {
  await assert.rejects(
    withAI(
      () => jsonResponse({ error: { message: "credit balance too low" } }, { ok: false, status: 400 }),
      () => aiJSON({ user: "u", schema: EVENT_SCHEMA })
    ),
    /AI 400/
  );
});

test("a 4xx is never retried", async () => {
  // A bad key, a rejected schema or an over-long request fails identically the
  // second time, and the second attempt still counts against the rate limit.
  for (const status of [400, 401, 403, 404, 413]) {
    await withAI(
      () => jsonResponse({}, { ok: false, status }),
      async (calls) => {
        await assert.rejects(aiJSON({ user: "u", schema: EVENT_SCHEMA }), new RegExp(`AI ${status}`));
        assert.equal(calls.length, 1, `a ${status} was retried`);
      }
    );
  }
});

test("a 429 is retried once and the second answer is used", async () => {
  const payload = { events: [anEvent()] };
  await withAI(
    (url, opts, i) => (i === 0 ? jsonResponse({}, { ok: false, status: 429 }) : toolUse(payload)),
    async (calls) => {
      assert.deepEqual(await aiJSON({ user: "page text", schema: EVENT_SCHEMA }), payload);
      assert.equal(calls.length, 2);
      // The retry is the same request, not a quietly degraded one.
      assert.deepEqual(bodyOf(calls[1]), bodyOf(calls[0]));
    }
  );
});

test("a 5xx is retried once, and a second failure is reported rather than looped on", async () => {
  for (const status of [500, 502, 503, 529]) {
    await withAI(
      () => jsonResponse({}, { ok: false, status }),
      async (calls) => {
        await assert.rejects(aiJSON({ user: "u", schema: EVENT_SCHEMA }), new RegExp(`AI ${status}`));
        assert.equal(calls.length, 2, `a ${status} did not get exactly one retry`);
      }
    );
  }
});

test("a network failure propagates and is not retried", async () => {
  // A DNS failure, a refused connection or an abort is not the API declining;
  // there is nothing here that a second identical attempt would fix, and the
  // worker's own schedule is the right place to try again.
  await withAI(
    () => {
      throw new Error("getaddrinfo ENOTFOUND api.anthropic.com");
    },
    async (calls) => {
      await assert.rejects(aiJSON({ user: "u", schema: EVENT_SCHEMA }), /ENOTFOUND/);
      assert.equal(calls.length, 1);
    }
  );
});

test("an empty page still produces a valid empty result rather than an error", async () => {
  // The common case for the crawl: a council page whose content hash changed
  // because a footer year rolled over. It must be cheap and quiet.
  const out = await withAI(
    () => toolUse({ events: [] }),
    () => aiJSON({ system: "s", user: "", schema: EVENT_SCHEMA })
  );
  assert.deepEqual(out, { events: [] });
});
