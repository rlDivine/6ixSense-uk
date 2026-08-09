import SwiftUI

/// The most-used component in the app. A row rather than a poster: a thumbnail
/// on the left, then an overline saying when, the title, the venue, and a quiet
/// footer of category, distance, price and source.
///
/// Two treatments live here.
///
/// * The default (option 1d in the handoff) is the editorial row with an 84pt
///   thumbnail. The category wash and glyph sit *underneath* the photo, so an
///   image that never loads leaves the mark showing rather than an empty box.
/// * `compact` (option 1f, the index row) drops the thumbnail entirely and puts
///   a 4pt category spine down the leading edge instead. The title gets the
///   whole width. The iPad grid asks for this when its cells are narrow, and it
///   is also used automatically for an event with no usable photo, because a
///   tinted square carries less than the extra width does.
struct EventCard: View {
    let event: Event
    /// Option 1f. Callers with narrow cells (the iPad two up grid) pass true.
    var compact: Bool = false

    @EnvironmentObject var app: AppState
    @Environment(\.dynamicTypeSize) private var typeSize

    /// Only the caller decides this now. A missing photo used to force the
    /// index treatment too, which dropped those rows to a bare colour spine and
    /// made a feed of image-less sources look broken. They get drawn artwork
    /// instead, so the thumbnail always has something to hold.
    private var usesIndex: Bool { compact }

    private var catColor: Color { Categories.style(event.category).color }

    var body: some View {
        // The bookmark is a sibling laid over the card, never a child of the
        // card's own tap target. The text column reserves 36pt on the right so
        // the title can never run underneath it.
        ZStack(alignment: .topTrailing) {
            surface
            bookmark
        }
    }

    // MARK: Container

