import SwiftUI

/// Settings. Reached from the gear in the brand strip on Discover, Saved and
/// Search, which is where it moved to when Map took its place in the tab bar.
///
/// Two things live here: which town the feed is built around, and which
/// interests it is narrowed to. Changes apply to the feed and the map
/// immediately (preferredCategories is @Published and persisted on each toggle).
struct PreferencesView: View {
    @EnvironmentObject var app: AppState
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss

    /// False until the catalogue fetch has actually been attempted. Without it
    /// a failed fetch is indistinguishable from a slow one, and the picker sits
    /// on "Loading towns" for ever with no way to retry.
    @State private var triedRegions = false

    /// Settings is itself a sheet, so it cannot use the app-wide unlock prompt
    /// that MainTabView presents underneath it.
    @State private var paywall: UnlockReason?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    unlockSection

                    Divider().overlay(Tok.hairline).padding(.vertical, 4)

                    locationSection

                    Divider().overlay(Tok.hairline).padding(.vertical, 4)

                    Text("Show me events about…")
                        .font(.system(size: 14)).foregroundStyle(Tok.muted).padding(.horizontal, 4)

                    let cols = [GridItem(.flexible()), GridItem(.flexible())]
                    LazyVGrid(columns: cols, spacing: 10) {
                        ForEach(Preferences.all) { p in chip(p) }
                    }

