# VenTrack: iPad design brief

**Status: built.** This was written as a brief before the layout existed. It is
kept as written rather than rewritten in the past tense, because what it argues
for is still what the code does and the reasoning is worth more than the tense.

What shipped, against what this asked for:

| | |
| --- | --- |
| Layout | `ios/VenTrack/Views/iPad/`, a `NavigationSplitView` behind one size class branch in `RootView` |
| Device family | `TARGETED_DEVICE_FAMILY = '1,2'` in `project.rb` |
| Landscape | `UISupportedInterfaceOrientations~ipad`, all four |
| Screenshots | Uploaded for build 6. App Store Connect will not accept a submission from an iPad capable app without them, so their existence is certain; whether they show the split view rather than a stretched phone is the part that decides section 1, and that has not been checked here |

One deviation from section 3, found by arithmetic rather than by taste: two
columns do not fit a 13 inch with the detail pane open while the 340pt card
floor holds, so that case is one column capped at 520 and centred. The floor
holds because dropping it to 280 fits the second column and breaks the card,
which loses its price and source out of the footer.

Read section 1 before anything else. It is not preamble, it is the reason the
sibling app was rejected, and two thirds of it being done is the dangerous
state rather than the safe one.

---

## 1. The rule that has already cost a rejection

**iPad support is three things, and shipping any subset of them is worse than
shipping none.**

1. A layout that actually activates at regular width.
2. `TARGETED_DEVICE_FAMILY = '1,2'` in `ios/project.rb`.
3. A full second set of App Store screenshots taken on a 13 inch iPad.

6ix Sense build 1.0 (1) had the first and not the second. The app carried a
regular width sidebar layout in `Views/iPad`, but shipped with device family
`1`, so iPadOS ran it in scaled iPhone compatibility mode and that layout never
activated once. A reviewer opened it on an iPad Air 11 inch, saw a blown up
phone app, and rejected it under Guideline 4, Design.

VenTrack's first answer was to delete the iPad layout rather than fix the
setting, so `Views/iPad` went, `RootView` stopped branching on size class, and
`project.rb` said `1`. A plainly iPhone only app is a normal, accepted
configuration and runs on iPad in compatibility mode by design.

That was reversed later, and all three parts went in together, which is what
the rest of this brief argues for.

So this brief describes work that lands all three together or does not land.
There is no useful halfway state, and the halfway state is specifically the one
that gets rejected.

### The two costs nobody counts up front

**Landscape.** `Info.plist` declares `UISupportedInterfaceOrientations` as
portrait only. That is a defensible choice for a phone and is not one for an
iPad, where a person is as likely to be holding it in landscape or have it in a
keyboard case. Every layout here has to work in both, which is a real constraint
on the phone screens too, because the same views serve compact width.

**A second screenshot set, forever.** Not once. Every release that changes the
interface needs both sets regenerated, and the iPad set has to show the iPad
layout rather than a stretched phone, or you are back at Guideline 4.

---

## 2. What native means here, and what it does not

Native on iPad does not mean the phone layout with more air around it. If the
finished thing could be described as "the same screens, wider", it has failed
and a reviewer will say so.

It means **`NavigationSplitView`**: a sidebar that replaces the tab bar, a
content column that lists things, and a detail column that shows the one thing
you picked. That is the shape iPadOS users already know from Mail, Notes,
Files and Photos, and it is the shape that makes an iPad worth using for this
app, because the whole point of the app is comparing events, and comparing is
easier when the list stays on screen next to what you selected.

The tab bar goes away at regular width. It does not become a sidebar-shaped tab
bar; the four destinations become sidebar rows.

---

## 3. The layout

### The sidebar

Fixed, always visible in landscape, collapsible in portrait. Contents, top to
bottom:

- The wordmark and the settings control, which is the phone's `BrandStrip`
  moved here and nothing more.
- The town. On the phone this is the large title inside the feed. On iPad it
  belongs in the sidebar, because it applies to every destination rather than
  to one screen, and because the feed's own header should not be repeating what
  the chrome already says.
- Discover, Map, Saved, Search as four rows with SF Symbols, selection drawn
  with `Tok.activeBg` under `Tok.activeFg` exactly as the phone's sort control
  does. Selection is monochrome. The accent stays reserved.

The filters do **not** go in the sidebar. They belong to the feed, they change
what the content column shows rather than which destination you are in, and a
sidebar that mixes navigation with filtering stops being legible. They stay at
the top of the content column and scroll away, as they do on the phone.

### The content column

The feed, the saved list, the search results. This is where the existing header
rows live: town date line, sort control, range chips, category chips, then the
cards. It behaves exactly as the phone does, including scrolling the header
away, because that behaviour was built as ordinary scroll content rather than a
collapsing chrome and therefore needs no iPad specific work at all.

**The measure problem is the main design question on this screen.** An
`EventCard` in `.row` style is a 68pt thumbnail, a title, and a distance column.
At 400pt wide that is a good row. At 1000pt wide it is a thumbnail on the left,
a distance on the right, and a lake of nothing between them.

Two answers, and the brief prefers the second:

- **Cap the measure.** One column, `frame(maxWidth: 700)`, centred. Safe,
  honest, and slightly wasteful of a 13 inch screen.
- **A grid.** `LazyVGrid` with adaptive columns, minimum around 340 and maximum
  around 520, so the column count falls out of the available width rather than
  being hardcoded: two up on an 11 inch in landscape, one up when the detail
  pane is open or the window is narrow. The feature card spans the full width
  at the top, which it earns by being the only one.