    private var surface: some View {
        HStack(alignment: .top, spacing: 13) {
            if !usesIndex { thumb }
            textColumn
        }
        .padding(12)
        .padding(.leading, usesIndex ? 4 : 0)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tok.panel)
        .overlay(alignment: .leading) { spine }
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
    }

    /// The 4pt category bar that stands in for the thumbnail on an index row.
    @ViewBuilder private var spine: some View {
        if usesIndex {
            Rectangle().fill(catColor).frame(width: 4)
        }
    }

    private var thumb: some View {
        ZStack {
            CategoryArtwork(category: event.category, seed: event.id.hashValue)
            // The photo sits on top of the artwork, so a URL that fails to load
            // leaves the composition showing rather than a blank square.
            if let url = event.imageURL {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        Color.clear
                    }
                }
            }
        }
        .frame(width: 84, height: 84)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityHidden(true)
    }

    // MARK: Text column

    private var textColumn: some View {
        VStack(alignment: .leading, spacing: 3) {
            overline
            Text(event.title)
                .font(.system(size: usesIndex ? 17 : 16, weight: .semibold))
                .kerning(-0.2)
                .lineSpacing(1)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .foregroundStyle(Tok.text)
            Text(venueText)
                .font(.system(size: 13.5))
                .foregroundStyle(Tok.muted)
                .lineLimit(1)
            footer
        }
        .padding(.trailing, 36)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var venueText: String {
        if let v = event.venue, !v.isEmpty { return v }
        return app.placeName
    }

    /// "TODAY, 19:00" in the accent, "SAT, 8 AUG, 19:00" in the quiet grey.
    /// Imminence is the one thing in a list worth colouring. On an index row the
    /// category joins it here, because the footer has no dot to carry it.
    private var overline: some View {
        let w = Fmt.when(event.startDate)
        return HStack(spacing: 8) {
            Text(w.text.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .kerning(0.84)
                .foregroundStyle(w.soon ? Tok.accent : Tok.faint)
            if usesIndex && showsCategoryName {
                Text(event.category.uppercased())
                    .font(.system(size: 10.5, weight: .bold))
                    .kerning(0.84)
                    .foregroundStyle(catColor)
            }
        }
        .lineLimit(1)
    }

    // MARK: Footer
    //
    // Category dot, category, distance, price, source, separated by dots.
    // Quiet by design: it is reference detail, not something to scan. The
    // source is the quietest thing on the card, because it is a trust signal
    // and not a headline.
    //
    // Dynamic Type breaks this line first, so at the accessibility sizes it
    // gives up the source, then the category name, and keeps distance and
    // price, which are the two facts a person is actually comparing.

    /// The source goes at the first accessibility size.
    private var showsSource: Bool { !typeSize.isAccessibilitySize }
    /// The category name goes a couple of steps later. The dot stays, so the
    /// colour still says which category it is.
    private var showsCategoryName: Bool { typeSize < .accessibility3 }
    /// An index row prints the category on the overline instead.
    private var showsCategoryDot: Bool { !usesIndex }

    private struct Meta: Identifiable {
        let id: Int
        let text: String
        /// Free is a strong signal, so it gets weight and the primary ink
        /// rather than being spent as another red mark.
        let strong: Bool
        /// The source, held back a little.
        let quiet: Bool
    }

    private var metaItems: [Meta] {
        var out: [Meta] = []
        if let km = event.distanceKm {
            out.append(Meta(id: out.count, text: Fmt.distance(km), strong: false, quiet: false))
        }
        if event.isFree {
            out.append(Meta(id: out.count, text: "Free", strong: true, quiet: false))
        } else if let p = event.price, !p.isEmpty {
            out.append(Meta(id: out.count, text: p, strong: false, quiet: false))
        }
        if showsSource && !event.source.isEmpty {
            out.append(Meta(id: out.count, text: event.source, strong: false, quiet: true))
        }
        return out
    }

    private var footer: some View {
        HStack(spacing: 6) {
            if showsCategoryDot {
                HStack(spacing: 5) {
                    Circle().fill(catColor).frame(width: 6, height: 6)
                    if showsCategoryName {
                        Text(event.category)
                            .font(.system(size: 11.5))
                            .foregroundStyle(Tok.faint)
                    }
                }
            }
            ForEach(metaItems) { item in
                if item.id > 0 || showsCategoryDot { separator }
                Text(item.text)
                    .font(.system(size: 11.5, weight: item.strong ? .semibold : .regular))
                    .foregroundStyle(item.strong ? Tok.text : Tok.faint)
                    .opacity(item.quiet ? 0.75 : 1)
            }
        }
        .lineLimit(1)
        .padding(.top, 4)
    }

    private var separator: some View {
        Circle().fill(Tok.faint).frame(width: 2, height: 2).opacity(0.7)
    }

    // MARK: Bookmark

    private var bookmark: some View {
        let saved = app.isSaved(event)
        return Button {
            app.toggleSave(event)
        } label: {
            Image(systemName: saved ? "bookmark.fill" : "bookmark")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(saved ? Tok.accent : Tok.faint)
                .frame(width: 36, height: 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(saved ? "Remove \(event.title) from saved" : "Save \(event.title)")
        .accessibilityValue(saved ? "Saved" : "Not saved")
        .accessibilityAddTraits(saved ? AccessibilityTraits.isSelected : [])
        .padding(.top, 4)
        .padding(.trailing, 4)
    }
}

enum TagKind { case category, neutral, free }

/// Small outlined label, used on the detail sheet and the iPad grid. Outlined
/// rather than filled, so several of them together stay quiet.
struct TagChip: View {
    let text: String
    var kind: TagKind = .neutral
    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .padding(.horizontal, 9).padding(.vertical, 4)
            .foregroundStyle(fg)
            .background(bg, in: Capsule())
            .overlay(Capsule().stroke(stroke, lineWidth: 1))
    }
    private var fg: Color {
        switch kind {
        case .category: Tok.text
        case .free: Tok.freeFg
        case .neutral: Tok.muted
        }
    }
    private var bg: Color { kind == .neutral ? Tok.panel2 : .clear }
    private var stroke: Color {
        switch kind {
        case .category: Tok.hairline
        case .free: Tok.freeFg
        case .neutral: .clear
        }
    }
}
