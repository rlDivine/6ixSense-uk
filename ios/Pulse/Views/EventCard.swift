import SwiftUI

/// The most-used component (HANDOFF.md §4.1): image thumbnail + date badge,
/// body, and a right rail with bookmark · distance · source.
struct EventCard: View {
    let event: Event
    @EnvironmentObject var app: AppState

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            thumb
            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(.system(size: 15.5, weight: .semibold))
                    .lineLimit(2)
                    .foregroundStyle(Tok.text)
                Text("\(Fmt.time(event.startDate)) · \(event.venue ?? "Venue TBA")")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Tok.muted)
                    .lineLimit(1)
                tags
            }
            Spacer(minLength: 4)
            rail
        }
        .padding(10)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
    }

    private var thumb: some View {
        let badge = Fmt.badge(event.startDate)
        // Centered glyph/image, with the date badge pinned to the top-left corner.
        return ZStack {
            Categories.wash(event.category)
            if let img = event.image, let url = URL(string: img) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { CategoryGlyph(category: event.category, size: 22) }
                }
            } else {
                CategoryGlyph(category: event.category, size: 22)
            }
        }
        .frame(width: 74, height: 74)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(alignment: .topLeading) {
            VStack(spacing: 0) {
                Text(badge.m).font(.system(size: 9, weight: .heavy)).foregroundStyle(Tok.accent)
                Text(badge.day).font(.system(size: 14, weight: .heavy)).foregroundStyle(.white)
            }
            .padding(.horizontal, 5).padding(.vertical, 2)
            .background(Color.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 7))
            .padding(4)
        }
    }

    private var tags: some View {
        HStack(spacing: 5) {
            TagChip(text: event.category, kind: .category)
            TagChip(text: Fmt.relDay(event.startDate), kind: .neutral)
            if event.isFree && event.category != "Free" { TagChip(text: "Free", kind: .free) }
            if let p = event.price, !p.isEmpty, !event.isFree { TagChip(text: p, kind: .neutral) }
        }
    }

    private var rail: some View {
        VStack(alignment: .trailing, spacing: 6) {
            Button { app.toggleSave(event) } label: {
                Image(systemName: app.isSaved(event) ? "bookmark.fill" : "bookmark")
                    .font(.system(size: 17))
                    .foregroundStyle(app.isSaved(event) ? Tok.accent : Tok.muted)
            }
            .buttonStyle(.plain)
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 2) {
                (Text(Fmt.km(event.distanceKm)).font(.system(size: 20, weight: .heavy))
                 + Text(" \(Fmt.distanceUnit)").font(.system(size: 11, weight: .semibold)).foregroundColor(Tok.muted))
                    .foregroundStyle(Tok.text)
                Text(event.source).font(.system(size: 10.5)).foregroundStyle(Tok.muted)
            }
        }
        .frame(minWidth: 52)
    }
}

enum TagKind { case category, neutral, free }

struct TagChip: View {
    let text: String
    var kind: TagKind = .neutral
    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .padding(.horizontal, 7).padding(.vertical, 3)
            .foregroundStyle(fg)
            .background(bg, in: RoundedRectangle(cornerRadius: 6))
    }
    private var fg: Color { switch kind { case .category: Tok.accent2; case .free: Tok.freeFg; case .neutral: Tok.muted } }
    private var bg: Color {
        switch kind {
        case .category: Tok.accent2.opacity(0.14)
        case .free: Tok.freeFg.opacity(0.16)
        case .neutral: Tok.chip
        }
    }
}
