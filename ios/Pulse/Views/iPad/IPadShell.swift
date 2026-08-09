import SwiftUI
import MapKit

// MARK: - Root

/// The regular-width (iPad) shell. Replaces the compact bottom tab bar with a
/// persistent sidebar, an adaptive card grid, and an inline detail pane, which
/// is the structure the handoff specifies in section 5: sidebar 284pt, a
/// flexible grid, and a 376pt detail pane at 1180 by 820.
///
/// Shipping iPhone-only is what got the predecessor rejected under App Store
/// Guideline 4, so this has to stay a real regular-width design rather than a
/// stretched phone. Everything below keys off the *width the layout system
/// hands us*, never the device model and never the raw screen size, so Split
/// View, Slide Over and Stage Manager all resolve correctly and a rotation
/// simply relayouts. Orientation is not locked anywhere.
struct IPadRootView: View {
    @EnvironmentObject var app: AppState

    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var selected: Event?
    @State private var query: String = ""
    @State private var keyboardIndex: Int = -1
    @State private var showPrefs = false
    @FocusState private var searchFocused: Bool

    /// Handoff section 5.
    private static let sidebarWidth: CGFloat = 284
    private static let detailPaneWidth: CGFloat = 376
    /// The grid is never squeezed below this to make room for the inline pane.
    /// Under it the detail is presented as a centred card instead, which is
    /// what a portrait iPad and most Split View widths end up doing.
    private static let minGridWidth: CGFloat = 420

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            sidebar
                .navigationSplitViewColumnWidth(min: 260, ideal: Self.sidebarWidth, max: 320)
                .toolbar(.hidden, for: .navigationBar)
        } detail: {
            content
                .toolbar(.hidden, for: .navigationBar)
        }
        .navigationSplitViewStyle(.balanced)
        .tint(Tok.accent)
        .background(Tok.bg.ignoresSafeArea())
        .background(shortcuts)
        .sheet(isPresented: $showPrefs) { PreferencesView() }
        .task {
            app.requestLocation()
            if app.events.isEmpty { await app.load() }
        }
        .onChange(of: app.tab) { _, _ in selected = nil; keyboardIndex = -1 }
    }

    // MARK: Derived data

    private var prefFiltered: [Event] { app.events.filter { app.matchesPreferences($0) } }

    private var whenFiltered: [Event] { prefFiltered.filter { app.range.matches($0.startDate) } }

    private var categoryFiltered: [Event] {
        switch app.category {
        case "All":  return whenFiltered
        case "Free": return whenFiltered.filter { $0.isFree }
        default:     return whenFiltered.filter { $0.category.caseInsensitiveCompare(app.category) == .orderedSame }
        }
    }

    private var trimmedQuery: String { query.trimmingCharacters(in: .whitespaces) }
    private var searching: Bool { !trimmedQuery.isEmpty }

    private var searchOutcome: AppState.SearchOutcome? {
        searching ? app.searchResults(trimmedQuery) : nil
    }

    /// What the grid renders on Discover. Search, when active, overrides the
    /// sidebar filters entirely, because the toolbar field replaces the phone's
    /// fourth tab, so a query has to be able to reach the whole catalogue.
    private var gridEvents: [Event] {
        if let outcome = searchOutcome {
            return app.sort.apply(outcome.events.filter { app.matchesPreferences($0) })
        }
        return app.sort.apply(categoryFiltered)
    }

    private var whenCounts: [EventService.Range: Int] {
        var out: [EventService.Range: Int] = [:]
        for r in EventService.Range.allCases {
            out[r] = prefFiltered.filter { r.matches($0.startDate) }.count
        }
        return out
    }

    /// "All", then "Free", then every real category ordered by volume. Built
    /// from what is actually in the feed rather than a fixed list, so a renamed
    /// or new category needs no change here.
    private var categoryRows: [(name: String, count: Int)] {
        var counts: [String: Int] = [:]
        for e in whenFiltered where !e.category.isEmpty {
            counts[e.category, default: 0] += 1
        }
        var rows: [(name: String, count: Int)] = [("All", whenFiltered.count)]
        let free = whenFiltered.filter { $0.isFree }.count
        if free > 0 { rows.append(("Free", free)) }
        let ordered = counts.keys.sorted { a, b in
            let ca = counts[a] ?? 0, cb = counts[b] ?? 0
            return ca == cb ? a.localizedCaseInsensitiveCompare(b) == .orderedAscending : ca > cb
        }
        rows.append(contentsOf: ordered.map { (name: $0, count: counts[$0] ?? 0) })
        return rows
    }

    private var savedGroups: [(day: String, events: [Event])] {
        var order: [String] = []
        var buckets: [String: [Event]] = [:]
        for e in app.savedUpcoming {
            let key = Fmt.relDay(e.startDate)
            if buckets[key] == nil { order.append(key) }
            buckets[key, default: []].append(e)
        }
        return order.map { (day: $0, events: buckets[$0] ?? []) }
    }

    // MARK: Sidebar

    /// Brand lockup, the four destinations, then Sort, When and Category as
    /// full-width rows with live counts. This is where the phone's cramped
    /// horizontal chip scrollers go: at regular width there is no reason to
    /// hide a filter behind a sideways scroll.
    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            brand
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    navRows
                    sidebarRule
                    SidebarSectionHeader(text: "Sort")
                    sortToggle
                    SidebarSectionHeader(text: "When")
                    whenRows
                    SidebarSectionHeader(text: "Category")
                    categoryList
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 20)
            }
            sidebarFooter
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // Liquid glass. The sidebar is app chrome, so it takes the same
        // ultra thin material the map tray already uses in this codebase.
        // Everything written on it stays at Tok.text or Tok.muted: Tok.faint is
        // solved against panel2, not against a material, so it never goes here.
        // Translucency is not a gradient, so this stays inside the no-gradients
        // rule.
        .background(.ultraThinMaterial)
        .overlay(alignment: .trailing) {
            Rectangle().fill(Tok.hairline).frame(width: 1).ignoresSafeArea()
        }
    }

    private var brand: some View {
        HStack(spacing: 9) {
            PulseLogoView(size: 24)
            Text("Pulse")
                .font(.system(size: 19, weight: .heavy))
                .kerning(-0.4)
                .foregroundStyle(Tok.text)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 14)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Pulse")
    }

    @ViewBuilder
    private var navRows: some View {
        SideRow(icon: "square.grid.2x2.fill", title: "Discover",
                count: categoryFiltered.count, active: app.tab == 0) {
            app.tab = 0
        }
        SideRow(icon: "map.fill", title: "Map", active: app.tab == 1) {
            app.tab = 1
        }
        SideRow(icon: "bookmark.fill", title: "Saved",
                count: app.savedUpcoming.isEmpty ? nil : app.savedUpcoming.count,
                active: app.tab == 2) {
            app.tab = 2
        }
        // Settings is a sidebar row here rather than a gear in a brand strip,
        // which is the regular-width half of the navigation change in 6.1.
        SideRow(icon: "gearshape.fill", title: "Settings", active: false) {
            showPrefs = true
        }
    }

    private var sidebarRule: some View {
        Rectangle()
            .fill(Tok.hairline)
            .frame(height: 1)
            .padding(.horizontal, 8)
            .padding(.top, 14)
    }

    private var whenRows: some View {
        ForEach(EventService.Range.allCases, id: \.self) { r in
            SideRow(title: r.label, count: whenCounts[r] ?? 0, active: app.range == r) {
                app.range = r
                if app.category != "All" && !categoryStillValid(after: r) { app.category = "All" }
                selected = nil
                keyboardIndex = -1
            }
        }
    }

    private var categoryList: some View {
        ForEach(categoryRows, id: \.name) { row in
            SideRow(dot: dotColour(row.name), title: row.name, count: row.count,
                    active: app.category == row.name) {
                app.category = row.name
                selected = nil
                keyboardIndex = -1
            }
        }
    }

    private func categoryStillValid(after r: EventService.Range) -> Bool {
        let pool = prefFiltered.filter { r.matches($0.startDate) }
        if app.category == "Free" { return pool.contains { $0.isFree } }
        return pool.contains { $0.category.caseInsensitiveCompare(app.category) == .orderedSame }
    }

    /// The 9pt dot beside a category row. This is one of the app's own
    /// surfaces, so it takes the category's `color`. `pin` is for map markers
    /// only, where a white symbol has to clear 3:1 on top of it.
    private func dotColour(_ name: String) -> Color? {
        switch name {
        case "All":  return Tok.muted
        case "Free": return Tok.freeFg
        default:     return Categories.style(name).color
        }
    }

    private var sortToggle: some View {
        HStack(spacing: 3) {
            sortButton(.nearest, "Nearest")
            sortButton(.soonest, "Soonest")
        }
        .padding(3)
        .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 11))
        .padding(.horizontal, 8)
        .padding(.bottom, 4)
    }

    private func sortButton(_ s: EventService.Sort, _ label: String) -> some View {
        Button { app.sort = s } label: {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                // Never a hardcoded white here. On dark the selected fill is
                // near white, and a white label on it is invisible.
                .foregroundStyle(app.sort == s ? Tok.activeFg : Tok.muted)
                .frame(maxWidth: .infinity)
                .frame(height: 36)
                .background(app.sort == s ? Tok.activeBg : Color.clear,
                            in: RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
        .frame(height: 40)
        .accessibilityLabel("Sort by \(label.lowercased())")
    }

    private var sidebarFooter: some View {
        VStack(alignment: .leading, spacing: 6) {
            Rectangle().fill(Tok.hairline).frame(height: 1)
            HStack(spacing: 8) {
                Button {
                    Task { await app.load() }
                } label: {
                    Label(app.loading ? "Refreshing" : "Refresh", systemImage: "arrow.clockwise")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Tok.muted)
                        .frame(height: 44)
                }
                .buttonStyle(.plain)
                .disabled(app.loading)
                Spacer(minLength: 0)
                if let last = app.lastLoad {
                    Text(last.formatted(.dateTime.hour().minute()))
                        .font(.system(size: 11)).foregroundStyle(Tok.muted)
                }
            }
            .padding(.horizontal, 18)
        }
    }

    // MARK: Content column

    /// The content column measures itself and decides two things from that one
    /// number: whether the 376pt detail pane fits beside the grid, and how wide
    /// each grid cell ends up (which is what picks the card variant, further
    /// down in `gridArea`).
    @ViewBuilder
    private var content: some View {
        GeometryReader { geo in
            let paneFits = (geo.size.width - Self.detailPaneWidth) >= Self.minGridWidth
            let showsPane = app.tab != 1 && selected != nil && paneFits

            ZStack {
                Tok.bg.ignoresSafeArea()

                if app.tab == 1 {
                    IPadMapPane(onOpen: { selected = $0 })
                } else {
                    HStack(spacing: 0) {
                        VStack(spacing: 0) {
                            toolbar
                            Rectangle().fill(Tok.hairline).frame(height: 1)
                            gridArea
                        }
                        .frame(maxWidth: .infinity)

                        if showsPane, let event = selected {
                            Rectangle().fill(Tok.hairline).frame(width: 1)
                            IPadDetailPane(event: event) { selected = nil }
                                .frame(width: Self.detailPaneWidth)
                                .transition(.move(edge: .trailing).combined(with: .opacity))
                        }
                    }
                    .animation(.easeInOut(duration: 0.22), value: selected?.id)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .overlay {
                if let event = selected, !showsPane {
                    IPadDetailOverlay(event: event) { selected = nil }
                }
            }
        }
    }

    // MARK: Toolbar

    private var titleText: String {
        if searching { return "Results" }
        if app.tab == 2 { return "Saved" }
        return app.placeName
    }

    /// The handoff's status line: the count and the active sort, in one
    /// sentence, so the list never needs a legend.
    private var subtitleText: String {
        if searching {
            let n = gridEvents.count
            if let dq = searchOutcome?.dateQuery {
                return "\(n) \(n == 1 ? "match" : "matches") · \(dq.label)"
            }
            return "\(n) \(n == 1 ? "match" : "matches") for \(trimmedQuery)"
        }
        if app.tab == 2 {
            let n = app.savedUpcoming.count
            return n == 0 ? "Nothing saved yet" : "\(n) \(n == 1 ? "event" : "events") you are keeping"
        }
        let n = gridEvents.count
        let order = app.sort == .nearest ? "nearest first" : "soonest first"
        return "\(n) \(n == 1 ? "event" : "events") \(app.originPhrase), \(order)"
    }

    private var toolbar: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .center, spacing: 14) {
                sidebarToggle
                titleBlock
                Spacer(minLength: 16)
                searchField
                locationButton
            }
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 14) { sidebarToggle; titleBlock; Spacer(minLength: 0) }
                HStack(spacing: 12) { searchField; locationButton; Spacer(minLength: 0) }
            }
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 14)
        .background(Tok.bg)
    }

    private var sidebarToggle: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                columnVisibility = columnVisibility == .detailOnly ? .all : .detailOnly
            }
        } label: {
            Image(systemName: "sidebar.leading")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Tok.muted)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Toggle sidebar")
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(titleText)
                .font(.system(size: 27, weight: .heavy))
                .kerning(-0.8)
                .foregroundStyle(Tok.text)
                .lineLimit(1)
            Text(subtitleText)
                .font(.system(size: 13.5))
                .foregroundStyle(Tok.muted)
                .lineLimit(1)
        }
        .fixedSize(horizontal: true, vertical: false)
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .semibold)).foregroundStyle(Tok.muted)
            TextField("Search events, venues or a town", text: $query)
                .textFieldStyle(.plain)
                .font(.system(size: 14.5))
                .foregroundStyle(Tok.text)
                .focused($searchFocused)
                .submitLabel(.search)
                .autocorrectionDisabled()
            if !query.isEmpty {
                Button { query = ""; searchFocused = false } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14)).foregroundStyle(Tok.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear the search")
            }
        }
        .padding(.horizontal, 13)
        .frame(height: 44)
        .frame(minWidth: 150, maxWidth: 330)
        .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
            .stroke(searchFocused ? Tok.accent : Color.clear, lineWidth: 2))
    }

    private var locationButton: some View {
        let located = app.hasOrigin
        let override = app.placeOverride
        return Button {
            if override != nil { Task { await app.clearOverride() } }
            else { app.tapLocationChip() }
        } label: {
            HStack(spacing: 7) {
                Image(systemName: override != nil ? "mappin.circle.fill" : "location.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Tok.accent)
                Text(override?.label ?? (located ? app.placeName : "Set location"))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Tok.text)
                    .lineLimit(1)
            }
            .padding(.horizontal, 15)
            .frame(height: 44)
            .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .fixedSize()
        .accessibilityLabel(override != nil ? "Clear the chosen town" : "Change location")
    }

    // MARK: Grid

    /// The grid measures the width it is actually given and hands it to
    /// `GridMetrics`, which returns the column count, the resulting cell width
    /// and, from that cell width alone, whether the cards render compact.
    @ViewBuilder
    private var gridArea: some View {
        GeometryReader { geo in
            let metrics = GridMetrics(available: geo.size.width)
            Group {
                if app.loading && app.events.isEmpty {
                    LoadingState()
                } else if let err = app.errorMessage, app.events.isEmpty {
                    ErrorState(message: err) { Task { await app.load() } }
                } else if app.tab == 2 && !searching {
                    savedGrid(metrics)
                } else if gridEvents.isEmpty {
                    // Both actions are handled locally and neither refetches.
                    // The iPad feed is loaded wide, with every upcoming event,
                    // so the sidebar can show a live count for each WHEN row;
                    // widening here is a filter change, not a new request.
                    EmptyState(place: app.placeName, widen: {
                        query = ""
                        app.range = .week
                        app.category = "All"
                        selected = nil
                    }) {
                        query = ""
                        app.range = .all
                        app.category = "All"
                        selected = nil
                    }
                } else {
                    discoverGrid(metrics)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    private func discoverGrid(_ m: GridMetrics) -> some View {
        ScrollView {
            LazyVGrid(columns: m.gridItems, spacing: GridMetrics.spacing) {
                ForEach(Array(gridEvents.enumerated()), id: \.element.id) { idx, event in
                    IPadEventCard(event: event,
                                  compact: m.usesCompactCard,
                                  highlighted: selected?.id == event.id || keyboardIndex == idx) {
                        selected = event
                        keyboardIndex = idx
                    }
                    .id(event.id)
                }
            }
            .padding(.horizontal, GridMetrics.horizontalPadding)
            .padding(.top, 20)
            .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
        .focusable()
        .onKeyPress(.leftArrow)  { moveSelection(.left,  cols: m.columns); return .handled }
        .onKeyPress(.rightArrow) { moveSelection(.right, cols: m.columns); return .handled }
        .onKeyPress(.upArrow)    { moveSelection(.up,    cols: m.columns); return .handled }
        .onKeyPress(.downArrow)  { moveSelection(.down,  cols: m.columns); return .handled }
        .onKeyPress(.return) {
            if keyboardIndex >= 0 && keyboardIndex < gridEvents.count {
                selected = gridEvents[keyboardIndex]; return .handled
            }
            return .ignored
        }
        .onKeyPress(.escape) {
            if selected != nil { selected = nil; return .handled }
            if !query.isEmpty { query = ""; return .handled }
            return .ignored
        }
        .refreshable { await app.load() }
    }

    @ViewBuilder
    private func savedGrid(_ m: GridMetrics) -> some View {
        if app.savedUpcoming.isEmpty {
            VStack(spacing: 10) {
                Image(systemName: "bookmark").font(.system(size: 40)).foregroundStyle(Tok.muted)
                Text("Nothing saved yet").font(.system(size: 19, weight: .bold)).foregroundStyle(Tok.text)
                Text("Tap the bookmark on any event and it lands here, grouped by day.")
                    .font(.system(size: 14)).foregroundStyle(Tok.muted)
                    .multilineTextAlignment(.center)
            }
            .padding(40)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 26) {
                    ForEach(savedGroups, id: \.day) { group in
                        savedGroup(group.day, group.events, m)
                    }
                }
                .padding(.horizontal, GridMetrics.horizontalPadding)
                .padding(.top, 20)
                .padding(.bottom, 40)
            }
        }
    }

    private func savedGroup(_ day: String, _ events: [Event], _ m: GridMetrics) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Text(day.uppercased())
                    .font(.system(size: 10.5, weight: .heavy))
                    .kerning(0.85)
                    .foregroundStyle(Tok.muted)
                CountBadge(count: events.count)
                Spacer(minLength: 0)
            }
            LazyVGrid(columns: m.gridItems, spacing: GridMetrics.spacing) {
                ForEach(events) { event in
                    VStack(spacing: 0) {
                        IPadEventCard(event: event,
                                      compact: m.usesCompactCard,
                                      highlighted: selected?.id == event.id) {
                            selected = event
                        }
                        reminderRow(event)
                    }
                }
            }
        }
    }

    private func reminderRow(_ e: Event) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "bell").font(.system(size: 12)).foregroundStyle(Tok.muted)
            Text("Remind me 2h before").font(.system(size: 12.5)).foregroundStyle(Tok.muted)
            Spacer(minLength: 0)
            Toggle("", isOn: Binding(get: { app.reminders.contains(e.id) },
                                     set: { _ in app.toggleReminder(e) }))
                .labelsHidden()
                .tint(Tok.accent)
        }
        .padding(.horizontal, 12)
        .frame(height: 44)
        .background(Tok.panel2)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.top, 6)
        .accessibilityLabel("Remind me two hours before \(e.title)")
    }

    /// Arrow-key direction for grid navigation. SwiftUI's `MoveCommandDirection`
    /// (and `onMoveCommand`) are macOS and tvOS only, so iPad hardware-keyboard
    /// support goes through `onKeyPress` with our own direction type instead.
    private enum GridMove { case left, right, up, down }

    private func moveSelection(_ direction: GridMove, cols: Int) {
        guard !gridEvents.isEmpty else { return }
        var idx = keyboardIndex
        switch direction {
        case .left:  idx = max(0, idx - 1)
        case .right: idx = min(gridEvents.count - 1, idx + 1)
        case .up:    idx = max(0, idx - cols)
        case .down:  idx = min(gridEvents.count - 1, idx < 0 ? 0 : idx + cols)
        }
        keyboardIndex = max(0, idx)
    }

    // MARK: Hardware keyboard

    private var shortcuts: some View {
        Group {
            Button("Search") { searchFocused = true }
                .keyboardShortcut("f", modifiers: .command)
            Button("Discover") { app.tab = 0 }.keyboardShortcut("1", modifiers: .command)
            Button("Map")      { app.tab = 1 }.keyboardShortcut("2", modifiers: .command)
            Button("Saved")    { app.tab = 2 }.keyboardShortcut("3", modifiers: .command)
            Button("Settings") { showPrefs = true }.keyboardShortcut(",", modifiers: .command)
            Button("Refresh")  { Task { await app.load() } }.keyboardShortcut("r", modifiers: .command)
            Button("Close")    { selected = nil }.keyboardShortcut(".", modifiers: .command)
        }
        .opacity(0)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: - Detail pane (inline, 376pt)

/// The handoff's third column: the same content as the phone detail screen,
/// minus the hero controls. The phone puts a back chevron and a bookmark on the
/// hero; neither belongs here, because the pane is not pushed and Save already
/// has a full-width button of its own further down. Dismissal lives in the
/// pane's own header strip, plus Escape and Command-full-stop.
struct IPadDetailPane: View {
    let event: Event
    let close: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                IPadDetailBody(event: event, heroHeight: 190)
            }
        }
        .frame(maxHeight: .infinity)
        .background(Tok.panel.ignoresSafeArea())
    }

    private var header: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)
            Button(action: close) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Tok.muted)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close the detail pane")
        }
        .padding(.horizontal, 6)
    }
}

