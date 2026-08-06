import SwiftUI

// MARK: - Client-side range matching
//
// On iPad the feed is always fetched with `range = .all` so the sidebar can show
// a live count for every WHEN row at once. The rows then filter locally.

extension EventService.Range {
    // Bucketed in the device's timezone so "today" and "this weekend" mean
    // the user's, whether they opened the app in Truro or in Thurso.
    fileprivate static let deviceCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        return c
    }()

    /// True when `date` falls inside this range. Undated events only survive `.all`.
    func matches(_ date: Date?, now: Date = .now) -> Bool {
        if self == .all { return true }
        guard let date else { return false }
        let cal = Self.deviceCalendar
        let today = cal.startOfDay(for: now)
        switch self {
        case .all:
            return true
        case .today:
            return cal.isDate(date, inSameDayAs: now)
        case .week:
            guard let end = cal.date(byAdding: .day, value: 7, to: today) else { return false }
            return date >= today && date < end
        case .weekend:
            let weekday = cal.component(.weekday, from: now) - 1      // 0 = Sunday
            let offset = weekday == 0 ? 0 : (6 - weekday + 7) % 7      // days until Saturday
            guard let saturday = cal.date(byAdding: .day, value: offset, to: today),
                  let monday = cal.date(byAdding: .day, value: weekday == 0 ? 1 : 2, to: saturday)
            else { return false }
            return date >= saturday && date < monday
        }
    }
}

extension EventService.Sort {
    /// Local re-sort. The server sorts too, but sorting in-place keeps the iPad
    /// segmented control instant instead of costing a network round-trip.
    func apply(_ events: [Event]) -> [Event] {
        switch self {
        case .nearest:
            return events.sorted {
                ($0.distanceKm ?? .greatestFiniteMagnitude) < ($1.distanceKm ?? .greatestFiniteMagnitude)
            }
        case .soonest:
            return events.sorted { ($0.startDate ?? .distantFuture) < ($1.startDate ?? .distantFuture) }
        }
    }
}

// MARK: - Sidebar primitives (HANDOFF.md §6.9)

/// A sidebar row: 42pt tall inside a 44pt hit area, leading icon or colour dot,
/// title, and an optional live count badge.
struct SideRow: View {
    var icon: String? = nil
    var dot: Color? = nil
    let title: String
    var count: Int? = nil
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 11) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 15.5, weight: .semibold))
                        .frame(width: 20)
                } else if let dot {
                    Circle().fill(dot).frame(width: 9, height: 9).frame(width: 20)
                }
                Text(title)
                    .font(.system(size: 15, weight: active ? .bold : .semibold))
                    .lineLimit(1)
                Spacer(minLength: 6)
                if let count {
                    CountBadge(count: count, active: active)
                }
            }
            .foregroundStyle(active ? Tok.activeFg : Tok.text)
            .padding(.horizontal, 12)
            .frame(height: 42)
            .frame(maxWidth: .infinity)
            .background(active ? Tok.activeBg : Color.clear, in: RoundedRectangle(cornerRadius: 11))
            .contentShape(RoundedRectangle(cornerRadius: 11))
            .padding(.vertical, 1)      // 42 + 2 gives the 44pt minimum target
        }
        .buttonStyle(.plain)
        .accessibilityLabel(count == nil ? title : "\(title), \(count!) events")
    }
}

struct CountBadge: View {
    let count: Int
    var active: Bool = false
    var body: some View {
        Text("\(count)")
            .font(.system(size: 12, weight: .bold))
            .monospacedDigit()
            .foregroundStyle(active ? Tok.activeFg : Tok.muted)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(active ? Tok.activeFg.opacity(0.24) : Tok.panel2, in: Capsule())
    }
}

struct SidebarSectionHeader: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .heavy))
            .kerning(0.8)
            .foregroundStyle(Tok.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.bottom, 6)
    }
}

// MARK: - Grid card (HANDOFF.md §6.9, "adaptive grid")

struct IPadEventCard: View {
    let event: Event
    var highlighted: Bool = false
    @EnvironmentObject var app: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            cover
            VStack(alignment: .leading, spacing: 6) {
                Text(event.title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Tok.text)
                    // Always reserve both lines so a one-line title doesn't make
                    // its card shorter than its row neighbours.
                    .lineLimit(2, reservesSpace: true)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(Fmt.time(event.startDate)) · \(event.venue ?? "Venue TBA")")
                    .font(.system(size: 13.5))
                    .foregroundStyle(Tok.muted)
                    .lineLimit(1)
                tags
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.top, 12)
            .padding(.bottom, 14)
        }
        // Fill the grid row's height so every card in a row draws the same box,
        // instead of short cards floating with a ragged bottom edge.
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(highlighted ? Tok.accent : Tok.hairline, lineWidth: highlighted ? 2 : 1)
        )
        .shadow(color: .black.opacity(0.07), radius: 8, y: 3)
        .contentShape(RoundedRectangle(cornerRadius: 16))
    }

    private var cover: some View {
        let when = Fmt.when(event.startDate)
        let glyph = CategoryGlyph(category: event.category, size: 36)
        // The flat wash has no intrinsic size, so it is what decides the media
        // box rather than the remote photo. The image sits in an overlay, which is sized by
        // its parent, so a large `scaledToFill` photo can no longer widen the
        // card past its grid column (which made cards bleed into each other and
        // off the right edge in the two-column portrait layout).
        return Categories.wash(event.category)
            .frame(maxWidth: .infinity)
            .frame(height: 150)
            .overlay {
                if let img = event.image, let url = URL(string: img) {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image { image.resizable().aspectRatio(contentMode: .fill) }
                        else { glyph }
                    }
                } else {
                    glyph
                }
            }
            // Clip the media (and any oversized photo) before the bookmark is
            // added, so the button can still overhang the bottom edge.
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(alignment: .topLeading) {
            Text(when.text.uppercased())
                .font(.system(size: 10, weight: .bold)).kerning(0.7).foregroundStyle(.white)
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(Color.black.opacity(0.72), in: Capsule())
                .padding(10)
        }
        .overlay(alignment: .topTrailing) {
            Text(Fmt.distance(event.distanceKm))
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(Color.black.opacity(0.72), in: Capsule())
                .padding(10)
        }
        .overlay(alignment: .bottomTrailing) {
            Button { app.toggleSave(event) } label: {
                Image(systemName: app.isSaved(event) ? "bookmark.fill" : "bookmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(app.isSaved(event) ? .white : Tok.text)
                    .frame(width: 44, height: 44)
                    .background(app.isSaved(event) ? Tok.accent : Tok.panel, in: Circle())
                    .shadow(color: .black.opacity(0.22), radius: 5, y: 2)
            }
            .buttonStyle(.plain)
            .padding(.trailing, 10)
            .offset(y: 22)
            .accessibilityLabel(app.isSaved(event) ? "Remove from saved" : "Save event")
        }
        .padding(.bottom, 10)   // room for the bookmark to overhang
    }

    private var tags: some View {
        HStack(spacing: 6) {
            TagChip(text: event.category, kind: .category)
            TagChip(text: Fmt.relDay(event.startDate), kind: .neutral)
            if event.isFree && event.category != "Free" { TagChip(text: "Free", kind: .free) }
            if let p = event.price, !p.isEmpty, !event.isFree { TagChip(text: p, kind: .neutral) }
        }
        .padding(.top, 2)
    }
}
