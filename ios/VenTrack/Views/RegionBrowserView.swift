import SwiftUI

/// The full list of towns VenTrack covers, for when "United Kingdom" is too
/// blunt an instrument. The catalogue runs to several hundred entries: at
/// least one per ceremonial county, principal area, council area and NI
/// county, plus the bigger cities and towns. So this screen leads with a
/// filter field and groups the rest by nation and county.
///
/// The filter field and the Automatic row are held above the scroll view
/// rather than inside it. With several hundred rows underneath, a header that
/// scrolls away means a user deep in Scotland has to flick all the way back to
/// the top to change the filter, or to hand ranking back to the device.
struct RegionBrowserView: View {
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss

    let country: RegionCountry

    @State private var query = ""

    var body: some View {
        VStack(spacing: 0) {
            header
            list
        }
        .background(Tok.bg.ignoresSafeArea())
        .navigationTitle(country.label)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: Header

    private var header: some View {
        VStack(spacing: 10) {
            searchField
            automaticRow
            countLine
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 12)
        .background(Tok.bg)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Tok.hairline).frame(height: 1)
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14)).foregroundStyle(Tok.muted)
            TextField("Filter by town or county", text: $query)
                .font(.system(size: 15))
                .foregroundStyle(Tok.text)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.search)
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 15)).foregroundStyle(Tok.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear the filter")
            }
        }
        .padding(.horizontal, 13).padding(.vertical, 11)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
    }

    /// The way back out. Without it, a user who picks a town has to work out
    /// that the route back to their own location is up a level in Settings.
    /// It sits outside the filtered list on purpose, so it is still there when
    /// the query matches nothing.
    private var automaticRow: some View {
        let selected = app.placeOverride == nil
        return Button {
            Task {
                await app.clearOverride()
                dismiss()
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "location.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(selected ? Tok.activeFg : Tok.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Automatic")
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(selected ? Tok.activeFg : Tok.text)
                    Text("Use my location")
                        .font(.system(size: 12))
                        .foregroundStyle(selected ? Tok.activeFg.opacity(0.85) : Tok.muted)
                }
                Spacer(minLength: 0)
                if selected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(Tok.activeFg)
                }
            }
            .padding(.horizontal, 13).padding(.vertical, 11)
            .background(selected ? Tok.activeBg : Tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(selected ? Tok.activeBg : Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    /// How much of the catalogue is on screen. With this many towns, a filter
    /// that quietly cut the list to three would otherwise look like the app
    /// only covering three.
    private var countLine: some View {
        let total = country.cities.count
        let shown = sections.reduce(0) { $0 + $1.cities.count }
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "All \(total) towns and cities, grouped by nation."
            : "\(shown) of \(total) match."
        return Text(text)
            .font(.system(size: 12))
            .foregroundStyle(Tok.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 4)
    }

    // MARK: List

    private var list: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14, pinnedViews: [.sectionHeaders]) {
                if sections.isEmpty {
                    Text("Nothing matches “\(query)”.")
                        .font(.system(size: 13)).foregroundStyle(Tok.muted)
                        .padding(.horizontal, 4).padding(.top, 8)
                } else {
                    ForEach(sections) { section in
                        Section {
                            VStack(spacing: 8) {
                                ForEach(section.cities) { city in
                                    cityRow(city)
                                }
                            }
                        } header: {
                            if let nation = section.nation {
                                Text(nation)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Tok.muted)
                                    .padding(.horizontal, 4).padding(.vertical, 8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Tok.bg)
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    /// Sections filtered by the query. Matching is on "town county nation" so
    /// typing a county name surfaces every town in it.
    private var sections: [RegionCountry.Section] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return country.sections }
        return country.sections.compactMap { section in
            let hits = section.cities.filter {
                $0.searchText.localizedCaseInsensitiveContains(q)
            }
            return hits.isEmpty ? nil : RegionCountry.Section(nation: section.nation, cities: hits)
        }
    }

    private func cityRow(_ city: RegionCountry.City) -> some View {
        let selected = app.placeOverride?.kind == .city && app.placeOverride?.label == city.label
        return Button {
            Task {
                await app.selectCity(city)
                dismiss()
            }
        } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(city.label)
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(selected ? Tok.activeFg : Tok.text)
                    if let area = city.area, area != city.label {
                        Text(area)
                            .font(.system(size: 12))
                            .foregroundStyle(selected ? Tok.activeFg.opacity(0.85) : Tok.muted)
                    }
                }
                Spacer(minLength: 0)
                if selected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(Tok.activeFg)
                }
            }
            .padding(.horizontal, 13).padding(.vertical, 11)
            .background(selected ? Tok.activeBg : Tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(selected ? Tok.activeBg : Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