// MARK: - Centred overlay card (portrait, map, and narrow windows)

/// When the window is too narrow to seat a 376pt pane beside a usable grid, the
/// same detail body is presented as a centred card instead. It is modal, so
/// unlike the pane it gets a scrim and an unmissable close button.
struct IPadDetailOverlay: View {
    let event: Event
    let close: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .onTapGesture(perform: close)
                .accessibilityLabel("Close")
                .accessibilityAddTraits(.isButton)

            VStack(spacing: 0) {
                header
                ScrollView {
                    IPadDetailBody(event: event, heroHeight: 240)
                }
            }
            .frame(maxWidth: 640)
            .frame(maxHeight: 820)
            .background(Tok.panel)
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Tok.hairline, lineWidth: 1))
            .shadow(color: .black.opacity(0.45), radius: 40, y: 18)
            .padding(40)
        }
        .transition(.opacity)
    }

    private var header: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)
            Button(action: close) {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Tok.text)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, 6)
    }
}

// MARK: - Shared detail body

/// Hero, category line, title, description, a three column facts table, the
/// venue block, the primary action and the secondary ones. The facts table is
/// one bordered container split by hairlines rather than three separate cards,
/// which is what the handoff asks for in 4.3.
struct IPadDetailBody: View {
    let event: Event
    var heroHeight: CGFloat = 240

