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
    //
    // A small brand strip, then the place as a proper page title. The title is
    // the thing worth reading, so it gets the size; the wordmark only has to
    // say which app you are in.
    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 7) {
                PulseLogoView(size: 18)
                Text("Pulse")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Tok.text)
                Spacer(minLength: 8)
                locationChip
                Button { showPrefs = true } label: {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(Tok.muted)
                        .frame(width: 30, height: 30)
                        .overlay(Circle().stroke(Tok.hairline, lineWidth: 1))
                        .overlay(alignment: .topTrailing) {
                            if app.isPreferenceFiltered {
                                Circle().fill(Tok.accent).frame(width: 8, height: 8)
                                    .overlay(Circle().stroke(Tok.bg, lineWidth: 1.5))
                                    .offset(x: 1, y: -1)
                            }
                        }
                }
            }
            Text("What's on in \(app.placeName)")
                .font(.system(size: 27, weight: .bold))
                .kerning(-0.6)
                .foregroundStyle(Tok.text)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
        }
        .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 12)
    }

    private var locationChip: some View {
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
                .padding(.horizontal, 11).padding(.vertical, 6)
                .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
                .foregroundStyle(Tok.muted)
        }
    }

    // MARK: Controls
    private var controls: some View {
        VStack(spacing: 10) {
            // Sort: two words, with the live one underlined.
            HStack(spacing: 18) {
                segment("Nearest", .nearest)
                segment("Soonest", .soonest)
                Spacer(minLength: 0)
            }
            .overlay(alignment: .bottom) { Rectangle().fill(Tok.hairline).frame(height: 1) }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(EventService.Range.allCases, id: \.self) { r in
                        Pill(text: r.label, active: app.range == r) {
                            app.range = r; Task { await app.load() }
                        }
                    }
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(app.categoryChips, id: \.self) { c in
                        Pill(text: c, active: app.category == c, small: true) {
                            app.category = c
                        }
                    }
                }
            }

            HStack {
                Text(statusText).font(.system(size: 12.5)).foregroundStyle(Tok.muted)
                Spacer()
                Button { Task { await app.load() } } label: {
                    Text(updatedText).font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Tok.faint)
                }
            }

            outOfMarketNotice
        }
        .padding(.horizontal, 16).padding(.bottom, 10)
    }

    /// Shown only when the device is outside the UK. Without it the feed looks
    /// broken, showing London listings under a "near you" heading, when in fact it is
    /// working exactly as intended for a UK-only app.
    @ViewBuilder private var outOfMarketNotice: some View {
        if !app.inMarket && app.placeOverride == nil {
            Button { showPrefs = true } label: {
                HStack(spacing: 8) {
                    Image(systemName: "globe.europe.africa.fill")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(Tok.accent)
                    Text("Pulse covers the UK. Showing \(app.placeName). Tap to pick a town.")
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
        let on = app.sort == value
        return Button { app.sort = value; Task { await app.load() } } label: {
            Text(label).font(.system(size: 14, weight: .semibold))
                .foregroundStyle(on ? Tok.text : Tok.faint)
                .padding(.bottom, 9)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(on ? Tok.accent : .clear).frame(height: 2)
                }
        }
        .buttonStyle(.plain)
        .zIndex(1)
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
                LazyVStack(spacing: 10) {
                    ForEach(app.visibleEvents) { e in
                        Button { selected = e } label: { EventCard(event: e) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 90)
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
        return "Updated \(m == 0 ? "just now" : "\(m)m ago")"
    }
}

/// The one chip used by both filter rows. Outlined when off, filled with the
/// selected colour when on, which is navy on light and near white on dark.
struct Pill: View {
    let text: String
    let active: Bool
    var small: Bool = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: small ? 12 : 12.5, weight: .semibold))
                .padding(.horizontal, small ? 11 : 12).padding(.vertical, small ? 5 : 6)
                .foregroundStyle(active ? Tok.activeFg : Tok.muted)
                .background(active ? Tok.activeBg : .clear, in: Capsule())
                .overlay(Capsule().stroke(active ? Tok.activeBg : Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
