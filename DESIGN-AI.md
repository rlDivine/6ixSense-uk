# VenTrack: design brief for the AI surfaces

A companion to `DESIGN.md`. That document describes the app as it stands. This
one describes the interface for the work in `AI-DISCOVERY.md`: natural language
search over a region's feed, and events that arrive because a person spotted
them rather than because somebody sold a ticket.

Everything in `DESIGN.md` section 4 still holds and is not restated here. Union
flag palette with navy carrying selection and red rationed to the logo, the
primary action and today. No gradients. No emoji outside the twelve interest
chips. SF Symbols on iOS, inline SVG on the web. Miles, `en-GB` dates, pounds.
No em dashes, en dashes or arrow glyphs in any user-facing string.

The one new rule this document adds, and the one everything else follows from:

> **A discovered event is a different kind of fact, and the interface says so
> every time it is shown.** Not once at onboarding, not in a settings screen, not
> in small print on the detail page. On every surface the event appears on.

That costs density on a card, which is the app's most valuable space, and it is
still worth it. The whole promise of VenTrack is that its answers are actionable.
An event somebody drives to that was never happening does more damage than a
hundred events it failed to find.

---

## 0. What the backend already decided

The interface cannot be designed against wishes, so here is what the four
modules in `api/ai/` actually hand the clients. Design to these and nothing else.

**Search** (`ai/search.js`) returns `{ ok, matches: [{ id, reason }], usedAI }`.

- The model **selects, it never writes**. Every `id` was already in the feed, and
  an id that was not sent back is dropped. There is no such thing as an AI
  result the client did not already have on screen.
- `reason` is a label, capped at **120 characters**, asked for in twelve words of
  British English. Design for one line at twelve words and for a layout that
  survives 120 characters at the largest type.
- Matches come back **in the caller's own order**, not the model's, because the
  model cannot see distance. The sort control keeps working and keeps meaning
  what it says.
- `ok: false` covers no key, no query, nothing to search, and any failure. It is
  one signal, deliberately, so the client has one branch: fall back to local
  search. `ok: true` with zero matches is a real answer of "nothing", and is a
  different screen.

**Extraction** (`ai/extract.js`) returns `{ ok, candidate, rejected, confidence }`.

- `candidate` is a `makeEvent` object with `source: "Spotted locally"` and an
  `evidence` map beside it: every field that survived, with the verbatim quote
  that justified it. That map is the best trust device in this entire feature and
  the interface uses it twice, in the confirm screen and in the moderation queue.
- `rejected` is a list of codes, and it is why the submission failed. It can hold
  more than one. The codes are `empty-input`, `ai-not-configured`, `ai-failed`,
  `not-an-event`, `no-title`, `no-date`, `no-place`, `unreadable-date`,
  `date-in-the-past`. **No code is ever shown to a person**; section 3 gives the
  sentence for each.
- `confidence` is worth knowing about because of what it cannot be. The weights
  are title 0.2, date 0.3, place 0.3, time 0.1, and title, date and place are all
  required for `ok: true`. So a successful extraction is **always 0.8 or 0.9**,
  and nothing else. Any interface that grades a submission on a confidence
  threshold is drawing a distinction the number cannot make. Section 3 keys on
  which fields carry evidence instead, which is the same information said
  usefully.
- Coordinates are `null` and stay null until `ai/geocode.js` places them, and an
  event it cannot place is dropped rather than pinned at the town centre. So a
  spotted event that reaches a client has a real coordinate, exactly like a boot
  sale, and the map does not need a special case for a missing one.

**Every one of these is key-gated.** No key means an empty result, no network
call and no exception. The interface inherits that: with no key configured, none
of the surfaces below exist, and the app is the app in `DESIGN.md` rather than a
broken version of this one. The single exception is the iOS share extension,
which is installed by the system and cannot hide itself; it gets a state, in
section 3.

---

## 1. AI search

### One field, not two

There is one search field. It does what it does today on every keystroke: a
literal filter over title, venue and category, plus the date phrases and the UK
address lookup. That is the floor and it never moves.

