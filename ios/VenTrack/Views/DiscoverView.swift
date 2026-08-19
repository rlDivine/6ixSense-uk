import SwiftUI

/// The feed. Order down the screen is fixed by the design: brand strip, the
/// town as a page title with today's date under it, the sort control, the date
/// ranges, the categories, the status line, then the cards.
///
/// Everything above the status line is pinned chrome sitting on glass, so the
/// filters stay reachable while the list moves. The status line itself is the
/// first row of the list rather than part of the chrome: it is the one label
/// the design sets in `Tok.faint`, and faint is solved against `panel2`, not
/// against a material.
struct DiscoverView: View {
    @EnvironmentObject var app: AppState
    @State private var selected: Event?

    var body: some View {
        ZStack {
            Tok.bg.ignoresSafeArea()
            content
        }
        .safeAreaInset(edge: .top, spacing: 0) { chrome }
        .sheet(item: $selected) { EventDetailView(event: $0) }
    }

    // MARK: Chrome

    private var chrome: some View {
        VStack(alignment: .leading, spacing: S.s3) {
            BrandStrip()
            titleBlock
            outOfMarketNotice
            sortControl
            rangeRow
            categoryRow
        }
        .padding(.bottom, S.s3)
        .topChrome()
    }

    /// The town is the thing worth reading, so it gets the size. The wordmark
    /// above it only has to say which app you are in, and the date under it
    /// answers "as of when" without spending a line on a sentence.
    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: S.s1) {
            Text(todayLine.uppercased())
                .font(F.caption)
                .kerning(0.77)
                .foregroundStyle(Tok.faint)
                .lineLimit(1)
            HStack(spacing: S.s2) {
                Text(app.placeName)
                    .font(F.display)
                    .kerning(-1.1)
                    .foregroundStyle(Tok.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Image(systemName: "chevron.down")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Tok.muted)
                Spacer(minLength: 0)
            }
            Text(statusText)
                .font(F.body)
                .foregroundStyle(Tok.muted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, S.s5)
    }

    /// Two segments in a full width `panel2` track, the live one filled with
    /// `activeBg` under `activeFg`. It used to fill with red, which put a third
    /// competing red on a screen that already had the "today" overline and the
    /// primary button; selection is monochrome everywhere now, and that is what
    /// leaves the accent free to mean one thing.
    ///
    /// Both segments are labelled with an SF Symbol. These were the last two
    /// emoji in the app and they are gone: an emoji renders in its own font at
    /// its own weight and colour, so it never matched the label beside it.
    private var sortControl: some View {
        HStack(spacing: 0) {
            sortSegment("location.fill", "Nearest", .nearest)
            sortSegment("clock.fill", "Soonest", .soonest)
        }
        .padding(2)
        .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 11))
        .padding(.horizontal, S.s5)
        .frame(height: 44)
    }

    /// The symbol is decorative, so it stays out of the accessibility label:
    /// VoiceOver says "sort by nearest" rather than reading the pin out loud.
    private func sortSegment(_ symbol: String, _ label: String,
                             _ value: EventService.Sort) -> some View {
        let on = app.sort == value
        return Button {
            guard app.sort != value else { return }
            app.sort = value
            Task { await app.load() }
        } label: {
            Label(label, systemImage: symbol)
                .labelStyle(.titleAndIcon)
                .font(.system(size: 15, weight: .medium))
                .imageScale(.small)
                .foregroundStyle(on ? Tok.activeFg : Tok.muted)
                .frame(maxWidth: .infinity)
                .frame(height: 36)
                .background(on ? Tok.activeBg : Color.clear,
                            in: RoundedRectangle(cornerRadius: 9))
                .contentShape(RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sort by \(label.lowercased())")
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    /// The free app looks seven days ahead, so "All upcoming" carries a padlock
    /// until the unlock is bought. It stays in the row rather than being hidden:
    /// a control you can see and understand is a better offer than one that
    /// silently is not there, and hiding it would leave the row looking like the
    /// whole feature set.
    private var rangeRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(EventService.Range.allCases, id: \.self) { r in
                    let locked = r == .all && !app.unlocked
                    Pill(text: r.label, active: app.range == r, locked: locked) {
                        guard app.range != r else { return }
                        if locked { app.unlockPrompt = .dateRange; return }
                        app.range = r
                        Task { await app.load() }
                    }
                }
            }
            .padding(.horizontal, S.s5)
        }
    }

    /// Built from what is actually in the feed, never a fixed list, so a town
    /// with no football listings does not offer a Football chip that returns
    /// nothing.
    private var categoryRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(app.categoryChips, id: \.self) { c in
                    CategoryChip(name: c, active: app.category == c) {
                        app.category = c
                    }
                }
            }
            .padding(.horizontal, S.s5)
        }
    }

    /// Shown only when the device is outside the UK. Without it the feed looks
    /// broken, showing London listings under a "near you" heading, when in fact
    /// it is working exactly as intended for a UK-only app. Not dismissible,
    /// because the condition persists.
    @ViewBuilder private var outOfMarketNotice: some View {
        if !app.inMarket && app.placeOverride == nil {
            HStack(alignment: .top, spacing: 9) {
                Image(systemName: "info.circle")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Tok.muted)
                Text("VenTrack covers the UK only. You appear to be outside it, so we are showing \(app.placeName).")
                    .font(F.footnote)
                    .foregroundStyle(Tok.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(S.s3)
            .background(Tok.panel2, in: RoundedRectangle(cornerRadius: R.well))
            .padding(.horizontal, S.s5)
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: Content

    @ViewBuilder private var content: some View {
        if app.loading && app.events.isEmpty {
            LoadingState()
        } else if let err = app.errorMessage, app.events.isEmpty {
            ErrorState(message: err) { Task { await app.load() } }
        } else if app.visibleEvents.isEmpty {
            // `widen` is left at its default, which is exactly "try this week".
            // Widening stops at the free window when locked, so the button
            // always does what it says rather than opening a purchase sheet.
            EmptyState(place: app.placeName) {
                app.category = "All"
                app.range = app.unlocked ? .all : .week
                Task { await app.load() }
            }
        } else {
            ScrollView {
                // No horizontal padding and no inter-row spacing: each card
                // owns its own gutter and draws its own hairline, which is what
                // lets a row separator run the full width the way the design
                // shows while the content still sits on a 20pt gutter.
                LazyVStack(alignment: .leading, spacing: 0) {
                    sectionHeader
                    ForEach(Array(app.visibleEvents.enumerated()), id: \.element.id) { i, e in
                        Button { selected = e } label: {
                            // Exactly one feature per screen, at the top, where
                            // the photograph gets to carry the feed. Used more
                            // than once it undoes the calm and the feed reads
                            // as a carousel of posters.
                            EventCard(event: e, style: i == 0 ? .feature : .row)
                        }
                        .buttonStyle(PressableRow())
                    }
                    freeWindowGate
                }
                .padding(.bottom, S.s6)
            }
            .refreshable { await app.load() }
        }
    }

    /// Names what the run of cards below actually is, rather than repeating
    /// the count already in the header.
    private var sectionHeader: some View {
        Text(app.range == .today ? "TONIGHT" : "TONIGHT AND THIS WEEK")
            .font(F.caption)
            .kerning(0.77)
            .foregroundStyle(Tok.faint)
            .padding(.horizontal, S.s5)
            .padding(.top, S.s5)
            .padding(.bottom, S.s3)
    }

    /// The end of the free week is a STATED gate, never a blur or a fade.
    ///
    /// A fade is a gradient, and it is also dishonest: it implies there is
    /// something just out of reach rather than saying what the boundary is. So
    /// this names how many more events exist, explains the boundary in one
    /// sentence, and offers one button. The shape of the paid tier is legible
    /// before anyone hits it.
    @ViewBuilder private var freeWindowGate: some View {
        if !app.unlocked, app.range != .all, !app.visibleEvents.isEmpty {
            VStack(alignment: .leading, spacing: S.s2) {
                Text("That is the free week")
                    .font(F.title)
                    .kerning(-0.7)
                    .foregroundStyle(Tok.text)
                Text("VenTrack looks seven days ahead on the free tier. Unlocking opens the whole month, every town in the UK, and unlimited saves.")
                    .font(F.body)
                    .foregroundStyle(Tok.muted)
                    .fixedSize(horizontal: false, vertical: true)
                Button { app.unlockPrompt = .dateRange } label: {
                    Text("See what unlocking adds")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(Tok.accentFill, in: RoundedRectangle(cornerRadius: R.button))
                }
                .buttonStyle(PressableRow())
                .padding(.top, S.s2)
            }
            .padding(.horizontal, S.s5)
            .padding(.top, S.s7)
        }
    }

    // MARK: Copy

    /// "Friday, 25 July". Built in two pieces because en-GB writes the date as
    /// "25 July" with no comma after the weekday, and the design wants one.
    private var todayLine: String {
        let gb = Locale(identifier: "en_GB")
        let now = Date.now
        let weekday = now.formatted(.dateTime.weekday(.wide).locale(gb))
        let date = now.formatted(.dateTime.day().month(.wide).locale(gb))
        return "\(weekday), \(date)"
    }

    /// "128 events near London, nearest first". Both halves matter: the count
    /// says whether the filters bit, and the order says why the top card is on
    /// top.
    private var statusText: String {
        let n = app.visibleEvents.count
        let noun = n == 1 ? "event" : "events"
        let order = app.sort == .nearest ? "nearest first" : "soonest first"
        return "\(n) \(noun) \(app.originPhrase), \(order)"
    }
}

/// The date range chip. Selection is MONOCHROME, filling `activeBg`, and this
/// is deliberate: if selection used the accent then red would appear a dozen
/// times a screen and stop meaning "this is on today", which is the highest
/// value single use of colour in the app.
///
/// Unselected is `panel2` with no border at all. The old bordered pill was part
/// of what made every screen read as a grid of boxes.
struct Pill: View {
    let text: String
    let active: Bool
    var small: Bool = false
    /// Draws the padlock and quietens the label. The button stays tappable:
    /// tapping is how the user finds out what the padlock is about.
    var locked: Bool = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if locked { LockBadge() }
                Text(text)
                    .font(.system(size: small ? 13 : 14, weight: .medium))
            }
            .padding(.horizontal, small ? 12 : 15)
            .frame(height: small ? 28 : 34)
            .foregroundStyle(active ? Tok.activeFg : (locked ? Tok.muted : Tok.text))
            .background(active ? Tok.activeBg : Tok.panel2, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(active ? .isSelected : [])
        .accessibilityHint(locked ? "Part of the paid unlock" : "")
    }
}

/// A category chip. Selection matches the range pills: `activeBg` with
/// `activeFg`, never a hardcoded white, which would be invisible on dark where
/// `activeBg` is itself near white.
///
/// The mark is a 14x3 rule rather than a dot, matching the card footer, so the
/// same shape means the same thing in both places. When the chip is selected
/// the rule would vanish into the fill, so it flips to the selected foreground
/// and stays visible.
struct CategoryChip: View {
    let name: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let rule = ruleColour {
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(rule).frame(width: 14, height: 3)
                }
                Text(name)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(active ? Tok.activeFg : Tok.text)
                    .lineLimit(1)
            }
            .padding(.horizontal, 15)
            .frame(height: 34)
            .background(active ? Tok.activeBg : Tok.panel2, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    /// "All" and "Free" are not categories, and neither is anything that folds
    /// to no family, so they carry no rule: a colour there would claim a hue
    /// that means nothing.
    private var ruleColour: Color? {
        guard name != "All", name != "Free" else { return nil }
        guard Categories.family(name) != nil else { return nil }
        return active ? Tok.activeFg : Categories.style(name).color
    }
}
