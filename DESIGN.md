# VenTrack: design brief

A brief for designing the VenTrack interface for the United Kingdom market.

The app is built and working. This document exists so a designer can take it
somewhere better without having to reverse-engineer the intent from the code.
It describes what VenTrack is, who uses it, what has already been decided and why,
what is deliberately a placeholder, and where the real design work is.

Read it alongside the running app: `cd api && npm start`, then open
`http://localhost:3000` on a phone or a narrow browser window. That is the
current state, not a mockup.

---

## 1. The product

VenTrack answers one question: **what is on near me, soon?**

Someone opens it with a free evening and no plan. They want a scannable list of
real things happening tonight or this weekend, close enough to get to, with
enough detail to decide and a link to buy. They are not browsing a catalogue and
they are not researching. The whole app is built around ranking by two axes,
distance and imminence, and everything else is secondary.

It covers the United Kingdom only: 454 curated towns and cities, at least one
per ceremonial county in England, per principal area in Wales, per council area
in Scotland and per traditional county in Northern Ireland. There is no
worldwide fallback. Someone who opens it abroad is shown London and told why.

Two clients share one backend and one design language:

- **iOS** (`ios/`), SwiftUI, iPhone and iPad, iOS 17 and up
- **Web** (`api/webapp/`), a vanilla-JS installable PWA. It is a development
  and design tool now rather than a shipped product: the public site at
  `api/public/` is a landing page, and the web app is only served when
  `SERVE_WEB_APP` is set. See `api/README.md`.

They are not a shared codebase, so a design decision has to be expressible in
both. Anything that only works in one is not a design decision, it is a
platform detail.

## 2. Who it is for

Assume a UK adult picking something to do in the next few days. Practically:

- They think in **miles**, not kilometres.
- They write **25/7** and mean the 25th of July.
- They say **gig**, **what's on**, **half seven**, **the weekend**. Not
  "concert", "events near you", "7:30 PM".
- Prices are in **pounds**, and "Free" is a strong signal worth surfacing.
- Football is a first-class category, not an afterthought. So are comedy,
  club nights, markets and museum lates.
- Many are on older Android handsets or an iPhone with Dynamic Type turned up.
  Density has to survive that.

## 3. What is already decided, and why

These are not arbitrary. Changing one is fine, but change it knowingly.

### Palette: the Union flag, used with discipline

The brand is British without being a flag graphic. The palette is drawn from
the flag but the two colours are given different jobs rather than equal weight.

**Navy is the interface colour.** Every selected state, every filled chip, the
primary text. It carries the structure.

**Red is rationed to three things:** the logo, the primary action, and anything
happening today. That is what stops the screen becoming a wall of buttons, which
is exactly what the first version looked like.

Neither flag colour survives a straight lift into a dark interface, so the dark
theme swaps the roles: near-white carries selection, and the red is lifted to
read against the page. The dark page itself is a neutral slate rather than a
darkened flag blue. A saturated navy at that value glares on an OLED screen at
night and tints every photograph on the list.

| Token | Light | Dark | Job |
|---|---|---|---|
| `bg` | `#f6f7fb` | `#141926` | Page |
| `surface` | `#ffffff` | `#1c2231` | Cards, sheets |
| `surface-2` | `#eef1f7` | `#252c3d` | Wells, search field, skeletons |
| `hairline` | `#e3e7f0` | `#2f3749` | Borders, rules |
| `ink` | `#0b1633` | `#e4e7ee` | Primary text |
| `ink-2` | `#59627b` | `#a3abbd` | Secondary text |
| `ink-3` | `#686e7e` | `#8d95a7` | Overlines, tertiary |
| `accent` | `#c8102e` | `#f4707f` | Logo, today, indicators. **Text weight** |
| `accent-fill` | `#c8102e` | `#c8324a` | The same red as a filled background under a white label |
| `link` | `#012169` | `#9db6e8` | Links, secondary emphasis |
| `active-bg` / `active-fg` | `#012169` / `#ffffff` | `#e4e7ee` / `#161b27` | Selected chips and pills |

Light red is Pantone 186, light link is Pantone 280. Both are the flag colours
unmodified.

`accent` and `accent-fill` are one colour on light and two on dark, because on
dark the red has to do two opposite jobs: be light enough to read as text on
the dark page, and dark enough to carry a white label when it is the
background. No single value does both. On light, Pantone 186 already carries
white at 5.9:1, so the two tokens are the same and the split costs nothing.

Defined in two places that must stay in step: `api/webapp/styles.css` (the
`:root` and `[data-theme="light"]` blocks) and `ios/VenTrack/Design/Theme.swift`
(`enum Tok`).