What changes is that the field gains a **submit**. Press Return, or tap the
**Ask** button on its trailing edge, and the query also goes to the model.

Two things were rejected here:

- **A mode toggle, or a second search box.** Nobody wants to choose a search
  engine before they have typed anything, and a person who picks the wrong one
  gets a worse answer than the app could have given. The correct number of
  search fields in a listings app is one.
- **Asking the model on every keystroke.** It is the obvious thing and it is
  indefensible: a model call per character, most of them for a prefix nobody
  meant to search for. Submit is also what makes the difference legible. Typing
  filters, asking answers.

`Ask` is a filled pill in `accent-fill` under a white label. That is red spent
on a primary action, which is exactly the third of the three jobs `DESIGN.md`
reserves it for, and it is the only red on the screen.

```
Placeholder:   Search, or ask a question
Button:        Ask
Button, busy:  Asking
```

When the model has not been configured, **the Ask button is not drawn**. Not
disabled, not greyed, not accompanied by an explanation. The screen is today's
screen. A person cannot miss a feature they were never shown.

### Teaching the difference without a mode

The empty search screen keeps its `Popular` chip row and gains a second block
below it. Chips are the wrong container for a sentence, so these are full-width
rows in the card idiom, not chips.

```
Try asking
  Free things to do with the kids this weekend
  Somewhere to hear live music tonight
  What's on near the seafront on Sunday
```

Tapping one fills the field and submits. Three, not six: the block is a worked
example, not a menu.

### The answer strip

An answered query puts a strip above the results, on `surface-2`, full width,
using the existing overline type role for its first line.

```
IN ANSWER TO
"free things to do with the kids this weekend"
8 of 214 events in Ramsgate. Picked from the listings already here, not written.
```

The third line is not decoration. It is the honest statement of the property
`ai/search.js` actually enforces, and it is the single most useful thing the
interface can say about a model: this did not invent anything. It stays in
`ink-2` and it stays on every answered query.

Editing the query after an answer clears the strip immediately and returns the
literal results. The model is not asked again until the next submit. A stale
strip over fresh literal results would be a lie with a quotation mark in it.

### The reason line on a card

The card gains one **caption line**, between the venue and the footer, single
line, `ink-2` at 12.5. For a search result it holds the model's reason, in
`ink-2` at weight 400, behind a flat 2px vertical bar in `link` with a 6px gap.

```
┌──────┐  SAT, 11 APR, 10:00
│      │  Bunny Trail at Quex Park
│ 84px │  Quex Park, Birchington
│      │  ▌free, outdoors, good for young children     (the caption line)
└──────┘  ● Family · 4.2 mi · Free · Eventbrite
```

The bar is the typographic convention for an annotation on a line of text, it
costs no new colour, and it distinguishes a reason from the other thing that can
occupy this slot without a second treatment to learn. `link` on `surface` is
14.76:1 light and 7.78:1 dark, so it clears the 3:1 graphical bar with room to
spare.

Rejected: a small glyph in front of the reason. Every candidate glyph either
means something else in this app already, or is the sparkle that every product
on earth now puts next to a model's output. The bar says annotation without
saying brand.

**The caption line makes the card taller than its thumbnail**, and cards with one
are taller than cards without. The list goes ragged. That was accepted rather
than solved: reserving the line on every card would make the entire feed taller
for a line most rows never carry, and this app's whole layout argument is that
density survives Dynamic Type.

**The reason is model output rendered into a client.** On the web it goes through
`esc()` like every other string in `app.js`, including when it is composed into
the card's `aria-label`. It is never HTML and never an unescaped attribute.

### When the model is not used

There are four cases and only one of them says anything.

| Case | What the person sees |
|---|---|
| No key configured | No Ask button. Today's screen, exactly. |
| Query not submitted | Literal results, no strip. Today's screen. |
| `ok: true`, matches | The strip and the reason lines above. |
| `ok: true`, no matches | The strip, with its third line replaced, and an empty state. |
| `ok: false` after a submit | One muted line where the strip would be. |

The no-matches state:

```
IN ANSWER TO
"somewhere to hear live jazz on a tuesday"
None of the 214 events in Ramsgate fit that.

    [ calendar mark ]
    Nothing fits that one
    We looked at every event in Ramsgate and none of them match. Try fewer
    words, widen the dates, or search for a venue instead.
      [ Show every event ]   [ Clear ]
```

The failure state, which is the only apology in the feature:

```
Could not answer that just now. These are the literal matches for "jazz".
```

No retry button. The Ask button is still sitting in the search field and it is
the retry. And the results underneath are real results, not an error screen: the
literal search already ran, on the same query, and its answer is on the page.
That is what "the existing local search remains the floor" has to mean in
practice, and it is why the failure line is one sentence in `ink-2` rather than
the full `Lost the signal` block. Nothing is lost, so nothing is mourned.

---

## 2. The unconfirmed badge

### The word

The badge reads **Spotted locally**, which is the `source` string the extractor
already sets, so the badge and the source are the same fact rather than two
facts that can drift apart. Beside it, an `eye` glyph: SF Symbol `eye` on iOS, a
new `eye` entry in `UI_ICONS` on the web. Somebody saw this. That is the claim,
and it is the whole claim.

The badge replaces the source in the card footer. `DESIGN.md` says the source is
the quietest thing on the card because it is a trust signal and not a headline.
For this one source the trust signal **is** the headline, so it takes the same
slot with a different treatment rather than adding a slot.

### The colour, and the three colours it is not

The badge is `ink-2` text and glyph on a `surface-2` fill, with a 1px **dashed**
`hairline` border and a 5px radius.

Contrast, computed the same way as `DESIGN.md` section 3:

| Pair | Ratio | Bar |
|---|---|---|
| `ink-2` on `surface-2`, light | 5.37:1 | 4.5 |
| `ink-2` on `surface-2`, dark | 6.05:1 | 4.5 |
| `ink-2` on `surface`, light | 6.07:1 | 4.5 |
| `ink-2` on `surface`, dark | 6.89:1 | 4.5 |

**No new colour is introduced anywhere in this document.** That is the argument,
not an accident of it, and here is what was turned down to keep it.

- **Red.** The obvious choice and the wrong one twice over. It is the token that
  means today, and spending it here would make every unconfirmed event look
  imminent in a list whose entire ranking is imminence. It also reads as an
  error, and an unconfirmed event is not an error: it is probably real, and
  probably the most interesting thing in the feed.
- **A new amber or yellow.** The colour of caution everywhere else, and it
  collides head on with Markets, which is already `#a5651b` light and `#e0a75c`
  dark. A thirteenth hue that looks like the twelfth is worse than no hue.
- **Navy, as a fill.** `active-bg` is navy on light, and a navy fill in this app
  means you selected this. Borrowing it would make every unconfirmed card look
  like the one the user tapped.
- **`link` navy, as text.** The closest call. `link` is defined as links and
  secondary emphasis, the badge does hang off a link, and it passes contrast
  comfortably. Rejected because the card is a single `<button>` and a control
  cannot be nested inside another button, so a badge that looks tappable is
  promising something the card's own structure forbids. Blue text that cannot be
  pressed is a bug report waiting to be filed.

The dashed border is the drafting convention for provisional, it costs nothing,
and it is **decorative**: at 1.24:1 light and 1.33:1 dark it is exempt on exactly
the grounds `DESIGN.md` already exempts the hairlines. The badge is identified by
the words in it, not by its outline, and removing every dash would lose no
information. Do not make the border the differentiator.

The badge is quiet on purpose. In a Ramsgate feed most of the interesting rows
may be spotted locally, and a loud badge repeated down that list out-shouts the
event titles, which is the opposite of the intent. The badge names the kind of
fact. The caption line carries the warning.

### The line

```
Unconfirmed, check before you travel
```

That exact string, identical in both clients, in the caption line, `ink-2` at
12.5, **weight 600**. It has no full stop, matching the card footer and the
overline, which have none either. It is the canonical short form and it is not
paraphrased anywhere.

Where the badge and the line go, per surface:

| Surface | Badge | Line |
|---|---|---|
| Card | Footer, in the source slot | Caption line, under the venue |
| Map tray card | The `badges` row, replacing `via Spotted locally` | Under the title |
| Saved row | Footer | Under the title, above the reminder switch |
| Event detail | In the block below, not in the facts table | In the block below |
| Map pin | A dashed white collar on the pin | None. The pin has no room for a sentence, so the tray card carries it |

Precedence in the caption slot, when an unconfirmed event turns up in an AI
search result and both want it: **the warning wins and the reason is dropped.**
The slot is not made to hold two lines. An unexplained match costs a person a
moment of curiosity, and a missed warning costs them a drive to Ramsgate.

The map pin keeps its category fill, because the map is read by colour and
breaking that to say "unverified" would cost more than it buys. The 1.5px white
collar becomes dashed instead. This introduces no pairing the map does not
already have, white on the category `pin` fills, which `DESIGN.md` audits at
3.93:1 against the 3:1 graphical bar. The collar is a thinner object than the
symbol, so if that row is ever re-derived, derive it from the collar.

### The detail screen block

Below the three-column facts table, above the venue and its mini map:

```
Spotted locally
Somebody shared this with VenTrack. Nobody has confirmed it, so check with the
organiser before you travel.

See where this came from
Show the words this came from
This isn't right
```

`See where this came from` opens the original post, and is absent entirely when
the extractor had no link, replaced by `No link came with it.` in `ink-3`.

`Show the words this came from` is a disclosure, closed by default, that reveals
the `evidence` map as label and quote pairs:

```
What    Free solar eclipse glasses
        from "handing out free solar eclipse glasses"
When    Saturday, 11 April, 10:00
        from "this Saturday from 10am"
Where   The Boating Pool
        from "down at the Boating Pool"
```

Quotes in `ink-3` at 11.5, the value in `ink`. This is the single most persuasive
thing the app can show about an event it did not get from a ticket seller, and
it costs one disclosure row to a person who does not care. Closed by default
because most people will not care, and the block above already told them the
part they need.

---

## 3. The submission flow

An iOS share extension, reached from the share sheet inside whatever app the
person is reading. Two taps from Facebook, which is where they already are.

### What it receives

Text, or a screenshot. `extractEvent` takes text only, so a screenshot is put
through on-device text recognition first and the recognised text is what is
submitted. That is a real assumption and it has a real failure mode: a poster
photographed at an angle in bad light recognises badly, and the extractor's own
quote rule then throws away most of the fields, which surfaces as "we could not
find a date". The copy below is written so that reads as a sensible thing to
have happened rather than as a bug.

### Reading

```
Add to VenTrack
Reading what you shared
```

Four skeleton rows in the field geometry, the same flat `panel2` blocks the feed
already uses, pulsing opacity. No spinner, no percentage: one model call and two
verification passes is a few seconds, and `States.swift` has a whole argument
about not making a promise about a finish time we cannot keep. This one is short
enough not to need the progress bar at all.

### Confirm or correct, one screen

```
Is this right?
We read this out of the post. Change anything that is wrong.

What    [ Free solar eclipse glasses                     ]
        from "handing out free solar eclipse glasses"
When    [ Saturday, 11 April  ] [ 10:00 ]
        from "this Saturday from 10am"
Where   [ The Boating Pool                               ]
        from "down at the Boating Pool"
Price   [ Free                                           ]
        from "free"

           [ Send it in ]        [ Cancel ]

It will show in Ramsgate as Spotted locally, and everyone who sees it is told
it is unconfirmed.
```

Every field is editable and every field shows its quote underneath, in `ink-3`
at 11.5. Showing the working is what makes a one-screen confirm honest: a person
correcting a date can see what the model read it out of, and a person who sees
`from "this Saturday from 10am"` under a date knows immediately whether the
model got the right Saturday.

The footnote is not boilerplate. It is the submitter being told, before they
commit, exactly how their contribution will be labelled, which is the thing that
keeps the badge from feeling like a demotion after the fact.

**When there is no time.** The extractor drops a time it cannot parse, so this
is the one degradation that reaches a person on a successful extraction. The
When row shows the date alone and a secondary control:

