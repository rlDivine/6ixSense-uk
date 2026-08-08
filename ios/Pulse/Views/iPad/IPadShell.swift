import SwiftUI
import MapKit

// MARK: - Root

/// The regular-width (iPad) shell. Replaces the compact bottom tab bar with a
/// persistent sidebar, an adaptive card grid, and an inline detail pane, which
/// is the structure specified in the iPad handoff.
///
/// Everything keys off the *size class*, never the device model, so Split View,
/// Slide Over and Stage Manager all fall back to the phone layout automatically
/// when the app is handed a compact width.
struct IPadRootView: View {
    @EnvironmentObject var app: AppState

    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var selected: Event?
    @State private var query: String = ""
    @State private var keyboardIndex: Int = -1
    @FocusState private var searchFocused: Bool

    var body: some View {
        GeometryReader { geo in
            let landscape = geo.size.width >= geo.size.height

            NavigationSplitView(columnVisibility: $columnVisibility) {
                sidebar(landscape: landscape)
                    .navigationSplitViewColumnWidth(
                        min: 240, ideal: landscape ? 290 : 268, max: 320)
                    .toolbar(.hidden, for: .navigationBar)
            } detail: {
                content(landscape: landscape)
                    .toolbar(.hidden, for: .navigationBar)
            }
            .navigationSplitViewStyle(.balanced)
        }
        .tint(Tok.accent)
        .background(Tok.bg.ignoresSafeArea())
        .background(shortcuts)
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

    /// "All", then "Free", then every real category ordered by volume.
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

    private func sidebar(landscape: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            brand
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    SideRow(icon: "square.grid.2x2.fill", title: "Discover",
                            active: app.tab == 0) { app.tab = 0 }
                    SideRow(icon: "map.fill", title: "Map",
                            active: app.tab == 1) { app.tab = 1 }
                    SideRow(icon: "bookmark.fill", title: "Saved",
                            count: app.savedUpcoming.isEmpty ? nil : app.savedUpcoming.count,
                            active: app.tab == 2) { app.tab = 2 }

                    SidebarSectionHeader(text: "Sort by")
                    sortToggle

                    SidebarSectionHeader(text: "When")
                    ForEach(EventService.Range.allCases, id: \.self) { r in
                        SideRow(title: r.label, count: whenCounts[r] ?? 0,
                                active: app.range == r) {
                            app.range = r
                            if app.category != "All" && !categoryStillValid(after: r) { app.category = "All" }
                            selected = nil
                        }
                    }

                    SidebarSectionHeader(text: "Category")
                    ForEach(categoryRows, id: \.name) { row in
                        SideRow(dot: dotColor(row.name), title: row.name, count: row.count,
                                active: app.category == row.name) {
                            app.category = row.name
                            selected = nil
                        }
                    }
                }
                .padding(.horizontal, 10)
                .padding(.bottom, 18)
            }
            sidebarFooter
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tok.panel.ignoresSafeArea())
    }

    private func categoryStillValid(after r: EventService.Range) -> Bool {
        let pool = prefFiltered.filter { r.matches($0.startDate) }
        if app.category == "Free" { return pool.contains { $0.isFree } }
        return pool.contains { $0.category.caseInsensitiveCompare(app.category) == .orderedSame }
    }

    private func dotColor(_ name: String) -> Color? {
        switch name {
        case "All":  return Tok.muted
        case "Free": return Tok.freeFg
        default:     return Categories.style(name).color
        }
    }

    private var brand: some View {
        HStack(spacing: 10) {
            PulseLogoView(size: 30)
            VStack(alignment: .leading, spacing: 0) {
                Text("Pulse").font(.system(size: 18, weight: .heavy)).foregroundStyle(Tok.text)
                Text("\(app.placeName), right now").font(.system(size: 11)).foregroundStyle(Tok.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18)
        .padding(.top, 14)
        .padding(.bottom, 12)
    }

    private var sortToggle: some View {
        HStack(spacing: 4) {
            sortButton(.nearest, "Nearest")
            sortButton(.soonest, "Soonest")
        }
        .padding(3)
        .background(Tok.chip, in: RoundedRectangle(cornerRadius: 11))
        .padding(.horizontal, 6)
        .padding(.bottom, 4)
    }

    private func sortButton(_ s: EventService.Sort, _ label: String) -> some View {
        Button { app.sort = s } label: {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(app.sort == s ? Tok.activeFg : Tok.muted)
                .frame(maxWidth: .infinity)
                .frame(height: 32)
                .background(app.sort == s ? Tok.activeBg : .clear, in: RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
        .frame(height: 38)
    }

    private var sidebarFooter: some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider().overlay(Tok.hairline)
            HStack(spacing: 8) {
                Button {
                    Task { await app.load() }
                } label: {
                    Label(app.loading ? "Refreshing…" : "Refresh",
                          systemImage: "arrow.clockwise")
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

    @ViewBuilder
    private func content(landscape: Bool) -> some View {
        let usesPane = landscape && app.tab != 1

        ZStack {
            Tok.bg.ignoresSafeArea()

            if app.tab == 1 {
                IPadMapPane(onOpen: { selected = $0 })
            } else {
                HStack(spacing: 0) {
                    VStack(spacing: 0) {
                        toolbar
                        Divider().overlay(Tok.hairline)
                        gridArea
                    }
                    .frame(maxWidth: .infinity)

                    if usesPane, let event = selected {
                        Divider().overlay(Tok.hairline)
                        IPadDetailPane(event: event) { selected = nil }
                            .frame(width: 400)
                            .transition(.move(edge: .trailing).combined(with: .opacity))
                    }
                }
                .animation(.easeInOut(duration: 0.22), value: selected?.id)
            }
        }
        .overlay {
            if let event = selected, !usesPane {
                IPadDetailOverlay(event: event) { selected = nil }
            }
        }
    }

    // MARK: Toolbar

    private var titleText: String {
        if searching { return "Results" }
        switch app.tab {
        case 2:  return "Saved"
        default: return "What's on"
        }
    }

    private var subtitleText: String {
        if searching {
            let n = gridEvents.count
            if let dq = searchOutcome?.dateQuery {
                return "\(n) \(n == 1 ? "match" : "matches") · \(dq.label)"
            }
            return "\(n) \(n == 1 ? "match" : "matches") for “\(trimmedQuery)”"
        }
        if app.tab == 2 {
            let n = app.savedUpcoming.count
            return n == 0 ? "Nothing saved yet" : "\(n) \(n == 1 ? "event" : "events") you're keeping"
        }
        let n = gridEvents.count
        return "\(n) \(n == 1 ? "event" : "events") upcoming \(app.originPhrase)"
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
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Toggle sidebar")
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(titleText).font(.system(size: 26, weight: .heavy)).foregroundStyle(Tok.text)
            Text(subtitleText).font(.system(size: 13)).foregroundStyle(Tok.muted)
                .lineLimit(1)
        }
        .fixedSize(horizontal: true, vertical: false)
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .semibold)).foregroundStyle(Tok.muted)
            TextField("Search events and venues", text: $query)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
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
            }
        }
        .padding(.horizontal, 13)
        .frame(height: 44)
        .frame(minWidth: 150, maxWidth: 330)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
            .stroke(searchFocused ? Tok.accent : Tok.hairline, lineWidth: searchFocused ? 1.5 : 1))
    }

    private var locationButton: some View {
        let located = app.hasOrigin
        let override = app.placeOverride
        return Button {
            if override != nil { Task { await app.clearOverride() } }
            else { app.tapLocationChip() }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: override != nil
                      ? "mappin.circle.fill"
                      : (app.locAuthorized ? "location.fill" : "location"))
                    .font(.system(size: 13, weight: .semibold))
                Text(override?.label ?? (located ? "Near you" : "Set location"))
                    .font(.system(size: 13.5, weight: .semibold))
                    .lineLimit(1)
            }
            .foregroundStyle(located ? Tok.activeFg : Tok.muted)
            .padding(.horizontal, 14)
            .frame(height: 44)
            .background(located ? Tok.activeBg : Tok.panel, in: Capsule())
            .overlay(Capsule().stroke(located ? Tok.accent : Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .fixedSize()
    }

    // MARK: Grid

    @ViewBuilder
    private var gridArea: some View {
        GeometryReader { geo in
            let cols = columnCount(for: geo.size.width)
            Group {
                if app.loading && app.events.isEmpty {
                    LoadingState()
                } else if let err = app.errorMessage, app.events.isEmpty {
                    ErrorState(message: err) { Task { await app.load() } }
                } else if app.tab == 2 && !searching {
                    savedGrid(cols: cols)
                } else if gridEvents.isEmpty {
                    EmptyState {
                        query = ""
                        app.range = .all
                        app.category = "All"
                    }
                } else {
                    discoverGrid(cols: cols)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    /// One card per ~300pt of *content* width: 3 columns on a detail-closed
    /// landscape iPad, 2 with the pane open or in portrait, 1 in Slide Over.
    private func columnCount(for width: CGFloat) -> Int {
        max(1, min(4, Int((width / 300).rounded())))
    }

    private func gridColumns(_ n: Int) -> [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 18), count: n)
    }

    private func discoverGrid(cols: Int) -> some View {
        ScrollView {
            LazyVGrid(columns: gridColumns(cols), spacing: 18) {
                ForEach(Array(gridEvents.enumerated()), id: \.element.id) { idx, event in
                    Button { selected = event; keyboardIndex = idx } label: {
                        IPadEventCard(event: event,
                                      highlighted: selected?.id == event.id || keyboardIndex == idx)
                    }
                    .buttonStyle(.plain)
                    .id(event.id)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 20)
            .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
        .focusable()
        .onKeyPress(.leftArrow)  { moveSelection(.left,  cols: cols); return .handled }
        .onKeyPress(.rightArrow) { moveSelection(.right, cols: cols); return .handled }
        .onKeyPress(.upArrow)    { moveSelection(.up,    cols: cols); return .handled }
        .onKeyPress(.downArrow)  { moveSelection(.down,  cols: cols); return .handled }
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

    private func savedGrid(cols: Int) -> some View {
        Group {
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
                    LazyVStack(alignment: .leading, spacing: 26, pinnedViews: []) {
                        ForEach(savedGroups, id: \.day) { group in
                            VStack(alignment: .leading, spacing: 14) {
                                HStack(spacing: 8) {
                                    Text(group.day.uppercased())
                                        .font(.system(size: 12, weight: .heavy))
                                        .kerning(0.8)
                                        .foregroundStyle(Tok.muted)
                                    CountBadge(count: group.events.count)
                                    Spacer(minLength: 0)
                                }
                                LazyVGrid(columns: gridColumns(cols), spacing: 18) {
                                    ForEach(group.events) { event in
                                        VStack(spacing: 0) {
                                            Button { selected = event } label: {
                                                IPadEventCard(event: event, highlighted: selected?.id == event.id)
                                            }
                                            .buttonStyle(.plain)
                                            reminderRow(event)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, 20)
                    .padding(.bottom, 40)
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
                .labelsHidden().tint(Tok.accent)
        }
        .padding(.horizontal, 12)
        .frame(height: 44)
        .background(Tok.panel2)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.top, 6)
    }

    /// Arrow-key direction for grid navigation. SwiftUI's `MoveCommandDirection`
    /// (and `onMoveCommand`) are macOS/tvOS-only, so iPad hardware-keyboard
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
            Button("Refresh")  { Task { await app.load() } }.keyboardShortcut("r", modifiers: .command)
            Button("Close")    { selected = nil }.keyboardShortcut(".", modifiers: .command)
        }
        .opacity(0)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: - Detail pane (landscape, 400pt)

struct IPadDetailPane: View {
    let event: Event
    let close: () -> Void

    var body: some View {
        ZStack(alignment: .top) {
            Tok.bg.ignoresSafeArea()
            ScrollView {
                IPadDetailBody(event: event, heroHeight: 210, close: close)
            }
        }
        .frame(maxHeight: .infinity)
    }
}

// MARK: - Centred overlay card (portrait / map, 640pt)

struct IPadDetailOverlay: View {
    let event: Event
    let close: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .onTapGesture(perform: close)

            ScrollView {
                IPadDetailBody(event: event, heroHeight: 260, close: close)
            }
            .frame(maxWidth: 640)
            .frame(maxHeight: 820)
            .background(Tok.bg)
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Tok.hairline, lineWidth: 1))
            .shadow(color: .black.opacity(0.45), radius: 40, y: 18)
            .padding(40)
        }
        .transition(.opacity)
    }
}

// MARK: - Shared detail body

struct IPadDetailBody: View {
    let event: Event
    var heroHeight: CGFloat = 240
    let close: () -> Void

    @EnvironmentObject var app: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            hero
            VStack(alignment: .leading, spacing: 16) {
                badges
                Text(event.title)
                    .font(.system(size: 24, weight: .heavy))
                    .foregroundStyle(Tok.text)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Tap “Get tickets” for the full description and tickets from \(event.source).")
                    .font(.system(size: 14)).foregroundStyle(Tok.muted)
                    .fixedSize(horizontal: false, vertical: true)
                facts
                venueBlock
                actions
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .padding(.bottom, 24)
        }
    }

    private var hero: some View {
        Categories.wash(event.category)
            .frame(maxWidth: .infinity)
            .frame(height: heroHeight)
            .overlay {
                if let img = event.image, let url = URL(string: img) {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() }
                        else { CategoryGlyph(category: event.category, size: 50) }
                    }
                } else {
                    CategoryGlyph(category: event.category, size: 50)
                }
            }
            .clipped()
            .overlay(alignment: .topTrailing) {
                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(.black.opacity(0.55), in: Circle())
                }
                .buttonStyle(.plain)
                .padding(12)
            }
    }

    private var badges: some View {
        HStack(spacing: 8) {
            TagChip(text: event.category, kind: .category)
            if event.isFree && event.category != "Free" { TagChip(text: "Free", kind: .free) }
            Text("via \(event.source)").font(.system(size: 11)).foregroundStyle(Tok.muted)
            Spacer(minLength: 0)
        }
    }

    private var facts: some View {
        HStack(spacing: 8) {
            fact("When", event.startDate != nil
                 ? event.startDate!.formatted(.dateTime.month(.abbreviated).day()) + " · " + Fmt.time(event.startDate)
                 : "TBA")
            // Fmt.distance carries the unit the region actually uses. Pasting a
            // literal "km" here labelled an already-converted miles figure as
            // kilometres, which is very visible in a UK build where every other
            // distance in the app reads in miles.
            fact("Distance", Fmt.distance(event.distanceKm))
            fact("Price", event.isFree ? "Free" : (event.price?.isEmpty == false ? event.price! : "Not listed"))
        }
    }

    private func fact(_ k: String, _ v: String) -> some View {
        VStack(spacing: 3) {
            Text(k).font(.system(size: 10.5)).foregroundStyle(Tok.muted)
            Text(v).font(.system(size: 13, weight: .bold)).foregroundStyle(Tok.text)
                .multilineTextAlignment(.center).lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity).padding(10)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
    }

    @ViewBuilder private var venueBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(event.venue ?? "Venue TBA").font(.system(size: 15, weight: .bold)).foregroundStyle(Tok.text)
            Text(event.address ?? "Address TBA").font(.system(size: 13)).foregroundStyle(Tok.muted)
            if let lat = event.lat, let lng = event.lng, event.hasCoordinate {
                VenueSnapshot(coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng))
                    .frame(height: 140).clipShape(RoundedRectangle(cornerRadius: 10))
                if let url = URL(string: "http://maps.apple.com/?daddr=\(lat),\(lng)") {
                    Link("Directions", destination: url)
                        .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Tok.link)
                        .frame(height: 44)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
    }

    private var actions: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                if let url = URL(string: event.url ?? "") {
                    ShareLink(item: url) { secondary("Share") }
                } else {
                    secondary("Share").opacity(0.4)
                }
                Button { app.toggleSave(event) } label: {
                    secondary(app.isSaved(event) ? "Saved" : "Save")
                }
                .buttonStyle(.plain)
            }
            HStack(spacing: 8) {
                Toggle(isOn: Binding(get: { app.reminders.contains(event.id) },
                                     set: { _ in app.toggleReminder(event) })) {
                    Label("Remind me 2h before", systemImage: "bell")
                        .font(.system(size: 13)).foregroundStyle(Tok.muted)
                }
                .tint(Tok.accent)
            }
            .padding(.horizontal, 12)
            .frame(height: 44)
            .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))

            if let url = URL(string: event.url ?? "") {
                Link(destination: url) {
                    Text("Get tickets")
                        .font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).frame(height: 50)
                        .background(Tok.accent, in: RoundedRectangle(cornerRadius: 14))
                }
            }
        }
    }

    private func secondary(_ t: String) -> some View {
        Text(t).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Tok.text)
            .frame(maxWidth: .infinity).frame(height: 44)
            .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
    }
}