                    Text(app.preferredCategories.isEmpty
                         ? "Nothing selected, so we show everything."
                         : "Showing only your selected interests.")
                        .font(.system(size: 12.5)).foregroundStyle(Tok.muted)
                        .padding(.top, 4).padding(.horizontal, 4)
                }
                .padding(16)
            }
            .background(Tok.bg.ignoresSafeArea())
            .task { await refreshRegions() }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .paywall($paywall)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if !app.preferredCategories.isEmpty {
                        Button("Clear") { app.clearPreferences() }
                            .foregroundStyle(Tok.link)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold).foregroundStyle(Tok.accent)
                }
            }
        }
    }

    // MARK: Unlock

    /// The unlock, and the way back to it after a reinstall or on a new phone.
    ///
    /// Restore has to be reachable here rather than only from the unlock sheet.
    /// App Review checks that a non-consumable can be restored without having
    /// to walk into a paywall first, and a user who already paid should never
    /// have to be told no before they can say "I own this".
    @ViewBuilder private var unlockSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("VenTrack")
                .font(.system(size: 14)).foregroundStyle(Tok.muted).padding(.horizontal, 4)

            if app.unlocked {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(Tok.accent)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Unlocked")
                            .font(.system(size: 14.5, weight: .semibold)).foregroundStyle(Tok.text)
                        Text("Every town, the whole calendar, unlimited saves and reminders.")
                            .font(.system(size: 12)).foregroundStyle(Tok.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 13).padding(.vertical, 11)
                .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
                .accessibilityElement(children: .combine)
            } else {
                countryRow(label: "Unlock everything",
                           detail: "Every town, the whole calendar, unlimited saves",
                           selected: false) {
                    paywall = .general
                }
                Button {
                    Task { await store.restore() }
                } label: {
                    Text(store.busy ? "Checking" : "Restore a previous purchase")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Tok.link)
                        .padding(.horizontal, 4)
                }
                .buttonStyle(.plain)
                .disabled(store.busy)

                if let failure = store.failure {
                    Text(failure)
                        .font(.system(size: 12.5)).foregroundStyle(Tok.accent)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 4)
                }
            }
        }
    }

    // MARK: Location

    /// Lets the user browse a different UK town outright. Picking one overrides
    /// GPS until they switch back to Automatic, so you can plan a trip from
    /// home, or see what's on back in Cardiff while you're away.
    private var locationSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Where to show events for")
                .font(.system(size: 14)).foregroundStyle(Tok.muted).padding(.horizontal, 4)

            VStack(spacing: 8) {
                countryRow(label: "Automatic",
                           detail: "Use my location",
                           selected: app.placeOverride == nil) {
                    Task { await app.clearOverride() }
                }

                ForEach(app.countries) { c in
                    if c.cities.count > 1 {
                        // The UK covers several hundred towns, so the row opens
                        // the list rather than silently deciding the country
                        // means its capital.
                        NavigationLink {
                            RegionBrowserView(country: c)
                        } label: {
                            countryRowLabel(label: c.label,
                                            detail: detail(for: c),
                                            selected: isSelected(c),
                                            chevron: true)
                        }
                        .buttonStyle(.plain)
                    } else {
                        countryRow(label: c.label,
                                   detail: detail(for: c),
                                   selected: isSelected(c)) {
                            guard app.unlocked else { paywall = .towns; return }
                            Task { await app.selectCountry(c) }
                        }
                    }
                }
            }

            if let o = app.placeOverride, o.kind == .city {
                Text("Currently browsing \(o.label). Choose another town or Automatic to leave it.")
                    .font(.system(size: 12.5)).foregroundStyle(Tok.accent)
                    .padding(.horizontal, 4)
            } else if let o = app.placeOverride, o.kind == .address {
                Text("Currently centred on “\(o.label)” from a search. Choose a town or Automatic to leave it.")
                    .font(.system(size: 12.5)).foregroundStyle(Tok.accent)
                    .padding(.horizontal, 4)
            } else if !app.inMarket {
                Text("VenTrack covers the UK and you're outside it, so we show \(app.placeName). Pick any town to browse it.")
                    .font(.system(size: 12.5)).foregroundStyle(Tok.accent)
                    .padding(.horizontal, 4)
            } else if app.countries.isEmpty {
                if triedRegions {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("The town list could not be loaded. Check your connection, then try again.")
                            .font(.system(size: 12.5)).foregroundStyle(Tok.muted)
                        Button("Try again") { Task { await refreshRegions() } }
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(Tok.link)
                    }
                    .padding(.horizontal, 4)
                } else {
                    Text("Loading towns…")
                        .font(.system(size: 12.5)).foregroundStyle(Tok.muted).padding(.horizontal, 4)
                }
            }
        }
    }

    /// Fetch the catalogue, recording that the attempt happened either way.
    /// `AppState.loadRegions` is a no-op once the list is in hand, so this is
    /// safe to call on every appearance and on every retry.
    @MainActor private func refreshRegions() async {
        triedRegions = false
        await app.loadRegions()
        triedRegions = true
    }

    /// Whether this country's row is the one currently in force. A country with
    /// several towns counts as selected when any of its towns was picked.
    private func isSelected(_ c: RegionCountry) -> Bool {
        guard let o = app.placeOverride else { return false }
        switch o.kind {
        case .country: return o.label == c.label
        case .city:    return c.cities.contains { $0.label == o.label }
        case .address: return false
        }
    }

    /// What sits under the country name. A single-city country names its city;
    /// a large one says how much it covers, or which town is in force.
    private func detail(for c: RegionCountry) -> String? {
        if let o = app.placeOverride, o.kind == .city,
           c.cities.contains(where: { $0.label == o.label }) {
            return o.label
        }
        if c.cities.count > 1 { return "\(c.cities.count) towns and cities" }
        return c.primary?.label
    }

    private func countryRow(label: String,
                            detail: String?,
                            selected: Bool,
                            action: @escaping () -> Void) -> some View {
        Button(action: action) {
            countryRowLabel(label: label, detail: detail, selected: selected, chevron: false)
        }
        .buttonStyle(.plain)
    }

    private func countryRowLabel(label: String,
                                 detail: String?,
                                 selected: Bool,
                                 chevron: Bool) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(selected ? Tok.activeFg : Tok.text)
                if let detail {
                    Text(detail)
                        .font(.system(size: 12))
                        .foregroundStyle(selected ? Tok.activeFg.opacity(0.85) : Tok.muted)
                }
            }
            Spacer(minLength: 0)
            if selected {
                Image(systemName: "checkmark")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(Tok.activeFg)
            }
            if chevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(selected ? Tok.activeFg : Tok.muted)
            }
        }
        .padding(.horizontal, 13).padding(.vertical, 11)
        .background(selected ? Tok.activeBg : Tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
            .stroke(selected ? Tok.activeBg : Tok.hairline, lineWidth: 1))
    }

    private func chip(_ p: Preference) -> some View {
        let on = app.preferredCategories.contains(p.id)
        return Button { app.togglePreference(p.id) } label: {
            HStack(spacing: 8) {
                Image(systemName: p.symbol)
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(on ? Tok.activeFg : Tok.accent)
                    .frame(width: 20)
                Text(p.label).font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(on ? Tok.activeFg : Tok.text).lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
                if on { Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Tok.activeFg) }
            }
            .padding(.horizontal, 12).padding(.vertical, 12)
            .background(on ? Tok.activeBg : Tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(on ? Tok.activeBg : Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