```
When    [ Saturday, 11 April  ]  [ Add a time ]
        No time was given, so it will show as a date only.
```

Not a defaulted 19:00, and not an empty time field that looks unfinished. This
matches what the backend actually stores, which is a bare date, and it matches
`carboots.js` and `DESIGN.md`: null beats a guess.

**Confidence is not shown, and not used.** As section 0 sets out, a successful
extraction is always 0.8 or 0.9, so a percentage on this screen would be a number
with two possible values dressed up as a measurement. Show which fields have
evidence, which is the same information and is actionable.

### When extraction fails

No code is shown. One sentence per case, and where possible, what was found and
what was missing, so the person can re-share the part that was cut off.

```
not-an-event
  That reads like a post, but not like an event.
  If it is one, share the part that says what is happening and when.

no-date, unreadable-date
  We found the Boating Pool, but nothing that says when.
  VenTrack will not guess a date, because somebody has to travel to it. Share
  the part of the post that says when it is on.

no-place
  We found a date, but nothing that says where.
  Share the part of the post that names the place.

no-date and no-place together
  We could not find a date or a place in that.
  VenTrack will not guess either one. Try sharing more of the post.

no-title
  We could not work out what is happening.
  Share the part of the post that says what it is.

date-in-the-past
  That one has already happened.

empty-input, from a screenshot with no readable text
  We could not read any words in that image.
  A screenshot of the post's text works better than a photograph of a poster.

ai-failed
  Could not read that just now.
  Nothing was sent. Try again in a moment.        [ Try again ]

ai-not-configured
  VenTrack cannot read posts at the moment.
  This copy of the app has the reader switched off. Nothing was sent anywhere.
                                                   [ Close ]
```

Every one of those ends the flow with `Cancel`, or `Try again` where retrying is
the fix. **There is no "enter it manually".** That was the obvious escape hatch
and it was rejected: the extractor's rule that no field exists without a quote
from the source text is the only thing keeping this tier honest, and a free-text
form routes around all of it in one tap. The cost is real, a person who saw
something genuine and gets refused, and the mitigation is the found-and-missing
sentence above, which turns a refusal into an instruction.

`ai-not-configured` exists because a share extension is installed by the system
and cannot remove itself from the share sheet when a key is unset. It is the one
place in this document where a switched-off feature has to say so out loud, and
it says the only thing that matters: nothing left the device.

### Thanks

```
Thanks, that is on the list
It is showing in Ramsgate now, badged as unconfirmed. If it turns out to be
wrong, one tap takes it off.

       [ Done ]        [ Add another ]
```

That copy commits to a moderation model, so it should be stated plainly:
**submissions go live immediately and moderation removes rather than approves.**
The alternative, holding everything until a human clears it, makes the tier
useless at the speed local events actually happen. Free eclipse glasses on
Saturday, cleared on Monday, is not a feature. What makes post-hoc moderation
survivable is everything else in this document: the badge on every surface, the
warning line, the one-tap report, and the ranking rule from the plan that an
unconfirmed event never outranks a ticketed listing on a tie.

There is no account, so there is no "track your submission". A person is told
what will happen and then trusted to have gone on with their day, which is the
same bargain the app already makes with saved events and reminders.

---

## 4. Reminders on unconfirmed events

The plan forbids a silent reminder. It does not forbid the reminder, and it
should not: an unconfirmed event is usually real, and the person who saved it
knew what they were saving.

So the reminder switch appears on unconfirmed events exactly as it does on every
other saved event. Removing it would be the app deciding on somebody's behalf
that they cannot be trusted with a caveat they have already read twice.

**Turning it on raises a sheet, once per event.**

```
This one is unconfirmed
Nobody has checked that Free solar eclipse glasses is happening. If you set a
reminder, we will say so again when it arrives.

       [ Set it anyway ]        [ Not now ]
```

Once per event, not once ever and not every time. Once ever means the fifth
unconfirmed reminder is silent, which is the thing the plan forbids. Every time
is nagging, and nagging is how a warning stops being read.

**The notification carries the warning in its title**, not its body, because a
lock screen truncates the body and the caveat is the part that must not be the
part that gets cut.

