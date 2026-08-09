// What somebody spotted, and whether anybody else saw the same thing.
//
// ai/extract.js turns a shared post into a candidate event. This is where that
// candidate waits, and it is the only part of the discovery pipeline that
// decides whether a claim nobody has checked is allowed in front of users.
// §5 of AI-DISCOVERY.md is the specification: a distinct label, a badge that
// says unconfirmed, a one-tap "this isn't right" that pulls it, and promotion
// on corroboration. The rest of this file is those four sentences made
// enforceable, plus the arithmetic that decides what "the same event" means.
//
// The failure this exists to prevent is one person publishing to the whole
// feed. Extraction already stops the model inventing a date; nothing in it
// stops a human inventing an event, sharing their own post twice and calling
// that corroboration. So independence is checked on identity, not on wording:
// two submissions of the same text, two submissions from the same person, and
// two anonymous submissions are all one witness here, and one witness never
// auto-publishes.
//
// Rejected, and why:
//   - A moderation queue and nothing else. It is the honest Phase 1 answer and
//     it is also the answer that stops working the week the feature is
//     popular, which §5 says out loud. The corroboration rule has to exist
//     before that week, not after it.
//   - Auto-publishing anything a submission asserts confidently. Confidence is
//     what a person sharing a rumour has most of.
//   - Reports as votes, counted and weighed. A report is not an opinion to
//     balance against the submission; it is somebody saying the app is about
//     to send a stranger to the wrong place. It acts immediately and the
//     appeal route is a human, which is the direction that costs the least
//     when it is abused. See report() below.
//   - Deleting on rejection or withdrawal. A row that vanishes is a row nobody
//     can explain later, and "why did my submission disappear" is the first
//     question the share extension will get.
//
// ---------------------------------------------------------------------------
// Why this is an interface with a Map behind it.
//
// The plan's Phase 2 puts this in Postgres, and Phase 2 is waiting on the
// budget question in §10 — a paid Render tier plus a database, in the EU. That
// answer has not come back, and blocking Tier 2 on it would delay the only
// tier that solves the Ramsgate case at all.
//
// So the store is a small closed surface — submit, list, get, moderate,
// report, toEvents — and nothing else reaches the data. No cursor, no live
// object and no Map escapes: everything returned is a copy, so no caller can
// hold something whose meaning changes when a Postgres implementation stops
// handing out references. Every operation is keyed by id or by a filter that
// is already a WHERE clause (status, region, day, radius), and each one is a
// single round trip by construction, so the same six methods can be written
// against a table without a caller noticing which they have.
//
// What the in-memory one genuinely does not do, so nobody discovers it in
// production: it does not survive a restart, it is not shared between
// instances, and it grows without bound. All three are the same fix.
// ---------------------------------------------------------------------------
import { distanceKm, makeEvent, safeUrl } from "../sources/util.js";

// The label §5 asks for. Deliberately not folded in with the feeds: a
// discovered event is not the same kind of fact as a Ticketmaster listing and
// the source line is where the app says so first.
const SOURCE = "Spotted locally";

// How close two sightings have to be to be the same event. 500 metres is about
// a park, a high street or a seafront — the scale at which two people
// describing the same thing disagree about where it is, because one names the
// venue and the other names the road.
const CORROBORATION_METRES = 500;

// How alike two titles have to be, as a Dice coefficient over their
// significant words, and how many of those words they must actually share.
//
// Conservative on purpose, and this is the number in the file most worth
// arguing about. Corroboration is the ONE path that puts an unverified claim
// in the feed with no person having looked at it, so a loose match here is not
// a tuning mistake, it is a publishing decision made by a string comparison.
//
// A loose rule fails in both directions and both are bad. Innocently: a park
// on a Saturday afternoon really does host "Summer craft market" and "Summer
// craft workshop", and merging them publishes an event with one thing's title
// and the other's time, which nobody submitted and nobody can correct.
// Deliberately: every point of slack is slack an abuser only has to get close
// to. Requiring near-agreement means a second person has to describe the same
// event in nearly the same words, which is what two people who both saw it do.
//
// The cost is real and it is the right cost: a genuine second sighting worded
// differently stays pending and waits for a moderator, which is exactly where
// an event nobody can be sure about belongs.
const TITLE_SIMILARITY = 0.7;
const MIN_SHARED_TITLE_TOKENS = 2;

