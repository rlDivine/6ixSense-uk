import SwiftUI
import MapKit

/// iPad map: a full-bleed map column plus a dedicated 340pt "Around you" rail.
/// The phone version stacks a carousel over the map; at regular width there is
/// room to give the list its own column, so nothing overlaps the pins.
struct IPadMapPane: View {
    @EnvironmentObject var app: AppState

    /// Called when the user asks for the full detail. The shell presents it
    /// as a centred card so it never fights the map for space.
    let onOpen: (Event) -> Void

    @State private var selectedID: String?
    @State private var recenterTick = 0
    @State private var query: String = ""
    @FocusState private var searchFocused: Bool

    private static let maxPins = 250
    private static let railWidth: CGFloat = 340

    var body: some View {
        GeometryReader { geo in
            let showRail = geo.size.width >= 700

            HStack(spacing: 0) {
                mapColumn
                    .frame(maxWidth: .infinity)

                if showRail {
                    Divider().overlay(Tok.hairline)
                    rail
                        .frame(width: Self.railWidth)
                        .background(Tok.bg)
                }
            }
        }
        .background(Tok.bg)
        .onChange(of: app.category) { _, _ in clampSelection() }
        .onChange(of: app.range) { _, _ in clampSelection() }
    }

    // MARK: Data

    private var pool: [Event] {
        let base = app.events.filter { app.matchesPreferences($0) && app.range.matches($0.startDate) }
        let byCategory: [Event]
        switch app.category {
        case "All":  byCategory = base
        case "Free": byCategory = base.filter { $0.isFree }
        default:     byCategory = base.filter { $0.category.caseInsensitiveCompare(app.category) == .orderedSame }
        }
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return app.sort.apply(byCategory) }
        let needle = trimmed.lowercased()
        return app.sort.apply(byCategory.filter {
            $0.title.lowercased().contains(needle)
            || ($0.venue ?? "").lowercased().contains(needle)
            || $0.category.lowercased().contains(needle)
        })
    }

    private var mapped: [Event] { Array(pool.filter { $0.hasCoordinate }.prefix(Self.maxPins)) }

    private var selectedEvent: Event? {
        guard let selectedID else { return nil }
        return mapped.first { $0.id == selectedID }
    }

    private func clampSelection() {
        if let id = selectedID, !mapped.contains(where: { $0.id == id }) { selectedID = nil }
    }

    // MARK: Map column

    private var mapColumn: some View {
        ZStack(alignment: .top) {
            EventMapKit(events: mapped,
                        selectedID: $selectedID,
                        showsUser: app.locAuthorized,
                        userCoordinate: app.origin,
                        recenterTick: recenterTick)
                .ignoresSafeArea(edges: .bottom)

            floatingBar

            if let event = selectedEvent {
                // The PiP sits high in the column so it reads as "anchored above
                // the pin" without covering the pin the user just tapped.
                VStack {
                    Spacer(minLength: 0)
                    PiPCard(event: event) { onOpen(event) }
                        .padding(.bottom, 22)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            VStack {
                Spacer(minLength: 0)
                HStack {
                    Spacer(minLength: 0)
                    locateButton
                }
                .padding(.trailing, 18)
                .padding(.bottom, selectedEvent == nil ? 22 : 132)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: selectedID)
        .clipped()
    }

    private var floatingBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14, weight: .semibold)).foregroundStyle(Tok.muted)
                TextField("Search this map", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14))
                    .foregroundStyle(Tok.text)
                    .focused($searchFocused)
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
            .shadow(color: .black.opacity(0.25), radius: 10, y: 4)

            Text("\(mapped.count) nearby")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .frame(height: 44)
                .background(Tok.accentFill, in: Capsule())
                .shadow(color: .black.opacity(0.25), radius: 10, y: 4)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18)
        .padding(.top, 16)
    }

    private var locateButton: some View {
        Button {
            if !app.hasOrigin { app.tapLocationChip() }
            recenterTick += 1
        } label: {
            Image(systemName: app.locAuthorized ? "location.fill" : "location")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(app.locAuthorized ? Tok.accent : Tok.muted)
                .frame(width: 48, height: 48)
                .background(Tok.panel, in: Circle())
                .overlay(Circle().stroke(Tok.hairline, lineWidth: 1))
                .shadow(color: .black.opacity(0.3), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Recentre on my location")
    }

    // MARK: Rail

    private var rail: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("Around you")
                    .font(.system(size: 20, weight: .heavy)).foregroundStyle(Tok.text)
                CountBadge(count: mapped.count)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 10)

            Divider().overlay(Tok.hairline)

            if mapped.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "map").font(.system(size: 32)).foregroundStyle(Tok.muted)
                    Text("No mapped events").font(.system(size: 15, weight: .bold)).foregroundStyle(Tok.text)
                    Text("Widen the date range or clear the category filter.")
                        .font(.system(size: 13)).foregroundStyle(Tok.muted)
                        .multilineTextAlignment(.center)
                }
                .padding(28)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(mapped) { event in
                                RailRow(event: event,
                                        selected: selectedID == event.id,
                                        onSelect: { selectedID = event.id },
                                        onOpen: { onOpen(event) })
                                    .id(event.id)
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 14)
                    }
                    .onChange(of: selectedID) { _, id in
                        guard let id else { return }
                        withAnimation(.easeInOut(duration: 0.25)) {
                            proxy.scrollTo(id, anchor: .center)
                        }
                    }
                }
            }
        }
    }
}

/// A row in the map rail. Selecting it drives the map; the arrow opens the
/// full detail, so a single tap never does two things at once.
private struct RailRow: View {
    let event: Event
    let selected: Bool
    let onSelect: () -> Void
    let onOpen: () -> Void

    @EnvironmentObject var app: AppState

    var body: some View {
        HStack(spacing: 11) {
            ZStack {
                Categories.wash(event.category)
                if let url = event.imageURL {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() }
                        else { CategoryGlyph(category: event.category, size: 16) }
                    }
                } else {
                    CategoryGlyph(category: event.category, size: 16)
                }
            }
            .frame(width: 58, height: 58)
            .clipShape(RoundedRectangle(cornerRadius: 11))

            VStack(alignment: .leading, spacing: 3) {
                Text(event.title)
                    .font(.system(size: 14.5, weight: .bold)).foregroundStyle(Tok.text)
                    .lineLimit(2).multilineTextAlignment(.leading)
                Text("\(Fmt.time(event.startDate)) · \(event.venue ?? "Venue TBA")")
                    .font(.system(size: 12)).foregroundStyle(Tok.muted).lineLimit(1)
                HStack(spacing: 6) {
                    Text(Fmt.distance(event.distanceKm))
                        .font(.system(size: 11, weight: .bold)).foregroundStyle(Tok.accent)
                    Text("·").foregroundStyle(Tok.muted)
                    Text(Fmt.relDay(event.startDate))
                        .font(.system(size: 11)).foregroundStyle(Tok.muted)
                    if event.isFree { TagChip(text: "Free", kind: .free) }
                }
            }

            Spacer(minLength: 0)

            VStack(spacing: 2) {
                Button { app.toggleSave(event) } label: {
                    Image(systemName: app.isSaved(event) ? "bookmark.fill" : "bookmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(app.isSaved(event) ? Tok.accent : Tok.muted)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                Button(action: onOpen) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Tok.muted)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(selected ? Tok.panel2 : Tok.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14)
            .stroke(selected ? Tok.accent : Tok.hairline, lineWidth: selected ? 2 : 1))
        .contentShape(RoundedRectangle(cornerRadius: 14))
        .onTapGesture(perform: onSelect)
    }
}