```
Unconfirmed: Free solar eclipse glasses
Starts 10:00 at the Boating Pool, Ramsgate. Nobody has confirmed this one, so
check before you travel.
```

Lead time stays at two hours, the same as every other reminder. A different lead
time for unconfirmed events would be a second rule to hold in your head for no
benefit anybody could name.

**When the event is pulled after it was saved.** Reminders are local
notifications and everything lives on the device, so this is only noticed on the
next launch, when the feed no longer contains it. The Saved row then shows:

```
This was taken down after you saved it. It may not be happening.
Reminder cancelled
```

and the pending notification is cancelled. The gap is honest and unresolved: if
the app is never opened between the takedown and the reminder, the reminder
fires anyway. Fixing that needs a push token and a server that knows about a
device, which is an account by another name and a much larger decision than this
feature. It is on the placeholder list at the end.

---

## 5. The report action

One tap. It lives in the unconfirmed block on the detail screen, under the
provenance disclosure, and it is scoped to unconfirmed events only.

```
This isn't right
```

The plan's own words, and better than any label a designer would reach for.
"Report" invites a form. "Flag" is a bird-watching verb. "This isn't right" is
what a person actually thinks, and the apostrophe is doing real work: it is the
one string in the app that sounds spoken.

Tapping it does not ask why. **No categories, no free-text box, no confirm
dialogue.** An interrogation converts a two second civic act into a chore, and it
buys nothing: the moderator can open the original post and see for themselves,
which is faster than reading somebody's guess about what was wrong with it.

In place of the block, immediately:

```
Thanks. It is off your list. If two people say the same, it comes off
everyone's.        Undo
```

`Undo` is an inline text button and it stays for as long as the screen is open,
not for eight seconds. A one-tap action with no confirmation needs an escape
hatch that is not a race, and a person who taps by accident is exactly the
person who will not be watching a timer.

The event is hidden on the reporting device straight away, using the same local
mechanism as saved events. It comes off the shared feed at two independent
reports. **Two is a placeholder**, chosen to match the plan's corroboration rule
in the other direction, and it needs to be set against real volume before this
is public. One report pulling an event for everyone is a heckler's veto. Five is
a number nobody will reach in a town of forty thousand people.

---

## 6. Moderation

A web queue, served from `api/public` like the rest of the web client, in the
web client's own visual language. Same tokens, same card geometry, same
stylesheet. It is one more page in an app that already exists, not a product.

**Getting in.** A single shared key, pasted once and kept in `localStorage`,
sent on each request. No accounts, no sessions, no roles.

```
Paste the moderation key
The key is kept on this device only.
```

Building authentication for a queue one person clears is the wrong trade at this
size, and the right time to revisit it is the first time a second person needs
access, not before.

**The page.**

```
Spotted locally
12 waiting, oldest 2 days
```

Each row is **the card exactly as a person would see it in the feed**, badge,
caption line and all, so the moderator is judging the thing that will be
published rather than a database row. Under it, the same evidence table as the
detail screen's disclosure, open by default here, plus the three facts a
moderator needs that a reader does not:

```
Submitted 2 days ago · confidence 0.9 · placed by postcode · 0 reports
```

`placed by postcode` comes from the geocoder's own `precision`, and it is worth
showing because a gazetteer match and a postcode match are different degrees of
sure about where somebody is being sent.

Then, per row:

```
[ Confirm ]   [ Remove ]   Open the post
```

`Confirm` is `btn-primary`, which is `accent-fill` under a white label at 5.88:1
light and 5.24:1 dark. It is the primary action on the screen, so it is the
correct place for the app's rationed red. `Remove` is `btn-ghost`. The
destructive action being the quieter of the two is deliberate: removing is
reversible from the database and confirming is what actually publishes something
to strangers.

`Confirm` promotes the event out of unconfirmed, which is what the plan's
corroboration rule does automatically at two independent submissions. The button
is the manual path to the same state, not a second state.

**Empty state**, in the house voice:

```
    [ check mark ]
    Nothing waiting
    Everything spotted locally has been looked at.
```