**Contrast, audited.** Every token pair was checked against WCAG 2.1 using
computed relative luminance, at 4.5:1 for text (1.4.3) and 3:1 for graphical
objects (1.4.11). It passes at both bars. The dark figures below were re-audited
against the revised dark palette; the light ones are unchanged. The tightest
margins, which are the ones to re-check if you change anything:

| Pair | Ratio | Bar |
|---|---|---|
| `ink-3` on `surface-2`, light | 4.50:1 | 4.5 |
| `ink-3` on `surface-2`, dark | 4.64:1 | 4.5 |
| `accent` on `surface-2`, dark | 4.96:1 | 4.5 |
| White on `accent-fill`, dark | 5.24:1 | 4.5 |
| Category glyph on its own wash, light | 3.04:1 | 3 |
| Category glyph on its own wash, dark, worst case | 3.68:1 | 3 |
| White symbol on a map pin | 3.93:1 | 3 |

Dark `ink-3` is `#8d95a7` rather than the lighter-looking `#8a92a4` the handoff
proposed, because `#8a92a4` measures 4.47:1 on `surface-2` and fails 1.4.3 by a
hair. The map pin is unchanged in both themes: the pins use the light mid-tones,
so the revised dark palette does not touch that number.

Two things are deliberately below 3:1 and are exempt rather than overlooked:
the hairlines (1.33:1 dark, 1.24:1 light). They are decorative dividers, not
component boundaries. A card is identified by its surface against the page, not
by its border, so removing every hairline would lose no information.

Note the worst case for text is almost always `surface-2`, not `surface`. It is
the search field and the skeleton, and it is easy to forget it exists.

### Category colours

Twelve hues, restrained rather than a default rainbow, anchored on red for
festivals and blue for music. In `Categories.map` (Swift) and `CATS` (JS).

Each category is **two** values, not one, for the same reason the accent is:

- **`color`** is theme-adaptive. It is the 6px dot in the card footer, the card
  wash, the drawn artwork on an event with no photo, and the category mark. The
  dark variant is a lifted version of the light mid-tone, because the mid-tones
  are far too dark to read on the dark surfaces.
- **`pin`** is the light mid-tone, fixed in both themes. It is the map marker
  fill, and a white SF Symbol sits on it. The lifted dark hues carry white at
  only 2:1 to 3:1, so the marker cannot use them.

The wash is that colour at low alpha, and the alpha differs by theme: 0.20 dark,
0.12 light. That is not a taste decision. The category mark and the artwork are
drawn in the same hue on top of the wash, so the wash has to stay far enough
from them to keep 3:1, and the light surfaces have less room. If you make the
light wash stronger, the mark disappears into it.

### Typography

System stack on both platforms. No web fonts: the iOS app must not depend on a
CDN, and the PWA has to work offline once installed.

One typographic device does most of the work: a **small, letter-spaced,
uppercase overline** above a title, saying when the thing is on. It replaced a
sticker date badge on the thumbnail and reads far better.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Page title | 27 | 700 | Tight tracking, carries the place name |
| Card title | 16 | 650 | Two lines max, tight tracking |
| Body, venue | 13 to 15 | 400 | |
| Overline | 10.5 | 700 | Uppercase, 0.08em tracking |
| Footer meta | 11.5 | 400 to 600 | Dot separated |

### Layout

Editorial rather than boxy. The place is a page title, not a caption. Cards are
a thumbnail plus a text column, not a poster. Distance is quiet reference
detail in the footer, not a large number competing with the event name.

### The mark

A map pin with a pulse trace knocked out of it as a counter, drawn as a single
path filled even-odd. It is the handoff's option **1b, Beacon**, and it replaced
the first pass at an identity, option 1a, a filled dot under two rising arcs.

"Pulse trace" here names the heartbeat line in the artwork, not the product. It
was a pun on the old name and is now just a description of the shape, so it
survives the rename to VenTrack and should not be edited out of the drawing
code or of this section.

The handoff recommended 1a and the recommendation was reasonable: three
separated shapes hold together at small sizes better than a silhouette with a
counter cut out of it does. It was rejected anyway, because in the app it read
as a wifi symbol, and a mark that says "signal strength" on a listings app is a
worse failure than a mark that is hard to draw small. Being generic is
recoverable. Being wrong is not.

That trade is real and is not resolved. The header uses the mark at 18pt, and at
that size the trace is close to the limit of what survives; go much below it and
the counter starts to fill in. It holds everywhere the app currently puts it,
and it is the first thing to check if the mark is ever put somewhere smaller.
If a future pass finds a reading of the two axes that does not resemble a wifi
glyph, it is worth revisiting; 1b is a decision made under a real objection, not
a preference.

One geometry, mirrored by hand in **six** places, all of which have to move
together:

- `ios/VenTrack/Design/Theme.swift`, `VenTrackLogoGeometry`, the in-app mark as
  a SwiftUI `Shape`
