import SwiftUI

/// Edit interests any time after onboarding. Changes apply to the feed + map
/// immediately (preferredCategories is @Published and persisted on each toggle).
struct PreferencesView: View {
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
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
            .task { await app.loadRegions() }
            .navigationTitle("Preferences")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if !app.preferredCategories.isEmpty {
                        Button("Clear") { app.clearPreferences() }
                            .foregroundStyle(Tok.accent2)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold).foregroundStyle(Tok.accent)
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
                Text("Pulse covers the UK and you're outside it, so we show \(app.placeName). Pick any town to browse it.")
                    .font(.system(size: 12.5)).foregroundStyle(Tok.accent)
                    .padding(.horizontal, 4)
            } else if app.countries.isEmpty {
                Text("Loading towns…")
                    .font(.system(size: 12.5)).foregroundStyle(Tok.muted).padding(.horizontal, 4)
            }
        }
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
                    .foregroundStyle(selected ? .white : Tok.text)
                if let detail {
                    Text(detail)
                        .font(.system(size: 12))
                        .foregroundStyle(selected ? .white.opacity(0.85) : Tok.muted)
                }
            }
            Spacer(minLength: 0)
            if selected {
                Image(systemName: "checkmark")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
            }
            if chevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(selected ? .white : Tok.muted)
            }
        }
        .padding(.horizontal, 13).padding(.vertical, 11)
        .background(selected ? Tok.accent : Tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
            .stroke(selected ? Tok.accent : Tok.hairline, lineWidth: 1))
    }

    private func chip(_ p: Preference) -> some View {
        let on = app.preferredCategories.contains(p.id)
        return Button { app.togglePreference(p.id) } label: {
            HStack(spacing: 8) {
                Text(p.emoji).font(.system(size: 18))
                Text(p.label).font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(on ? .white : Tok.text).lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
                if on { Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(.white) }
            }
            .padding(.horizontal, 12).padding(.vertical, 12)
            .background(on ? Tok.accent : Tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(on ? Tok.accent : Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