    @EnvironmentObject var app: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            hero
            VStack(alignment: .leading, spacing: 16) {
                categoryLine
                Text(event.title)
                    .font(.system(size: 24, weight: .heavy))
                    .kerning(-0.7)
                    .foregroundStyle(Tok.text)
                    .fixedSize(horizontal: false, vertical: true)
                Text(blurb)
                    .font(.system(size: 14))
                    .lineSpacing(4)
                    .foregroundStyle(Tok.muted)
                    .fixedSize(horizontal: false, vertical: true)
                facts
                primaryAction
                secondaryActions
                reminderRow
                venueBlock
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .padding(.bottom, 24)
        }
    }

    /// Flat category wash with the category mark on it, replaced by the photo
    /// when one loads. No scrim and no controls: the brief removed the hero
    /// gradient, and the wash sits underneath so a failed image still leaves
    /// the mark showing rather than an empty box.
    private var hero: some View {
        Categories.wash(event.category)
            .frame(maxWidth: .infinity)
            .frame(height: heroHeight)
            .overlay {
                if let url = event.imageURL {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() }
                        else { CategoryGlyph(category: event.category, size: 56) }
                    }
                } else {
                    CategoryGlyph(category: event.category, size: 56)
                }
            }
            .clipped()
            .accessibilityHidden(true)
    }

    private var blurb: String {
        "The full listing, the line up and tickets are on \(event.source)."
    }

    private var categoryLine: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(Categories.style(event.category).color)
                .frame(width: 7, height: 7)
            Text(event.category.uppercased())
                .font(.system(size: 10.5, weight: .heavy))
                .kerning(0.85)
                .foregroundStyle(Categories.style(event.category).color)
                .lineLimit(1)
            if event.isFree {
                // Free is a strong signal, so it is surfaced at weight rather
                // than in red. Red has three jobs and this is not one of them.
                Text("Free")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Tok.text)
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: Facts

    private var facts: some View {
        HStack(spacing: 0) {
            fact("When", whenValue, whenSub, rule: false)
            fact("Distance", Fmt.distance(event.distanceKm), walkSub, rule: true)
            fact("Price", priceValue, priceSub, rule: true)
        }
        .fixedSize(horizontal: false, vertical: true)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
    }

    private func fact(_ label: String, _ value: String, _ sub: String?, rule: Bool) -> some View {
        VStack(spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .heavy))
                .kerning(0.85)
                .foregroundStyle(Tok.muted)
            Text(value)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Tok.text)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(sub ?? " ")
                .font(.system(size: 11.5))
                .foregroundStyle(Tok.muted)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .multilineTextAlignment(.center)
        .padding(.vertical, 13)
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay(alignment: .leading) {
            if rule { Rectangle().fill(Tok.hairline).frame(width: 1) }
        }
    }

    private var whenValue: String { Fmt.relDay(event.startDate) }

    private var whenSub: String? {
        event.startDate == nil ? nil : Fmt.time(event.startDate)
    }

    /// `Fmt.distance` carries the unit the region actually uses, which for a UK
    /// build is miles. Never paste a literal unit beside it: labelling an
    /// already-converted miles figure as kilometres is a bug this file has
    /// shipped before, and it is very visible when every other distance in the
    /// app reads in miles.
    private var walkSub: String? {
        guard let km = event.distanceKm, km > 0 else { return nil }
        let minutes = Int((km / 5.0 * 60).rounded())
        guard minutes >= 1, minutes <= 90 else { return nil }
        return "\(minutes) min walk"
    }

    private var priceValue: String {
        if event.isFree { return "Free" }
        if let p = event.price, !p.isEmpty { return p }
        return "Not listed"
    }

    private var priceSub: String? { "via \(event.source)" }

    // MARK: Actions

    @ViewBuilder private var primaryAction: some View {
        if let url = event.webURL {
            Link(destination: url) {
                Text("Book on \(event.source)")
                    .font(.system(size: 15.5, weight: .bold))
                    // accentFill is the red background token, and white is the
                    // label it is solved for. accent is text red and would fail
                    // here on dark.
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Tok.accentFill, in: RoundedRectangle(cornerRadius: 13))
            }
        }
    }

    private var secondaryActions: some View {
        HStack(spacing: 9) {
            shareButton
            Button { app.toggleSave(event) } label: {
                secondary(app.isSaved(event) ? "Saved" : "Save")
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder private var shareButton: some View {
        if let url = event.webURL {
            ShareLink(item: url) { secondary("Share") }
        } else {
            secondary("Share").opacity(0.4).accessibilityHidden(true)
        }
    }

    private func secondary(_ t: String) -> some View {
        Text(t)
            .font(.system(size: 13.5, weight: .semibold))
            .foregroundStyle(Tok.text)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
    }

    private var reminderRow: some View {
        Toggle(isOn: Binding(get: { app.reminders.contains(event.id) },
                             set: { _ in app.toggleReminder(event) })) {
            Label("Remind me 2h before", systemImage: "bell")
                .font(.system(size: 13))
                .foregroundStyle(Tok.muted)
        }
        .tint(Tok.accent)
        .padding(.horizontal, 12)
        .frame(height: 48)
        .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
    }

    @ViewBuilder private var venueBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(event.venue ?? "Venue TBA")
                .font(.system(size: 15, weight: .bold)).foregroundStyle(Tok.text)
                .fixedSize(horizontal: false, vertical: true)
            Text(event.address ?? "Address TBA")
                .font(.system(size: 13)).foregroundStyle(Tok.muted)
                .fixedSize(horizontal: false, vertical: true)
            if let lat = event.lat, let lng = event.lng, event.hasCoordinate {
                // A map marker, so it takes the category's fixed `pin` rather
                // than the theme-adaptive `color` the rest of this pane uses.
                VenueSnapshot(coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng),
                              tint: Categories.style(event.category).pin)
                    .frame(height: 140)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .accessibilityHidden(true)
                if let url = URL(string: "http://maps.apple.com/?daddr=\(lat),\(lng)") {
                    Link("Directions", destination: url)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Tok.link)
                        .frame(height: 44)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
    }
}
