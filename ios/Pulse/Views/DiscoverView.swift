import SwiftUI

struct DiscoverView: View {
    @EnvironmentObject var app: AppState
    @State private var selected: Event?
    @State private var showPrefs = false

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Tok.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                controls
                content
            }
            mapFab
        }
        .sheet(item: $selected) { EventDetailView(event: $0) }
        .sheet(isPresented: $showPrefs) { PreferencesView() }
    }

    // MARK: Header
    private var header: some View {
        HStack(alignment: .center, spacing: 9) {
            PulseMarkView(size: 26)
            VStack(alignment: .leading, spacing: 1) {
                Text("Pulse").font(.system(size: 21, weight: .heavy)).foregroundStyle(Tok.text)
                Text("what's on in \(app.placeName), right now").font(.system(size: 11.5)).foregroundStyle(Tok.muted)
            }
            Spacer()
            Button { showPrefs = true } label: {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Tok.text)
                    .frame(width: 34, height: 34)
                    .background(Tok.panel, in: Circle())
                    .overlay(Circle().stroke(Tok.hairline, lineWidth: 1))
                    .overlay(alignment: .topTrailing) {
                        if app.isPreferenceFiltered {
                            Circle().fill(Tok.accent).frame(width: 9, height: 9)
                                .overlay(Circle().stroke(Tok.bg, lineWidth: 1.5))
                                .offset(x: 1, y: -1)
                        }
                    }
            }
            Button {
                // With a manual place set, the chip's job is to clear it rather
                // than to re-ask for a permission we aren't using.
                if app.placeOverride != nil { Task { await app.clearOverride() } }
                else { app.tapLocationChip() }
            } label: {
                Label(app.locationChipLabel,
                      systemImage: app.placeOverride == nil ? "location.fill" : "mappin.circle.fill")
                    .lineLimit(1)
                    .font(.system(size: 12, weight: .semibold))
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .background(Tok.panel, in: Capsule())
                    .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
                    .foregroundStyle(Tok.text)
            }
        }
        .padding(.horizontal, 14).padding(.top, 8).padding(.bottom, 10)
    }

    // MARK: Controls
    private var controls: some View {
        VStack(spacing: 10) {
            // Sort segmented
            HStack(spacing: 3) {
                segment("Nearest", .nearest)
                segment("Soonest", .soonest)
            }
            .padding(4)
            .background(Tok.panel, in: Capsule())
            .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
            .frame(maxWidth: .infinity, alignment: .leading)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(EventService.Range.allCases, id: \.self) { r in
                        Pill(text: r.label, active: app.range == r, color: Tok.accent) {
                            app.range = r; Task { await app.load() }
                        }
                    }
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(app.categoryChips, id: \.self) { c in
                        Pill(text: c, active: app.category == c, color: Tok.accent2, filledText: .white) {
                            app.category = c
                        }
                    }
                }
            }

            HStack {
                Text(statusText).font(.system(size: 12.5)).foregroundStyle(Tok.muted)
                Spacer()
                Button { Task { await app.load() } } label: {
                    Text(updatedText).font(.system(size: 12, weight: .semibold)).foregroundStyle(Tok.accent2)
                }
            }

            outOfMarketNotice
        }
        .padding(.horizontal, 14).padding(.bottom, 8)
    }

    /// Shown only when the device is outside the UK. Without it the feed looks
    /// broken — London listings under a "near you" heading — when in fact it is
    /// working exactly as intended for a UK-only app.
    @ViewBuilder private var outOfMarketNotice: some View {
        if !app.inMarket && app.placeOverride == nil {
            Button { showPrefs = true } label: {
                HStack(spacing: 8) {
                    Image(systemName: "globe.europe.africa.fill")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(Tok.accent)
                    Text("Pulse covers the UK — showing \(app.placeName). Tap to pick a town.")
                        .font(.system(size: 12)).foregroundStyle(Tok.text)
                        .lineLimit(2).multilineTextAlignment(.leading)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 11).padding(.vertical, 9)
                .background(Tok.panel, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(Tok.accent.opacity(0.45), lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    private func segment(_ label: String, _ value: EventService.Sort) -> some View {
        Button { app.sort = value; Task { await app.load() } } label: {
            Text(label).font(.system(size: 13.5, weight: .semibold))
                .padding(.vertical, 9).padding(.horizontal, 18)
                .foregroundStyle(app.sort == value ? .white : Tok.muted)
                .background(app.sort == value ? Tok.accent : .clear, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: Content
    @ViewBuilder private var content: some View {
        if app.loading && app.events.isEmpty {
            LoadingState()
        } else if let err = app.errorMessage, app.events.isEmpty {
            ErrorState(message: err) { Task { await app.load() } }
        } else if app.visibleEvents.isEmpty {
            EmptyState { app.category = "All"; app.range = .all; Task { await app.load() } }
        } else {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(app.visibleEvents) { e in
                        Button { selected = e } label: { EventCard(event: e) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14).padding(.top, 6).padding(.bottom, 90)
            }
            .refreshable { await app.load() }
        }
    }

    private var mapFab: some View {
        Button { app.tab = 1 } label: {
            Label("Map", systemImage: "map.fill")
                .font(.system(size: 14, weight: .bold))
                .padding(.horizontal, 18).padding(.vertical, 12)
                .background(Tok.accent, in: Capsule())
                .foregroundStyle(.white)
                .shadow(color: Tok.accent.opacity(0.4), radius: 10, y: 6)
        }
        .padding(.trailing, 16).padding(.bottom, 18)
    }

    private var statusText: String {
        let rl = ["all": "upcoming", "today": "today", "weekend": "this weekend", "week": "this week"][app.range.rawValue] ?? ""
        return "\(app.visibleEvents.count) events \(rl) \(app.originPhrase)"
    }
    private var updatedText: String {
        guard let t = app.lastLoad else { return "" }
        let m = Int(Date.now.timeIntervalSince(t) / 60)
        return "Updated \(m == 0 ? "just now" : "\(m)m ago") ↻"
    }
}

struct Pill: View {
    let text: String
    let active: Bool
    var color: Color
    var filledText: Color = .white
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(text).font(.system(size: 12.5, weight: .semibold))
                .padding(.horizontal, 13).padding(.vertical, 7)
                .foregroundStyle(active ? filledText : Tok.muted)
                .background(active ? color : Tok.panel, in: Capsule())
                .overlay(Capsule().stroke(active ? color : Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
