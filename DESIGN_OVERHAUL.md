# VenTrack: visual overhaul brief

A brief for a complete redesign of the VenTrack interface. The app works; this
is about how it looks and feels, not what it does.

Read this alongside `DESIGN.md`, which describes the product, the audience and
the decisions already made. That document explains *what* the app is. This one
says what is wrong with how it currently looks and what to do instead.

Read it alongside the running app rather than from memory:

```bash
cd api && npm start          # then http://localhost:3000 in a narrow window
open ios/VenTrack.xcodeproj  # the real target, iPhone only
```

---

## 1. The one sentence

It should feel like an app Apple would ship: quiet, confident, typographic,
obviously native, with nothing decorative that is not doing work.

It currently feels like a competent template. That is the gap to close.

---

## 2. Three hard constraints

These are not preferences to be balanced against other goals. A design that
breaks any of them is not a candidate.

### No gradients. Anywhere.

Not in backgrounds, not in buttons, not as a scrim over a photograph, not as a
shimmer on a loading state, not a "barely visible" one. Every fill is a flat
colour.

Translucency is not a gradient and is allowed: `.ultraThinMaterial` behind a
navigation bar is a native blur, and it stays. The distinction is that a
material samples what is behind it, while a gradient invents a ramp.

### No purple and no pink.

This is currently violated in specific, findable places, and it is the single
biggest reason the app reads as generic. In `ios/VenTrack/Design/Theme.swift`:

| Token | Value | Problem |
| --- | --- | --- |
| `accent` (dark) | `0xF4707F` | salmon pink, the app's primary accent in dark mode |
| `accentFill` (dark) | `0xC8324A` | rose |
| `clubs` | `0xAC8BF2` / `0x6D3FC4` | purple |
| `comedy` | `0xE58FCE` / `0xB23A8C` | magenta |
| `theatre` | `0xE07FA5` / `0x9C2F5E` | pink |
| `film` | `0x949AE8` / `0x4A4F9E` | purple-blue |
| `festivals` | `0xF4707F` | pink |

Five of thirteen category colours plus the dark-mode accent. The light theme is
already close to right: `0xC8102E` and `0x012169` are the reds and blues of the
Union flag, which is a defensible place for a British app to start. The dark
theme drifted into pink because the flag red was too dark against a dark panel,
and the fix was to lighten it rather than to re-pick it. Re-pick it.

### No emoji, no em dashes.

Both are now clear in the app. Do not reintroduce either.

The interest grid used to carry twelve emoji and the sort control two more; all
fourteen are now SF Symbols. Emoji render in their own font, at their own
weight, in someone else's palette, and they ignore tint and Dynamic Type, which
made those two screens the only places the interface changed character.

Two em dashes remain in the codebase and are correct: they are inside regular
expressions in `DateQueryParser.swift` and `webapp/app.js` that parse date
ranges like `Sep 3—5` out of scraped listings. They are input the parser
accepts, never text anyone sees. Leave them.

---

## 3. What is actually wrong now

Diagnosis, so the redesign solves real problems rather than restyling arbitrary
things.

**Everything is a rounded rectangle at the same radius.** Cards, chips, wells,
buttons and sheets all sit at roughly 12 to 14 points. Nothing establishes
hierarchy, so a twenty item feed reads as twenty equally important slabs.

**The panels do the work that type should do.** Almost every element sits on its
own filled `panel` background with a hairline border. The result is busy, and it
is why the app feels like a dashboard rather than a reading surface. Native iOS
leans on whitespace, weight and a single hairline, not on boxes.

**The type scale is too flat and too small.** Sizes cluster between 12 and 14.5
with weights of semibold and bold. There is no display size, so nothing anchors
a screen, and no genuinely quiet size, so nothing recedes.

**Density is uniform.** A card gives the same space to the event title, the
venue, the distance and the price. The title should dominate; the rest is
supporting metadata.

**Category colour is applied as decoration.** Thirteen hues appear at similar
saturation across cards, pins, chips and washes. It reads as a colour-coded
spreadsheet. Colour should be an accent within a card, not the card's identity.

**Nothing is ever tactile.** No press states worth the name, no haptics, no
considered transitions. Native apps feel responsive because of a hundred small
acknowledgements, and this has almost none.

---

## 4. Direction

Not prescriptive. Show alternatives if you see something better.

### Colour

Start from a near-neutral base with one restrained accent. The subject matter
is already colourful: every event carries a photograph. The interface should
recede so those photographs carry the colour.