**Keyboard.** This is a queue, and a queue is used with two fingers on the home
row rather than a mouse: `j` and `k` move, `c` confirms, `r` removes, `u` undoes
the last action. The buttons remain real `<button>` elements with accessible
names, per `DESIGN.md` section 8, and the shortcuts are additional rather than
instead of.

**Deliberately absent**: pagination beyond the newest fifty, search, filters,
sorting, bulk selection, and any statistics. Every one of those is a thing to
build and maintain for a list that should be short. If the queue is ever long
enough to need filtering, the problem is the queue, and the answer is the
corroboration rules in the plan rather than a better tool for clearing it by
hand.

---

## 7. Accessibility

### Contrast

No new colour is introduced, so the audit is of existing tokens in new roles.
All computed the same way as `DESIGN.md` section 3, at 4.5:1 for text and 3:1 for
graphical objects.

| Pair | Where | Ratio | Bar |
|---|---|---|---|
| `ink-2` on `surface-2`, light | Badge label and glyph | 5.37:1 | 4.5 |
| `ink-2` on `surface-2`, dark | Badge label and glyph | 6.05:1 | 4.5 |
| `ink-2` on `surface`, light | Caption line, both kinds | 6.07:1 | 4.5 |
| `ink-2` on `surface`, dark | Caption line, both kinds | 6.89:1 | 4.5 |
| `ink-2` on `bg`, light | Answer strip third line | 5.67:1 | 4.5 |
| `ink-2` on `bg`, dark | Answer strip third line | 7.62:1 | 4.5 |
| `link` on `surface`, light | Reason bar | 14.76:1 | 3 |
| `link` on `surface`, dark | Reason bar | 7.78:1 | 3 |
| `ink-3` on `surface`, light | Evidence quotes | 5.10:1 | 4.5 |
| `ink-3` on `surface`, dark | Evidence quotes | 5.28:1 | 4.5 |
| White on `accent-fill`, light | Ask, Send it in, Confirm | 5.88:1 | 4.5 |
| White on `accent-fill`, dark | Ask, Send it in, Confirm | 5.24:1 | 4.5 |

Two things sit below 3:1 and are exempt on the same grounds as the existing
hairlines: the badge's dashed border (1.24:1 light, 1.33:1 dark on `surface`) and
the `surface-2` badge fill against the card (1.09:1 light, 1.17:1 dark). Both are
decorative. The badge is identified by its words, and if every dash and every
fill were removed the interface would lose no information. That is the test, and
it is the reason neither had to be solved with a colour that does not exist yet.

Note the pattern `DESIGN.md` warns about holds here too: the worst case for text
is `surface-2`, not `surface`, and `surface-2` is where the badge lives.

### VoiceOver and screen readers

The card is one button, so the caption line is not separately focusable and the
composed accessible name is the whole design. Order matters: the caveat goes
immediately after the title, so it is heard before somebody decides to act, and
before the footer meta they may well skip.

```
Free solar eclipse glasses. Unconfirmed, check before you travel. Saturday, 11
April, 10:00. The Boating Pool. Things to do. 0.4 miles. Free. Spotted locally.
```

The reason line takes a prefix, because "free, outdoors, Saturday morning" read
out with no frame is a fragment nobody can place:

```
Matched because free, outdoors, good for young children.
```

Composed into the same name, after the title, in the slot the warning would
otherwise have taken. Both never appear, per the precedence rule in section 2.

The badge's glyph, the reason's `link` bar and the dashed border are all
decorative and carry nothing the name does not: `accessibilityHidden(true)` on
iOS, `aria-hidden="true"` on the web, exactly as `CategoryArtwork` and the
category dots already are.

Everything tappable is a real button with a name, per `DESIGN.md` section 8, and
that specifically includes `This isn't right`, `Ask`, `Undo`, the evidence
disclosure (`aria-expanded`), and the queue's `Confirm` and `Remove`. The
reminder switch on an unconfirmed event keeps `role="switch"` and
`aria-checked`, and takes an extended label:

```
Remind me two hours before. This event is unconfirmed.
```

The answer strip is a live region on the web, announced once when an answer
lands, so a screen reader user who pressed Ask is told that something happened
rather than discovering it by exploring.