// Two identified people. Not two submissions: see witnessesOf().
const WITNESSES_TO_PUBLISH = 2;

// Words too short or too common to be evidence that two titles agree. Short
// tokens are dropped wholesale rather than listed, which also takes the noise
// ("5k", "up", "at") that no stopword list would think to include.
const MIN_TOKEN_CHARS = 3;
const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "our", "your",
  "all", "any", "are", "its", "into", "onto", "over", "off",
  // Words that describe every event in the store rather than one of them, so
  // two titles sharing them have agreed about nothing.
  "event", "free", "come", "join", "day", "night",
]);

// Why a submission is where it is. Short fixed phrases rather than sentences
// built around the input: these are shown in a moderation queue and grouped in
// logs, and the input they would quote is untrusted text somebody shared.
const REASON = {
  notAnEvent: "not a usable candidate",
  noId: "no id",
  noTitle: "no title",
  noStart: "no usable start",
  noCoordinate: "no coordinate",
  moderated: "rejected by a moderator",
  reported: "reported as wrong",
};

// The statuses, and the only transitions there are:
//
//   pending   -> published  (a moderator approves, or a second witness arrives)
//   pending   -> rejected   (a moderator rejects)
//   pending   -> withdrawn  (reported before it was ever published)
//   published -> withdrawn  (reported)
//   withdrawn -> published  (a moderator overrules the report)
//   rejected  -> nothing at all
//
// `rejected` being terminal is the one that matters. It is the only status a
// human deliberately chose against the event, and neither a fresh submission
// nor a corroboration may undo it — otherwise the way past a moderator is to
// submit again, twice, with a friend.
const STATUS = {
  pending: "pending",
  published: "published",
  rejected: "rejected",
  withdrawn: "withdrawn",
};

// ---------------------------------------------------------------------------
// Text and time.
// ---------------------------------------------------------------------------

/// The form titles are compared in.
///
/// Same folding ai/extract.js applies before its substring check, and for the
/// same reason: a phone keyboard writes a curly apostrophe and a laptop writes
/// a straight one, and neither person is describing a different event. It is
/// copied rather than imported because it is a private helper there, and this
/// module does not get to edit that file. Three copies of this across the
/// project is two too many and it belongs in sources/util.js.
function normalise(s) {
  return String(s ?? "")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/// The words in a title that could be evidence two people mean the same thing.
function significantTokens(title) {
  const out = new Set();
  for (const word of normalise(title).split(" ")) {
    const token = word.replace(/[^a-z0-9]/g, "");
    if (token.length < MIN_TOKEN_CHARS || STOPWORDS.has(token)) continue;
    out.add(token);
  }
  return out;
}

/// Do these two titles agree, conservatively?
///
/// Dice rather than a substring test or an edit distance. A substring test
/// makes "Craft market" match "Craft market committee meeting", which is a
/// different event about the first one. An edit distance measures typing, not
/// meaning: "5k run" and "5k fun" are one character apart and "Eclipse glasses
/// giveaway" and "Free solar eclipse glasses" are miles apart in characters
/// while plainly being the same thing.
///
/// The shared-token floor is what stops a single common word carrying a match.
/// Two one-word titles therefore never corroborate each other, however
/// identical — deliberately, because "Fireworks" is not a description of an
/// event, it is a description of a hundred of them. Those wait for a moderator.
function titlesAgree(a, b) {
  const left = significantTokens(a);
  const right = significantTokens(b);
  if (!left.size || !right.size) return false;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  if (shared < MIN_SHARED_TITLE_TOKENS) return false;
  return (2 * shared) / (left.size + right.size) >= TITLE_SIMILARITY;
}

const LONDON_YMD = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric", month: "2-digit", day: "2-digit",
});

