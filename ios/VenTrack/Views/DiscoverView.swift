import SwiftUI

/// The feed. Order down the screen is fixed by the design: brand strip, the
/// town as a page title with today's date under it, the sort control, the date
/// ranges, the categories, the status line, then the cards.
///
/// The header collapses as you read down the feed and returns the moment you
/// head back up, so twenty events are not read through a letterbox. The town
/// name survives the collapse; everything else goes. See `onScroll`.
struct DiscoverView: View {
    @EnvironmentObject var app: AppState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selected: Event?

    /// Collapsed chrome state, and the two values needed to decide it.
    ///
    /// The header is six stacked rows: wordmark, date and town, the out of
    /// market notice, the sort control, the date ranges and the categories.
    /// That is most of a phone screen, and pinned it meant a feed of twenty
    /// events was read through a letterbox. It now behaves the way a large
    /// title does everywhere else on iOS: it goes away when you are reading and
    /// comes back the moment you head upward.
    @State private var collapsed = false
    @State private var lastOffset: CGFloat = 0

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
            if collapsed {
                compactBar
            } else {
                BrandStrip()
                titleBlock
                outOfMarketNotice
                sortControl
                rangeRow
                categoryRow
            }
        }
        .padding(.bottom, S.s3)
        .topChrome()
        .animation(reduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.9),
                   value: collapsed)
    }

    /// What survives the collapse: the town, and nothing else.
    ///
    /// Something has to, or a feed scrolled halfway down says nothing about
    /// where it is for, and that is the one fact every row on screen depends
    /// on. The chevron matches the expanded title so it still reads as the
    /// same control, and it opens the same picker.
    private var compactBar: some View {
        HStack(spacing: S.s2) {
            Text(app.placeName)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Tok.text)
                .lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Tok.muted)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, S.s5)
        .frame(height: 30)
        .transition(.opacity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Showing events for \(app.placeName)")
    }

    /// Collapse on the way down, restore on the way up.
    ///
    /// Direction rather than a fixed threshold, because a threshold alone means
    /// a reader deep in the feed has to scroll all the way back to the top to
    /// reach the filters. Restoring on any upward movement is what Safari and
    /// Mail do and it is what "swipe back up and it comes back" means.
    ///
    /// The 6 point deadzone is not decoration: without it, the sub-pixel jitter
    /// a finger produces while holding still flips this on every frame.
    ///
    /// Collapsing changes the header's height, which changes the safe area
    /// inset, which moves the content and produces another reading. That
    /// feedback is SELF STABILISING rather than oscillating, and it is worth
    /// knowing why before anyone tries to damp it: a shorter header shifts the
    /// content up, which reads as further scrolling down, which is the state it
    /// is already in. Expanding pushes content down and reads as scrolling up.
    /// Each change reinforces itself instead of fighting.
    private func onScroll(_ y: CGFloat) {
        let dy = y - lastOffset
        lastOffset = y

        // Near the top the header is always whole, whatever the last gesture
        // was. Rubber banding at the very top would otherwise read as a scroll
        // downward and collapse it just as the user arrives.
        if y > -12 {
            if collapsed { collapsed = false }
            return
        }
        guard abs(dy) > 6 else { return }
        let wantsCollapsed = dy < 0
        if wantsCollapsed != collapsed { collapsed = wantsCollapsed }
    }

    /// Restores the full header and forgets where the feed was.
    ///
    /// Resetting lastOffset matters as much as the flag: a stale value from the
    /// previous list would make the first reading of the next one look like a
    /// large jump in whichever direction, and collapse the header before the
    /// user has touched anything.
    private func expand() {
        collapsed = false
        lastOffset = 0
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
            LoadingState().onAppear { expand() }
        } else if let err = app.errorMessage, app.events.isEmpty {
            ErrorState(message: err) { Task { await app.load() } }
                .onAppear { expand() }
        } else if app.visibleEvents.isEmpty {
            // `widen` is left at its default, which is exactly "try this week".
            // Widening stops at the free window when locked, so the button
            // always does what it says rather than opening a purchase sheet.
            EmptyState(place: app.placeName) {
                app.category = "All"
                app.range = app.unlocked ? .all : .week
                Task { await app.load() }
            }
            // Without this the header can strand itself. Filter down to
            // something with no results while scrolled deep into the feed and
            // the chrome is collapsed, the list it was collapsed over is gone,
            // and there is nothing left to scroll upward to bring the filters
            // back: the only controls that can undo the filter are the ones
            // that just disappeared.
            .onAppear { expand() }
        } else {
            ScrollView {
                // The gap between cards is the separation now, and each card
                // carries its own horizontal gutter so the section header and
                // the gate can keep their own alignment independently.
                LazyVStack(alignment: .leading, spacing: S.s3) {
                    scrollReader
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
            .coordinateSpace(name: Self.feedSpace)
            .onPreferenceChange(FeedOffsetKey.self) { onScroll($0) }
            .refreshable { await app.load() }
        }
    }

    private static let feedSpace = "feed"

    /// Reports how far the feed has scrolled.
    ///
    /// A zero height GeometryReader at the top of the content, publishing its
    /// own minY in the scroll view's coordinate space. iOS 18 has
    /// onScrollGeometryChange for exactly this and the app targets 17, so this
    /// is the version that works on the deployment target rather than the tidy
    /// one. It draws nothing and takes no space.
    private var scrollReader: some View {
        GeometryReader { geo in
            Color.clear.preference(
                key: FeedOffsetKey.self,
                value: geo.frame(in: .named(Self.feedSpace)).minY)
        }
        .frame(height: 0)
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

/// Carries the feed's scroll offset up to DiscoverView.
///
/// Last one wins rather than summing, because exactly one reader publishes it
/// and a sum would be meaningless if that ever stopped being true.
private struct FeedOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
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
