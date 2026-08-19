import SwiftUI

/// One field that takes a title, a venue, a category, a date phrase or a place.
/// The empty state is where that gets explained: the example chips are the
/// documentation for the parser, so nobody has to guess that "25/7" or "next
/// friday" will work.
struct SearchView: View {
    @EnvironmentObject var app: AppState
    @State private var selected: Event?
    /// Set while CLGeocoder is resolving a typed address.
    @State private var locating = false
    /// Shown when a typed address could not be found.
    @State private var addressMiss: String?

    /// One of each kind the parser understands: a date phrase, a price filter
    /// and a place. Ordered so the first row is short and the second reads as
    /// the two longer ideas.
    private let examples = ["this weekend", "free", "25/7", "gigs in Leeds", "next friday"]

    var body: some View {
        ZStack {
            Tok.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                if app.placeOverride != nil { placeChip }
                if app.search.trimmingCharacters(in: .whitespaces).isEmpty {
                    suggestions
                } else {
                    results
                }
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) { chrome }
        .sheet(item: $selected) { EventDetailView(event: $0) }
    }

    private var chrome: some View {
        VStack(spacing: 0) {
            BrandStrip()
            searchField
        }
        .padding(.bottom, 11)
        .topChrome()
    }

    private var searchField: some View {
        HStack(spacing: 9) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Tok.muted)
            TextField("Search events, venues, a date or a place", text: $app.search)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.system(size: 15))
                .foregroundStyle(Tok.text)
                .submitLabel(.search)
            if !app.search.isEmpty {
                Button { app.search = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 15))
                        .foregroundStyle(Tok.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear the search")
            }
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 12)
        .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(Tok.hairline, lineWidth: 1))
        .padding(.horizontal, 16)
    }

    private var suggestions: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("TRY")
                .font(.system(size: 10.5, weight: .bold))
                .kerning(0.85)
                .foregroundStyle(Tok.faint)
            FlexWrap(examples) { q in
                Button { app.search = q } label: {
                    Text(q)
                        .font(.system(size: 13.5))
                        .foregroundStyle(Tok.text)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(Tok.panel2, in: Capsule())
                        .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Search for \(q)")
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.top, 14)
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
                // A date past the free window is not "no events on that date",
                // it is "we did not look that far". Saying the first would be
                // a lie, and the honest version is also the one that sells.
                let beyondFreeWindow = !app.unlocked
                    && (outcome.dateQuery?.range.upperBound ?? .distantPast) > freeWindowEnd
                VStack(spacing: 8) {
                    Image(systemName: beyondFreeWindow ? "calendar.badge.clock" : "magnifyingglass")
                        .font(.system(size: 34)).foregroundStyle(Tok.muted)
                    Text(beyondFreeWindow ? "That is past the next seven days" : "No matches")
                        .font(.system(size: 17, weight: .bold)).foregroundStyle(Tok.text)
                    Text(beyondFreeWindow
                         ? "The free app looks seven days ahead. Unlock VenTrack once to search the whole calendar."
                         : (outcome.dateQuery != nil
                            ? "No events on that date."
                            : "Try a venue, an artist, a category, a date like \"this weekend\", or a place."))
                        .font(.system(size: 13.5)).foregroundStyle(Tok.muted)
                        .multilineTextAlignment(.center)
                    if beyondFreeWindow {
                        Button("See what to unlock") { app.unlockPrompt = .dateRange }
                            .font(.system(size: 13.5, weight: .semibold))
                            .foregroundStyle(Tok.link)
                            .padding(.top, 2)
                    }
                }
                .padding(40)
                Spacer(minLength: 0)
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(hits) { e in
                            Button { selected = e } label: { EventCard(event: e) }
                                .buttonStyle(PressableRow())
                        }
                    }
                    .padding(.horizontal, 16).padding(.bottom, 28)
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
                    .font(.system(size: 14, weight: .semibold)).foregroundStyle(Tok.link)
                VStack(alignment: .leading, spacing: 2) {
                    Text(locating ? "Finding \"\(query)\"" : "Search near \"\(query)\"")
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(Tok.text)
                        .lineLimit(1)
                    Text(addressMiss == query
                         ? "Could not find that address in the UK."
                         : (app.unlocked
                            ? "Show events around this place instead"
                            : "Part of the paid unlock"))
                        .font(.system(size: 12))
                        .foregroundStyle(addressMiss == query ? Tok.accent : Tok.muted)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                if !locating {
                    if app.unlocked {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .bold)).foregroundStyle(Tok.muted)
                    } else {
                        LockBadge()
                    }
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
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 12)
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
                    Image(systemName: "xmark").font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Tok.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Stop searching near \(o.label)")
            }
            .padding(.horizontal, 13).padding(.vertical, 7)
            .background(Tok.panel2, in: Capsule())
            .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16).padding(.top, 12)
        }
    }

    private func useAsAddress(_ query: String) async {
        locating = true
        addressMiss = nil
        let outcome = await app.searchAddress(query)
        locating = false
        switch outcome {
        case .moved:
            // The query has done its job as a place; clear it so the full
            // re-centred feed shows rather than a text match on the street name.
            app.search = ""
        case .notFound:
            addressMiss = query
        case .locked:
            app.unlockPrompt = .towns
        }
    }

    /// The far edge of what the free app fetched: the same eight day window the
    /// backend's `range=week` uses, so this agrees with the feed rather than
    /// guessing at it. Built with calendar arithmetic rather than adding
    /// seconds, so it stays right across a clock change.
    private var freeWindowEnd: Date {
        let cal = Calendar.current
        let start = cal.startOfDay(for: .now)
        return cal.date(byAdding: .day, value: 8, to: start) ?? start
    }

    private func dateChip(_ dq: DateQuery) -> some View {
        HStack(spacing: 6) {
            Label(dq.label, systemImage: "calendar")
                .font(.system(size: 13, weight: .semibold)).foregroundStyle(Tok.text)
            Button { app.search = dq.rest } label: {
                Image(systemName: "xmark").font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Tok.muted)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Drop the date from this search")
        }
        .padding(.horizontal, 13).padding(.vertical, 7)
        .background(Tok.panel2, in: Capsule())
        .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 2)
    }
}

/// Minimal wrapping HStack for chips. Three to a row, which is what the two
/// short examples plus one long one come out at.
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
