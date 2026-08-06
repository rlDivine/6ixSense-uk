import SwiftUI

/// The most-used component. A row rather than a poster: thumbnail on the left,
/// then an overline saying when, the title, the venue, and a quiet footer of
/// category, distance, price and source.
///
/// The date used to sit in a badge stuck on the corner of the thumbnail and the
/// distance used to be a large number in its own column. Both competed with the
/// title for attention while telling you less than the overline does.
struct EventCard: View {
    let event: Event
    @EnvironmentObject var app: AppState

    var body: some View {
        HStack(alignment: .top, spacing: 13) {
            thumb
            VStack(alignment: .leading, spacing: 3) {
                when
                Text(event.title)
                    .font(.system(size: 16, weight: .semibold))
                    .kerning(-0.15)
                    .lineSpacing(1)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .foregroundStyle(Tok.text)
                Text(event.venue?.isEmpty == false ? event.venue! : app.placeName)
                    .font(.system(size: 13))
                    .foregroundStyle(Tok.muted)
                    .lineLimit(1)
                footer
            }
            Spacer(minLength: 0)
            bookmark
        }
        .padding(12)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Tok.hairline, lineWidth: 1))
    }

    /// "Today, 19:00" in the accent, "Sat, 8 Aug, 19:00" in the quiet grey.
    /// Imminence is the one thing in a list worth colouring.
    private var when: some View {
        let w = Fmt.when(event.startDate)
        return Text(w.text.uppercased())
            .font(.system(size: 10.5, weight: .bold))
            .kerning(0.8)
            .foregroundStyle(w.soon ? Tok.accent : Tok.faint)
            .lineLimit(1)
    }

    private var thumb: some View {
        ZStack {
            Categories.wash(event.category)
            CategoryGlyph(category: event.category, size: 22).opacity(0.75)
            // The photo sits on top of the mark, so a URL that fails to load
            // leaves the mark showing rather than an empty square.
            if let img = event.image, let url = URL(string: img) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { Color.clear }
                }
            }
        }
        .frame(width: 78, height: 78)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    /// Category, distance, price and source, separated by dots. Quiet by
    /// design: it is reference detail, not something to scan.
    private var footer: some View {
        HStack(spacing: 6) {
            HStack(spacing: 5) {
                Circle()
                    .fill(Categories.style(event.category).color)
                    .frame(width: 6, height: 6)
                Text(event.category)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Tok.muted)
            }
            if event.distanceKm != nil {
                separator
                Text(Fmt.distance(event.distanceKm)).font(.system(size: 11.5)).foregroundStyle(Tok.faint)
            }
            if event.isFree {
                separator
                Text("Free").font(.system(size: 11.5, weight: .bold)).foregroundStyle(Tok.accent)
            } else if let p = event.price, !p.isEmpty {
                separator
                Text(p).font(.system(size: 11.5)).foregroundStyle(Tok.faint)
            }
            separator
            Text(event.source).font(.system(size: 11.5)).foregroundStyle(Tok.faint).lineLimit(1)
        }
        .padding(.top, 4)
    }

    private var separator: some View {
        Circle().fill(Tok.faint).frame(width: 2, height: 2).opacity(0.7)
    }

    private var bookmark: some View {
        Button { app.toggleSave(event) } label: {
            Image(systemName: app.isSaved(event) ? "bookmark.fill" : "bookmark")
                .font(.system(size: 16))
                .foregroundStyle(app.isSaved(event) ? Tok.accent : Tok.faint)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(app.isSaved(event) ? "Remove from saved" : "Save event")
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
        case .free: Tok.accent
        case .neutral: Tok.muted
        }
    }
    private var bg: Color { kind == .neutral ? Tok.panel2 : .clear }
    private var stroke: Color {
        switch kind {
        case .category: Tok.hairline
        case .free: Tok.accent
        case .neutral: .clear
        }
    }
}