- `ios/tools/make_icon.js`, which rasterises the App Store icons
- `ios/tools/make_icon.swift`, the CoreGraphics twin of that tool
- `api/public/icon.svg`, the site and home screen icon
- the inline `<svg>` in the header of `api/public/index.html`, the landing page
- the inline `<svg>` in the brand strip of `api/webapp/index.html`, the web app

The last two are the ones that actually render, and the web one was missing from
every cross-reference in the codebase for a while, so a change to the mark landed
everywhere except the place a user sees it. If you touch the geometry, start by
listing all six.

## 4. Hard constraints

These are product decisions and are not up for grabs without a conversation.

- **No gradients.** Every fill in both clients is a flat colour. Category
  washes, hero scrims, the loading skeleton and the map overlay were all
  gradients and were deliberately made solid.
- **No emoji**, with one exception: the twelve interest filter chips in the iOS
  onboarding and preferences, where they make the grid scannable at a glance.
  Everywhere else uses SF Symbols on iOS and inline SVG on the web, so nothing
  depends on an emoji font or shifts weight between platforms. The web app has
  no emoji at all.
- **No em dashes, en dashes or arrow glyphs** in any user-facing copy.
- **Miles**, `en-GB` dates, `£` prices.
- **Light and dark both first-class.** The web app has a manual toggle and
  defaults to dark; iOS follows the system.
- **iPhone, iPad and web.** The iPad layout is a real regular-width design with
  a sidebar and a grid, not a stretched phone. It has to stay that way: shipping
  iPhone-only got the predecessor app rejected under App Store Guideline 4.

## 5. Screens

Every screen exists and works. Purpose, then what it must show.

**Onboarding**, three mandatory steps. Value proposition, location priming with
an honest explanation of why, then interests. It is the only place emoji are
allowed.

**Discover**, the main screen. Brand strip, page title naming the town, sort
(Nearest or Soonest), a date-range row (All upcoming, Today, This weekend, This
week), a category row built from whatever is actually in the feed, a status
line, then the card list. A floating Map button. When the user is outside the
UK, a notice explaining that London is being shown.

**Event card**, the most-used component. Thumbnail, overline saying when, title
over two lines, venue, and a footer of category, distance, price and source. A
bookmark control, which is a separate button sitting over the card rather than
inside it. The photo often fails to load or was never there, so drawn category
artwork sits underneath it and shows through rather than leaving an empty box.
The map tray card and the iOS card do the same; anything new that shows a photo
should too.

The artwork is set out in `ios/VenTrack/Design/CategoryArtwork.swift`, which is the
reference for both clients. Twelve motifs, each a composition rather than an
enlarged icon, because a column of identical music notes still reads as missing
data: an equaliser for music, bunting for festivals, pitch markings for
football, a market awning, an arcade for museums, a curtain and swag for
theatre, sprocket holes for film, and so on down to a run of diagonal tiles for
anything that could not be placed. Flat shapes only, the category colour at
varying alpha over its own wash, with the small category mark in the bottom
corner to name it. Some motifs are shared on purpose: football and sport are the
same idea, and inventing a distinction the palette does not make would be worse
than repeating one.

Two rules hold it up. A motif's layout varies per event but is **deterministic
in the event id**, so a card keeps its artwork between redraws and between
launches rather than reshuffling as you scroll. And it carries **nothing a
screen reader needs**, so it is hidden from assistive technology; the category
is already in the footer as text.

What this replaced was no thumbnail at all and a 4pt colour spine in its place.
Those rows looked poorer than the ones either side, and a feed drawn mostly from
sources that carry no images looked broken rather than sparse. The spine
survives where it was actually the right answer, which is a cell too narrow for
a thumbnail: in practice, the iPad two up grid.

**Map**, category-coloured pins with clustering, the user's position, a preview
on tap, and a card tray along the bottom.

**Event detail**, hero, category label, title, description, a three-column facts
table (When, Distance, Price), the venue with a mini map and directions, Share,
Calendar, Save, and a sticky primary action linking out to the source.

**Saved**, grouped by day, each with a "remind me two hours before" toggle.
No account: everything is local to the device.

**Search**, live filter over title, venue and category, plus date phrases
("this weekend", "25/7", "next friday") and UK address lookup that re-centres
the whole feed.

**Preferences**, interests, and a location picker over all 454 towns grouped by
nation and county with a filter field.

**Unlock**, the one purchase screen. VenTrack is free to download; browsing
towns other than the one you are in, looking past the next seven days, and
keeping more than three saved events with reminders are behind a single
non-consumable purchase. The sheet takes an `UnlockReason` and leads with the
gate the user actually walked into, rather than opening on a generic feature
list.