- A dark theme that is genuinely dark and slightly cool, not navy-tinted grey.
- A light theme that is warm white rather than blue-white.
- One accent, used sparingly, legible on both themes without becoming pink when
  lightened. A deep British red works if the dark variant is desaturated rather
  than tinted toward salmon.
- Category colour reduced to a small mark or a short rule, not a wash behind
  a whole card. Consider whether thirteen distinct hues are needed at all;
  five or six families with shared tones would be calmer and just as legible.

### Type

Take a real position on it. Either SF Pro used properly with a full scale, or a
single well-chosen face for display sizes against SF for the body. What the app
must not keep is the current situation, where everything is 13pt semibold.

There should be an obvious display size, an obvious body, and an obvious caption
that genuinely recedes. Support Dynamic Type throughout.

### Layout

- Let the feed breathe. Fewer borders, more space, hairlines only where a
  boundary is genuinely ambiguous.
- Give the event title real prominence.
- Make distance and time, the two axes the whole app ranks on, immediately
  scannable without being loud.
- Establish a radius scale rather than one radius: sheets, cards and chips
  should not all be 12.

### Motion and feel

- Meaningful transitions between feed, detail and map.
- Real press states.
- Haptics on the actions that matter: save, unlock, changing town.
- Skeletons that suggest the shape of what is loading, flat and without a
  shimmer sweep, since a sweep is a gradient.

---

## 5. Screens, in priority order

1. **Discover** the feed. The app. Ninety per cent of use.
2. **Event detail** where the photograph should carry the screen.
3. **Onboarding** the first impression, and the twelve cell interest grid.
4. **Map** currently the weakest screen visually.
5. **Saved** and **Search**.
6. **Paywall** it has to feel worth paying for. See section 7.
7. **Preferences**.

---

## 6. What must not change

Structural and commercial decisions, not aesthetic ones.

- **iPhone only, portrait only.** There is no iPad layout, deliberately: the
  sibling app was rejected under Guideline 4 for claiming iPad support it did
  not honour. Do not design one without also building it.
- **The two ranking axes**, distance and imminence. Any redesign has to make
  both legible on every card.
- **The freemium gates** exactly where they are: three saves free, one week of
  range free, own town free. Other towns, longer ranges, unlimited saves and
  reminders are paid. See `PaywallView.swift` and `AppState.swift`.
- **The free tier has to be genuinely useful.** The gates should read as an
  honest boundary, never as a crippled app.
- **British English** throughout. "What's on", not "events near you".
- **Accessibility.** Contrast at AA or better, VoiceOver labels intact, Dynamic
  Type honoured. The current app does this reasonably; do not regress it.

---

## 7. The paywall deserves special attention

It is where the product asks for money, and it currently looks like every other
screen with a price on it.

It appears in five contexts, each with its own headline (`UnlockReason` in
`PaywallView.swift`): saving beyond three, extending the date range, browsing
another town, setting reminders, and a general entry point. The design should
make each feel like a natural next step from what the person was just doing,
rather than five routes to one generic wall.

One purchase, non-consumable, restorable. No subscription, no tiers, no dark
patterns, no fake urgency, no countdowns.

---

## 8. Deliverables

1. A colour system, both themes, as hex tokens mapped to the existing names in
   `Theme.swift` (`bg`, `panel`, `panel2`, `hairline`, `text`, `muted`, `faint`,
   `accent`, `accentFill`, `link`, `activeBg`, `activeFg`, plus the category
   map). Keeping the token names means the redesign lands as a palette change
   rather than a rewrite.
2. A type scale with sizes, weights and intended use.
3. A spacing and radius scale.
4. High fidelity screens for the seven above, both themes, iPhone.
5. Component specifications for the event card, chips, the sort control, sheets,
   buttons, empty states and loading states.
6. Notes on motion and haptics.

Both clients share the palette: the SwiftUI app in `ios/VenTrack/Design/` and
the web app in `api/webapp/styles.css`. Deliver tokens once, in a form that maps
cleanly onto both.

---

## 9. How to check the result

- Screenshot it next to Apple's own apps. Does it look like it belongs?
- Turn it greyscale. Does the hierarchy still hold? If it collapses, the design
  is leaning on colour instead of structure.
- Look at a feed of twenty events. Can you find the closest one, and the
  soonest, in under two seconds?
- Search the design for a gradient, a purple, a pink, an emoji and an em dash.
  All five counts should be zero.
