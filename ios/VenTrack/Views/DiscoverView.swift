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
        VStack(alignment: .leading, spacing: 11) {
            BrandStrip()
            titleBlock
            outOfMarketNotice
            sortControl
            rangeRow
            categoryRow
        }
        .padding(.bottom, 11)
        .topChrome()
    }

    /// The town is the thing worth reading, so it gets the size. The wordmark
    /// above it only has to say which app you are in, and the date under it
    /// answers "as of when" without spending a line on a sentence.
    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(app.placeName)
                .font(.system(size: 27, weight: .bold))
                .kerning(-0.8)
                .foregroundStyle(Tok.text)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(todayLine)
                .font(.system(size: 13.5))
                .foregroundStyle(Tok.muted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
    }

    /// A bordered inline well that hugs its content, matching the web client,
    /// which took the control back from 6ix Sense. The live segment is filled
    /// with `accentFill` under a white label. That pairing is the whole reason
    /// `accentFill` exists as a separate token: `accent` is the lighter red for
    /// text and would fail contrast under white on the dark theme.
    ///
    /// The two emoji are a deliberate, user-requested exception to this app's
    /// otherwise no-emoji rule. Nothing else in the app gets one.
    private var sortControl: some View {
        HStack(spacing: 0) {
            sortSegment("📍", "Nearest", .nearest)
            sortSegment("⏱️", "Soonest", .soonest)
        }
        .padding(3)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
        .padding(.horizontal, 16)
    }

    /// The emoji is kept out of the accessibility label, so VoiceOver says
    /// "sort by nearest" rather than reading the pin out loud.
    private func sortSegment(_ emoji: String, _ label: String,
                             _ value: EventService.Sort) -> some View {
        let on = app.sort == value
        return Button {
            guard app.sort != value else { return }
            app.sort = value
            Task { await app.load() }
        } label: {
            Text("\(emoji) \(label)")
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(on ? Color.white : Tok.muted)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(on ? Tok.accentFill : Color.clear,
                            in: RoundedRectangle(cornerRadius: 9))
                .contentShape(RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sort by \(label.lowercased())")
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private var rangeRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(EventService.Range.allCases, id: \.self) { r in
                    Pill(text: r.label, active: app.range == r) {
                        guard app.range != r else { return }
                        app.range = r
                        Task { await app.load() }
                    }
                }
            }
            .padding(.horizontal, 16)
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
            .padding(.horizontal, 16)
        }
    }

    /// Shown only when the device is outside the UK. Without it the feed looks
    /// broken, showing London listings under a "near you" heading, when in fact
    /// it is working exactly as intended for a UK-only app. Not dismissible,
    /// because the condition persists.
    @ViewBuilder private var outOfMarketNotice: some View {
        if !app.inMarket && app.placeOverride == nil {
            HStack(alignment: .top, spacing: 9) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Tok.link)
                Text("VenTrack covers the UK only. You appear to be outside it, so we are showing \(app.placeName).")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Tok.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 16)
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
            EmptyState(place: app.placeName) {
                app.category = "All"
                app.range = .all
                Task { await app.load() }
            }
        } else {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    Text(statusText)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Tok.faint)
                        .padding(.top, 10)
                        .padding(.bottom, 2)
                    ForEach(app.visibleEvents) { e in
                        Button { selected = e } label: { EventCard(event: e) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 26)
            }
            .refreshable { await app.load() }
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

    /// "128 events near London, nearest first", or "9 events near London within
    /// 5 mi, nearest first". Three parts, each earning its place: the count says
    /// whether the filters bit, the order says why the top card is on top, and
    /// the radius says so out loud because it is set away from here, in
    /// Settings, and an unexplained short list reads as a broken feed.
    private var statusText: String {
        let n = app.visibleEvents.count
        let noun = n == 1 ? "event" : "events"
        let order = app.sort == .nearest ? "nearest first" : "soonest first"
        return "\(n) \(noun) \(app.originPhrase)\(app.radiusPhrase), \(order)"
    }
}

/// The date range chip. Selected is the filled red under a white label, which
/// is `accentFill` and never `accent`: on the dark theme those are different
/// values and `accent` is too light to carry white. Unselected is a solid
/// surface with a hairline, so it stays readable sitting on glass.
struct Pill: View {
    let text: String
    let active: Bool
    var small: Bool = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: small ? 12 : 12.5, weight: .semibold))
                .padding(.horizontal, small ? 11 : 13)
                .padding(.vertical, small ? 6 : 7)
                .foregroundStyle(active ? Color.white : Tok.text)
                .background(active ? Tok.accentFill : Tok.panel, in: Capsule())
                .overlay(Capsule().stroke(active ? Tok.accentFill : Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

/// A category chip. Unlike the sort control and the range pills, this one keeps
/// the navy selected state rather than taking the red: it sits directly under a
/// row of red pills, and two filled reds in a stack read as one control. That
/// means `activeBg` with `activeFg`, and never `activeBg` with a hardcoded
/// white, which is invisible on dark where `activeBg` is near white.
///
/// The 6pt dot is the category's own adaptive colour, which is what tells two
/// chips apart at a glance. When the chip is selected that dot would vanish into
/// the navy, so it flips to the selected foreground and stays visible.
struct CategoryChip: View {
    let name: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let dot = dotColour {
                    Circle().fill(dot).frame(width: 6, height: 6)
                }
                Text(name)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(active ? Tok.activeFg : Tok.text)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(active ? Tok.activeBg : Tok.panel2, in: Capsule())
            .overlay(Capsule().stroke(active ? Tok.activeBg : Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    /// "All" and "Free" are not categories, so they carry no dot: a colour
    /// there would claim a hue that means nothing.
    private var dotColour: Color? {
        guard name != "All", name != "Free" else { return nil }
        return active ? Tok.activeFg : Categories.style(name).color
    }
}