The grid is the better answer because it uses the screen for its actual purpose,
which is seeing more events at once, rather than for margins.

### The detail column

`EventDetailView`, presented as a pane rather than a sheet. This is the single
biggest improvement an iPad version buys: on the phone, opening an event covers
the feed, so comparing two events means closing one and opening the other. Side
by side, comparison is free.

It needs an empty state for "nothing selected yet", which the phone has never
needed. Keep it quiet: the app mark, one line, no illustration.

### Map

Three columns: sidebar, a list of what is in view, and the map as the detail.

The bottom tray disappears on iPad and should not be recreated. It exists on the
phone because a phone has one screen and the map has to share it. Given a real
second column, a persistent list is better in every way: more events visible, no
tray to open and close, no gesture to learn, and the map keeps its whole area.

Selecting in the list moves the map. Tapping a pin selects in the list. Same
two way binding as the phone already has through `selectedID`.

---

## 4. Compact width is not a special case, it is most of the time

Split View, Slide Over and Stage Manager all hand an iPad app a compact width.
So does an iPhone. The rule:

**Compact width renders exactly what the phone renders today.** Same tab bar,
same feed, same sheets. Not a degraded iPad layout, not a two column layout
squeezed. The existing views, unchanged.

`RootView` branches on `horizontalSizeClass` and nothing else branches anywhere.
One decision, at the top, so there is one place to look when a layout appears at
the wrong size. Every screen below that point stays size class agnostic.

This is also what makes the work tractable: the compact path is already built
and already shipped, so the job is adding a regular path beside it rather than
making every screen adaptive.

---

## 5. Tokens: what carries over and what does not

The design system in `ios/VenTrack/Design/Theme.swift` is not up for
renegotiation. `Tok`, `R`, `S`, `F` and `Family` are the same on both devices.

**Unchanged:** every colour, every radius, every font size. A 17pt body is a
17pt body on an iPad; type does not scale with screen size, it scales with
Dynamic Type. Card radius stays at `R.card`. The family colours, the accent
reserved for imminence, the monochrome selection, all identical.

**Changed:** only the outer gutter. The phone's `S.s5` screen margin becomes
`S.s6` or `S.s7` at regular width, because a margin that reads as generous at
390pt reads as cramped at 1024pt. Nothing inside a card changes.

**Not added:** no iPad specific colours, no iPad specific components, no second
card style. If a screen needs something the phone does not have, that is a
signal the phone screen is missing it too.

---

## 6. Pointer and keyboard

An iPad has both, and ignoring them is the difference between a port and a
native app.

- **Hover.** Cards and sidebar rows take `.hoverEffect(.highlight)`. Nothing
  else does, because a pointer highlighting everything it crosses is noise.
- **Keyboard.** Arrow keys move the selection in the content column. Return
  opens. `⌘F` focuses search. `⌘,` opens settings, which is the platform
  convention and free.
- **Focus.** The detail pane follows the content selection, so a person can
  work the whole feed from the keyboard without touching the screen.

---

## 7. What must not change

Everything in section 6 of `DESIGN_OVERHAUL.md` still applies. In particular:

- No gradients, anywhere, on either device.
- No emoji, no em dashes.
- The two ranking axes, distance and imminence, legible on every card at every
  width.
- The freemium gates exactly where they are. An iPad layout does not get more
  free saves because it has more room.
- British English.
- Contrast at AA or better, VoiceOver labels intact, Dynamic Type honoured.
  The sidebar and the detail pane need their own VoiceOver pass; a split view
  has three focus regions where the phone has one.

---

## 8. Deliverables

1. A sidebar, in both selected and unselected states, portrait and landscape.
2. The feed in the content column at three widths: 11 inch landscape with the
   detail pane open, 13 inch landscape with it open, and one up when narrow.
3. The detail pane, including its empty state.
4. The map screen, all three columns.
5. The paywall at regular width. It is a sheet on the phone and should stay a
   sheet, centred and measure capped, not a full screen wall.
6. A compact width screen, to prove it is the phone layout untouched.

Deliver as the same tokens, not as pixels. Anything that cannot be expressed in
`Tok`, `R`, `S` and `F` is either wrong or a change to the design system, and
the second one needs saying out loud.

---

## 9. How to check the result

- **The blown up phone test.** Screenshot the iPad feed and the phone feed side
  by side. If the iPad one is recognisably the phone one with wider margins, it
  is not done. This is the exact test a reviewer performs.
- **Rotate everything.** Both orientations, every screen, no clipped content and
  no layout jumping.
- **Split View at every stop.** Drag the divider through all positions. The
  transition between regular and compact happens live and must not lose scroll
  position or selection.
- **Slide Over.** The narrowest case. It has to be the phone layout.
- **Stage Manager.** Resize the window continuously rather than in steps, which
  is where hardcoded widths show up.
- **Pointer and keyboard.** Drive the whole app from a Magic Keyboard without
  touching the screen.
- **VoiceOver.** Rotor navigation across three panes.
- **Dynamic Type at the accessibility sizes**, in landscape, with the sidebar
  open. This is where a two column grid fails first.

---

## 10. Before any of this starts

Decide whether it is worth it, honestly, and the answer today is probably not
yet.

The app has no users. Its differentiator is local listings that no other app
carries, and the thing limiting that is seeded towns, not screen sizes. An iPad
layout is a few thousand lines of SwiftUI, a permanent second screenshot set, a
landscape support commitment across the whole app, and a rejection risk that
has already been realised once on a sibling product.

It is the right piece of work after the first release finds an audience, and the
wrong one before it. When it does start, start with section 1 and land all three
parts in the same submission.
