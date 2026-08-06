import SwiftUI

struct SearchView: View {
    @EnvironmentObject var app: AppState
    @State private var selected: Event?
    /// Set while CLGeocoder is resolving a typed address.
    @State private var locating = false
    /// Shown when a typed address could not be found.
    @State private var addressMiss: String?
    private let popular = ["Music", "Food & Drink", "Pop-up", "Free", "Today", "This weekend"]

    var body: some View {
        ZStack {
            Tok.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                searchField
                if app.placeOverride != nil { placeChip }
                if app.search.trimmingCharacters(in: .whitespaces).isEmpty {
                    suggestions
                } else {
                    results
                }
            }
        }
        .sheet(item: $selected) { EventDetailView(event: $0) }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(Tok.muted)
            TextField("Search events, venues, an address, or a date…", text: $app.search)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                .foregroundStyle(Tok.text)
                .submitLabel(.search)
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
        .padding(14)
    }

    private var suggestions: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Popular").font(.system(size: 12, weight: .semibold)).foregroundStyle(Tok.muted)
            FlexWrap(popular) { c in
                Button { app.search = c } label: {
                    Text(c).font(.system(size: 13)).foregroundStyle(Tok.text)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(Tok.chip, in: Capsule())
                        .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
                }
            }
            Spacer()
        }
        .padding(.horizontal, 18)
        .padding(.top, 2)
    }

    @ViewBuilder private var results: some View {
        let outcome = app.searchResults(app.search)
        let hits = outcome.events
        VStack(spacing: 0) {
            if let dq = outcome.dateQuery { dateChip(dq) }
            // Only offer the place interpretation when the text isn't already a
            // pure date query, since "this weekend" is not an address.
            if outcome.dateQuery?.rest.isEmpty != true { addressRow }
            if hits.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").font(.system(size: 34)).foregroundStyle(Tok.muted)
                    Text("No matches").font(.system(size: 17, weight: .bold)).foregroundStyle(Tok.text)
                    Text(outcome.dateQuery != nil ? "No events on that date." : "Try a venue, artist, category, a date like \"this weekend\", or an address.")
                        .font(.system(size: 13.5)).foregroundStyle(Tok.muted)
                }.padding(40); Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(hits) { e in
                            Button { selected = e } label: { EventCard(event: e) }.buttonStyle(.plain)
                        }
                    }.padding(.horizontal, 14).padding(.bottom, 40)
                }
            }
        }
    }

    /// Offered above the results: treat what was typed as a place, not a title.
    /// Tapping it geocodes on-device and re-centres the whole feed there.
    private var addressRow: some View {
        let query = app.search.trimmingCharacters(in: .whitespaces)
        return Button {
            Task { await useAsAddress(query) }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: locating ? "clock" : "mappin.and.ellipse")
                    .font(.system(size: 14, weight: .semibold)).foregroundStyle(Tok.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text(locating ? "Finding “\(query)”…" : "Search near “\(query)”")
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(Tok.text)
                        .lineLimit(1)
                    Text(addressMiss == query
                         ? "Couldn't find that address in the UK."
                         : "Show events around this address instead")
                        .font(.system(size: 12))
                        .foregroundStyle(addressMiss == query ? Tok.accent2 : Tok.muted)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                if !locating {
                    Image(systemName: "arrow.right")
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(Tok.muted)
                }
            }
            .padding(.horizontal, 13).padding(.vertical, 11)
            .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(locating)
        // Bottom padding matters as much as top here: without it the first
        // result card butts straight up against this row and the two read as
        // one block.
        .padding(.horizontal, 14).padding(.top, 8).padding(.bottom, 12)
    }

    /// The standing reminder that the feed is centred somewhere the user chose,
    /// with the one tap that undoes it.
    @ViewBuilder private var placeChip: some View {
        if let o = app.placeOverride {
            HStack(spacing: 6) {
                Label(o.label, systemImage: o.kind == .address ? "mappin.and.ellipse" : "building.2")
                    .font(.system(size: 13, weight: .semibold)).foregroundStyle(Tok.text)
                    .lineLimit(1)
                Button { Task { await app.clearOverride() } } label: {
                    Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).foregroundStyle(Tok.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Stop searching near \(o.label)")
            }
            .padding(.horizontal, 13).padding(.vertical, 7)
            .background(Tok.chip, in: Capsule())
            .overlay(Capsule().stroke(Tok.accent.opacity(0.5), lineWidth: 1))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14).padding(.bottom, 12)
        }
    }

    private func useAsAddress(_ query: String) async {
        locating = true
        addressMiss = nil
        let ok = await app.searchAddress(query)
        locating = false
        if ok {
            // The query has done its job as a place; clear it so the full
            // re-centred feed shows rather than a text match on the street name.
            app.search = ""
        } else {
            addressMiss = query
        }
    }

    private func dateChip(_ dq: DateQuery) -> some View {
        HStack(spacing: 6) {
            Label(dq.label, systemImage: "calendar").font(.system(size: 13, weight: .semibold)).foregroundStyle(Tok.text)
            Button { app.search = dq.rest } label: {
                Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).foregroundStyle(Tok.muted)
            }
        }
        .padding(.horizontal, 13).padding(.vertical, 7)
        .background(Tok.chip, in: Capsule())
        .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 2)
    }
}

/// Minimal wrapping HStack for chips.
struct FlexWrap<Item: Hashable, Content: View>: View {
    let items: [Item]
    let content: (Item) -> Content
    init(_ items: [Item], @ViewBuilder content: @escaping (Item) -> Content) {
        self.items = items; self.content = content
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(rows, id: \.self) { row in
                HStack(spacing: 8) { ForEach(row, id: \.self) { content($0) } }
            }
        }
    }
    private var rows: [[Item]] {
        var result: [[Item]] = [[]]
        var count = 0
        for item in items {
            if count >= 3 { result.append([]); count = 0 }
            result[result.count - 1].append(item); count += 1
        }
        return result
    }
}