### Dynamic Type

Both clients set text with the same scaling calls as the rest of the app, so the
new lines grow with everything else. Two rules govern what happens when they
outgrow their space, and they are deliberately opposite:

- **The warning line never truncates.** It wraps, to as many lines as it needs, at
  every size. A safety line cut off at "Unconfirmed, check before you tra..." is
  worse than no line, because it looks like the app tried.
- **The reason line always truncates, to one line, at every size.** It is a
  nicety, and 120 characters of model output at an accessibility size would push
  the title, the venue and the footer off a phone screen to explain a match the
  person can see for themselves.

At the largest accessibility sizes the card's 84pt thumbnail is dropped in favour
of the 4pt category spine, and the text column takes the full width. That
mechanism already exists for the iPad two-up grid, so this reuses a decision
rather than making a new one, and it is the only way the footer plus a wrapped
warning line fits. The footer is where `DESIGN.md` predicts the card will break
first under Dynamic Type, and adding a line above it is exactly the change that
proves the prediction, so test there first.

Under Reduce Motion the skeleton rows in the share extension and the search
results stop pulsing and render flat at 0.8 opacity, matching the app's existing
loading behaviour. Nothing in this feature animates otherwise, because nothing in
this app does.

---

## 8. Where these surfaces live

Following `DESIGN.md` section 8, so the next person does not have to search.

| You want to change | Web | iOS |
|---|---|---|
| The badge and the caption line | `cardHTML` in `app.js`, new `.badge-unconf` and `.caption` rules | `EventCard.swift` |
| The `eye` glyph | a new entry in `UI_ICONS` in `app.js` | SF Symbol `eye`, inline |
| Ask, the answer strip, the failure line | `renderSearch` in `app.js` | `SearchView.swift` |
| The `Try asking` block | `renderSearch`, beside the `Popular` chips | `SearchView.swift` |
| The unconfirmed detail block and evidence | the detail renderer in `app.js` | `EventDetailView.swift` |
| The reminder sheet and notification copy | not applicable, no reminders on web | `SavedView.swift`, `AppState.swift` |
| The share extension | not applicable | a new extension target, new to `project.rb` |
| The moderation queue | a new page in `api/public` | not applicable |

The web client is still the faster loop, and every surface here except the share
extension exists on it. Try it there first.

---

## 9. Deliberately placeholder

In the same spirit as `DESIGN.md` section 6. These are known gaps, not oversights.

**The name for the feature.** There is a button that says `Ask` and a strip that
says what it did. There is no product name for AI search, no badge, no "powered
by" line, and nothing anywhere calls it AI except the one honest sentence in the
strip. That is a deliberate absence for a first pass rather than a decision that
naming it would be wrong.

**The reason line's voice.** The model is asked for twelve words of British
English and it will do roughly that, but nobody has read a hundred of them in a
row on a real feed. The prompt is where that gets fixed, and it will not be
obvious what to fix until the lines are sitting under real titles.

**"Spotted locally" as a phrase.** It is good, it is short and it is not
researched. It has to work as a source name, a badge and a page title in the
moderation queue, and it has only been tested against the first two.

**The report threshold.** Two independent reports pulls an event, and two is a
guess. So is the promotion rule's two independent submissions. Both need real
volume behind them before this is public.

**Push, and the takedown a saved reminder never hears about.** Section 4 is
honest about the gap and does not close it. Closing it needs a device token and
a server that remembers devices, which is an account in all but name, and the
app currently has no account by design.

**The screenshot path.** On-device text recognition is assumed and its failure
mode is written into the copy, but nobody has run a photographed A4 poster in a
pub window through it. That is one afternoon of testing and it will probably
change the copy in section 3.

**Empty and loading states for the new surfaces.** They follow the house voice
established in `States.swift`, which `DESIGN.md` already lists as functional and
characterless. These inherit both the voice and the criticism.

**The moderation queue's visual design.** It is the web client's components
rearranged, on purpose, and it will look like it. That is the correct amount of
design for a page one person opens once a day, right up until a second person
has to use it.
