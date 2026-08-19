import SwiftUI

/// The feed. Order down the screen is fixed by the design: brand strip, the
/// town as a page title with today's date under it, the sort control, the date
/// ranges, the categories, the status line, then the cards.
///
/// HOW THE HEADER GETS OUT OF THE WAY, AND WHY IT IS DONE THIS WAY.
///
/// Everything above the cards except one thin bar lives INSIDE the scroll view,
/// as the first rows of the feed. It goes away because it is scrolled away, and
/// it comes back because it is scrolled back. There is no collapse state, no
/// gesture reading, no measurement of where the feed is, and no animation: the
/// header tracks the finger exactly, because it is being dragged, not animated
/// in response to being dragged.
///
/// Three earlier versions did it the other way, with the whole header pinned as
/// a top safe area inset that swapped to a compact bar. Every one of them was
/// beaten by the same thing, and it is worth stating plainly because the idea
/// is so tempting: changing the height of a top inset SHOVES the scroll view.
/// Collapsing yanks the feed up by three hundred points and expanding drops it
/// back, neither of which the person asked for, and the feed does not end up
/// where it was. That is not a timing bug and no easing curve repairs it. It is
/// what a changing inset does.
///
/// What stays pinned is a single strip of constant height, and constant is the
/// operative word. It names the app at the top of the feed and the town once
/// the large title has scrolled past, which is one line of text swapping for
/// another next to the same button. Nothing below it moves, ever.
struct DiscoverView: View {
    @EnvironmentObject var app: AppState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selected: Event?

    /// Whether the feed's own large title is still on screen. Drives nothing
    /// but which of two words the pinned strip shows. See `headerRows`.
    @State private var titleVisible = true

    var body: some View {
        ZStack {
            Tok.bg.ignoresSafeArea()
            content
        }
        .safeAreaInset(edge: .top, spacing: 0) { pinnedStrip }
        .sheet(item: $selected) { EventDetailView(event: $0) }
    }

    // MARK: Chrome

    /// The one pinned thing, and the only thing that survives scrolling.
    ///
    /// Its height never changes, which is the whole reason this screen is calm
    /// now. The strip contains one line of 15pt text and a 34pt button in both
    /// of its states, so the swap costs no layout at all and the feed beneath it
    /// is never moved by anything the header does.
    private var pinnedStrip: some View {
        BrandStrip(place: pinnedPlace)
            .animation(reduceMotion ? nil : Animation.easeInOut(duration: 0.22),
                       value: pinnedPlace)
            .topChrome()
    }

    /// The town, but only once its large title has actually scrolled away, and
    /// only on the feed.
    ///
    /// The second half is derived from which screen is showing rather than left
    /// to `titleVisible`, because leaving the feed fires that flag's
    /// `onDisappear` and the order of it against the next screen's `onAppear`
    /// is not defined. Deriving it means a loading screen cannot inherit a
    /// stale town from the feed it replaced, whichever way that race lands.
    private var pinnedPlace: String? {
        guard case .feed = screen, !titleVisible else { return nil }
        return app.placeName
    }

    /// Everything that used to be pinned, now the first rows of the feed.
    ///
    /// Shared between the feed and the three empty states rather than living
    /// only in the scroll view, because the sort control and the filters have to
    /// stay usable while the feed is loading or empty. An empty state whose only
    /// remedy is a control the empty state removed is a dead end.
    private var headerRows: some View {
        VStack(alignment: .leading, spacing: S.s3) {
            titleBlock
            outOfMarketNotice
            sortControl
            rangeRow
            categoryRow
        }
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

    /// Which of the four screens the feed tab is currently showing. Worked out
    /// in one place because two things need the answer: `content`, to draw it,
    /// and `pinnedPlace`, to decide whether the strip may name a town.
    private enum Screen {
        case loading
        case failed(String)
        case empty
        case feed
    }

    private var screen: Screen {
        if app.loading && app.events.isEmpty { return .loading }
        if let err = app.errorMessage, app.events.isEmpty { return .failed(err) }
        if app.visibleEvents.isEmpty { return .empty }
        return .feed
    }

    @ViewBuilder private var content: some View {
        switch screen {
        case .loading:
            stateScreen { LoadingState(place: app.placeName) }
        case .failed(let err):
            stateScreen { ErrorState(message: err) { Task { await app.load() } } }
        case .empty:
            // `widen` is left at its default, which is exactly "try this week".
            // Widening stops at the free window when locked, so the button
            // always does what it says rather than opening a purchase sheet.
            stateScreen {
                EmptyState(place: app.placeName) {
                    app.category = "All"
                    app.range = app.unlocked ? .all : .week
                    Task { await app.load() }
                }
            }
        case .feed:
            feed
        }
    }

    /// The feed, header rows and all.
    ///
    /// The header is the first thing IN the scroll view rather than pinned
    /// above it, which is what makes it get out of the way at exactly the speed
    /// of the finger and come back exactly when the feed reaches the top. See
    /// the note on the type for the three pinned versions this replaced and why
    /// none of them could be made smooth.
    private var feed: some View {
        ScrollView {
            // The gap between cards is the separation now, and each card
            // carries its own horizontal gutter so the section header and
            // the gate can keep their own alignment independently.
            LazyVStack(alignment: .leading, spacing: S.s3) {
                headerRows
                    // The large title being on screen is what the pinned strip
                    // above needs to know, and being the lazy stack's first
                    // child is what makes these two events say it. It reports a
                    // region rather than a line, since the stack keeps a little
                    // either side of what is visible, and that is the right way
                    // round: the strip has finished changing over before the
                    // feed stops moving. Nothing about the layout depends on
                    // it, so being early or late costs a crossfade and nothing
                    // else.
                    .onAppear { titleVisible = true }
                    .onDisappear { titleVisible = false }
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
            .padding(.top, S.s3)
            .padding(.bottom, S.s6)
        }
        .refreshable { await app.load() }
    }

    /// One of the three non-feed screens, with the header rows kept above it.
    ///
    /// The filters have to stay usable while the feed is loading or empty. An
    /// empty state whose only remedy is a control the empty state itself
    /// removed is a dead end, and a loading screen that will not let you change
    /// your mind until it finishes is just a slower one.
    ///
    /// These do not scroll, so the large title is always on screen and the
    /// pinned strip stays on the wordmark.
    ///
    /// The type parameter is called `Content` because the two obvious names are
    /// both taken. `S` is the spacing scale and `Screen` is the enum above, and
    /// a generic of either name shadows the real one for the whole function
    /// body without any warning that it has.
    @ViewBuilder private func stateScreen<Content: View>(
        @ViewBuilder _ body: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: S.s3) {
            headerRows
            body()
        }
        .padding(.top, S.s3)
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
