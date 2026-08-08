# Pulse: design brief

A brief for designing the Pulse interface for the United Kingdom market.

The app is built and working. This document exists so a designer can take it
somewhere better without having to reverse-engineer the intent from the code.
It describes what Pulse is, who uses it, what has already been decided and why,
what is deliberately a placeholder, and where the real design work is.

Read it alongside the running app: `cd api && npm start`, then open
`http://localhost:3000` on a phone or a narrow browser window. That is the
current state, not a mockup.

---

## 1. The product

Pulse answers one question: **what is on near me, soon?**

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
- **Web** (`api/public/`), a vanilla-JS installable PWA

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
read on navy.

| Token | Light | Dark | Job |
|---|---|---|---|
| `bg` | `#f6f7fb` | `#080e1c` | Page |
| `surface` | `#ffffff` | `#0f1730` | Cards, sheets |
| `surface-2` | `#eef1f7` | `#16203c` | Wells, search field, skeletons |
| `hairline` | `#e3e7f0` | `#1d2846` | Borders, rules |
| `ink` | `#0b1633` | `#eef1f8` | Primary text |
| `ink-2` | `#59627b` | `#9aa5c2` | Secondary text |
| `ink-3` | `#686e7e` | `#7d88a4` | Overlines, tertiary |
| `accent` | `#c8102e` | `#f44f63` | Logo, today, indicators. **Text weight** |
| `accent-fill` | `#c8102e` | `#d21e3c` | The same red as a filled background under a white label |
| `link` | `#012169` | `#8fadea` | Links, secondary emphasis |
| `active-bg` / `active-fg` | `#012169` / `#ffffff` | `#eef1f8` / `#0b1327` | Selected chips and pills |

Light red is Pantone 186, light link is Pantone 280. Both are the flag colours
unmodified.

`accent` and `accent-fill` are one colour on light and two on dark, because on
dark the red has to do two opposite jobs: be light enough to read as text on
navy, and dark enough to carry a white label when it is the background. No
single value does both. On light, Pantone 186 already carries white at 5.9:1,
so the two tokens are the same and the split costs nothing.

Defined in two places that must stay in step: `api/public/styles.css` (the
`:root` and `[data-theme="light"]` blocks) and `ios/Pulse/Design/Theme.swift`
(`enum Tok`).

**Contrast, audited.** Every token pair was checked against WCAG 2.1 using
computed relative luminance, at 4.5:1 for text (1.4.3) and 3:1 for graphical
objects (1.4.11). It passes at both bars. The tightest margins, which are the
ones to re-check if you change anything:

| Pair | Ratio | Bar |
|---|---|---|
| `ink-3` on `surface-2`, light | 4.50:1 | 4.5 |
| `ink-3` on `surface-2`, dark | 4.54:1 | 4.5 |
| `accent` on `surface-2`, dark | 4.71:1 | 4.5 |
| White on `accent-fill`, dark | 5.26:1 | 4.5 |
| Category glyph on its own wash, light | 3.04:1 | 3 |
| `accent-fill` on `bg`, dark | 3.66:1 | 3 |
| White symbol on a map pin | 3.93:1 | 3 |

Two things are deliberately below 3:1 and are exempt rather than overlooked:
the hairlines (1.22:1 dark, 1.24:1 light). They are decorative dividers, not
component boundaries. A card is identified by its surface against the page, not
by its border, so removing every hairline would lose no information.

Note the worst case for text is almost always `surface-2`, not `surface`. It is
the search field and the skeleton, and it is easy to forget it exists.

### Category colours

Twelve hues, restrained rather than a default rainbow, anchored on red for
festivals and blue for music. In `Categories.map` (Swift) and `CATS` (JS).

Each category is **two** values, not one, for the same reason the accent is:

- **`color`** is theme-adaptive. It is the 6px dot in the card footer, the card
  wash, and the placeholder glyph. The dark variant is a lifted version of the
  light mid-tone, because the mid-tones are far too dark to read on navy.
- **`pin`** is the light mid-tone, fixed in both themes. It is the map marker
  fill, and a white SF Symbol sits on it. The lifted dark hues carry white at
  only 2:1 to 3:1, so the marker cannot use them.

The wash is that colour at low alpha, and the alpha differs by theme: 0.18 dark,
0.12 light. That is not a taste decision. The placeholder glyph is drawn in the
same hue on top of the wash, so the wash has to stay far enough from it to keep
3:1, and the light surfaces have less room. If you make the light wash stronger,
the glyph disappears into it.

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
inside it. The photo often fails to load, so the category mark sits underneath
and shows through rather than leaving an empty box. The map tray card and the
iOS card do the same; anything new that shows a photo should too.

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

Every list screen needs **loading, empty and error** states. They exist and are
plain; they are a good place to add character.

## 6. Deliberately placeholder

**The logo.** A flat map pin with a knocked-out centre. It is competent and
consistent and it is not an identity. It was built to be thrown away: one
geometry expressed in three files, so replacing it touches nothing else.

- `ios/Pulse/Design/Theme.swift`, `PulseLogoGeometry`, the in-app mark as a
  SwiftUI `Shape`
- `ios/tools/make_icon.js`, which rasterises the App Store icons
- `api/public/icon.svg`, the web and PWA icon

A replacement needs to work at 18pt in a header, at 1024px on a home screen,
and in a single flat colour. **This is the first thing worth redesigning.**

**The name.** "Pulse" was chosen quickly. It is not researched and not
trademark-cleared.

**The category icon set.** Twelve hand-drawn line icons on the web
(`ICON_PATHS` in `app.js`) paired with SF Symbols on iOS. They are serviceable
and inconsistent with each other.

**The empty and loading states.** Functional, characterless.

## 7. What would most improve it

In rough order of value:

1. A real identity: mark, wordmark, and a decision on whether the flag palette
   is the right long-term call or a first-release shortcut.
2. The card. It is the screen. Everything else is chrome around a list of them.
3. A photo strategy. Most events arrive with a poor image or none at all, and
   the app currently falls back to a tinted square with an icon. That fallback
   is seen constantly and deserves better than it has.
4. Density and Dynamic Type. Test at the largest accessibility sizes; the card
   footer is where it will break first.
5. Empty states with a point of view.

## 8. Working with the code

| You want to change | Web | iOS |
|---|---|---|
| Colour tokens | `api/public/styles.css` top block | `ios/Pulse/Design/Theme.swift`, `enum Tok` |
| Category colours and icons | `CATS` and `ICON_PATHS` in `api/public/app.js` | `Categories` in `Theme.swift` |
| Interface icons | `UI_ICONS` in `api/public/app.js` | SF Symbol names inline |
| The card | `cardHTML` in `app.js`, `.card` in `styles.css` | `ios/Pulse/Views/EventCard.swift` |
| The logo | `api/public/icon.svg` | `PulseLogoGeometry` in `Theme.swift`, then `node ios/tools/make_icon.js` |
| Screen layout | `api/public/index.html` | `ios/Pulse/Views/` |

The web client is the faster loop and renders in a headless browser, so it is
the sensible place to try something before porting it to SwiftUI.

Four things to know before touching the code:

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