This is the screen most likely to be designed badly, so the constraint is worth
stating: **no countdown, no crossed-out price, no "most popular" badge on a
single product, no dark pattern on the dismiss.** There is one thing to buy and
one price. On a utility, an honest presentation of that outperforms a sales
page, and the current version is plain on purpose rather than for want of
effort. What it could use is warmth, not urgency.

Locked controls carry a small padlock and stay tappable, because a control you
can see and understand is a better offer than one that silently is not there.
`LockBadge` is that padlock, and it is the same on the range pill, the town
rows, the address row and the reminder switch.

Every list screen needs **loading, empty and error** states. They exist and are
plain; they are a good place to add character.

## 6. Deliberately placeholder

**The wordmark.** There is a mark, described above, and it is a real decision.
There is no drawn wordmark to go beside it: "VenTrack" is set in the system
font like any other page title. A mark without a wordmark is half an identity.

**The name.** "VenTrack" is recent and replaced the working name "Pulse". It is
not researched and not trademark-cleared.

**The category icon set.** Twelve hand-drawn line icons on the web
(`ICON_PATHS` in `app.js`) paired with SF Symbols on iOS. They are serviceable
and inconsistent with each other.

**The empty and loading states.** Functional, characterless.

## 7. What would most improve it

In rough order of value:

1. A wordmark to sit beside the mark, and a decision on whether the flag palette
   is the right long-term call or a first-release shortcut.
2. The card. It is the screen. Everything else is chrome around a list of them.
3. The rest of the photo strategy. The no-photo case now has drawn artwork, but
   the poor-photo case does not: a small, badly cropped, low contrast image
   still gets shown as though it were a good one, and it is often worse than the
   artwork it covers. A rule for rejecting an image would use work already done.
4. Density and Dynamic Type. Test at the largest accessibility sizes; the card
   footer is where it will break first.
5. Empty states with a point of view.

## 8. Working with the code

| You want to change | Web | iOS |
|---|---|---|
| Colour tokens | `api/webapp/styles.css` top block | `ios/VenTrack/Design/Theme.swift`, `enum Tok` |
| Category colours and icons | `CATS` and `ICON_PATHS` in `api/webapp/app.js` | `Categories` in `Theme.swift` |
| Interface icons | `UI_ICONS` in `api/webapp/app.js` | SF Symbol names inline |
| The card | `cardHTML` in `app.js`, `.card` in `styles.css` | `ios/VenTrack/Views/EventCard.swift` |
| No-photo artwork | the card renderer in `app.js` and `.card` art rules in `styles.css` | `ios/VenTrack/Design/CategoryArtwork.swift` |
| The logo | `api/public/icon.svg` **and** the inline brand marks in `api/public/index.html` and `api/webapp/index.html` | `VenTrackLogoGeometry` in `Theme.swift`, then `node ios/tools/make_icon.js`, keeping `make_icon.swift` in step |
| Screen layout | `api/webapp/index.html` | `ios/VenTrack/Views/` |
| The unlock sheet and padlocks | not in the web app | `ios/VenTrack/Views/PaywallView.swift` |

The web client is the faster loop and renders in a headless browser, so it is
the sensible place to try something before porting it to SwiftUI.

Six things to know before touching the code:

- A `<button>` does not inherit `color` in CSS. Anything inside one that does
  not set its own colour renders as the browser default, which is black in both
  themes. This has already caused one invisible-text bug.
- On iOS, `Tok.activeBg` is navy on light and near-white on dark. Never pair it
  with a hardcoded `.white` foreground; use `Tok.activeFg`. This has caused four.
- Use `accent` for red **text and marks**, `accent-fill` for red **backgrounds**.
  Reaching for `accent` as a fill puts a white label on a light red in the dark
  theme, which is the single easiest contrast regression to introduce here.
- Same rule for categories: `color` on the app's own surfaces, `pin` under the
  white symbol on a map marker.
- **Anything tappable is a real `<button>`.** The card's bookmark, the reminder
  switch and the map tray card were all styled `<span>`s with delegated click
  handlers. They looked right and were unreachable by keyboard and unnamed to a
  screen reader. If a new control needs a click handler, it needs to be a
  button with an accessible name and, for a toggle, `aria-pressed` or
  `role="switch"` with `aria-checked`.
- A control cannot be nested inside another button, which is why the bookmark
  is a sibling of the card positioned over it rather than a third grid column
  inside it. Keep it that way.

Focus is a designed state, not a browser default: `:focus-visible` draws a
2px accent ring at a 2px offset. Several controls here have no border of their
own, so without it a keyboard user cannot see where they are.

If you change any colour, re-run the contrast numbers above rather than eyeballing
them. Several of the pairs that fail are ones that look fine on a good monitor.