/// The Europe/London calendar date of an instant, as YYYY-MM-DD.
///
/// London, not UTC, for the reason carboots.js gives: for the hour after
/// midnight BST the two disagree about which day it is, and an event would
/// either corroborate the wrong day's sighting or drop out of the feed a day
/// early.
function londonDay(value) {
  const p = Object.fromEntries(LONDON_YMD.formatToParts(value).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/// A candidate's start, as the day it falls on and the instant it begins.
///
/// Two forms arrive, both from ai/extract.js and both meaningful: a full ISO
/// instant when the post named a time, and a bare YYYY-MM-DD when it named
/// only a day. The bare one is kept bare rather than parsed to midnight — it
/// means "some time that day", and treating it as 00:00 would drop a thing
/// that has not happened yet out of the feed at one minute past midnight.
function startInfo(start) {
  const raw = typeof start === "string" ? start.trim() : "";
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { day: raw, instant: null };
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  return { day: londonDay(new Date(t)), instant: t };
}

/// Is this start already behind us?
///
/// No grace period, unlike the six hours carboots.js and extract.js allow. The
/// difference is what is being shown: the boot sale table is known to be
/// right, so a sale that started at seven is worth offering at eleven. An
/// event in this store may not exist at all, and an unconfirmed thing that has
/// also already started is the weakest row the app can print. A bare date
/// survives until its day is over, because that is the whole of what the post
/// said.
function hasPassed(info, now) {
  if (info.instant != null) return info.instant < now.getTime();
  return info.day < londonDay(now);
}

// ---------------------------------------------------------------------------

/// Do two candidates describe the same event?
///
/// Three agreements, all required: the same London day, titles that agree, and
/// places within CORROBORATION_METRES. No coordinate on either side is not the
/// same event — it is two claims whose places cannot be compared, and the plan
/// is explicit that an unplaceable event does not ship anyway.
///
/// Note what is NOT compared: the time. Two people at the same thing write
/// "from 10am" and "10.30 start", and demanding they agree on the minute would
/// reject exactly the pair of honest sightings this rule exists to reward. The
/// day, the words and the place are already three independent agreements.
function describesSameEvent(a, b) {
  const left = startInfo(a?.start);
  const right = startInfo(b?.start);
  if (!left || !right || left.day !== right.day) return false;
  if (!titlesAgree(a?.title, b?.title)) return false;
  const apart = distanceKm(a?.lat, a?.lng, b?.lat, b?.lng);
  return apart != null && apart * 1000 <= CORROBORATION_METRES;
}

/// The people who have independently reported seeing this.
///
/// Two counts, and the smaller one wins, because a witness has to be new in
/// both ways at once:
///
///   - a new PERSON. Only identified submitters count. An anonymous sighting
///     is recorded and shown to a moderator, but it can never be shown to be a
///     different person from the last anonymous sighting, and "a different
///     person" is the entire content of the rule. Counting them would make
///     auto-publishing a matter of pressing share twice.
///   - a new SOURCE. Two people forwarding one Facebook post is one post.
///     ai/extract.js fingerprints the text and the link, so the two arrive
///     with one id, and treating that as two observations would publish on the
///     say-so of whoever wrote the original — which is exactly the thing
///     nobody has checked.
///
/// Taking the minimum rather than intersecting pairs is deliberate: it is one
/// line, it can only ever under-count, and under-counting here costs a wait
/// for a moderator while over-counting costs a stranger a wasted journey.
function witnessesOf(record) {
  const people = new Set(record.sightings.map((s) => s.submitter).filter(Boolean));
  const sources = new Set(record.sightings.map((s) => s.source).filter(Boolean));
  return Math.min(people.size, sources.size);
}

/// A copy of a record, for a caller to keep.
function snapshot(record) {
  return structuredClone({ ...record, witnesses: witnessesOf(record) });
}

/// The one place a submitted candidate is checked for being usable at all.
///
/// Returns a reason string, or "" when the candidate can become an event. The
/// coordinate check is the plan's "no coordinate, no event" rule applied at
/// the door rather than at the feed: a submission with no coordinate can never
/// be shown, and leaving it sitting in the queue for a moderator to approve
/// into nothing is worse than saying so now. It also means the integrator has
/// to geocode before submitting, which is the correct order.
function unusableReason(candidate) {
  if (!candidate || typeof candidate !== "object") return REASON.notAnEvent;
  // An id is not bookkeeping here, it is the identity the exact-duplicate rule
  // is built on: without one, the same post shared twice is two events. Minting
  // one was the alternative and it is the wrong kind of helpful, because the
  // minted id would be unique by construction and would therefore never
  // collide with the thing it is a copy of.
  if (typeof candidate.id !== "string" || !candidate.id.trim()) return REASON.noId;
  if (typeof candidate.title !== "string" || !candidate.title.trim()) return REASON.noTitle;
  if (!startInfo(candidate.start)) return REASON.noStart;
  if (!Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) return REASON.noCoordinate;
  return "";
}

/// A store of user submissions, with the trust rules of §5 attached.
///
/// `clock` is the seam the tests replace, and the only source of "now" the
/// store has: timestamps on records and the default for toEvents both come
/// from it, so a suite can age a submission without waiting.
///
/// A candidate is what ai/extract.js produces — a makeEvent-shaped object with
/// an `evidence` map — after ai/geocode.js has put a coordinate on it, plus
/// two fields this module needs and neither of those produces:
///
///   submitter  who sent it, as a stable opaque id. Absent means anonymous,
///              which is allowed and which can never corroborate.
///   regionId   the region it belongs to, for list() and for the queue.
export function createSubmissionStore({ clock = () => new Date() } = {}) {
  const records = new Map();

  const now = () => {
    const at = clock();
    return at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  };

  /// The record a candidate belongs to, or null for something new.
  ///
  /// A rejected record is a match too, and returning it is the point: a
  /// resubmission of something a moderator threw out lands back on the same
  /// row and stays thrown out, instead of starting a fresh pending one that
  /// the moderator has to reject again.
  function findMatch(candidate) {
    if (typeof candidate.id === "string" && records.has(candidate.id)) {
      // The same post shared twice. ai/extract.js fingerprints the text and
      // the link, so this is an exact identity rather than a similarity, and
      // it is the cheapest half of the abuse case.
      return records.get(candidate.id);
    }
    for (const record of records.values()) {
      if (describesSameEvent(record.candidate, candidate)) return record;
    }
    return null;
  }

  return {
    /// Take one submission. Never throws, whatever it is handed.
    ///
    /// Returns { id, status } for the record the submission landed in, which
    /// may be one that already existed — a second sighting joins the first
    /// rather than starting a row of its own, so the queue holds events rather
    /// than reports of events. The caller gets that id back precisely so it
    /// can follow what happened to what it sent.
    submit(candidate) {
      const reason = unusableReason(candidate);
      const id = typeof candidate?.id === "string" && candidate.id.trim() ? candidate.id.trim() : "";
      if (reason) {
        // Nothing to store and nothing to moderate when there is not even an
        // id to look the answer up by, so the answer is the whole of it.
        if (!id) return { id: "", status: STATUS.rejected, reason };
        const at = now().toISOString();
        const existing = records.get(id);
        if (existing) return { id, status: existing.status };
        records.set(id, {
          id,
          status: STATUS.rejected,
          reason,
          regionId: typeof candidate.regionId === "string" ? candidate.regionId : "",
          candidate: null,
          evidence: {},
          sightings: [],
          reports: 0,
          createdAt: at,
          updatedAt: at,
        });
        return { id, status: STATUS.rejected, reason };
      }

      const at = now().toISOString();
      const submitter = typeof candidate.submitter === "string" ? candidate.submitter.trim() : "";
      const sighting = { submitter, source: id, at, sourceUrl: safeUrl(candidate.url) };

      const match = findMatch(candidate);
      if (match) {
        if (match.status === STATUS.rejected) return { id: match.id, status: match.status };
        match.sightings.push(sighting);
        match.updatedAt = at;
        // Promotion happens here and only here, and only out of pending. A
        // withdrawn event is NOT brought back by a new sighting: a report is
        // an assertion that the thing is wrong, and answering it with more of
        // the same evidence that published it is how a store argues itself
        // into a mistake. A human overrules a report; nothing else does.
        if (match.status === STATUS.pending && witnessesOf(match) >= WITNESSES_TO_PUBLISH) {
          match.status = STATUS.published;
          match.reason = "";
        }
        return { id: match.id, status: match.status };
      }

      const record = {
        id,
        status: STATUS.pending,
        reason: "",
        regionId: typeof candidate.regionId === "string" ? candidate.regionId : "",
        // Stored as given. This module does not re-derive the event: what a
        // moderator approves has to be the thing that was extracted, quotes
        // and all, or the queue is showing them one event and publishing
        // another.
        candidate: structuredClone({ ...candidate }),
        evidence: structuredClone(candidate.evidence || {}),
        sightings: [sighting],
        reports: 0,
        createdAt: at,
        updatedAt: at,
      };
      records.set(record.id, record);
      return { id: record.id, status: record.status };
    },

    /// The queue, filtered. Both filters are optional; neither is a search.
    list({ status, regionId } = {}) {
      const out = [];
      for (const record of records.values()) {
        if (status && record.status !== status) continue;
        if (regionId && record.regionId !== regionId) continue;
        out.push(snapshot(record));
      }
      return out;
    },

    /// One submission, or null. A copy, so nothing a caller does to it lands
    /// back in the store.
    get(id) {
      const record = records.get(String(id ?? ""));
      return record ? snapshot(record) : null;
    },

    /// A human's verdict. Returns the updated record, or null if there was
    /// nothing to act on.
    ///
    /// Approval clears the report count as well as publishing, because that is
    /// what a moderator overruling a report means; leaving the count would
    /// have the next single report pull it again, which makes the moderator's
    /// decision worth one tap from a stranger.
    ///
    /// An unrecognised verdict changes nothing and says so by returning null.
    /// Defaulting to either one is a bug that publishes or unpublishes on a
    /// typo, and there is no safe direction to default in.
    moderate(id, verdict) {
      const record = records.get(String(id ?? ""));
      if (!record) return null;
      if (record.status === STATUS.rejected) return snapshot(record);
      if (verdict !== "approve" && verdict !== "reject") return null;

      if (verdict === "approve") {
        record.status = STATUS.published;
        record.reason = "";
        record.reports = 0;
      } else {
        record.status = STATUS.rejected;
        record.reason = REASON.moderated;
      }
      record.updatedAt = now().toISOString();
      return snapshot(record);
    },

    /// Somebody says this is wrong. Returns the updated record, or null.
    ///
    /// One report is enough to pull an event only one person ever reported.
    /// That is trivially abusable and it is abusable in the safe direction
    /// only: the cost of a malicious report is one event missing from a feed
    /// that has gaps in it anyway, and the cost of not acting is a stranger
    /// driving to a field for something that is not happening. The plan calls
    /// the second one the worst thing this feature could do, so the asymmetry
    /// is the design rather than a shortcut.
    ///
    /// The threshold tracks corroboration rather than being fixed at one, so
    /// that knocking out an event two people independently saw takes two
    /// people saying otherwise. That is the only place the two rules meet, and
    /// it keeps a single report from outweighing the strongest evidence the
    /// store can hold.
    report(id) {
      const record = records.get(String(id ?? ""));
      if (!record) return null;
      if (record.status === STATUS.rejected) return snapshot(record);

      record.reports++;
      if (record.reports >= Math.max(1, witnessesOf(record))) {
        record.status = STATUS.withdrawn;
        record.reason = REASON.reported;
      }
      record.updatedAt = now().toISOString();
      return snapshot(record);
    },

    /// The published submissions near a point, as events the feed can hold.
    ///
    /// Reads like carboots.js and curated.js: a cheap local read that returns
    /// already-shaped events, with no model and no network anywhere near the
    /// request path. The distance filter is carboots.js's, including its
    /// behaviour with no point given — everything, so a caller without
    /// coordinates gets the lot rather than nothing.
    toEvents({ lat, lng, radiusKm = 50, now: at = now() } = {}) {
      const clock_ = at instanceof Date && !Number.isNaN(at.getTime()) ? at : now();
      const bounded = Number.isFinite(lat) && Number.isFinite(lng);

      const events = [];
      const emitted = [];
      for (const record of records.values()) {
        // Only published. Pending, rejected and withdrawn are the three ways
        // an event is not a thing this app is willing to say out loud.
        if (record.status !== STATUS.published || !record.candidate) continue;

        const candidate = record.candidate;
        const info = startInfo(candidate.start);
        if (!info || hasPassed(info, clock_)) continue;

        if (bounded) {
          const away = distanceKm(lat, lng, candidate.lat, candidate.lng);
          if (away == null || away > radiusKm) continue;
        }

        // Dedupe, by the same conservative rule corroboration uses, and it is
        // a belt on top of braces: submit() merges a second sighting into the
        // record it matches, so this implementation cannot hold two records
        // for one event and this branch never fires. It is here for the
        // Postgres one, which will have more than one worker, and where two
        // sightings arriving at once can both find no match and both insert.
        // Two rows for one event reads as a bug in the app — the same
        // judgement carboots.js makes about one sale's dates landing adjacent
        // in a distance sort — and it is much cheaper to answer here than with
        // a lock.
        if (emitted.some((seen) => describesSameEvent(seen, candidate))) continue;
        emitted.push(candidate);

        const link = safeUrl(candidate.url);
        events.push({
          ...makeEvent({
            id: record.id,
            title: candidate.title,
            // Already folded onto the shared vocabulary by makeEvent when the
            // candidate was built, and every name in that vocabulary maps to
            // itself, so passing it back through is a no-op rather than a
            // second guess at what the thing is.
            category: candidate.category,
            start: candidate.start,
            venue: candidate.venue,
            address: candidate.address,
            lat: candidate.lat,
            lng: candidate.lng,
            url: link,
            image: candidate.image,
            source: SOURCE,
            price: candidate.price,
            description: candidate.description,
          }),
          // The badge, and it is on every event this store emits — including
          // the corroborated ones. Two people is better evidence than one and
          // it is still not a published listing, so "unconfirmed" is a
          // statement about where the event came from rather than about how
          // sure this module happens to feel.
          unconfirmed: true,
          // The provenance, named separately from `url` on purpose. `url` is
          // what every existing client already opens from the primary action,
          // and the "check before you travel" line needs a link of its own
          // that a client cannot lose by deciding an event with no tickets has
          // nothing to link to.
          sourceUrl: link,
        });
      }
      return events;
    },
  };
}

// Exported for the tests, which check the trust rules themselves rather than
// only the events that come out of them.
export const __rules = {
  SOURCE,
  STATUS,
  REASON,
  CORROBORATION_METRES,
  TITLE_SIMILARITY,
  MIN_SHARED_TITLE_TOKENS,
  WITNESSES_TO_PUBLISH,
};
